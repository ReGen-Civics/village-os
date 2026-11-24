/**
 * THE ENTRANCE, SERVER SIDE: the entry cookie, the gate in front of every route, and the human
 * check (the contract and the lists are shared/entrance.ts).
 *
 * ── THE GATE ────────────────────────────────────────────────────────────────
 *
 * `entranceMiddleware` sits in front of every route, installed right after the people lock and
 * for the same reason: a gate read per route is a gate every new route forgets. While the
 * village's dial `entrance.required` is on, a GET or HEAD to a path on `ENTRANCE_APIS` from a
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
import { apiBehindEntrance, brochureKeysFor, ENTRY_COOKIE, ENTRY_DAYS } from "../../shared/entrance";

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
}

/**
 * Whether this request comes from somebody who has passed the entrance: a live cookie whose
 * entry is still on record. Signed-in callers are the middleware's question, not this one's.
 */
export function entryChecker(deps: { secret: string; entryExists(id: string): Promise<boolean>; now?: () => number }) {
  const now = deps.now ?? (() => Date.now());
  const known = new Map<string, number>();
  return async (req: Request): Promise<boolean> => {
    const id = readEntry(deps.secret, cookieValue(req), now());
    if (!id) return false;
    const seen = known.get(id);
    if (seen && now() - seen < KNOWN_TTL_MS) return true;
    if (!(await deps.entryExists(id))) {
      known.delete(id);
      return false;
    }
    if (known.size > 5000) known.clear();
    known.set(id, now());
    return true;
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
export function entranceMiddleware(deps: EntranceGateDeps, entered: (req: Request) => Promise<boolean>) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (req.method !== "GET" && req.method !== "HEAD") return next();
    if (!apiBehindEntrance(req.path)) return next();
    if (!deps.boolVar("entrance.required")) return next();
    try {
      if (await deps.authedUser(req)) return next();
      if (await entered(req)) return next();
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

/** Ask Cloudflare whether a Turnstile answer is good. A provider we cannot reach is a refusal, said as such. */
export async function verifyTurnstile(secret: string, token: string, ip: string | null, fetchImpl: typeof fetch = fetch): Promise<HumanVerdict> {
  if (!token || token.length > 4096) return { ok: false, why: "check_failed" };
  try {
    const body = new URLSearchParams({ secret, response: token });
    if (ip) body.set("remoteip", ip);
    const r = await fetchImpl(TURNSTILE_VERIFY, { method: "POST", body, signal: AbortSignal.timeout(8000) });
    const j = (await r.json().catch(() => null)) as { success?: boolean } | null;
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
