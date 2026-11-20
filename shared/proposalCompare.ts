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
