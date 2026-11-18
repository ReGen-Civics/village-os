/**
 * THE COUNTER-OFFER FOR EACH ROLE (the lead, 18 Nov 2026): on a proposal, each role's commitment and price can be
 * countered by the people who seat it. The eight settings stay one counter-offer for the whole proposal
 * (shared/counterOffer.ts); this is the part that belongs to one role.
 *
 *   - price: any role's, a whole amount for the role's own period (its listed price's), countered against what the
 *     applicant asked or, with no ask, the suggested price;
 *   - commitment: each role after the first. The first role's commitment is countered where it always was, in the
 *     proposal's counter-offer, so a one-role proposal reads exactly as before.
 *
 * Kept as `counterOffer.roles` beside the proposal's revisions, with its own revisions and its own replies, each reply
 * keyed by role and kind and holding the revision it answered, so a value changed AGAIN asks again. A release that
 * reads only the proposal's revisions passes over it.
 *
 * Pure and dependency-free. Nothing here computes pay: the contract price is worked at adoption
 * (shared/contractPrice.ts), from the countered price as the price agreed.
 */

export type RoleOfferKey = "commitment" | "price";
export const ROLE_OFFER_KEYS: readonly RoleOfferKey[] = ["commitment", "price"];
export const ROLE_REVISIONS_MAX = 50;
/** The most a countered price may be, in whole units: the same ceiling a price ask has (shared/commitmentRange.ts). */
export const ROLE_PRICE_MAX = 100_000_000;

export interface RoleOfferChange {
  roleId: string;
  key: RoleOfferKey;
  /** The value before and after, as text: a commitment's percent, a price's whole amount. Null: not countered. */
  from: string | null;
  to: string | null;
}

export interface RoleOfferRevision {
  n: number;
  at: string;
  byId: string;
  by: string;
  changes: RoleOfferChange[];
}

export interface RoleOfferReply {
  choice: "accept" | "talk";
  note: string;
  rev: number;
  at: string;
}

export interface RoleCounter {
  revisions: RoleOfferRevision[];
  /** By `replyKey(roleId, key)`. */
  replies: Record<string, RoleOfferReply>;
}

/** Where a reply is kept: the role and the kind. */
export const replyKey = (roleId: string, key: RoleOfferKey): string => `${roleId}:${key}`;

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const str = (v: unknown, max: number): string => (typeof v === "string" ? v.trim().slice(0, max) : "");
const wholeText = (v: unknown): string | null => (typeof v === "string" && /^\d{1,9}$/.test(v.trim()) ? String(Number(v.trim())) : null);
const isRoleKey = (v: unknown): v is RoleOfferKey => v === "commitment" || v === "price";
const NOTE_MAX = 600;

/** A stored role counter, tolerant, never throws; null when there is none. */
export function roleCounterOf(raw: unknown): RoleCounter | null {
  if (!isObj(raw) || !Array.isArray(raw.revisions)) return null;
  const revisions: RoleOfferRevision[] = [];
  for (const r of raw.revisions.slice(0, ROLE_REVISIONS_MAX)) {
    if (!isObj(r) || !Array.isArray(r.changes)) continue;
    const changes: RoleOfferChange[] = [];
    for (const c of r.changes) {
      if (!isObj(c) || !isRoleKey(c.key)) continue;
      const roleId = str(c.roleId, 128);
      if (roleId) changes.push({ roleId, key: c.key, from: wholeText(c.from), to: wholeText(c.to) });
    }
    if (changes.length) revisions.push({ n: revisions.length + 1, at: str(r.at, 40), byId: str(r.byId, 64), by: str(r.by, 120), changes });
  }
  if (!revisions.length) return null;
  const replies: RoleCounter["replies"] = {};
  if (isObj(raw.replies)) {
    for (const [k, a] of Object.entries(raw.replies).slice(0, 12)) {
      if (isObj(a) && (a.choice === "accept" || a.choice === "talk")) replies[k.slice(0, 140)] = { choice: a.choice, note: str(a.note, NOTE_MAX), rev: Math.max(0, Math.min(ROLE_REVISIONS_MAX, Number(a.rev) || 0)), at: str(a.at, 40) };
    }
  }
  return { revisions, replies };
}

/** The revision each role's value was last changed in, by `replyKey`. */
export function roleChangedIn(rc: RoleCounter | null): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of rc?.revisions ?? []) for (const c of r.changes) out[replyKey(c.roleId, c.key)] = r.n;
  return out;
}

/** A role's value now: its latest change, else what it was before anybody countered it (`theirs`). */
export function currentRoleValue(rc: RoleCounter | null, roleId: string, key: RoleOfferKey, theirs: number | null): number | null {
  let now = theirs;
  for (const r of rc?.revisions ?? []) for (const c of r.changes) if (c.roleId === roleId && c.key === key) now = c.to == null ? theirs : Number(c.to);
  return now;
}

/** Whether a role's price was countered: the contract then takes it as the price agreed. */
export function rolePriceCountered(rc: RoleCounter | null, roleId: string): number | null {
  const v = currentRoleValue(rc, roleId, "price", null);
  return typeof v === "number" && Number.isInteger(v) && v > 0 ? v : null;
}

export type RoleOfferState = "accept" | "talk" | "waiting";

/** Where one role's countered value stands: the applicant's reply to its latest change, or waiting for one. */
export function roleStateOf(rc: RoleCounter, roleId: string, key: RoleOfferKey): RoleOfferState {
  const at = roleChangedIn(rc)[replyKey(roleId, key)];
  const r = rc.replies[replyKey(roleId, key)];
  if (!at) return "accept";
  return r && r.rev >= at ? r.choice : "waiting";
}

/** One edit to one role: a new commitment (each role after the first), a new price, or both. Null: leave it. */
export interface RoleEdit {
  roleId: string;
  commitmentPct?: number | null;
  price?: number | null;
}

export const ROLE_OFFER_WORDS = {
  badCommitment: "Choose a commitment from 10 to 100 in steps of 10.",
  badPrice: "Write the price as a whole number, like 6500.",
  notThisProposal: "That role is not in this proposal.",
  firstCommitment: "The first role's commitment is countered with the rest of the terms.",
  tooMany: "This offer has been changed many times. Talk it through together instead.",
} as const;

export type RoleEdited = { ok: true; rc: RoleCounter; revision: RoleOfferRevision | null } | { ok: false; error: string; roleId: string };

/**
 * Append one revision for every role edited. `roles` is the proposal's roles in order with what each was before any
 * counter (the applicant's commitment and price), so a value equal to the current one is no change. Nothing changed
 * is not an error here: the proposal's own counter-offer may carry the save (`revision` is then null).
 */
export function editRoleOffer(p: {
  rc: RoleCounter | null;
  roles: ReadonlyArray<{ roleId: string; commitmentPct: number | null; price: number | null }>;
  edits: unknown;
  by: { id: string; name: string };
  now: Date;
}): RoleEdited {
  const rc = p.rc ?? { revisions: [], replies: {} };
  const changes: RoleOfferChange[] = [];
  for (const e of Array.isArray(p.edits) ? p.edits.slice(0, 6) : []) {
    if (!isObj(e)) continue;
    const roleId = str(e.roleId, 128);
    const i = p.roles.findIndex((r) => r.roleId === roleId);
    if (i < 0) return { ok: false, error: ROLE_OFFER_WORDS.notThisProposal, roleId };
    const role = p.roles[i];
    if (e.commitmentPct !== undefined && e.commitmentPct !== null) {
      if (i === 0) return { ok: false, error: ROLE_OFFER_WORDS.firstCommitment, roleId };
      const pct = e.commitmentPct;
      if (typeof pct !== "number" || !Number.isInteger(pct) || pct < 10 || pct > 100 || pct % 10 !== 0) return { ok: false, error: ROLE_OFFER_WORDS.badCommitment, roleId };
      const was = currentRoleValue(p.rc, roleId, "commitment", role.commitmentPct);
      if (pct !== was) changes.push({ roleId, key: "commitment", from: was == null ? null : String(was), to: String(pct) });
    }
    if (e.price !== undefined && e.price !== null) {
      const price = e.price;
      if (typeof price !== "number" || !Number.isInteger(price) || price <= 0 || price > ROLE_PRICE_MAX) return { ok: false, error: ROLE_OFFER_WORDS.badPrice, roleId };
      const was = currentRoleValue(p.rc, roleId, "price", role.price);
      if (price !== was) changes.push({ roleId, key: "price", from: was == null ? null : String(was), to: String(price) });
    }
  }
  if (!changes.length) return { ok: true, rc, revision: null };
  if (rc.revisions.length >= ROLE_REVISIONS_MAX) return { ok: false, error: ROLE_OFFER_WORDS.tooMany, roleId: changes[0].roleId };
  const revision: RoleOfferRevision = { n: rc.revisions.length + 1, at: p.now.toISOString(), byId: p.by.id, by: p.by.name.slice(0, 120), changes };
  return { ok: true, rc: { revisions: [...rc.revisions, revision], replies: rc.replies }, revision };
}

export type RoleReplied = { ok: true; rc: RoleCounter | null; any: boolean } | { ok: false; error: string; key: string };

/** The applicant answers the countered values, by `replyKey`. Only a countered value can be answered. */
export function replyToRoleOffer(rc: RoleCounter | null, raw: unknown, now: Date): RoleReplied {
  if (!isObj(raw)) return { ok: true, rc, any: false };
  const at = roleChangedIn(rc);
  const replies = { ...(rc?.replies ?? {}) };
  let any = false;
  for (const [k, a] of Object.entries(raw).slice(0, 12)) {
    if (a === undefined || a === null) continue;
    if (!rc || !at[k]) return { ok: false, error: "There is nothing here to answer.", key: k };
    if (!isObj(a) || (a.choice !== "accept" && a.choice !== "talk")) return { ok: false, error: "Say whether you accept or would like to talk about it.", key: k };
    const note = typeof a.note === "string" ? a.note.trim() : "";
    if (note.length > NOTE_MAX) return { ok: false, error: `Keep your note to ${NOTE_MAX} characters.`, key: k };
    replies[k] = { choice: a.choice, note, rev: rc.revisions.length, at: now.toISOString() };
    any = true;
  }
  return { ok: true, rc: rc ? { revisions: rc.revisions, replies } : rc, any };
}

/** The countered values not yet agreed: waiting for an answer, or answered "let's talk". */
export function roleOpenTalks(rc: RoleCounter | null): Array<{ roleId: string; key: RoleOfferKey }> {
  if (!rc) return [];
  const seen = new Set<string>();
  const out: Array<{ roleId: string; key: RoleOfferKey }> = [];
  for (const r of rc.revisions) {
    for (const c of r.changes) {
      const k = replyKey(c.roleId, c.key);
      if (seen.has(k)) continue;
      seen.add(k);
      if (roleStateOf(rc, c.roleId, c.key) !== "accept") out.push({ roleId: c.roleId, key: c.key });
    }
  }
  return out;
}
