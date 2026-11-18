/**
 * CAPS ON VOTING WEIGHT BY SOURCE: THE ARITHMETIC.
 *
 * A village that weighs votes by a token (`governance.weight_mode = token`) can
 * cap how much of one member's balance a ballot counts, separately for the part
 * that came from CASH and the part that came from everything else. Each cap is
 * a switch and a whole-token number (`governance.weight_cap_cash_on` and
 * `governance.weight_cap_cash`, the same pair for other), off by default.
 *
 * ── ENFORCED AT WEIGHT TIME, NEVER AT MINT ─────────────────────────────────
 *
 * Nothing here clips, refuses or rewrites a mint. The ledger records every
 * contribution in full and the cap only decides what a ballot COUNTS, at the
 * moment the ballot freezes its roll. Three reasons:
 *
 *   - Work pay is never capped (constitution II.6), and Voice is part of pay.
 *   - A cap changed by a vote applies at the next ballot to everybody alike,
 *     with nothing lost to restore when it is raised.
 *   - The record stays honest: a member's balance says what they contributed,
 *     and each ballot row freezes the balance, its cash part and the caps it
 *     was counted under (`ballot_electorate.held_weight` and the three beside
 *     it), so anyone can recompute the weight.
 *
 * ── HOW A BALANCE SPLITS INTO ITS TWO PARTS ────────────────────────────────
 *
 * The cash part is the balance times the cash share of everything minted to
 * the member, each source net of its own reversals. Decay and exit sweeps take
 * from the balance as a whole, so they take from both parts alike; this is the
 * same doctrine `workShare` (shared/voiceFromMoney.ts) states for work Voice.
 * A balance with nothing traceable behind it is all "other", so it is still
 * capped. The cash part is floored and the remainder is other, so the two parts
 * always sum to the balance exactly.
 *
 * WHICH SOURCES ARE CASH. One list, `MONEY_VOICE_SOURCES`, which a work-only
 * count already reads, so a source cannot be money to one rule and work to the
 * other. Every source not on it is "other", an unknown one included.
 *
 * Pure: no pool, no clock. All amounts are in the token's MINOR units, the
 * units `token_balances` holds and a ballot's weight is stored in.
 */
import { minorPerWhole } from "./tokenScale";
import { voiceSourceKind } from "./voiceFromMoney";

export type ContributionKind = "cash" | "other";

/** The ledger source of a hand-mint a steward marked as cash. */
export const HAND_MINT_CASH_SOURCE = "admin_mint_cash";
/** The ledger source of every other hand-mint, unchanged from before the tag. */
export const HAND_MINT_OTHER_SOURCE = "admin_mint";

export function contributionKindOfSource(source: string): ContributionKind {
  return voiceSourceKind(source) === "money" ? "cash" : "other";
}

/**
 * The tag a hand-mint request carries. Absent or blank reads "other", which is
 * what every hand-mint meant before the tag existed. Anything else that is not
 * "cash" or "other" is refused (null), so a typo never silently becomes either.
 */
export function parseContributionKind(raw: unknown): ContributionKind | null {
  if (raw === undefined || raw === null) return "other";
  if (typeof raw !== "string") return null;
  const v = raw.trim().toLowerCase();
  if (v === "") return "other";
  return v === "cash" || v === "other" ? v : null;
}

export function handMintSource(kind: ContributionKind): string {
  return kind === "cash" ? HAND_MINT_CASH_SOURCE : HAND_MINT_OTHER_SOURCE;
}

/** Each cap in minor units, or null for a cap that is off. */
export interface SourceCaps {
  cash: number | null;
  other: number | null;
}

/** Whole-token caps (the dials) to the token's minor units. An off cap stays null. */
export function capsInMinor(whole: SourceCaps, decimals: number): SourceCaps {
  const per = minorPerWhole(decimals);
  const scale = (n: number | null) => (n === null ? null : Math.round(n * per));
  return { cash: scale(whole.cash), other: scale(whole.other) };
}

export interface HeldSplit {
  held: number;
  cash: number;
  other: number;
}

export function splitHeld(balance: number, netBySource: Readonly<Record<string, number>>): HeldSplit {
  const held = Number.isFinite(balance) && balance > 0 ? Math.floor(balance) : 0;
  let cash = 0;
  let all = 0;
  for (const [source, amount] of Object.entries(netBySource)) {
    const n = Number(amount);
    if (!Number.isFinite(n) || n <= 0) continue;
    all += n;
    if (contributionKindOfSource(source) === "cash") cash += n;
  }
  const cashPart = all > 0 ? Math.min(held, Math.floor((held * cash) / all + 1e-9)) : 0;
  return { held, cash: cashPart, other: held - cashPart };
}

export interface CountedWeight {
  /** What the ballot counts: the capped cash part plus the capped other part. */
  counted: number;
  cash: number;
  other: number;
}

/** A cap that is not a finite, non-negative number caps at 0: caps fail closed. */
function capOf(cap: number | null): number | null {
  if (cap === null) return null;
  return Number.isFinite(cap) && cap > 0 ? Math.floor(cap) : 0;
}

export function countedWeight(split: HeldSplit, caps: SourceCaps): CountedWeight {
  const cashCap = capOf(caps.cash);
  const otherCap = capOf(caps.other);
  const cash = cashCap === null ? split.cash : Math.min(split.cash, cashCap);
  const other = otherCap === null ? split.other : Math.min(split.other, otherCap);
  return { counted: cash + other, cash, other };
}
