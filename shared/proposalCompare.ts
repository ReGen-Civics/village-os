/**
 * COMPARE PROPOSALS SIDE BY SIDE (the lead, 20 Nov 2026): "compare multiple proposals in admin side by side by
 * selecting them across the role categories ... look at the ones of the same category side by side (up to 4 at a
 * time)".
 *
 * Every proposal waiting for a decision, as one list: a stranger's open proposal for a role (a full application, an
 * early one for a role still coming soon, or "Start a conversation"), a member's own application for a role, and a
 * proposed quest. One open proposal naming three roles is three entries, one per role, so the same person can be
 * read beside the others who want each role.
 *
 * THE CATEGORY IS THE DATA'S OWN GROUPING, never a new taxonomy: a role's circle, and a quest's circle (the
 * `circle` a quest is filed under on the board). A quest with none files under "No circle".
 *
 * ONE CATEGORY AT A TIME, UP TO FOUR (`MAX_COMPARE`). Ticking a fifth, or one from another category, is refused
 * with a plain line (`pickProblem`). The refusal is a code here; the page holds the words, so they translate.
 *
 * NOTHING HERE ORDERS PEOPLE BY MERIT. The list keeps the order the proposals arrived in, and the columns keep the
 * order the person ticked them. No field scores, ranks or rates anybody (applicationReview.refusal.test.ts).
 *
 * Pure: no Node builtins, no clock.
 */

/** The most proposals shown side by side. */
export const MAX_COMPARE = 4;

export type CompareKind = "role" | "quest";

/**
 * How it came in. `full`, `early` and `conversation` are a stranger's open proposal (an early one names a role that
 * was coming soon when it was sent); `member` is a member's own application; `quest` a proposed quest.
 */
export type CompareWay = "full" | "early" | "conversation" | "member" | "quest";

/** Where a deliverable came from, so the page can say it in the person's own terms. */
export type DeliverableFrom = "outcome" | "value" | "deliver" | "goal" | "quest";

export interface CompareDeliverable {
  text: string;
  /** How everybody will know it is done, when they said. */
  doneWhen?: string;
  /** A day they named for it, YYYY-MM-DD. */
  date?: string;
  from: DeliverableFrom;
}

/** Their answer on the terms. Pay rides only for a reader who may read pay (`terms.read`). */
export interface CompareTerms {
  choice: "accept" | "talk" | null;
  note: string;
  /** The settings they would like to talk about, by their labels. */
  talkAbout: string[];
  rampUp: boolean;
  /** Their price ask, when the reader may read pay. `negotiate` is "on the first call". */
  ask: { kind: "amount"; amount: number; per: string } | { kind: "negotiate" } | null;
  /** Whether the deciders have already countered their terms. */
  countered: boolean;
}

export interface CompareDates {
  earliestStart: string | null;
  /** The first day a member asked to begin, YYYY-MM-DD. */
  startsOn: string | null;
  /** The moon an open proposal is for, when the village takes proposals for the moon. */
  termStarts: string | null;
  termEnds: string | null;
  /** When it reached the village, YYYY-MM-DD. */
  received: string | null;
}

export interface CompareItem {
  /** Unique across the list: `op:<id>:<roleId>`, `sa:<id>:<roleId>` or `qp:<id>`. */
  key: string;
  kind: CompareKind;
  way: CompareWay;
  /** The proposal's own id. */
  ref: string;
  /** The person's name, or empty when there is none to show (`whoKind` then says who). */
  who: string;
  whoKind: "person" | "visitor" | "machine";
  /** The role's name, or the quest's title. */
  title: string;
  roleId: string | null;
  category: string;
  /** Their commitment for this role, 0 to 100, or null when they gave none. */
  commitmentPct: number | null;
  /** Their own words on the aim, when they wrote some. */
  aim: string;
  deliverables: CompareDeliverable[];
  terms: CompareTerms | null;
  dates: CompareDates;
  /** The full proposal's page. */
  href: string;
}

/** What the role asks, for the commitment arithmetic and the outcomes nobody offered. */
export interface CompareRole {
  id: string;
  name: string;
  category: string;
  /** The role's own outcomes (accountabilities), as the chart writes them. */
  outcomes: string[];
  /** The commitment the role needs in all, 100 unless the role says otherwise. */
  commitmentTarget: number;
  /** How many people the role holds at once, and how many hold it now. */
  places: number;
  taken: number;
}

export interface CompareCategory {
  key: string;
  label: string;
  count: number;
}

export interface ComparePayload {
  items: CompareItem[];
  roles: CompareRole[];
  categories: CompareCategory[];
  /** Whether the reader may read pay; the asks are left out when not. */
  readsPay: boolean;
  /** What the reader may see (the lead, 20 Nov 2026): "quests" is the quest part alone, with no role and no pay. Absent reads as "all". */
  scope?: CompareScope;
  /** The splits deciders saved, by role. Absent for a reader of the quest part. */
  saved?: SavedSplitView[];
  /** Whether this reader may save a split (the Compare key itself). */
  maySave?: boolean;
}

/** The category a quest with no circle files under. */
export const NO_CIRCLE = "quest:none";

/** A category key: a role's circle id, or a quest's circle name. */
export const roleCategory = (circleId: string | null): string => `circle:${circleId ?? "none"}`;
export const questCategory = (circle: string | null | undefined): string => {
  const c = String(circle ?? "").trim().toLowerCase();
  return c ? `quest:${c}` : NO_CIRCLE;
};

/** The categories the list holds, in the order they first appear, each with how many it holds. */
export function categoriesOf(items: readonly CompareItem[], labelOf: (key: string) => string): CompareCategory[] {
  const out: CompareCategory[] = [];
  for (const it of items) {
    const found = out.find((c) => c.key === it.category);
    if (found) found.count++;
    else out.push({ key: it.category, label: labelOf(it.category), count: 1 });
  }
  return out;
}

/** The entries in one category, or all of them, in the list's own order. */
export function inCategory(items: readonly CompareItem[], category: string | null): CompareItem[] {
  return category ? items.filter((i) => i.category === category) : [...items];
}

export type PickProblem = "too-many" | "other-category";

/** Why this entry cannot join the ones already ticked, or null when it can. */
export function pickProblem(picked: readonly CompareItem[], next: CompareItem): PickProblem | null {
  if (picked.some((p) => p.key === next.key)) return null;
  if (picked.length >= MAX_COMPARE) return "too-many";
  if (picked.length && picked[0].category !== next.category) return "other-category";
  return null;
}

/**
 * Tick or untick one entry. Unticking always works; ticking keeps the order the person ticked in, and a refused tick
 * leaves the selection as it was and says why.
 */
export function togglePick(keys: readonly string[], next: CompareItem, items: readonly CompareItem[]): { keys: string[]; problem: PickProblem | null } {
  if (keys.includes(next.key)) return { keys: keys.filter((k) => k !== next.key), problem: null };
  const picked = keys.map((k) => items.find((i) => i.key === k)).filter((i): i is CompareItem => !!i);
  const problem = pickProblem(picked, next);
  return problem ? { keys: [...keys], problem } : { keys: [...keys, next.key], problem: null };
}

/** The ticked entries, in the order they were ticked, dropping any that left the list. */
export function pickedItems(keys: readonly string[], items: readonly CompareItem[]): CompareItem[] {
  return keys.map((k) => items.find((i) => i.key === k)).filter((i): i is CompareItem => !!i);
}

/** The rows a comparison lines up, in order, so the same field sits on the same line in every column. */
export const COMPARE_ROWS = ["who", "title", "way", "commitment", "deliverables", "terms", "dates", "link"] as const;
export type CompareRow = (typeof COMPARE_ROWS)[number];

// ── The saved split (the lead, 20 Nov 2026) ─────────────────────────────────────────────────────────────────────
//
// "Which deliverables each adopted person holds" for one role, saved by a decider from Compare. Kept on each
// person's own proposal (its stored data, beside the other deciders-only parts), so it is erased with it. Read by
// the admin section alone, at the Compare key; never served to the applicant, the public or an agent.

/** The most words one saved piece keeps, and the most pieces one person holds in a saved split. */
export const HELD_LIMITS = { text: 400, pieces: 24, rows: MAX_COMPARE } as const;

/** One person's part of a saved split, as kept on their proposal. */
export interface HeldSplit {
  roleId: string;
  /** The deliverables they hold, in the words the split showed. */
  holds: string[];
  /** The comparison keys of the others in the same split, so each record names its whole split. */
  with: string[];
  by: string;
  at: string;
}

const COMPARE_KEY = /^(op|sa):[A-Za-z0-9-]{1,40}:[A-Za-z0-9_-]{1,64}$/;

/** The saved splits on one proposal, read tolerantly. */
export function heldSplitsOf(raw: unknown): HeldSplit[] {
  if (!Array.isArray(raw)) return [];
  const out: HeldSplit[] = [];
  for (const s of raw.slice(0, 6)) {
    if (!s || typeof s !== "object") continue;
    const o = s as Record<string, unknown>;
    if (typeof o.roleId !== "string" || !o.roleId || typeof o.by !== "string" || typeof o.at !== "string" || !Array.isArray(o.holds)) continue;
    out.push({
      roleId: o.roleId.slice(0, 64),
      holds: o.holds.filter((h): h is string => typeof h === "string" && !!h.trim()).map((h) => h.trim().slice(0, HELD_LIMITS.text)).slice(0, HELD_LIMITS.pieces),
      with: Array.isArray(o.with) ? o.with.filter((k): k is string => typeof k === "string" && COMPARE_KEY.test(k)).slice(0, HELD_LIMITS.rows) : [],
      by: o.by.slice(0, 64),
      at: o.at.slice(0, 40),
    });
  }
  return out;
}

/** A split to save, as the page sends it. */
export interface SplitToSave {
  roleId: string;
  rows: Array<{ key: string; holds: string[] }>;
}

export const SAVE_SPLIT_WORDS = {
  shape: "Send the role and, for each person, the deliverables they would hold.",
  rows: `A split names between one and ${MAX_COMPARE} people.`,
  key: "A person in the split is not one of the proposals in Compare.",
  role: "Everyone in a split must have proposed for the same role.",
  tooLong: `Keep each deliverable under ${HELD_LIMITS.text} characters.`,
  tooMany: `Up to ${HELD_LIMITS.pieces} deliverables for one person.`,
} as const;

/** The split the page sent, checked for shape. Whether each proposal exists is the route's to check. */
export function parseSplitToSave(raw: unknown): { ok: true; value: SplitToSave } | { ok: false; error: string } {
  const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : null;
  if (!o || typeof o.roleId !== "string" || !o.roleId.trim() || !Array.isArray(o.rows)) return { ok: false, error: SAVE_SPLIT_WORDS.shape };
  const roleId = o.roleId.trim();
  if (o.rows.length < 1 || o.rows.length > HELD_LIMITS.rows) return { ok: false, error: SAVE_SPLIT_WORDS.rows };
  const rows: SplitToSave["rows"] = [];
  for (const r of o.rows) {
    const x = r && typeof r === "object" ? (r as Record<string, unknown>) : {};
    const key = typeof x.key === "string" ? x.key : "";
    if (!COMPARE_KEY.test(key) || rows.some((y) => y.key === key)) return { ok: false, error: SAVE_SPLIT_WORDS.key };
    if (!key.endsWith(`:${roleId}`)) return { ok: false, error: SAVE_SPLIT_WORDS.role };
    if (!Array.isArray(x.holds)) return { ok: false, error: SAVE_SPLIT_WORDS.shape };
    const holds = x.holds.filter((h): h is string => typeof h === "string").map((h) => h.trim()).filter(Boolean);
    if (holds.some((h) => h.length > HELD_LIMITS.text)) return { ok: false, error: SAVE_SPLIT_WORDS.tooLong };
    if (holds.length > HELD_LIMITS.pieces) return { ok: false, error: SAVE_SPLIT_WORDS.tooMany };
    rows.push({ key, holds });
  }
  return { ok: true, value: { roleId, rows } };
}

/** A saved split as Compare shows it: one role, each person and what they hold. */
export interface SavedSplitView {
  roleId: string;
  roleName: string;
  by: string;
  at: string;
  rows: Array<{ key: string; who: string; status: "waiting" | "adopted" | "closed"; holds: string[]; href: string }>;
}

/** What Compare's reader may see: everything, or the quest part alone (a holder of `quest.approve` only). */
export type CompareScope = "all" | "quests";
