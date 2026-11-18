/**
 * THE SPLIT A PERSON PROPOSES (the lead, 17 Nov 2026): a role's total reward shared into the village's pay
 * shape (cash, equity, credits, or whatever labels the shape in force writes), at the commitment they chose.
 *
 *   "Every share is hand-editable in the proposal, in BOTH forms: a percent field and a raw amount field."
 *   "Save what the village offered beside what the person proposed, so the difference is known."
 *
 * THE RULES THIS FILE HOLDS
 *   - Each share is a whole percent and a whole amount in currency units. The percents add to 100 and the
 *     amounts add to the total, always (`shareOut`, largest remainder, so rounding never loses a unit).
 *   - The total is the price in force: the person's own price when they proposed one, else the listed price
 *     at their commitment (`ceilingAt`, straight proportional, ruling 1).
 *   - REBALANCING. Typing a percent sets that share; the difference comes from (or goes to) the other shares
 *     in proportion to their current size, and to them evenly when they are all at 0. Typing an amount keeps
 *     that amount exactly; its percent becomes the nearest whole percent of the total and the rest of the
 *     total is shared over the others the same way. A value above the whole is held to the whole.
 *   - A change of commitment or price keeps the person's percents and works the amounts again, so the split
 *     always adds up to the price it describes.
 *   - The default is the shape in force (the card's own, else the village's). A shape that adds to less than
 *     100 gives the rest to its credits share, as the End of Moon split does (shared/rewardShare.ts), or to
 *     its last share when it names no credits.
 *
 * No share is locked: no switch says whether the village issues tokens yet, and the token terms show on every
 * card for now (TOKEN_TERMS_ALWAYS, client/src/components/roleCard/rewardWords.ts).
 *
 * DISPLAY AND PROPOSAL ONLY. Nothing here moves value. The contract's split is still written at adoption
 * from what the card showed (server/lib/openProposalDecide.ts `contractPriceFor`); the deciders read the
 * proposed split beside the offered one.
 *
 * Pure: no Node builtins, no clock.
 */
import { ceilingAt } from "./commitmentRange";

/** One share of a shape: a label and a whole percent. Written here so this file imports no settings model. */
export interface ShapeShare {
  label: string;
  pct: number;
}

export type { ProposalSplit, Split, SplitShare } from "./proposalSplitStored";
export { proposalSplitOf } from "./proposalSplitStored";
import type { Split, SplitShare } from "./proposalSplitStored";

export const SPLIT_WORDS = {
  shape: "Your split must name the role's shares, each a whole percent, adding up to 100.",
  amounts: "Your split's amounts must be whole numbers that add up to your price.",
  noShape: "This role shows no split to propose against.",
} as const;

const whole = (n: unknown): n is number => typeof n === "number" && Number.isInteger(n);
const CREDITS = /credit/i;

/**
 * Share `total` by `weights`, whole units, adding up to `total` exactly: each gets its floor, and what is left
 * goes one unit at a time to the largest remainders (earlier shares first on a tie). All weights 0: evenly.
 */
export function shareOut(total: number, weights: readonly number[]): number[] {
  const n = weights.length;
  if (n === 0) return [];
  const t = Math.max(0, Math.floor(total));
  const w = weights.map((x) => (Number.isFinite(x) && x > 0 ? x : 0));
  const sum = w.reduce((a, b) => a + b, 0);
  const use = sum > 0 ? w : w.map(() => 1);
  const base = sum > 0 ? sum : n;
  const exact = use.map((x) => (t * x) / base);
  const out = exact.map((x) => Math.floor(x));
  let left = t - out.reduce((a, b) => a + b, 0);
  const order = exact.map((x, i) => ({ i, r: x - Math.floor(x) })).sort((a, b) => b.r - a.r || a.i - b.i);
  for (let k = 0; left > 0 && k < order.length; k++, left--) out[order[k].i]++;
  return out;
}

/** The shape in force as a split's percents: whole, adding to 100 (the rest to credits, else the last share). */
export function shapePercents(shape: readonly ShapeShare[]): ShapeShare[] {
  const shares = shape.map((s) => ({ label: s.label, pct: whole(s.pct) && s.pct > 0 ? Math.min(s.pct, 100) : 0 }));
  if (!shares.length) return [];
  const sum = shares.reduce((a, s) => a + s.pct, 0);
  if (sum > 100) {
    const pcts = shareOut(100, shares.map((s) => s.pct));
    return shares.map((s, i) => ({ ...s, pct: pcts[i] }));
  }
  if (sum < 100) {
    const at = shares.findIndex((s) => CREDITS.test(s.label));
    shares[at >= 0 ? at : shares.length - 1].pct += 100 - sum;
  }
  return shares;
}

/** The amounts of a split's percents at a total (whole units, adding to the total). No total: percents only. */
export function withAmounts(shares: readonly ShapeShare[], total: number | null): Split {
  if (total === null || !Number.isFinite(total) || total < 0) return { total: null, shares: shares.map((s) => ({ label: s.label, pct: s.pct })) };
  const t = Math.floor(total);
  const amounts = shareOut(t, shares.map((s) => s.pct));
  return { total: t, shares: shares.map((s, i) => ({ label: s.label, pct: s.pct, amount: amounts[i] })) };
}

/** The village's offer: the shape in force at the total. */
export function offeredSplit(shape: readonly ShapeShare[], total: number | null): Split {
  return withAmounts(shapePercents(shape), total);
}

/** The price a split describes: their own price when they proposed one, else the listed price at their commitment. */
export function splitTotal(fullBand: number | null | undefined, pct: number | null | undefined, ownPrice: number | null | undefined): number | null {
  if (whole(ownPrice) && ownPrice > 0) return ownPrice;
  if (typeof fullBand !== "number" || fullBand <= 0) return null;
  const at = typeof pct === "number" && pct > 0 ? pct : 100;
  return ceilingAt(fullBand, at);
}

/** Percent edit: share `i` to `pct` (held to 0..100), the others absorbing the difference by their size. */
export function setPercent(split: Split, i: number, pct: number): Split {
  if (i < 0 || i >= split.shares.length) return split;
  const p = Math.max(0, Math.min(100, Math.round(Number.isFinite(pct) ? pct : 0)));
  if (split.shares.length === 1) return withAmounts([{ label: split.shares[0].label, pct: 100 }], split.total);
  const rest = shareOut(100 - p, split.shares.filter((_, k) => k !== i).map((s) => s.pct));
  let r = 0;
  const pcts = split.shares.map((_, k) => (k === i ? p : rest[r++]));
  return withAmounts(split.shares.map((s, k) => ({ label: s.label, pct: pcts[k] })), split.total);
}

/**
 * Amount edit: share `i` keeps `amount` exactly (held to 0..total); its percent becomes the nearest whole percent
 * of the total, and the rest of the total, and of the percents, is shared over the others by their size.
 * Without a total there is no amount to type, and the split comes back as it was.
 */
export function setAmount(split: Split, i: number, amount: number): Split {
  const t = split.total;
  if (t === null || i < 0 || i >= split.shares.length) return split;
  if (split.shares.length === 1) return withAmounts([{ label: split.shares[0].label, pct: 100 }], t);
  const a = Math.max(0, Math.min(t, Math.floor(Number.isFinite(amount) ? amount : 0)));
  const p = t > 0 ? Math.round((a * 100) / t) : 0;
  const others = split.shares.filter((_, k) => k !== i);
  const weights = others.map((s) => (s.amount ?? 0) || s.pct);
  const restAmounts = shareOut(t - a, weights);
  const restPcts = shareOut(100 - p, weights);
  let r = 0;
  return {
    total: t,
    shares: split.shares.map((s, k) => {
      if (k === i) return { label: s.label, pct: p, amount: a };
      const out = { label: s.label, pct: restPcts[r], amount: restAmounts[r] };
      r++;
      return out;
    }),
  };
}

/** The same percents at a new total (a new commitment or price): the amounts worked again. */
export function retotal(split: Split, total: number | null): Split {
  return withAmounts(split.shares, total);
}

/** Whether the person changed the split: a percent differs, or at the same total an amount differs. */
export function splitChanged(offered: Split, proposed: Split): boolean {
  if (offered.shares.length !== proposed.shares.length) return true;
  const sameTotal = offered.total !== null && offered.total === proposed.total;
  return proposed.shares.some((s, k) => {
    const o = offered.shares[k];
    if (!o || o.label !== s.label || o.pct !== s.pct) return true;
    return sameTotal && whole(o.amount) && whole(s.amount) && o.amount !== s.amount;
  });
}

/** Which shares changed, by index: for the reviewers' highlight. */
export function changedShares(offered: Split, proposed: Split): boolean[] {
  const sameTotal = offered.total !== null && offered.total === proposed.total;
  return proposed.shares.map((s, k) => {
    const o = offered.shares[k];
    if (!o || o.label !== s.label || o.pct !== s.pct) return true;
    return sameTotal && whole(o.amount) && whole(s.amount) && o.amount !== s.amount;
  });
}

/**
 * A proposed split as the form sent it, read against the shape in force and the price it describes. Absent
 * is no split. Refused, never reread: labels other than the shape's in its order, a percent that is not
 * whole, percents not adding to 100, and amounts present that are not whole or do not add to the total.
 * With no total (the reader may not see a price) amounts are dropped and percents alone are kept.
 */
export function readProposedSplit(raw: unknown, shape: readonly ShapeShare[], total: number | null): { ok: true; value: Split | null } | { ok: false; problem: string } {
  if (raw === null || raw === undefined) return { ok: true, value: null };
  if (!shape.length) return { ok: false, problem: SPLIT_WORDS.noShape };
  const list = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>).shares : raw;
  if (!Array.isArray(list) || list.length !== shape.length) return { ok: false, problem: SPLIT_WORDS.shape };
  const shares: SplitShare[] = [];
  for (let k = 0; k < list.length; k++) {
    const o = list[k] && typeof list[k] === "object" ? (list[k] as Record<string, unknown>) : null;
    if (!o || o.label !== shape[k].label || !whole(o.pct) || o.pct < 0 || o.pct > 100) return { ok: false, problem: SPLIT_WORDS.shape };
    shares.push({ label: shape[k].label, pct: o.pct, ...(o.amount !== undefined && o.amount !== null ? { amount: o.amount as number } : {}) });
  }
  if (shares.reduce((a, s) => a + s.pct, 0) !== 100) return { ok: false, problem: SPLIT_WORDS.shape };
  if (total === null) return { ok: true, value: { total: null, shares: shares.map((s) => ({ label: s.label, pct: s.pct })) } };
  const typed = shares.every((s) => s.amount !== undefined);
  if (!typed) {
    if (shares.some((s) => s.amount !== undefined)) return { ok: false, problem: SPLIT_WORDS.amounts };
    return { ok: true, value: withAmounts(shares, total) };
  }
  if (!shares.every((s) => whole(s.amount) && (s.amount as number) >= 0) || shares.reduce((a, s) => a + (s.amount as number), 0) !== total) return { ok: false, problem: SPLIT_WORDS.amounts };
  return { ok: true, value: { total, shares } };
}

/**
 * The split a form draws: the village's offer at the commitment, and the person's split at the price in force.
 * Their split (`stored`) is kept as typed while its total still holds, worked again at a new total with their
 * percents kept, and replaced by the shape in force when it names other shares. Null for a role with no shape.
 */
export function formSplit(shape: readonly ShapeShare[], fullBand: number | null | undefined, pct: number | null | undefined, ownPrice: number | null | undefined, stored: Split | null | undefined): { offered: Split; shown: Split } | null {
  if (!shape.length) return null;
  const offered = offeredSplit(shape, splitTotal(fullBand, pct, null));
  const total = splitTotal(fullBand, pct, ownPrice);
  const fits = !!stored && stored.shares.length === offered.shares.length && stored.shares.every((s, i) => s.label === offered.shares[i].label);
  const base = fits ? (stored as Split) : offeredSplit(shape, total);
  return { offered, shown: base.total === total ? base : retotal(base, total) };
}
