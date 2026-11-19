/**
 * A ROLE'S DATED DELIVERABLES (the lead, Anchor session of 19 Nov 2026):
 * "Delivers" becomes "Deliverables", drawn as a timeline of dated outcomes.
 *
 * Kept in the role's founding sections (`sections.deliverables`, the
 * `role-card-sections` app_config document), so no migration:
 *
 *   { title, start: "YYYY-MM-DD", end: "YYYY-MM-DD", workstream?, milestone? }
 *
 * A milestone is one day: its start and end are the same date and it is
 * drawn as a diamond. The role on the card is the owner, so no row names a
 * person. The day-to-day stays in "What I look after"; these are the dated
 * outcomes only.
 *
 * Also here: the "Once you're selected" steps (`sections.onboarding`), lines
 * read like every other section list, and the editor's one-line text form for
 * a deliverable ("2027-01-15 | 2027-03-01 | Title | Workstream") lives in
 * shared/roleDeliverablesText.ts. The timeline's
 * geometry lives apart, in shared/roleDeliverablesGantt.ts, so a card that only
 * reads its sections does not carry it.
 *
 * Pure: no pool, no clock, no Node builtins.
 */
import { looksLikePaymentDetails } from "./seatSettings";

export interface Deliverable {
  title: string;
  /** The first day, YYYY-MM-DD. */
  start: string;
  /** The last day, YYYY-MM-DD, on or after `start`. */
  end: string;
  /** The stream of work it belongs to, for grouping rows. Empty: none. */
  workstream?: string;
  /** One day, drawn as a diamond. */
  milestone?: boolean;
}

export const DELIVERABLE_LIMITS = {
  rows: 12,
  titleChars: 120,
  workstreamChars: 40,
} as const;

export const DELIVERABLE_PROBLEMS = {
  notAList: "Deliverables is a list of dated outcomes: title, start and end.",
  tooMany: `Deliverables: at most ${DELIVERABLE_LIMITS.rows}.`,
  row: `Each deliverable needs a title of up to ${DELIVERABLE_LIMITS.titleChars} characters, a workstream of up to ${DELIVERABLE_LIMITS.workstreamChars}, and dates as year-month-day, like 2027-01-15, ending on or after it starts.`,
  payment: "Keep bank, card and account numbers out of a role card.",
} as const;

/** A real calendar day as YYYY-MM-DD, or null. */
export function readDay(raw: unknown): string | null {
  const t = typeof raw === "string" ? raw.trim() : "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return null;
  const d = new Date(`${t}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === t ? t : null;
}

/** Whole days since 1970-01-01 for a YYYY-MM-DD already read by `readDay`. */
export function dayNumber(day: string): number {
  return Math.round(Date.parse(`${day}T00:00:00Z`) / 86_400_000);
}

const clean = (v: unknown): string => (typeof v === "string" ? v.replace(/\s+/g, " ").trim() : "");

export type DeliverablesRead = { ok: true; value: Deliverable[] } | { ok: false; problem: string };

/** The one reader, for the editor's save, a proposal and the stored document alike. */
export function readDeliverables(raw: unknown): DeliverablesRead {
  if (raw === null || raw === undefined || raw === "") return { ok: true, value: [] };
  // The editor reads its own text form into rows (shared/roleDeliverablesText.ts); a string here is one it could not read.
  if (!Array.isArray(raw)) return { ok: false, problem: DELIVERABLE_PROBLEMS.notAList };
  const out: Deliverable[] = [];
  for (const item of raw) {
    const o = (item && typeof item === "object" ? item : {}) as Record<string, unknown>;
    const title = clean(o.title);
    const workstream = clean(o.workstream);
    const start = readDay(o.start);
    // Dates as YYYY-MM-DD order as text, so an end before its start is a smaller string.
    const end = o.end === undefined || o.end === null || o.end === "" ? start : readDay(o.end);
    if (!title || title.length > DELIVERABLE_LIMITS.titleChars || workstream.length > DELIVERABLE_LIMITS.workstreamChars || !start || !end || end < start) return { ok: false, problem: DELIVERABLE_PROBLEMS.row };
    if (looksLikePaymentDetails(`${title} ${workstream}`)) return { ok: false, problem: DELIVERABLE_PROBLEMS.payment };
    const milestone = o.milestone === true || start === end;
    out.push({ title, start, end: milestone ? start : end, ...(workstream ? { workstream } : {}), ...(milestone ? { milestone: true } : {}) });
  }
  if (out.length > DELIVERABLE_LIMITS.rows) return { ok: false, problem: DELIVERABLE_PROBLEMS.tooMany };
  return { ok: true, value: out };
}
