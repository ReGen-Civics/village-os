/**
 * PAYING SOMEBODY, as data both halves agree on: who a payment can go to, and
 * the request link a member shares so somebody can pay them.
 *
 * The send and receive page (`/pay`, client/src/pages/Pay.tsx) and its routes
 * (server/routes/pay.ts) read this one file, so the link a member shares and
 * the link the page opens are parsed by the same function.
 *
 * ── WHO A PAYMENT GOES TO: A SMALL UNION ────────────────────────────────────
 *
 * A member today. A venture (an org account, credits lane 1) once the server
 * returns one: the page draws whatever kinds the server hands it and offers
 * nothing it was not handed, so orgs appear when the server starts returning
 * them and not before. A record keyed by `PayeeKind` makes the compiler name
 * every place a new kind needs words.
 *
 * ── THE REQUEST LINK ────────────────────────────────────────────────────────
 *
 *   /pay?to=@handle&amount=12.50&note=Two%20jars
 *
 * `to` is a public handle, never an account id: a handle is already printed
 * under every member's name, and the link is shared on purpose by the person
 * it names. An org is `to=org:<slug>`. `amount` is in credits, the unit the
 * amount pad works in, with at most two decimals. Every part is optional
 * except `to`, and a link that fails to parse opens the page empty, never on a
 * guess.
 */

export type PayeeKind = "member" | "org";

/** Every kind, in the order a list shows them. */
export const PAYEE_KINDS: readonly PayeeKind[] = ["member", "org"];

/** One person or venture a payment can go to, as the server hands it to the page. */
export interface Payee {
  kind: PayeeKind;
  /** The id the send route takes. Never shown. */
  id: string;
  /** The public handle, without the @. Null for a kind that has none. */
  handle: string | null;
  /**
   * What the reader may call them. No avatar and no address: the public
   * profile (`publicView`, server/lib/profile.ts) carries neither, and a
   * search is not a way around it.
   */
  name: string;
}

/** Where a request link points: a member by handle, or an org by slug. */
export interface PayTarget {
  kind: PayeeKind;
  ref: string;
}

/** What a request link carries, each part null when it is absent or unreadable. */
export interface PayRequest {
  to: PayTarget | null;
  /** Credits as a canonical decimal string ("12.5" reads "12.50"), or null. */
  amount: string | null;
  note: string | null;
}

/** The ledger column's own width, the same cap `/api/wallet/send` applies. */
export const PAY_NOTE_MAX = 180;
/** Fewer letters than this match nobody: a search is never a way to list the village. */
export const PAY_SEARCH_MIN = 2;
/** The most a search answers with, however many match. */
export const PAY_SEARCH_LIMIT = 6;
/** How many recent people the row shows. */
export const PAY_RECENT_LIMIT = 8;
/** The largest amount one payment may carry, in credits. */
export const PAY_AMOUNT_MAX = 1_000_000;

/**
 * Handles as the platform makes them: lowercase letters, digits, dash and
 * underscore. Wider than the profile editor's rule on purpose, because a
 * handle made from a short name ("jo") predates that rule and is still a
 * handle somebody can share.
 */
const HANDLE = /^[a-z0-9][a-z0-9_-]{0,39}$/;
const ORG_SLUG = /^[a-z0-9][a-z0-9_-]{0,63}$/;

/** "@Ana", " ana " and "ana" are the same handle; anything else is null. */
export function normaliseHandle(raw: unknown): string | null {
  const h = String(raw ?? "").trim().replace(/^@+/, "").toLowerCase();
  return HANDLE.test(h) ? h : null;
}

/** A link's `to`: "@ana" or "ana" is a member, "org:garden-coop" an org. */
export function parseTarget(raw: unknown): PayTarget | null {
  const s = String(raw ?? "").trim();
  if (!s) return null;
  if (/^org:/i.test(s)) {
    const slug = s.slice(4).trim().toLowerCase();
    return ORG_SLUG.test(slug) ? { kind: "org", ref: slug } : null;
  }
  const handle = normaliseHandle(s);
  return handle ? { kind: "member", ref: handle } : null;
}

/** A target as a link writes it. */
export function targetParam(t: PayTarget): string {
  return t.kind === "org" ? `org:${t.ref}` : `@${t.ref}`;
}

/**
 * An amount of credits, as a member types it or a link carries it, in
 * canonical form: "12", "12.5", "12,50" and "12.50" all read "12.50" and "12"
 * reads "12". Null for anything that is not a positive number with at most two
 * decimals and at most `PAY_AMOUNT_MAX`. A comma is read as the decimal mark,
 * the way a Spanish keyboard types it; a thousands separator is not accepted,
 * so "1,000" is refused rather than read as one.
 */
export function parseAmount(raw: unknown): string | null {
  const s = String(raw ?? "").trim().replace(",", ".");
  const m = /^(\d{1,7})(?:\.(\d{1,2}))?$/.exec(s);
  if (!m) return null;
  const whole = m[1].replace(/^0+(?=\d)/, "");
  const frac = m[2] ?? "";
  const value = Number(`${whole}.${frac || "0"}`);
  if (!(value > 0) || value > PAY_AMOUNT_MAX) return null;
  return frac ? `${whole}.${frac.padEnd(2, "0")}` : whole;
}

/** Whole credits and hundredths, as minor units at `decimals` places. */
export function amountToMinor(amount: string, decimals: number): number {
  const [whole, frac = ""] = amount.split(".");
  const places = Math.max(0, Math.trunc(decimals));
  const digits = `${whole}${frac.padEnd(places, "0").slice(0, places)}`;
  return Number(digits) || 0;
}

/** A note as a link carries it: trimmed, one line, capped. */
function cleanNote(raw: unknown): string | null {
  const s = String(raw ?? "").replace(/\s+/g, " ").trim().slice(0, PAY_NOTE_MAX);
  return s || null;
}

/**
 * Read a request link in any shape a member may hold it: a full URL from a QR
 * code, a path, a query string, or a bare handle typed or pasted. The origin
 * is not checked: a link from another village names a handle here, and the
 * server resolves that handle against this village's members or says it found
 * nobody.
 */
export function parsePayLink(input: unknown): PayRequest {
  const raw = String(input ?? "").trim();
  const empty: PayRequest = { to: null, amount: null, note: null };
  if (!raw) return empty;
  let params: URLSearchParams | null = null;
  try {
    if (/^https?:\/\//i.test(raw)) params = new URL(raw).searchParams;
    else if (raw.includes("?")) params = new URLSearchParams(raw.slice(raw.indexOf("?") + 1));
    else if (raw.includes("=")) params = new URLSearchParams(raw);
  } catch {
    return empty;
  }
  if (!params) return { ...empty, to: parseTarget(raw) };
  return {
    to: parseTarget(params.get("to")),
    amount: params.has("amount") ? parseAmount(params.get("amount")) : null,
    note: cleanNote(params.get("note")),
  };
}

/** The path a request link opens: `/pay?to=%40ana&amount=12.50`. */
export function payLinkPath(req: { to: PayTarget; amount?: string | null; note?: string | null }): string {
  const params = new URLSearchParams();
  params.set("to", targetParam(req.to));
  const amount = req.amount ? parseAmount(req.amount) : null;
  if (amount) params.set("amount", amount);
  const note = cleanNote(req.note);
  if (note) params.set("note", note);
  return `/pay?${params.toString()}`;
}

/** The whole link, for a QR code or the share sheet. */
export function payLinkUrl(origin: string, req: { to: PayTarget; amount?: string | null; note?: string | null }): string {
  return `${String(origin ?? "").replace(/\/+$/, "")}${payLinkPath(req)}`;
}
