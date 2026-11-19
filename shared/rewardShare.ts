/**
 * A ROLE'S PRICE IS ITS TOTAL REWARD (Rye, 15 Nov 2026, P1-6: "Total reward").
 *
 * A role's listed price, the 120% cap and the contract figure written at
 * adoption are the WHOLE reward, cash and Earned Equity and Credits together,
 * as Ruling A of 1 Nov has it for every price. So an End of Moon line is not
 * all cash: it is shared out, and only the cash share is owed as cash. Earned
 * Equity and Credits are issued through the ledger, once per line.
 *
 * Whose split, in order (the coordinator's call, 15 Nov 2026: "the split
 * follows what the card showed the person"):
 *   1. the contract's, `pay.shape`, written at adoption: the applicant's proposed split when they sent one,
 *      else what the card showed (the lead, 18 Nov 2026; shared/proposalSplit.ts `adoptedShape`);
 *   2. the role card's own shape ("Cash 60, Equity 40"), `payShape`;
 *   3. the village's default, the `org.pay_shape` setting (the card's "Default split");
 *   4. none of them: the whole line is cash, and the Treasurer's queue says
 *      "No split set: paid all in cash." before they confirm. Never the
 *      valuation model's default, whose cash share is 0%.
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

/**
 * One share of a split, as the role card and the village setting write it (shared/roleCardSections.ts
 * `PayShare`). Written here, never imported: a module that moves value stays clear of the seat settings
 * model, which roleCardSections reaches (shared/seatSettings.boundary.test.ts).
 */
import { namedPart, shareNames, type ShareNames } from "./contributionToken";

export interface PayShare {
  label: string;
  pct: number;
}

/** "US$3,900", "US$12.50": a minor amount in the line's currency, cents only when there are any. */
function moneyWords(minor: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-GB", { style: "currency", currency, minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(minor / 100);
  } catch {
    return `${(minor / 100).toLocaleString("en-GB")} ${currency}`;
  }
}

export type RewardPart = "cash" | "equity" | "credits";

/** Where a line's split came from. */
export type RewardSplitFrom = "contract" | "card" | "village" | "none";

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
  /**
   * The two token shares' names as the village had them when the line was shared (Admin, Tokens). Absent on a
   * line shared before 19 Nov 2026; the words then read the platform defaults (shared/contributionToken.ts).
   */
  names?: ShareNames;
}

const CASH = /\bcash\b/i;
// "equity" stays read forever: contracts written before 19 Nov 2026 carry it in their stored shape.
const EQUITY = /equity|\bcontribution/i;
const CREDITS = /credit|\busage\b/i;

/**
 * Which part a share's label names, or null when it names none or more than one. A label that is exactly one of
 * the village's token names ("Amora", "Usage tokens") names that share first (the lead, 19 Nov 2026), so a
 * village can label its shares with its own words and End of Moon still pays each where it was meant.
 */
export function partOfLabel(label: string, names?: Partial<ShareNames> | null): RewardPart | null {
  const named = namedPart(label, names);
  if (named) return named;
  const hits = ([["cash", CASH], ["equity", EQUITY], ["credits", CREDITS]] as const).filter(([, re]) => re.test(label));
  return hits.length === 1 ? hits[0][0] : null;
}

/** A shape as three percents, or null when any label reads as no part, a part is named twice, or it adds past 100. */
export function partsOfShape(shape: readonly PayShare[], names?: Partial<ShareNames> | null): { cash: number; equity: number; credits: number; rest: number } | null {
  if (!shape.length) return null;
  const out = { cash: 0, equity: 0, credits: 0 };
  const seen = new Set<RewardPart>();
  for (const s of shape) {
    const part = partOfLabel(s.label, names);
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
 * Share one line's total. `shapes` are the contract's, the card's and the
 * village's, tried in that order; with none, the whole line is cash. Null for a line with no
 * money. Cash takes what rounding leaves, so the three parts always add up to
 * the line, to the cent.
 */
export function shareLine(
  totalMinor: number | null,
  shapes: { contract?: readonly PayShare[]; card: readonly PayShare[]; village: readonly PayShare[] },
  opts: { equityMeaningWritten: boolean; tokens: { equity: string; credits: string }; names?: Partial<ShareNames> | null },
): LineReward | null {
  if (totalMinor === null || !Number.isInteger(totalMinor) || totalMinor <= 0) return null;
  const tried: Array<[RewardSplitFrom, readonly PayShare[]]> = [["contract", shapes.contract ?? []], ["card", shapes.card], ["village", shapes.village]];
  let from: RewardSplitFrom = "none";
  let parts: ReturnType<typeof partsOfShape> = null;
  for (const [who, shape] of tried) {
    parts = partsOfShape(shape, opts.names);
    if (parts) {
      from = who;
      break;
    }
  }
  const rest = parts ? parts.rest : 0;
  const equityUnits = parts ? wholeShare(totalMinor, parts.equity) / 100 : 0;
  const creditsUnits = parts ? wholeShare(totalMinor, parts.credits + parts.rest) / 100 : 0;
  const cashMinor = totalMinor - (equityUnits + creditsUnits) * 100;
  return {
    from,
    totalMinor,
    cashMinor,
    equityUnits,
    creditsUnits,
    tokens: opts.tokens,
    equityHeld: equityUnits > 0 && !opts.equityMeaningWritten,
    restToCreditsPct: rest,
    ...(opts.names ? { names: shareNames(opts.names) } : {}),
  };
}

/** The cash a line owes: its cash share when it was shared out, else the whole amount (a line from before 15 Nov). */
export function cashOfLine(line: { amountMinor: number | null; reward?: LineReward | null }): number | null {
  if (line.amountMinor === null) return null;
  return line.reward && line.reward.totalMinor === line.amountMinor ? line.reward.cashMinor : line.amountMinor;
}

/**
 * WHAT THE PAYER IS BILLED (call 2, with Rye; the coordinator's suggestion, 15 Nov 2026): the cash share
 * only, with Earned Equity and Credits listed beside it as earned with nothing to pay, since the village
 * issues them. "total" bills the whole reward. One constant, so a ruling the other way is a one-line flip.
 */
export const PAYER_IS_BILLED: "cash" | "total" = "cash";

/** What a payer is billed for one line: its cash share, or its whole amount, by `PAYER_IS_BILLED`. */
export function billedOfLine(line: { amountMinor: number | null; reward?: LineReward | null }): number | null {
  return PAYER_IS_BILLED === "cash" ? cashOfLine(line) : line.amountMinor;
}

/** "Also earned, nothing to pay: 2,600 Amora, 0 Credits. Total reward US$6,500." Null when the payer is billed it all, or nothing was shared. */
export function earnedBesideLine(r: LineReward | null | undefined, currency: string, names?: Partial<ShareNames> | null): string | null {
  if (PAYER_IS_BILLED !== "cash" || !r || r.equityUnits + r.creditsUnits === 0) return null;
  const n = shareNames(names ?? r.names);
  return `${REWARD_SHARE_WORDS.earnedBeside}: ${r.equityUnits.toLocaleString("en-US")} ${n.equity}, ${r.creditsUnits.toLocaleString("en-US")} ${n.credits}. Total reward ${moneyWords(r.totalMinor, currency)}.`;
}

/** A whole percent of the total, for the words. */
const pctOf = (part: number, total: number): number => (total > 0 ? Math.round((part * 100) / total) : 0);

export const REWARD_SHARE_WORDS = {
  from: { contract: "by the split in their contract", card: "by the role card's split", village: "by the village's default split", none: "" } satisfies Record<RewardSplitFrom, string>,
  /** The queue row, the invoice and the member's line say it first, before anyone confirms (the coordinator's call 1). */
  none: "No split set: paid all in cash.",
  earnedBeside: "Also earned, nothing to pay",
  held: (equity: string) => `The ${equity} share is owed until the village writes what ${equity} means (Admin, Tokens).`,
};

/**
 * "Total reward $6,500.00: $3,900.00 cash (60%), 2,600 Earned Equity (40%), 0 Credits (0%), by the role card's split."
 * Every part is said, a 0% one too, so a Treasurer can read the split back to the member.
 */
export function rewardShareLine(r: LineReward, currency: string, names?: Partial<ShareNames> | null): string {
  const n = shareNames(names ?? r.names);
  if (r.from === "none") return `${REWARD_SHARE_WORDS.none} Total reward ${moneyWords(r.totalMinor, currency)}.`;
  const t = r.totalMinor;
  const eq = r.equityUnits * 100;
  const cr = r.creditsUnits * 100;
  const parts = [
    `${moneyWords(r.cashMinor, currency)} cash (${pctOf(r.cashMinor, t)}%)`,
    `${r.equityUnits.toLocaleString("en-US")} ${n.equity} (${pctOf(eq, t)}%)`,
    `${r.creditsUnits.toLocaleString("en-US")} ${n.credits} (${pctOf(cr, t)}%)`,
  ];
  const rest = r.restToCreditsPct > 0 ? ` The split names ${100 - r.restToCreditsPct}%, so the other ${r.restToCreditsPct}% is ${n.credits}.` : "";
  return `Total reward ${moneyWords(t, currency)}: ${parts.join(", ")}, ${REWARD_SHARE_WORDS.from[r.from]}.${rest}${r.equityHeld ? ` ${REWARD_SHARE_WORDS.held(n.equity)}` : ""}`;
}
