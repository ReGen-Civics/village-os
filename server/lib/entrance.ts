/**
 * THE ENTRANCE, SERVER SIDE: the entry cookie, the gate in front of every route, and the human
 * check (the contract and the lists are shared/entrance.ts).
 *
 * ── THE GATE ────────────────────────────────────────────────────────────────
 *
 * `entranceMiddleware` sits in front of every route, installed right after the people lock and
 * for the same reason: a gate read per route is a gate every new route forgets. While the
 * village's dial `entrance.required` is on, a GET or HEAD to any `/api` path `OPEN_APIS` does not name, from a
 * caller who is neither signed in nor carrying a live entry cookie is refused with 401 and
 * `entrance_required`, except where `ENTRANCE_BROCHURE_KEYS` names the few keys a brochure page
 * needs from that read, which the visitor is answered with and nothing more. Writes pass: every write already asks who is writing, and an application
 * is posted from a form only an entered visitor could have read.
 *
 * ── THE COOKIE ──────────────────────────────────────────────────────────────
 *
 * `<entry id>.<expiry ms>.<HMAC-SHA256>` under a key derived from the auth secret, HttpOnly,
 * SameSite=Lax, Secure behind HTTPS, `ENTRY_DAYS` long. The signature proves the server wrote it;
 * the entry still being on record proves nobody has asked for it to be forgotten since
 * (`portalEntryExists`, remembered a few minutes per id so a busy page is not a query per call).
 *
 * ── THE HUMAN CHECK ─────────────────────────────────────────────────────────
 *
 * With a Turnstile site key in the dial and its secret in Admin, Integrations, the server asks
 * Cloudflare whether the answer the form carries is good, and refuses without one. Without both,
 * the honest fallback: a field no person sees must be empty, the form must have been on screen
 * for `MIN_FILL_MS`, and one connection may enter `ENTRIES_PER_HOUR` times an hour. That stops
 * scripts that post blind; it does not stop a person, and nothing claims it does.
 */
import crypto from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { guardedFetchJson } from "./toolcheck";
import { apiBehindEntrance, brochureKeysFor, ENTRANCE_PASS_HEADER, GATE_HINT_COOKIE, ENTRY_COOKIE, ENTRY_DAYS, EVENT_PASS_COOKIE, EVENT_PASS_DAYS, EVENT_PASS_PARAM } from "../../shared/entrance";

export const ENTRY_MS = ENTRY_DAYS * 24 * 60 * 60 * 1000;
const KNOWN_TTL_MS = 5 * 60 * 1000;

function keyOf(secret: string): Buffer {
  return crypto.createHmac("sha256", secret).update("village-os/portal-entry/v1").digest();
}

function mac(secret: string, id: string, exp: number): string {
  return crypto.createHmac("sha256", keyOf(secret)).update(`${id}.${exp}`).digest("base64url");
}

/** The cookie's value for one entry. */
export function signEntry(secret: string, id: string, now: number = Date.now()): string {
  const exp = now + ENTRY_MS;
  return `${id}.${exp}.${mac(secret, id, exp)}`;
}

/** The entry id a cookie value carries, when the signature holds and it has not run out. */
export function readEntry(secret: string, value: string | undefined | null, now: number = Date.now()): string | null {
  if (!value || value.length > 200) return null;
  const parts = value.split(".");
  if (parts.length !== 3) return null;
  const [id, expRaw, sig] = parts;
  if (!/^pe-[0-9a-f]{20}$/.test(id)) return null;
  const exp = Number(expRaw);
  if (!Number.isFinite(exp) || exp <= now) return null;
  const want = Buffer.from(mac(secret, id, exp));
  const got = Buffer.from(sig);
  if (want.length !== got.length || !crypto.timingSafeEqual(want, got)) return null;
  return id;
}

/** One cookie's value from the request's Cookie header. No parser is mounted for one cookie. */
export function cookieValue(req: Request, name: string = ENTRY_COOKIE): string | null {
  const header = req.headers.cookie;
  if (!header) return null;
  for (const part of header.split(";")) {
    const i = part.indexOf("=");
    if (i < 0) continue;
    if (part.slice(0, i).trim() === name) {
      try {
        return decodeURIComponent(part.slice(i + 1).trim());
      } catch {
        return null;
      }
    }
  }
  return null;
}

/** The Set-Cookie header for an entry. `secure` follows the request's own scheme. */
export function entryCookieHeader(value: string, secure: boolean): string {
  return `${ENTRY_COOKIE}=${encodeURIComponent(value)}; Max-Age=${Math.floor(ENTRY_MS / 1000)}; Path=/; HttpOnly; SameSite=Lax${secure ? "; Secure" : ""}`;
}

export interface EntranceGateDeps {
  boolVar(key: string): boolean;
  authedUser(req: Request): Promise<unknown | null>;
  /** A live agent token (connector or API) in the Authorization header. Its holder is a member. */
  isAgent?(req: Request): Promise<boolean>;
  /** The entrance pass our own automation carries (Admin, Integrations), or "" when none is set. */
  passToken?(): string;
  /** The gathering an invite's pass cookie opens for this request, or null. */
  eventPassFor?(req: Request): string | null;
}

/** The shortest pass a village may set; a shorter one is treated as no pass at all. */
export const PASS_MIN = 24;

/** Whether a request carries the village's entrance pass. Compared in constant time; a short or unset pass opens nothing. */
export function carriesPass(req: Request, token: string): boolean {
  const want = String(token ?? "");
  if (want.length < PASS_MIN) return false;
  const got = req.headers[ENTRANCE_PASS_HEADER];
  if (typeof got !== "string" || !got) return false;
  const a = crypto.createHash("sha256").update(got).digest();
  const b = crypto.createHash("sha256").update(want).digest();
  return crypto.timingSafeEqual(a, b);
}

// ── A gathering's pass (the lead, 24 Nov 2026): an invited guest reaches that one gathering ─────

const EVENT_PASS_MS = EVENT_PASS_DAYS * 24 * 60 * 60 * 1000;
let eventPassSecret: string | null = null;

/** Set once at boot by the entrance's routes, so a gathering's link can be signed wherever it is written. */
export function useEventPassSecret(secret: string): void {
  eventPassSecret = secret;
}

function eventMac(secret: string, eventId: string, exp: number): string {
  const key = crypto.createHmac("sha256", secret).update("village-os/event-pass/v1").digest();
  return crypto.createHmac("sha256", key).update(`${eventId}.${exp}`).digest("base64url");
}

/** A signed pass to one gathering, `<event id, base64url>.<expiry ms>.<signature>`. */
export function signEventPass(secret: string, eventId: string, now: number = Date.now()): string {
  const exp = now + EVENT_PASS_MS;
  return `${Buffer.from(eventId).toString("base64url")}.${exp}.${eventMac(secret, eventId, exp)}`;
}

/** The gathering a pass opens, when it is ours and has not run out. */
export function readEventPass(secret: string, value: string | null | undefined, now: number = Date.now()): { eventId: string; exp: number } | null {
  if (!value || value.length > 400) return null;
  const parts = value.split(".");
  if (parts.length !== 3) return null;
  let eventId = "";
  try {
    eventId = Buffer.from(parts[0], "base64url").toString("utf8");
  } catch {
    return null;
  }
  if (!/^[A-Za-z0-9_.:-]{1,128}$/.test(eventId)) return null;
  const exp = Number(parts[1]);
  if (!Number.isFinite(exp) || exp <= now) return null;
  const want = Buffer.from(eventMac(secret, eventId, exp));
  const got = Buffer.from(parts[2]);
  if (want.length !== got.length || !crypto.timingSafeEqual(want, got)) return null;
  return { eventId, exp };
}

/** The query a gathering's link carries, or "" before the entrance has booted (a test, a script). */
export function eventPassQuery(eventId: string, now: number = Date.now()): string {
  if (!eventPassSecret || !eventId) return "";
  return `?${EVENT_PASS_PARAM}=${encodeURIComponent(signEventPass(eventPassSecret, eventId, now))}`;
}

/** The Set-Cookie header for a gathering's pass; it lives as long as the pass does. */
export function eventPassCookieHeader(value: string, exp: number, now: number, secure: boolean): string {
  const maxAge = Math.max(0, Math.floor((exp - now) / 1000));
  return `${EVENT_PASS_COOKIE}=${encodeURIComponent(value)}; Max-Age=${maxAge}; Path=/; HttpOnly; SameSite=Lax${secure ? "; Secure" : ""}`;
}

/** Whether a gathering's pass opens this read: the calendar (trimmed to that gathering) and that gathering's own routes. */
export function eventPassOpens(path: string, eventId: string): "list" | "open" | false {
  if (path === "/api/events") return "list";
  const own = `/api/events/${encodeURIComponent(eventId)}`;
  if (path === own || path.startsWith(own + "/") || path === "/api/events/comms-access") return "open";
  return false;
}

/**
 * Where an entry stands: `in` (no code asked, or the address is proved), `look` (still inside its
 * short look), `code` (the look is over and the code has not come), or null when it is gone.
 */
export type EntryState = "in" | "look" | "code";

/** How long a `look` answer is trusted before the entry is read again: the window is short. */
const LOOK_TTL_MS = 5 * 1000;

/**
 * Whether this request comes from somebody who has passed the entrance, and how: a live cookie
 * whose entry is still on record, and where its short look stands. Signed-in callers are the
 * middleware's question, not this one's. Answers false when there is no live entry.
 */
export function entryChecker(deps: { secret: string; entryState(id: string): Promise<EntryState | null>; now?: () => number }) {
  const now = deps.now ?? (() => Date.now());
  const known = new Map<string, { state: EntryState; at: number }>();
  return async (req: Request): Promise<EntryState | false> => {
    const id = readEntry(deps.secret, cookieValue(req), now());
    if (!id) return false;
    const seen = known.get(id);
    if (seen && now() - seen.at < (seen.state === "in" ? KNOWN_TTL_MS : LOOK_TTL_MS)) return seen.state;
    const state = await deps.entryState(id);
    if (!state) {
      known.delete(id);
      return false;
    }
    if (known.size > 5000) known.clear();
    known.set(id, { state, at: now() });
    return state;
  };
}

/** Only the listed top-level keys of a JSON object; anything else (an error body, a list) passes as an empty object. */
export function pickKeys(body: unknown, keep: readonly string[]): Record<string, unknown> {
  if (!body || typeof body !== "object" || Array.isArray(body)) return {};
  const src = body as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const k of keep) if (Object.prototype.hasOwnProperty.call(src, k)) out[k] = src[k];
  return out;
}

/** The gate. See the header. */
export function entranceMiddleware(deps: EntranceGateDeps, entered: (req: Request) => Promise<EntryState | false>) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (req.method !== "GET" && req.method !== "HEAD") return next();
    if (!req.path.startsWith("/api/")) {
      // A page (no file extension): say whether the village keeps an entrance, for the client's gate to read at once.
      if (!/\.[A-Za-z0-9]+$/.test(req.path)) {
        const on = deps.boolVar("entrance.required");
        const has = (cookieValue(req, GATE_HINT_COOKIE) ?? "") === "1";
        if (on && !has) res.append("Set-Cookie", `${GATE_HINT_COOKIE}=1; Path=/; SameSite=Lax; Max-Age=${ENTRY_MS / 1000}`);
        else if (!on && has) res.append("Set-Cookie", `${GATE_HINT_COOKIE}=; Path=/; SameSite=Lax; Max-Age=0`);
      }
      return next();
    }
    if (!apiBehindEntrance(req.path, req.query as Record<string, unknown>)) return next();
    if (!deps.boolVar("entrance.required")) return next();
    try {
      // Our own automation, by the pass from Integrations. Never recorded, never asked to prove it is a person.
      if (deps.passToken && carriesPass(req, deps.passToken())) return next();
      if (await deps.authedUser(req)) return next();
      if (deps.isAgent && (await deps.isAgent(req))) return next();
      const entry = await entered(req);
      if (entry === "in" || entry === "look") return next();
      if (entry === "code") {
        res.status(401).json({ error: "code_required", message: "Type the 6-digit code we sent to your email to keep exploring." });
        return;
      }
      const eventId = deps.eventPassFor?.(req) ?? null;
      const opens = eventId ? eventPassOpens(req.path, eventId) : false;
      if (eventId && opens === "open") return next();
      if (eventId && opens === "list") {
        // The calendar, as an invited guest reads it: their gathering and nothing else.
        const json = res.json.bind(res);
        res.json = ((body?: unknown) => {
          const b = body as { events?: unknown } | null;
          if (b && typeof b === "object" && Array.isArray(b.events)) {
            return json({ ...b, events: b.events.filter((e: any) => e && String(e.id) === eventId) });
          }
          return json(body);
        }) as Response["json"];
        return next();
      }
      const keep = brochureKeysFor(req.path);
      if (keep) {
        // A brochure page's share of a gated read: the listed keys, nothing else.
        const json = res.json.bind(res);
        res.json = ((body?: unknown) => json(pickKeys(body, keep))) as Response["json"];
        return next();
      }
      res.status(401).json({ error: "entrance_required", message: "Enter the portal first: a name and an email address are all it asks." });
    } catch {
      // A gate that cannot read its own record fails closed, as the people lock does.
      res.status(503).json({ error: "unavailable", message: "This page is not available right now. Try again in a moment." });
    }
  };
}

export type HumanVerdict = { ok: true; how: "turnstile" | "fallback" | "smoke" } | { ok: false; why: "check_failed" | "too_fast" | "check_unavailable" };

const TURNSTILE_VERIFY = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

/** One JSON POST to Cloudflare, through the house's guarded, pinned outbound door (server/lib/toolcheck.ts). */
export type TurnstilePost = (url: string, body: Record<string, string>) => Promise<unknown>;

const guardedPost: TurnstilePost = (url, body) => guardedFetchJson(url, 8000, { method: "POST", body });

/** Ask Cloudflare whether a Turnstile answer is good. A provider we cannot reach is a refusal, said as such. */
export async function verifyTurnstile(secret: string, token: string, ip: string | null, post: TurnstilePost = guardedPost): Promise<HumanVerdict> {
  if (!token || token.length > 4096) return { ok: false, why: "check_failed" };
  try {
    const j = (await post(TURNSTILE_VERIFY, { secret, response: token, ...(ip ? { remoteip: ip } : {}) })) as { success?: boolean } | null;
    return j?.success === true ? { ok: true, how: "turnstile" } : { ok: false, why: "check_failed" };
  } catch {
    return { ok: false, why: "check_unavailable" };
  }
}

/** The fallback check: the hidden field is empty and the form was on screen long enough. */
export function fallbackHuman(input: { website?: unknown; shownAt?: unknown }, minFillMs: number, now: number): HumanVerdict {
  if (typeof input.website === "string" && input.website.trim() !== "") return { ok: false, why: "check_failed" };
  const shown = Number(input.shownAt);
  if (!Number.isFinite(shown) || shown <= 0 || shown > now) return { ok: false, why: "check_failed" };
  if (now - shown < minFillMs) return { ok: false, why: "too_fast" };
  return { ok: true, how: "fallback" };
}

/** The Turnstile card for Admin, Integrations. The site key is public by design and lives in a dial. */
export const TURNSTILE_CARD = {
  key: "turnstile_secret_key" as const,
  title: "Cloudflare Turnstile, the portal's human check",
  unlocks:
    "The entrance asks Cloudflare whether a visitor is a person before it lets them in. It takes this secret here and the matching site key in Game Mechanics (Portal entrance: Turnstile site key). Without both, the entrance uses its simpler check: a hidden field, a minimum time on the form and a limit per connection.",
  getAt: "dash.cloudflare.com → Turnstile → your site → Settings → Secret key",
  placeholder: "0x4AAAAAAA…",
};

/** The entrance pass card for Admin, Integrations: our own automation's way past the entrance. */
export const ENTRANCE_PASS_CARD = {
  key: "entrance_pass_token" as const,
  title: "Portal entrance pass, for the village's own automation",
  unlocks:
    "A long random value. A request that carries it in the X-Entrance-Pass header passes the portal entrance and its human check, and is never recorded as a visitor: the release smoke test, QA probes and the village's own sessions use it. Signed-in members and agent tokens pass without it. At least 24 characters; anything shorter opens nothing.",
  getAt: "Make one yourself, for example with a password manager's generator",
  placeholder: "at least 24 random characters",
};
