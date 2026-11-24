/**
 * THE PORTAL ENTRANCE'S ROUTES (the contract is shared/entrance.ts, the gate and the cookie are
 * server/lib/entrance.ts, the SQL is server/repos/portalEntries.ts).
 *
 *   GET    /api/entrance                        whether this village keeps an entrance, whether this
 *                                               device has passed it, and the Turnstile site key
 *   POST   /api/entrance                        enter: the form, checked, kept, and the cookie set
 *   GET    /api/admin/entrance/entries          the list, newest first (`?updates=1`: only those
 *                                               who asked for updates)
 *   GET    /api/admin/entrance/entries.csv      the same, as a spreadsheet
 *   DELETE /api/admin/entrance/entries?email=   forget one person's entries, on their request
 *
 * `register` installs the gate as well, in front of every later route, which is why it is called
 * right after the people lock in server/index.ts.
 *
 * NO EMAIL, EVER. Nothing here sends a message to anybody, the visitor included. A visitor who ticks
 * "send me updates" is added to the village's address book with the source `portal` and no
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
import { ENTRIES_PER_HOUR, isInterest, LINK_MAX, MIN_FILL_MS, parseEntrance, safeNext, type EntranceStatus, type PortalEntry } from "../../shared/entrance";
import { ipBucket } from "../../shared/openProposals";
import { ensureContact } from "../lib/comms/contacts";
import { entranceMiddleware, entryChecker, entryCookieHeader, fallbackHuman, signEntry, verifyTurnstile, type HumanVerdict } from "../lib/entrance";
import { isSmokeSubmission, SMOKE_HEADER } from "../lib/smokeTest";
import { deletePortalEntriesFor, insertPortalEntry, journeysFor, listPortalEntries, markPortalSync, portalEmailsFor, portalEntryExists, unsyncedOptedIn } from "../repos/portalEntries";
import { brevoOn, removeFromBrevo, syncToBrevo, type BrevoDeps } from "../lib/portalSync";
import { csvCell } from "./commsPeople";

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
  /** The secret the entry cookie is signed under. */
  secret: string;
  clientIp(req: Request): string;
  overLimit(bucket: string, max: number, windowMs: number): Promise<boolean>;
  guardCapability(req: Request, res: Response, cap: Capability): Promise<boolean>;
  /** The village's email list (server/lib/portalSync.ts): the key from Integrations and the list's number. */
  brevo: BrevoDeps;
  now?: () => number;
}

const LIST_MAX = 5000;
const CONSENT_MAX = 2000;

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
  // The gate, in front of every route registered after this call.
  app.use(entranceMiddleware({ boolVar: deps.boolVar, authedUser: deps.authedUser }, entered));

  const siteKey = (): string | null => {
    const key = deps.stringVar("entrance.turnstile_site_key").trim();
    return key && deps.turnstileSecret() ? key : null;
  };

  app.get("/api/entrance", async (req, res) => {
    const required = deps.boolVar("entrance.required");
    let passed = !required;
    if (!passed) passed = !!(await deps.authedUser(req).catch(() => null)) || (await entered(req).catch(() => false));
    const body: EntranceStatus = { required, entered: passed, siteKey: siteKey() };
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
      updates: v.updates,
      consentWords,
      nextPath: next,
      locale,
      human: human.how,
      isTest: smoke,
      at: new Date(now()),
      interest: v.interest,
    });
    // The address book learns the address of somebody who asked for updates, and nothing more.
    if (v.updates && !smoke) {
      await ensureContact({ getPool: deps.getPool }, { email: v.email, name: v.name, source: "portal", locale }).catch(() => null);
      // And the village's email list, after the answer: the visitor never waits on Brevo.
      if (brevoOn(deps.brevo)) void syncOne({ id, email: v.email, name: v.name, interest: v.interest, whatsapp: v.whatsapp });
    }
    const secure = req.secure || String(req.headers["x-forwarded-proto"] ?? "").split(",")[0].trim() === "https";
    res.setHeader("Set-Cookie", entryCookieHeader(signEntry(deps.secret, id, now()), secure));
    res.status(201).json({ ok: true, next });
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

  // ── The admin half ────────────────────────────────────────────────────────

  const entriesFor = async (req: Request): Promise<PortalEntry[]> => {
    const interest = isInterest(req.query.interest) ? req.query.interest : null;
    const rows = await listPortalEntries(deps.getPool(), { limit: LIST_MAX, updatesOnly: req.query.updates === "1", interest });
    const journeys = await journeysFor(deps.getPool(), rows.map((e) => emailKeyOf(e.email)));
    return rows.map((e) => ({ ...e, journey: journeys.get(emailKeyOf(e.email)) }));
  };

  app.get("/api/admin/entrance/entries", async (req, res) => {
    if (!(await guardCapability(req, res, "intake.moderate"))) return;
    res.setHeader("Cache-Control", "no-store");
    res.json({ entries: await entriesFor(req), emailList: brevoOn(deps.brevo) });
  });

  app.get("/api/admin/entrance/entries.csv", async (req, res) => {
    if (!(await guardCapability(req, res, "intake.moderate"))) return;
    const rows = await entriesFor(req);
    const head = ["entered_at", "name", "email", "whatsapp", "link", "drawn_by", "wants_updates", "on_email_list", "applications", "has_account", "forms_sent", "was_going_to", "language"];
    const lines = [head.join(",")].concat(
      rows.map((e) =>
        [
          e.at,
          e.name,
          e.email,
          e.whatsapp ?? "",
          e.link ?? "",
          e.interest ?? "",
          e.updates ? "yes" : "no",
          e.syncedAt ? "yes" : "no",
          (e.journey?.applications ?? []).map((a) => a.status).join(" "),
          e.journey?.account ? "yes" : "no",
          (e.journey?.forms ?? []).map((f) => f.type).join(" "),
          e.nextPath ?? "",
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
