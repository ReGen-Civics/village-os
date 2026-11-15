/**
 * A ROLE'S PRICE IS ITS TOTAL REWARD (Rye, 15 Nov 2026, P1-6: "Total reward").
 *
 * A role's listed price, the 120% cap and the contract figure written at
 * adoption are the WHOLE reward, cash and Earned Equity and Credits together,
 * as Ruling A of 1 Nov has it for every price. So an End of Moon line is not
 * all cash: it is shared out, and only the cash share is owed as cash. Earned
 * Equity and Credits are issued through the ledger, once per line.
 *
 * Whose split, in order:
 *   1. the role card's own shape ("Cash 60, Equity 40"), `payShape`;
 *   2. the village's shape, the `org.pay_shape` setting;
 *   3. neither: the whole line is cash, as it was before 15 Nov, and the line
 *      says no split is written. Nothing invents one: the valuation model's
 *      default cash share is 0%, and a member would be owed no cash at all.
 * A shape whose labels do not all read as cash, equity or credits is passed
 * over, so a typo never pays a share somewhere nobody meant. A shape adding to
 * less than 100 gives the rest as Credits, and the line says so.
 *
 * What Earned Equity is a share of is the village's own words (Admin, Tokens;
 * Rye, 5 Nov 2026), and nothing here names it. While those words are unwritten
 * the Earned Equity share is held, owed and never issued, and never turned
 * into cash either.
 *
 * Pure: no pool, no clock.
 */
import type { PayShare } from "./roleCardSections";
import { moneyWords } from "./seatSettings";

export type RewardPart = "cash" | "equity" | "credits";

/** Where a line's split came from. */
export type RewardSplitFrom = "card" | "village" | "none";

/** A line's total shared out, in the line's minor units (tokens at one per whole currency unit). */
export interface LineReward {
  from: RewardSplitFrom;
  /** The line's amount this was worked from: the whole reward. */
  totalMinor: number;
  cashMinor: number;
  equityUnits: number;
  creditsUnits: number;
  /** The token slugs the two token shares issue in. */
  tokens: { equity: string; credits: string };
  /** The Earned Equity share is owed, unissued, until the village writes what it means. */
  equityHeld: boolean;
  /** A shape adding to less than 100: the rest went to Credits. */
  restToCreditsPct: number;
}

const CASH = /\bcash\b/i;
const EQUITY = /equity/i;
const CREDITS = /credit/i;

/** Which part a share's label names, or null when it names none or more than one. */
export function partOfLabel(label: string): RewardPart | null {
  const hits = ([["cash", CASH], ["equity", EQUITY], ["credits", CREDITS]] as const).filter(([, re]) => re.test(label));
  return hits.length === 1 ? hits[0][0] : null;
}

/** A shape as three percents, or null when any label reads as no part, a part is named twice, or it adds past 100. */
export function partsOfShape(shape: readonly PayShare[]): { cash: number; equity: number; credits: number; rest: number } | null {
  if (!shape.length) return null;
  const out = { cash: 0, equity: 0, credits: 0 };
  const seen = new Set<RewardPart>();
  for (const s of shape) {
    const part = partOfLabel(s.label);
    if (!part || seen.has(part) || !Number.isInteger(s.pct) || s.pct < 0 || s.pct > 100) return null;
    seen.add(part);
    out[part] = s.pct;
  }
  const sum = out.cash + out.equity + out.credits;
  if (sum > 100) return null;
  return { ...out, rest: 100 - sum };
}

/** Whole units of a percent of a minor amount, rounded down, back in minor units. */
const wholeShare = (totalMinor: number, pct: number): number => Math.floor((totalMinor * pct) / 100 / 100) * 100;

/**
 * Share one line's total. `shapes` are the card's and the village's, tried in
 * that order; with neither, the whole line is cash. Null for a line with no
 * money. Cash takes what rounding leaves, so the three parts always add up to
 * the line, to the cent.
 */
export function shareLine(
  totalMinor: number | null,
  shapes: { card: readonly PayShare[]; village: readonly PayShare[] },
  opts: { equityMeaningWritten: boolean; tokens: { equity: string; credits: string } },
): LineReward | null {
  if (totalMinor === null || !Number.isInteger(totalMinor) || totalMinor <= 0) return null;
  const card = partsOfShape(shapes.card);
  const village = card ? null : partsOfShape(shapes.village);
  const parts = card ?? village;
  const from: RewardSplitFrom = card ? "card" : village ? "village" : "none";
  const rest = parts ? parts.rest : 0;
  const equityUnits = parts ? wholeShare(totalMinor, parts.equity) / 100 : 0;
  const creditsUnits = parts ? wholeShare(totalMinor, parts.credits + parts.rest) / 100 : 0;
  const cashMinor = totalMinor - (equityUnits + creditsUnits) * 100;
  return { from, totalMinor, cashMinor, equityUnits, creditsUnits, tokens: opts.tokens, equityHeld: equityUnits > 0 && !opts.equityMeaningWritten, restToCreditsPct: rest };
}

/** The cash a line owes: its cash share when it was shared out, else the whole amount (a line from before 15 Nov). */
export function cashOfLine(line: { amountMinor: number | null; reward?: LineReward | null }): number | null {
  if (line.amountMinor === null) return null;
  return line.reward && line.reward.totalMinor === line.amountMinor ? line.reward.cashMinor : line.amountMinor;
}

/** A whole percent of the total, for the words. */
const pctOf = (part: number, total: number): number => (total > 0 ? Math.round((part * 100) / total) : 0);

export const REWARD_SHARE_WORDS = {
  from: { card: "by the role card's split", village: "by the village's split", none: "all in cash: no split is written for this role or the village" } satisfies Record<RewardSplitFrom, string>,
  held: "Earned Equity is owed until the village writes what it means (Admin, Tokens).",
};

/**
 * "Total reward $6,500.00: $3,900.00 cash (60%), 2,600 Earned Equity (40%), 0 Credits (0%), by the role card's split."
 * Every part is said, a 0% one too, so a Treasurer can read the split back to the member.
 */
export function rewardShareLine(r: LineReward, currency: string): string {
  const t = r.totalMinor;
  const eq = r.equityUnits * 100;
  const cr = r.creditsUnits * 100;
  const parts = [
    `${moneyWords(r.cashMinor, currency)} cash (${pctOf(r.cashMinor, t)}%)`,
    `${r.equityUnits.toLocaleString("en-US")} Earned Equity (${pctOf(eq, t)}%)`,
    `${r.creditsUnits.toLocaleString("en-US")} Credits (${pctOf(cr, t)}%)`,
  ];
  const rest = r.restToCreditsPct > 0 ? ` The split names ${100 - r.restToCreditsPct}%, so the other ${r.restToCreditsPct}% is Credits.` : "";
  return `Total reward ${moneyWords(t, currency)}: ${parts.join(", ")}, ${REWARD_SHARE_WORDS.from[r.from]}.${rest}${r.equityHeld ? ` ${REWARD_SHARE_WORDS.held}` : ""}`;
}
