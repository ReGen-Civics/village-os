/**
 * THE PORTAL ENTRANCE'S ROUTES (the contract is shared/entrance.ts, the gate and the cookie are
 * server/lib/entrance.ts, the SQL is server/repos/portalEntries.ts).
 *
 *   GET    /api/entrance                        whether this village keeps an entrance, whether this
 *                                               device has passed it, and the Turnstile site key
 *   POST   /api/entrance                        enter: the form, checked, kept, and the cookie set
 *   POST   /api/entrance/updates                the keep-in-touch step: `yes` or `no`, for this
 *                                               device's own entry
 *   POST   /api/entrance/view                   a page an entered visitor opened (never a member's)
 *   GET    /api/admin/entrance/entries          the list, newest first (`?updates=1`: only those
 *                                               who asked for updates)
 *   GET    /api/admin/entrance/entries.csv      the same, as a spreadsheet
 *   DELETE /api/admin/entrance/entries?email=   forget one person's entries, on their request
 *
 * `register` installs the gate as well, in front of every later route, which is why it is called
 * right after the people lock in server/index.ts.
 *
 * NO EMAIL, EVER. Nothing here sends a message to anybody, the visitor included. A visitor who answers
 * yes to keeping in touch is added to the village's address book with the source `portal` and no
 * permission at all: the address book grants nothing by itself (server/lib/comms/contacts.ts), and
 * asking them to confirm a letters subscription stays a human act in Village Comms.
 *
 * The list is read through the one capability gate on `intake.moderate`, as the other public
 * queues are.
 */
import crypto from "node:crypto";
import type { Express, Request, Response } from "express";
import type { Pool } from "mysql2/promise";
import type { Capability } from "../../shared/capabilities";
import { emailKeyOf } from "../../shared/comms/address";
import { EVENT_PASS_COOKIE, ENTRIES_PER_HOUR, isInterest, isUpdatesAnswer, LINK_MAX, MIN_FILL_MS, parseEntrance, roleSlugOf, safeNext, type EntranceStatus, type PortalEntry } from "../../shared/entrance";
import { ipBucket } from "../../shared/openProposals";
import { ensureContact } from "../lib/comms/contacts";
import { carriesPass, cookieValue, entranceMiddleware, entryChecker, entryCookieHeader, eventPassCookieHeader, fallbackHuman, readEntry, readEventPass, signEntry, useEventPassSecret, verifyTurnstile, type HumanVerdict } from "../lib/entrance";
import { isSmokeSubmission, SMOKE_HEADER } from "../lib/smokeTest";
import { registerJob } from "../lib/scheduler";
import { deletePortalEntriesFor, insertPortalEntry, insertPortalView, journeysFor, listPortalEntries, markPortalSync, portalEmailsFor, portalEntryById, portalEntryExists, setUpdatesAnswer, sweepPortalViews, unsyncedOptedIn, viewsFor } from "../repos/portalEntries";
import { brevoOn, removeFromBrevo, syncToBrevo, type BrevoDeps } from "../lib/portalSync";
import { csvCell } from "./commsPeople";

export { ENTRANCE_PASS_CARD } from "../lib/entrance";
// Re-exported so server/index.ts takes the Integrations card and the page test (for the sitemap) on the same line as `register`.
export { TURNSTILE_CARD } from "../lib/entrance";
export { BREVO_CARD } from "../lib/portalSync";
export { pageBehindEntrance } from "../../shared/entrance";

export interface EntranceRouteDeps {
  getPool(): Pool;
  authedUser(req: Request): Promise<any | null>;
  boolVar(key: string): boolean;
  stringVar(key: string): string;
  /** The Turnstile secret from Admin, Integrations, or "" when none is set. */
  turnstileSecret(): string;
  /** A whole-number dial (`entrance.views_keep_days`). */
  numberVar(key: string): number;
  /** The secret the entry cookie is signed under. */
  secret: string;
  clientIp(req: Request): string;
  overLimit(bucket: string, max: number, windowMs: number): Promise<boolean>;
  guardCapability(req: Request, res: Response, cap: Capability): Promise<boolean>;
  /** The village's email list (server/lib/portalSync.ts): the key from Integrations and the list's number. */
  brevo: BrevoDeps;
  /** A live agent token (connector or API) in the Authorization header: its holder is a member. */
  isAgent(req: Request): Promise<boolean>;
  /** The entrance pass for our own automation, from Admin, Integrations, or "". */
  passToken(): string;
  now?: () => number;
}

const LIST_MAX = 5000;
const CONSENT_MAX = 2000;
const VIEW_PATH_MAX = 500;
const VIEWS_PER_HOUR = 600;

const PROBLEM_WORDS: Record<string, string> = {
  name: "Tell us your name.",
  email: "That email address does not look right.",
  whatsapp: "That WhatsApp number does not look right. Digits, spaces and a leading + are fine.",
  link: "That link does not look right. Paste a web address or a handle such as @yourname.",
};

const HUMAN_WORDS: Record<string, string> = {
  check_failed: "We could not confirm you are a person. Try the check again.",
  too_fast: "That was quicker than a person types. Take a breath and press Enter again.",
  check_unavailable: "The check that you are a person is not answering right now. Try again in a moment.",
};

export function register(app: Express, deps: EntranceRouteDeps): void {
  const now = deps.now ?? (() => Date.now());
  const { guardCapability } = deps;
  const entered = entryChecker({ secret: deps.secret, entryExists: (id) => portalEntryExists(deps.getPool(), id), now });
  // A gathering's invite link is signed under the same secret, wherever the link is written.
  useEventPassSecret(deps.secret);
  const eventPassFor = (req: Request): string | null => readEventPass(deps.secret, cookieValue(req, EVENT_PASS_COOKIE), now())?.eventId ?? null;
  // The pages visitors opened are kept `entrance.views_keep_days` (365 by default), then swept daily.
  registerJob("portal-views-sweep", 24 * 60 * 60 * 1000, async () => {
    const days = Math.max(1, Math.floor(deps.numberVar("entrance.views_keep_days") || 365));
    const n = await sweepPortalViews(deps.getPool(), new Date(now() - days * 24 * 60 * 60 * 1000));
    return `${n} page view(s) older than ${days} days`;
  });
  // The gate, in front of every route registered after this call.
  app.use(entranceMiddleware({ boolVar: deps.boolVar, authedUser: deps.authedUser, isAgent: deps.isAgent, passToken: deps.passToken, eventPassFor }, entered));
  const secureOf = (req: Request) => req.secure || String(req.headers["x-forwarded-proto"] ?? "").split(",")[0].trim() === "https";

  const siteKey = (): string | null => {
    const key = deps.stringVar("entrance.turnstile_site_key").trim();
    return key && deps.turnstileSecret() ? key : null;
  };

  app.get("/api/entrance", async (req, res) => {
    const required = deps.boolVar("entrance.required");
    let passed = !required;
    let visitor = false;
    if (!passed) passed = carriesPass(req, deps.passToken()) || !!(await deps.authedUser(req).catch(() => null)) || (await deps.isAgent(req).catch(() => false));
    if (!passed) passed = visitor = await entered(req).catch(() => false);
    const body: EntranceStatus = { required, entered: passed, siteKey: siteKey(), eventPass: passed ? null : eventPassFor(req), visitor };
    res.setHeader("Cache-Control", "no-store");
    res.json(body);
  });

  app.post("/api/entrance", async (req, res) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const parsed = parseEntrance(body);
    if (!parsed.ok) return res.status(400).json({ error: "invalid", field: parsed.problem, message: PROBLEM_WORDS[parsed.problem] });
    const v = parsed.value;
    const smoke = isSmokeSubmission(req.headers[SMOKE_HEADER], v.email);
    const ip = deps.clientIp(req);
    if (!smoke && (await deps.overLimit(`entrance:${ipBucket(ip)}`, ENTRIES_PER_HOUR, 60 * 60 * 1000))) {
      return res.status(429).json({ error: "slow_down", message: "Too many entries from this connection. Try again in an hour." });
    }
    let human: HumanVerdict;
    if (smoke) human = { ok: true, how: "smoke" };
    else if (siteKey()) human = await verifyTurnstile(deps.turnstileSecret(), String(body.turnstileToken ?? ""), ip || null);
    else human = fallbackHuman({ website: body.website, shownAt: body.shownAt }, MIN_FILL_MS, now());
    if (!human.ok) return res.status(human.why === "check_unavailable" ? 503 : 400).json({ error: human.why, message: HUMAN_WORDS[human.why] });

    const id = `pe-${crypto.randomBytes(10).toString("hex")}`;
    const next = safeNext(body.next);
    const consentWords = typeof body.consentWords === "string" ? body.consentWords.trim().slice(0, CONSENT_MAX) : "";
    const locale = typeof body.locale === "string" && /^[a-z]{2,3}(-[A-Za-z0-9]{2,8})?$/.test(body.locale) ? body.locale : null;
    await insertPortalEntry(deps.getPool(), {
      id,
      name: v.name,
      email: v.email,
      emailKey: emailKeyOf(v.email),
      whatsapp: v.whatsapp,
      link: v.link ? v.link.slice(0, LINK_MAX) : null,
      consentWords,
      nextPath: next,
      locale,
      human: human.how,
      isTest: smoke,
      at: new Date(now()),
      interest: v.interest,
    });
    res.setHeader("Set-Cookie", entryCookieHeader(signEntry(deps.secret, id, now()), secureOf(req)));
    res.status(201).json({ ok: true, next });
  });

  /** This device's own entry id, from its signed cookie, or null. */
  const ownEntry = (req: Request): string | null => readEntry(deps.secret, cookieValue(req), now());

  // The keep-in-touch step, its own screen after the entry: two buttons, and the latest answer stands.
  // Only a yes reaches the address book and the email list.
  app.post("/api/entrance/updates", async (req, res) => {
    const id = ownEntry(req);
    if (!id) return res.status(401).json({ error: "entrance_required", message: "Enter the portal first." });
    const answer = req.body?.answer;
    if (!isUpdatesAnswer(answer)) return res.status(400).json({ error: "invalid", message: "Answer yes or no." });
    const words = typeof req.body?.words === "string" ? req.body.words.trim().slice(0, CONSENT_MAX) : "";
    const entry = await portalEntryById(deps.getPool(), id);
    if (!entry) return res.status(401).json({ error: "entrance_required", message: "Enter the portal first." });
    await setUpdatesAnswer(deps.getPool(), id, answer, words);
    if (answer === "yes" && !entry.isTest) {
      // The address book learns the address, and nothing more.
      await ensureContact({ getPool: deps.getPool }, { email: entry.email, name: entry.name, source: "portal", locale: entry.locale }).catch(() => null);
      // And the village's email list, after the answer: the visitor never waits on Brevo.
      if (brevoOn(deps.brevo) && !entry.syncedAt) void syncOne(entry);
    }
    res.json({ ok: true, answer });
  });

  // A page an entered visitor opened. First-party, the path without its query, never a member's.
  app.post("/api/entrance/view", async (req, res) => {
    const id = ownEntry(req);
    if (!id || !deps.boolVar("entrance.required")) return res.status(204).end();
    if (await deps.authedUser(req).catch(() => null)) return res.status(204).end();
    const raw = typeof req.body?.path === "string" ? req.body.path : "";
    const path = safeNext(raw)?.split(/[?#]/)[0].slice(0, VIEW_PATH_MAX) ?? null;
    if (!path) return res.status(400).json({ error: "invalid", message: "Name the page." });
    if (await deps.overLimit(`entrance-view:${id}`, VIEWS_PER_HOUR, 60 * 60 * 1000)) return res.status(204).end();
    if (!(await portalEntryExists(deps.getPool(), id))) return res.status(204).end();
    await insertPortalView(deps.getPool(), { id: `pv-${crypto.randomBytes(10).toString("hex")}`, entryId: id, path, roleSlug: roleSlugOf(path), at: new Date(now()) });
    res.status(204).end();
  });

  /** One entry to the email list, its outcome written on the entry. Never throws. */
  async function syncOne(e: Pick<PortalEntry, "id" | "email" | "name" | "interest" | "whatsapp">): Promise<boolean> {
    try {
      const why = await syncToBrevo(deps.brevo, e);
      await markPortalSync(deps.getPool(), e.id, why ? { error: why } : { at: new Date(now()) });
      return !why;
    } catch {
      return false;
    }
  }
  // An invited guest's link (`/events?pass=`): the pass becomes a cookie for that one gathering,
  // so the calendar shows them their gathering and its RSVP. Nothing is kept about them here.
  app.post("/api/entrance/event-pass", async (req, res) => {
    if (await deps.overLimit(`entrance-event:${ipBucket(deps.clientIp(req))}`, 30, 60 * 60 * 1000)) {
      return res.status(429).json({ error: "slow_down", message: "Too many tries from this connection. Try again in an hour." });
    }
    const value = typeof req.body?.pass === "string" ? req.body.pass : "";
    const pass = readEventPass(deps.secret, value, now());
    if (!pass) return res.status(400).json({ error: "pass_invalid", message: "This invitation link has run out or is not ours. Enter the portal, or ask your host for a new one." });
    res.setHeader("Set-Cookie", eventPassCookieHeader(value, pass.exp, now(), secureOf(req)));
    res.json({ ok: true, eventId: pass.eventId });
  });

  // ── The admin half ────────────────────────────────────────────────────────

  const entriesFor = async (req: Request): Promise<PortalEntry[]> => {
    const interest = isInterest(req.query.interest) ? req.query.interest : null;
    const rows = await listPortalEntries(deps.getPool(), { limit: LIST_MAX, updatesOnly: req.query.updates === "1", interest });
    const journeys = await journeysFor(deps.getPool(), rows.map((e) => emailKeyOf(e.email)));
    const views = await viewsFor(deps.getPool(), rows.map((e) => e.id));
    return rows.map((e) => ({ ...e, journey: journeys.get(emailKeyOf(e.email)), views: views.get(e.id) ?? [] }));
  };

  app.get("/api/admin/entrance/entries", async (req, res) => {
    if (!(await guardCapability(req, res, "intake.moderate"))) return;
    res.setHeader("Cache-Control", "no-store");
    res.json({ entries: await entriesFor(req), emailList: brevoOn(deps.brevo) });
  });

  app.get("/api/admin/entrance/entries.csv", async (req, res) => {
    if (!(await guardCapability(req, res, "intake.moderate"))) return;
    const rows = await entriesFor(req);
    const head = ["entered_at", "name", "email", "whatsapp", "link", "drawn_by", "keep_in_touch", "on_email_list", "applications", "has_account", "is_member", "forms_sent", "first_asked_for", "pages_opened", "roles_opened", "language"];
    const lines = [head.join(",")].concat(
      rows.map((e) =>
        [
          e.at,
          e.name,
          e.email,
          e.whatsapp ?? "",
          e.link ?? "",
          e.interest ?? "",
          e.updates ?? "unanswered",
          e.syncedAt ? "yes" : "no",
          (e.journey?.applications ?? []).map((a) => a.status).join(" "),
          e.journey?.account ? "yes" : "no",
          e.journey?.account?.member ? "yes" : "no",
          (e.journey?.forms ?? []).map((f) => f.type).join(" "),
          e.nextPath ?? "",
          String(e.views?.length ?? 0),
          Array.from(new Set((e.views ?? []).map((w) => w.roleSlug).filter(Boolean))).join(" "),
          e.locale ?? "",
        ]
          .map(csvCell)
          .join(","),
      ),
    );
    const day = new Date(now()).toISOString().slice(0, 10);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="portal-visitors-${req.query.updates === "1" ? "updates-" : ""}${day}.csv"`);
    res.setHeader("Cache-Control", "no-store");
    res.send(lines.join("\r\n") + "\r\n");
  });

  app.delete("/api/admin/entrance/entries", async (req, res) => {
    if (!(await guardCapability(req, res, "intake.moderate"))) return;
    const email = typeof req.query.email === "string" ? req.query.email.trim() : "";
    if (!email) return res.status(400).json({ error: "Name the address to forget." });
    const key = emailKeyOf(email);
    // Off the email list first, while the entry still says which address reached it.
    const listed = await portalEmailsFor(deps.getPool(), key);
    const listProblem = await removeFromBrevo(deps.brevo, listed);
    const removed = await deletePortalEntriesFor(deps.getPool(), key);
    res.json({ ok: true, removed, ...(listProblem ? { listProblem } : {}) });
  });

  // Send everyone who asked for updates and has not reached the email list yet (a first setup, or a failed call).
  app.post("/api/admin/entrance/sync", async (req, res) => {
    if (!(await guardCapability(req, res, "intake.moderate"))) return;
    if (!brevoOn(deps.brevo)) return res.status(409).json({ error: "not_set_up", message: "Set the Brevo key under Integrations and the list's number in Game Mechanics first." });
    const waiting = await unsyncedOptedIn(deps.getPool(), 200);
    let sent = 0;
    for (const e of waiting) if (await syncOne(e)) sent += 1;
    res.json({ ok: true, waiting: waiting.length, sent });
  });
}
