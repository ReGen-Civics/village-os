/**
 * A SEAT'S TERMS, PROPOSED AS WORDS (the lead, 19 Nov 2026: "Seems like we need to upgrade what agents are able to
 * do in the Game").
 *
 * A role's terms on offer (`org_roles.terms_offer`, shared/seatTermsOffer.ts) hold two kinds of thing:
 *
 *   THE EIGHT WORDINGS   term, clocks, rhythm, allowance, bonus, goals, scoreboard, ending (shared/termsWords.ts):
 *                        the role's suggested wording for each setting, which a candidate reads before they apply.
 *   THE GROUPS           pay, allowance and bonus figures, clocks, rhythm, tasks, scoreboard, ending: structured
 *                        values, the money groups among them (`MONEY_GROUPS`).
 *
 * An agent proposes THE WORDINGS ONLY, through `propose_changes`, kind `seat_terms`: target {roleId}, body
 * {words: {bonus: "...", ...}}. A wording sent as "" takes that wording off. The groups are never in a proposal:
 * the body may carry `words` and nothing else, and the apply keeps every group exactly as the role holds it when the
 * person accepts. So no amount, currency or pay shape can ever be proposed this way, and none is ever shown: the
 * read (`seatTermsRead`) carries the wordings, the commitment the role asks, and the NAMES of the groups that are
 * set, never their values. That is the connector's rule (server/lib/agentMcp.ts): it never shows an amount or a
 * pay route.
 *
 * The wordings are what a candidate already reads before they are a member (`publicTermsOf`), so reading them
 * shows an agent nothing a candidate cannot see.
 *
 * ACCEPTING runs through the org draft path as the person, the same path Admin's terms editor takes
 * (client/src/components/admin/SeatTermsOfferEditor.tsx): a one-change draft carrying the whole offer with the new
 * wordings, its preview, and its publish. Publishing needs the person's own power, so the one capability gate
 * answers for them.
 *
 * Pure: no database, no Express.
 */
import { GROUP_LABELS, SETTINGS_GROUPS, type SeatSettings } from "./seatSettings";
import { readTermsOffer } from "./seatTermsOffer";
import { TERM_KEYS, TERM_LABELS, type TermKey, type TermsWords } from "./termsWords";

/** The route a `seat_terms` proposal is recorded under: the org draft path it is accepted through. */
export const SEAT_TERMS_ROUTE = { method: "POST", path: "/api/admin/org/drafts" } as const;

/** The longest wording the seat settings parser keeps (`readWords`, shared/seatSettings.ts). */
export const SEAT_TERMS_WORD_MAX = 600;

export const SEAT_TERMS_WORDS = {
  onlyWords: "A proposal on a role's terms carries words: the suggested wording for each setting. Pay, allowance and bonus figures, and every other setting, stay a person's to change in Admin, Roles, Terms on offer.",
  wordsShape: `words is a set of wordings, one for any of: ${TERM_KEYS.join(", ")}.`,
  nothing: "Say which wording to change.",
  draftTitle: (role: string) => `Terms on offer, wording: ${role}`.slice(0, 200),
} as const;

/** The wordings a proposal sends, read: each a string, "" meaning take it off. Or the sentence and field saying why not. */
export function readSeatTermsBody(body: Record<string, unknown>): { ok: true; words: Partial<Record<TermKey, string>> } | { ok: false; error: string; field: string } {
  const extra = Object.keys(body).filter((k) => k !== "words");
  if (extra.length) return { ok: false, error: SEAT_TERMS_WORDS.onlyWords, field: extra[0] };
  const w = body.words;
  if (!w || typeof w !== "object" || Array.isArray(w)) return { ok: false, error: SEAT_TERMS_WORDS.wordsShape, field: "words" };
  const out: Partial<Record<TermKey, string>> = {};
  for (const [k, v] of Object.entries(w as Record<string, unknown>)) {
    if (!(TERM_KEYS as readonly string[]).includes(k)) return { ok: false, error: SEAT_TERMS_WORDS.wordsShape, field: `words.${k}` };
    if (typeof v !== "string") return { ok: false, error: `The wording for ${TERM_LABELS[k as TermKey]} is text.`, field: `words.${k}` };
    if (v.trim().length > SEAT_TERMS_WORD_MAX) return { ok: false, error: `Keep the wording for ${TERM_LABELS[k as TermKey]} to ${SEAT_TERMS_WORD_MAX} characters.`, field: `words.${k}` };
    out[k as TermKey] = v.trim();
  }
  if (!Object.keys(out).length) return { ok: false, error: SEAT_TERMS_WORDS.nothing, field: "words" };
  return { ok: true, words: out };
}

/**
 * The whole offer with the new wordings: every group the role holds kept exactly as it is, each wording sent put in,
 * a wording sent as "" taken off. Null when nothing is left in it (no terms on offer).
 */
export function termsWithWords(held: SeatSettings | null, words: Partial<Record<TermKey, string>>): SeatSettings | null {
  const base: SeatSettings = held ? { ...held } : { v: 1 };
  const next: TermsWords = { ...(base.words ?? {}) };
  for (const k of TERM_KEYS) {
    if (!(k in words)) continue;
    const v = words[k] ?? "";
    if (v) next[k] = v;
    else delete next[k];
  }
  if (Object.keys(next).length) base.words = next;
  else delete base.words;
  return Object.keys(base).every((k) => k === "v") ? null : base;
}

/**
 * The offer as a new write would be read (the draft's own check, `readTermsOffer(..., { newWrite: true })`), or the
 * sentence saying why the draft would refuse it.
 */
export function seatTermsProblem(heldRaw: unknown, words: Partial<Record<TermKey, string>>): string | null {
  const held = readTermsOffer(heldRaw);
  if (!held.ok) return `This role's terms on offer could not be read, so a person changes them in Admin, Roles. ${held.problem}`;
  const next = termsWithWords(held.settings, words);
  if (next === null) return null;
  const read = readTermsOffer(next, { newWrite: true });
  return read.ok ? null : `These terms cannot be offered. ${read.problem}`;
}

/** Every wording, "" where the role has written none: what is live, in the proposal's shape, so it can be put back. */
export function liveSeatWords(heldRaw: unknown): { words: Record<TermKey, string> } {
  const held = readTermsOffer(heldRaw);
  const w = held.ok ? held.settings?.words ?? {} : {};
  return { words: Object.fromEntries(TERM_KEYS.map((k) => [k, w[k] ?? ""])) as Record<TermKey, string> };
}

/** One role's terms as the connector reads them: wordings, the commitment it asks, and the names of the groups set. Never a value of a group. */
export interface SeatTermsRead {
  roleId: string;
  name: string;
  words: Record<TermKey, string>;
  commitmentPct: number | null;
  /** The groups the offer sets, by name only ("Pay", "Ending"). Their values are a person's to read in the app. */
  setGroups: string[];
  readable: boolean;
}

export function seatTermsRead(role: { id: string; name: string; termsOffer: unknown }): SeatTermsRead {
  const held = readTermsOffer(role.termsOffer);
  const s = held.ok ? held.settings : null;
  return {
    roleId: role.id,
    name: role.name,
    words: liveSeatWords(role.termsOffer).words,
    commitmentPct: s?.clocks?.commitmentPct ?? null,
    setGroups: SETTINGS_GROUPS.filter((g) => s?.[g] !== undefined).map((g) => GROUP_LABELS[g]),
    readable: held.ok,
  };
}
