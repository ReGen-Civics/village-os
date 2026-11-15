/**
 * THE REWARDS PIECE'S WORDS FOR A ROLE THAT CAN BE SHARED (Rye, 14 Nov 2026, through the coordinator).
 *
 *   "Up to $13,000 a month for the full role*"
 *   "Take on all of it, or part of it: we're open to proposals from 30% to 100%. One person can hold
 *    the whole role, or a few people can share it."
 *   "Your proposal sets your pay. Tell us what you'd deliver each moon and how much of yourself that
 *    takes; that becomes your contract (value in, value out). At 50%, this role pays up to $6,500 a
 *    month."
 *   "*The full band, at 100% commitment. Your first moon starts lower and is tied to what you deliver."
 *
 * The figure is the card's own ceiling (shared/roleCardSections.ts); the share is straight
 * proportional (shared/commitmentRange.ts, ruling 1). A role offered at 100% only says nothing about
 * sharing. Display only: the contract sets the pay.
 *
 * Pure: no Node builtins.
 */
import { ceilingAt, rangeMin } from "./commitmentRange";
import type { PayCeiling } from "./roleCardSections";

/** "$13,000", or "13,000 XYZ" for a code the formatter does not know. */
export function moneyWords(amount: number, currency: string, locale = "en-US"): string {
  try {
    return new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: 0, minimumFractionDigits: 0 }).format(amount);
  } catch {
    return `${amount.toLocaleString(locale)} ${currency}`;
  }
}

/** "Up to $6,500 a month", the most at one commitment. */
export function ceilingAtWords(c: PayCeiling, pct: number): string {
  return `Up to ${moneyWords(ceilingAt(c.amount, pct), c.currency)} a ${c.per}`;
}

export interface RewardWords {
  headline: string;
  /** Null for a role offered at 100% only. */
  range: string | null;
  proposal: string;
  footnote: string;
}

/** The example share the proposal line names: 50%, or the role's minimum when that is higher. */
export const exampleShare = (min: number | null | undefined): number => Math.max(rangeMin(min), 50);

export function rewardWords(c: PayCeiling, min: number | null | undefined): RewardWords {
  const lo = rangeMin(min);
  const shared = lo < 100;
  const at = exampleShare(min);
  return {
    headline: `Up to ${moneyWords(c.amount, c.currency)} a ${c.per} for the full role*`,
    range: shared ? `Take on all of it, or part of it: we're open to proposals from ${lo}% to 100%. One person can hold the whole role, or a few people can share it.` : null,
    proposal: `Your proposal sets your pay. Tell us what you'd deliver each moon and how much of yourself that takes; that becomes your contract (value in, value out).${shared ? ` At ${at}%, this role pays ${ceilingAtWords(c, at).replace(/^Up/, "up")}.` : ""}`,
    footnote: "*The full band, at 100% commitment. Your first moon starts lower and is tied to what you deliver.",
  };
}

/** The commitment row: "30% to 100% (100% is the whole role)", or "100%" for a role offered whole. */
export function commitmentRowWords(min: number | null | undefined): string {
  const lo = rangeMin(min);
  return lo < 100 ? `${lo}% to 100% (100% is the whole role)` : "100%";
}
