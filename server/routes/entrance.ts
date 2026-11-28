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
 *   POST   /api/entrance/code                   the 6-digit code: proves the address (and signs in an
 *                                               address that already has an account)
 *   POST   /api/entrance/code/resend            a new code, 30 seconds after the last
 *   GET    /api/admin/entrance/entries          the list, newest first (`?updates=1`: only those
 *                                               who asked for updates)
 *   GET    /api/admin/entrance/entries.csv      the same, as a spreadsheet
 *   DELETE /api/admin/entrance/entries?email=   forget one person's entries, on their request
 *   POST   /api/admin/entrance/entries/:id/invite  "Invite to join": the platform's own invitation link
 *                                               for a verified visitor with no account, shown once to
 *                                               copy; nothing is emailed
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
import { domainOf, isDisposable } from "../../shared/emailCheck";
import { sameAddress, endUnprovenPassword, proveAddress } from "../lib/emailVerification";
import { holdsUnprovenPassword, isUnclaimable } from "../lib/oauthAccounts";
import { codeMatches, domainTakesMail, hashCode, makeCode, sendCodeLetter, type CodeLetterDeps, type MailLookup } from "../lib/entranceCode";
import { codesSentTo, countWrongTry, deletePortalCodesFor, insertPortalCode, latestPortalCode, takePortalCode } from "../repos/portalCodes";
import { CODE_TRIES, CODE_TTL_MS, KEEP_IN_TOUCH_PARAM, LOOK_GRACE_MS, RESEND_AFTER_MS, backdropOf, cleanCode, type LookStatus } from "../../shared/entrance";
import { EVENT_PASS_COOKIE, ENTRIES_PER_HOUR, isInterest, isUpdatesAnswer, LINK_MAX, MIN_FILL_MS, parseEntrance, roleSlugOf, safeNext, type EntranceStatus, type PortalEntry } from "../../shared/entrance";
import { ipBucket } from "../../shared/openProposals";
import { ensureContact } from "../lib/comms/contacts";
import { carriesPass, cookieValue, entranceMiddleware, entrancePasses, entryChecker, entryCookieHeader, eventPassCookieHeader, fallbackHuman, readEntry, readEventPass, signEntry, useEventPassSecret, verifyTurnstile, type HumanVerdict } from "../lib/entrance";
import { isSmokeSubmission, SMOKE_HEADER } from "../lib/smokeTest";
import { registerJob } from "../lib/scheduler";
import { entryLook, markEntryInvited, markEntryVerified, type EntryLook } from "../repos/portalEntries";
import { makeInvite } from "./invites";
import { registerVisitor } from "./visitorProfile";
import { deleteVisitorAt, latestVerifiedEntry } from "../repos/portalVisitors";
import { INVITE_DAYS, invitePath } from "../lib/invites";
import { deletePortalEntriesFor, insertPortalEntry, insertPortalView, journeysFor, listPortalEntries, markPortalSync, portalEmailsFor, portalEntryById, portalEntryExists, setUpdatesAnswer, sweepPortalViews, unsyncedOptedIn, viewsFor } from "../repos/portalEntries";
import { brevoOn, removeFromBrevo, syncToBrevo, type BrevoDeps } from "../lib/portalSync";
import { csvCell } from "./commsPeople";
import { languageForAddress } from "../lib/mailLanguage";

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
  /**
   * The code's letter, through the one mail door (`sendResendEmail`, an essential email). `ready`
   * is whether the village can send email at all; without it the entrance asks for no code.
   */
  mail: CodeLetterDeps & { ready(): boolean; origin?(): string };
  /** The roles by id, for naming a visitor's applications (server/routes/visitorProfile.ts). */
  roleNames?(): Promise<Map<string, string>>;
  /** The accounts, for an address that already has one: a correct code signs it in, never a second account. */
  accounts: {
    byEmail(email: string): Promise<any | null>;
    update(id: string, mutate: (m: any) => void): Promise<any | null>;
    encodeToken(userId: string, email: string, tokenVersion: number): string;
    publicUser(u: any): any;
    /** Ends agent reach on both sides of a change that ends an unproved password (R104). */
    endReachAround<T>(userId: string, change: () => Promise<T>): Promise<T>;
    recordAudit(text: string, userId: string): void;
    /** A visitor promoted to member (server/routes/visitorProfile.ts): their new account. */
    add?(member: any): Promise<any>;
    makeHandle?(name: string): Promise<string>;
    /** A new member arrived: records the join and greets, as every door in does. Never rejects. */
    joined?(member: any): void;
  };
  /** DNS, swapped in tests. */
  mailLookup?: MailLookup;
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

/** What the entrance hands the routes after it: the gate's own answer for a write (`entrancePasses`). */
export interface EntranceHandle {
  passes(req: Request): Promise<boolean>;
}

export function register(app: Express, deps: EntranceRouteDeps): EntranceHandle {
  const now = deps.now ?? (() => Date.now());
  const { guardCapability } = deps;
  const lookMs = () => Math.max(1, Math.floor(deps.numberVar("entrance.look_minutes") || 3)) * 60 * 1000;
  const lookPages = () => Math.max(1, Math.floor(deps.numberVar("entrance.look_pages") || 3));
  /** Where an entry stands, for the gate: the server's half of the short look. */
  const stateOf = (e: EntryLook): "in" | "look" | "code" => {
    if (!e.codeRequired || e.verified) return "in";
    const over = now() - e.createdAt > lookMs() + LOOK_GRACE_MS || e.views > lookPages();
    return over ? "code" : "look";
  };
  /** This device's own entry id, from its signed cookie, or null. */
  const ownEntry = (req: Request): string | null => readEntry(deps.secret, cookieValue(req), now());
  const entered = entryChecker({
    secret: deps.secret,
    entryState: async (id) => {
      const e = await entryLook(deps.getPool(), id);
      return e ? stateOf(e) : null;
    },
    now,
  });
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
  const gateDeps = { boolVar: deps.boolVar, authedUser: deps.authedUser, isAgent: deps.isAgent, passToken: deps.passToken, eventPassFor };
  app.use(entranceMiddleware(gateDeps, entered));
  const handle: EntranceHandle = { passes: entrancePasses(gateDeps, entered) };
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
    let look: LookStatus | null = null;
    if (!passed) {
      const state = await entered(req).catch(() => false as const);
      passed = visitor = state !== false;
      const id = state === "look" || state === "code" ? ownEntry(req) : null;
      const e = id ? await entryLook(deps.getPool(), id) : null;
      if (e && e.codeRequired && !e.verified) look = { needsCode: true, startedAt: e.createdAt, pages: e.views, lookMs: lookMs(), lookPages: lookPages(), sentTo: e.email };
    }
    const privacyContact = deps.stringVar("entrance.privacy_contact").trim();
    const backdrop = backdropOf(deps.stringVar("entrance.background_video"), deps.stringVar("entrance.background_video_mobile"), deps.stringVar("entrance.background_poster"));
    let verified = false;
    if (visitor) {
      const own = ownEntry(req);
      const e = own ? await entryLook(deps.getPool(), own) : null;
      verified = !!e && e.verified && !e.isTest;
    }
    const body: EntranceStatus = { required, entered: passed, siteKey: siteKey(), eventPass: passed ? null : eventPassFor(req), visitor, look, privacyContact, backdrop, codes: deps.mail.ready(), verifiedVisitor: verified };
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
    // The instant checks: a throwaway inbox, and a domain that receives no mail at all.
    if (!smoke && isDisposable(v.email)) return res.status(400).json({ error: "invalid", field: "email", message: "That looks like a throwaway inbox. Use an address you read, so we can reach you." });
    if (!smoke && (await domainTakesMail(domainOf(v.email), deps.mailLookup)) === "no") {
      return res.status(400).json({ error: "invalid", field: "email", message: "That email domain does not receive mail. Check the part after the @." });
    }
    // A code only while the village can send one, and never for a release smoke.
    const wantsCode = !smoke && deps.mail.ready();

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
      codeRequired: wantsCode,
    });
    res.setHeader("Set-Cookie", entryCookieHeader(signEntry(deps.secret, id, now()), secureOf(req)));
    let code: { sentTo: string } | null = null;
    if (wantsCode) {
      const sent = await sendNewCode(id, v.email, locale);
      // A letter the provider would not take is no reason to stop a person at the door: the entry
      // stands, and the code step offers to send again.
      code = { sentTo: v.email };
      if (!sent) console.warn(`[entrance] the code for ${id} was not sent; the visitor can ask again`);
    }
    res.status(201).json({ ok: true, next, code });
  });

  /** A fresh code for an entry, to its address: hashed, kept, sent. Answers whether the letter went. */
  async function sendNewCode(entryId: string, email: string, requestLocale: string | null = null): Promise<boolean> {
    const pool = deps.getPool();
    const existing = await deps.accounts.byEmail(email).catch(() => null);
    const account = existing && sameAddress(existing.email, email) && !isUnclaimable(existing) ? existing : null;
    const code = makeCode();
    await insertPortalCode(pool, {
      id: `pc-${crypto.randomBytes(10).toString("hex")}`,
      entryId,
      userId: account ? String(account.id) : null,
      emailKey: emailKeyOf(email),
      codeHash: hashCode(deps.secret, entryId, code),
      expiresAt: new Date(now() + CODE_TTL_MS),
      at: new Date(now()),
    });
    // In the reader's language: theirs if they are a member, the address book's, the site's as they asked, the village's.
    const lang = await languageForAddress(pool, email, { member: account, request: requestLocale });
    const mail = await sendCodeLetter(deps.mail, email, code, !!account, lang);
    return mail.sent;
  }

  /** On a proved address, a yes reaches the address book and the email list. */
  async function listIfYes(entryId: string): Promise<void> {
    const entry = await portalEntryById(deps.getPool(), entryId);
    if (!entry || entry.isTest || entry.updates !== "yes") return;
    await ensureContact({ getPool: deps.getPool }, { email: entry.email, name: entry.name, source: "portal", locale: entry.locale }).catch(() => null);
    if (brevoOn(deps.brevo) && !entry.syncedAt) void syncOne(entry);
  }

  /**
   * Take a typed code for an entry: the code rules (15 minutes, 5 tries, single use), then the
   * address is proved on the entry, an account already at that address is signed in (never a second
   * one made), and a yes reaches the lists. The entrance's own step and a visitor signing back in
   * (server/routes/visitorProfile.ts) both come through here.
   */
  async function redeemCode(id: string, typed: string): Promise<{ ok: true; signedIn: { token: string; user: unknown } | null } | { ok: false; status: number; body: Record<string, unknown> }> {
    const pool = deps.getPool();
    const e = await entryLook(pool, id);
    if (!e) return { ok: false, status: 401, body: { error: "entrance_required", message: "Enter the portal first." } };
    const c = await latestPortalCode(pool, id);
    const spent = (why: string) => ({ ok: false as const, status: 410, body: { error: "code_spent", message: why } });
    if (!c || c.usedAt) return spent("That code has been used. Ask for a new one.");
    if (c.expiresAt <= now()) return spent("That code has run out. Ask for a new one.");
    if (c.attempts >= CODE_TRIES) return spent("Too many wrong tries for this code. Ask for a new one.");
    if (!codeMatches(deps.secret, id, typed, c.codeHash)) {
      const tries = await countWrongTry(pool, c.id);
      if (tries >= CODE_TRIES) return spent("Too many wrong tries for this code. Ask for a new one.");
      const left = CODE_TRIES - tries;
      return { ok: false, status: 400, body: { error: "wrong_code", message: left === 1 ? "That code is not right. One more try, then you will need a new one." : `That code is not right. ${left} more tries.` } };
    }
    if (!(await takePortalCode(pool, c.id, new Date(now())))) return spent("That code has been used. Ask for a new one.");

    // The address is proved. An account at this address is signed in; nobody else gets one.
    let signedIn: { token: string; user: unknown } | null = null;
    let userId: string | null = null;
    if (c.userId) {
      const account = await deps.accounts.byEmail(e.email).catch(() => null);
      if (account && String(account.id) === c.userId && sameAddress(account.email, e.email) && !isUnclaimable(account)) {
        let gone = false;
        let ended = false;
        const write = () =>
          deps.accounts.update(String(account.id), (u: any) => {
            if ((gone = isUnclaimable(u))) return;
            // The mailbox's own power (R104): a password nobody proved ends, as a Google sign-in ends it.
            ended = endUnprovenPassword(u);
            proveAddress(u, e.email);
          });
        const saved = holdsUnprovenPassword(account) ? await deps.accounts.endReachAround(String(account.id), write) : await write();
        if (saved && !gone) {
          userId = String(saved.id);
          if (ended) deps.accounts.recordAudit("auth:entrance-code-ended-unproven-password", userId);
          deps.accounts.recordAudit("auth:entrance-code-sign-in", userId);
          signedIn = { token: deps.accounts.encodeToken(userId, String(saved.email), Number(saved.tokenVersion ?? 0)), user: deps.accounts.publicUser(saved) };
        }
      }
    }
    await markEntryVerified(pool, id, new Date(now()), userId);
    await listIfYes(id);
    return { ok: true, signedIn };
  }

  app.post("/api/entrance/code", async (req, res) => {
    if (await deps.overLimit(`entrance-code:${ipBucket(deps.clientIp(req))}`, 30, 60 * 60 * 1000)) {
      return res.status(429).json({ error: "slow_down", message: "Too many tries from this connection. Try again in an hour." });
    }
    const id = ownEntry(req);
    if (!id) return res.status(401).json({ error: "entrance_required", message: "Enter the portal first." });
    const typed = cleanCode(req.body?.code);
    if (!typed) return res.status(400).json({ error: "invalid", message: "The code is 6 digits." });
    const r = await redeemCode(id, typed);
    if (!r.ok) return res.status(r.status).json(r.body);
    res.json({ ok: true, ...(r.signedIn ?? {}) });
  });

  app.post("/api/entrance/code/resend", async (req, res) => {
    const id = ownEntry(req);
    if (!id) return res.status(401).json({ error: "entrance_required", message: "Enter the portal first." });
    const pool = deps.getPool();
    const e = await entryLook(pool, id);
    if (!e) return res.status(401).json({ error: "entrance_required", message: "Enter the portal first." });
    if (!e.codeRequired || e.verified) return res.json({ ok: true, already: true });
    if (!deps.mail.ready()) return res.status(503).json({ error: "mail_unavailable", message: "We cannot send email right now. Try again later." });
    const last = await latestPortalCode(pool, id);
    if (last && now() - last.createdAt < RESEND_AFTER_MS) {
      return res.status(429).json({ error: "too_soon", message: "Give the first code a moment to arrive, then ask again." });
    }
    if (
      (await deps.overLimit(`entrance-resend:${ipBucket(deps.clientIp(req))}`, 20, 60 * 60 * 1000)) ||
      (await codesSentTo(pool, e.emailKey, new Date(now() - 60 * 60 * 1000))) >= 6
    ) {
      return res.status(429).json({ error: "slow_down", message: "That is a lot of codes for one hour. Try again later." });
    }
    const sent = await sendNewCode(id, e.email, e.locale);
    res.json({ ok: true, sent });
  });


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
    // An address waiting on its code reaches no list yet; the code, when it comes, sends it on.
    if (answer === "yes" && !entry.isTest && (entry.verifiedAt || !entry.codeRequired)) {
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
    const head = ["entered_at", "name", "email", "whatsapp", "link", "drawn_by", "keep_in_touch", "address_verified", "on_email_list", "applications", "has_account", "is_member", "forms_sent", "first_asked_for", "pages_opened", "roles_opened", "language"];
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
          e.verifiedAt ? "yes" : e.codeRequired ? "no" : "not_checked",
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
    await deletePortalCodesFor(deps.getPool(), key);
    await deleteVisitorAt(deps.getPool(), key);
    const removed = await deletePortalEntriesFor(deps.getPool(), key);
    res.json({ ok: true, removed, ...(listProblem ? { listProblem } : {}) });
  });

  // "Invite to join" (the lead, 24 Nov 2026: visitors hold no accounts; one click makes them a member's
  // invitation). The platform's own link, made on the admin's own vouch exactly as POST /api/invites
  // makes it, recorded against the entry, and shown once for the admin to copy and send themselves.
  app.post("/api/admin/entrance/entries/:id/invite", async (req, res) => {
    if (!(await guardCapability(req, res, "intake.moderate"))) return;
    if (!(await guardCapability(req, res, "member.vouch"))) return;
    const user = await deps.authedUser(req);
    if (!user) return res.status(401).json({ error: "auth_required" });
    const entry = await portalEntryById(deps.getPool(), String(req.params.id ?? ""));
    if (!entry || entry.isTest) return res.status(404).json({ error: "not_found", message: "There is no visitor by that entry." });
    if (!entry.verifiedAt) return res.status(409).json({ error: "not_verified", message: "Only a visitor whose address is verified can be invited." });
    if (await deps.accounts.byEmail(entry.email).catch(() => null)) {
      return res.status(409).json({ error: "has_account", message: "This address already has an account. Use Make member instead." });
    }
    const made = await makeInvite(deps.getPool(), String(user.id), Number(user.tokenVersion ?? 0));
    if (!made.ok) return res.status(made.status).json({ error: made.error, message: made.error });
    await markEntryInvited(deps.getPool(), entry.id, made.id);
    res.json({ ok: true, path: invitePath(made.token), expiresInDays: INVITE_DAYS });
  });

  // A visitor's own profile, sign-in by code, and the invitation requests (server/routes/visitorProfile.ts).
  registerVisitor(app, {
    getPool: deps.getPool,
    secret: deps.secret,
    now,
    clientIp: deps.clientIp,
    overLimit: deps.overLimit,
    guardCapability,
    authedUser: deps.authedUser,
    secureOf,
    ownEntry,
    mailReady: () => deps.mail.ready(),
    sendNewCode,
    redeemCode,
    listIfYes,
    brevo: deps.brevo,
    roleNames: () => (deps.roleNames ? deps.roleNames() : Promise.resolve(new Map())),
    accounts: { byEmail: deps.accounts.byEmail, update: deps.accounts.update, add: deps.accounts.add, makeHandle: deps.accounts.makeHandle, joined: deps.accounts.joined },
    sendEmail: deps.mail.sendEmail,
    escapeHtml: deps.mail.escapeHtml,
    projectName: deps.mail.projectName,
    origin: () => (deps.mail.origin ? deps.mail.origin() : ""),
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

  return handle;
}


/**
 * "Continue with Google" from the entrance, at an address with no account (server/routes/authGoogle.ts
 * calls this): a portal entry already proved by Google, its cookie, and the page to land on with
 * the keep-in-touch question waiting there. Makes no account.
 */
export function portalGoogleVisitor(deps: { getPool(): Pool; secret: string; now?: () => number }) {
  const now = deps.now ?? (() => Date.now());
  return async (v: { name: string; email: string; next: string | null; secure: boolean }): Promise<{ cookie: string; next: string }> => {
    const next = safeNext(v.next) ?? "/";
    // A visitor who has been here before (0434): Google signs them back in to the profile they have,
    // on the page they asked for (or their profile, from the sign-in page), with no new entry.
    const known = await latestVerifiedEntry(deps.getPool(), emailKeyOf(v.email));
    if (known) {
      const landing = next === "/" || next === "/profile" || next.startsWith("/login") ? "/visitor" : next;
      return { cookie: entryCookieHeader(signEntry(deps.secret, known.id, now()), v.secure), next: landing };
    }
    const id = `pe-${crypto.randomBytes(10).toString("hex")}`;
    await insertPortalEntry(deps.getPool(), {
      id,
      name: v.name.slice(0, 120),
      email: v.email,
      emailKey: emailKeyOf(v.email),
      whatsapp: null,
      link: null,
      consentWords: "Entered with Google from the portal entrance, under its privacy line.",
      nextPath: next,
      locale: null,
      human: "google",
      isTest: false,
      at: new Date(now()),
      interest: null,
      codeRequired: false,
      verifiedAt: new Date(now()),
    });
    const [path, hash = ""] = next.split("#");
    const landing = `${path}${path.includes("?") ? "&" : "?"}${KEEP_IN_TOUCH_PARAM}=1${hash ? `#${hash}` : ""}`;
    return { cookie: entryCookieHeader(signEntry(deps.secret, id, now()), v.secure), next: landing };
  };
}

/** Whether an address belongs to a visitor with a profile here (a verified portal entry), for Google's sign-in door. */
export function portalVisitorKnown(deps: { getPool(): Pool }) {
  return async (email: string): Promise<boolean> => !!(await latestVerifiedEntry(deps.getPool(), emailKeyOf(email)));
}
