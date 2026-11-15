/**
 * A ROLE'S COMMITMENT RANGE (Rye, 14 Nov 2026).
 *
 *   "We're also open to this role being with several people filling to the 100%
 *   commitment we need ... we're open to proposals from 30 to 100% commitment ...
 *   the total compensation we're showing there is for the full 100% commitment
 *   ... how much we actually pay is on a contract, and that's all part of their
 *   proposal."
 *
 * His rulings (14 Nov):
 *   1. The ceiling is straight proportional: up to band x commitment, so 50% of
 *      $13,000 a month is up to $6,500.
 *   2. Each role sets the least one person may propose (`commitmentMin`).
 *   3. The pay ask is optional: a monthly amount, or "negotiate on the first
 *      call if chosen". A contractor may propose more or less than the suggested price, above
 *      the full band too (Rye, 14 Nov 2026); the contract sets the amount.
 *   4. A role may fill beyond 100%. Each role has a target total commitment
 *      (`commitmentTarget`, 100 unless set, 300 for three whole people). It
 *      stays open while what its holders give is below the target.
 *
 * DISPLAY AND PROPOSAL ONLY. Nothing here moves value: the ceiling is a line on a
 * card and on a decider's page, and the ask is the applicant's words. The
 * contract sets the pay.
 *
 * THE CAP (Rye, 15 Nov 2026): proposals go up to ROLE_PAY_CAP_PCT of the listed
 * price at the same commitment (`capAt`), and the server refuses an ask above it.
 * The math is shared with the End of Moon invoice (shared/rolePayMath.ts).
 *
 * Pure: no Node builtins, no clock.
 */
import { payForTime, ROLE_PAY_CAP_PCT } from "./rolePayMath";

export { ROLE_PAY_CAP_PCT };
/**
 * The periods an ask may be for: the same three a role's ceiling names (CEILING_PERIODS in shared/roleCardSections.ts,
 * held equal by commitmentRange.test.ts). Written here, not imported: roleCardSections reaches shared/seatSettings.ts,
 * and pay modules read this file (shared/seatSettings.boundary.test.ts).
 */
export const ASK_PERIODS = ["month", "moon", "year"] as const;
export type AskPeriod = (typeof ASK_PERIODS)[number];

export const COMMITMENT_TARGET_DEFAULT = 100;
export const COMMITMENT_TARGET_MAX = 1000;
/** The choices a person picks from, in steps of 10 (the seat settings' steps). */
export const COMMITMENT_STEP = 10;

/** The longest "why this price" line. */
export const PRICE_WHY_MAX = 600;

export type RangeRead<T> = { ok: true; value: T } | { ok: false; problem: string };

export const RANGE_WORDS = {
  min: "The least commitment one person may propose is a whole percent from 1 to 100.",
  target: `The commitment a role needs in all is a whole percent from 1 to ${COMMITMENT_TARGET_MAX}.`,
  askAmount: "Write the monthly amount you would ask as a whole number, like 6500.",
  askWhy: `Keep why this price to ${PRICE_WHY_MAX} characters.`,
  askPeriod: "Choose a price for each month, moon or year.",
  askBoth: "Choose a price or to negotiate on the first call, one of the two.",
  askShape: "Choose a price, or to negotiate on the first call.",
  askNoPrice: "This role lists no price yet, so choose to negotiate on the first call.",
} as const;

/**
 * Digits only, read without a backtracking pattern (CodeQL js/polynomial-redos on #1243): the text is
 * capped first, trimmed, an optional trailing "%" taken off, and then every character must be a digit.
 */
export function digitsOf(raw: string, maxDigits: number, percent = false): number {
  if (raw.length > maxDigits + 32) return NaN;
  let t = raw.trim();
  if (percent && t.endsWith("%")) t = t.slice(0, -1).trimEnd();
  if (t.length === 0 || t.length > maxDigits) return NaN;
  for (let i = 0; i < t.length; i++) {
    const c = t.charCodeAt(i);
    if (c < 48 || c > 57) return NaN;
  }
  return Number(t);
}

const whole = (raw: unknown): number => {
  if (typeof raw === "number") return Number.isInteger(raw) ? raw : NaN;
  if (typeof raw === "string") return digitsOf(raw, 4, true);
  return NaN;
};

/** The least commitment one person may propose: 1 to 100, or null for "not said" (100% only). */
export function readCommitmentMin(raw: unknown): RangeRead<number | null> {
  if (raw === null || raw === undefined || raw === "") return { ok: true, value: null };
  const n = whole(raw);
  return Number.isInteger(n) && n >= 1 && n <= 100 ? { ok: true, value: n } : { ok: false, problem: RANGE_WORDS.min };
}

/** The commitment a role needs in all: 1 to 1000, or null for "not said" (100). */
export function readCommitmentTarget(raw: unknown): RangeRead<number | null> {
  if (raw === null || raw === undefined || raw === "") return { ok: true, value: null };
  const n = whole(raw);
  return Number.isInteger(n) && n >= 1 && n <= COMMITMENT_TARGET_MAX ? { ok: true, value: n } : { ok: false, problem: RANGE_WORDS.target };
}

/** A stored column read tolerantly: anything unreadable is "not said". */
export const storedCommitmentMin = (raw: unknown): number | null => {
  const r = readCommitmentMin(raw);
  return r.ok ? r.value : null;
};
export const storedCommitmentTarget = (raw: unknown): number | null => {
  const r = readCommitmentTarget(raw);
  return r.ok ? r.value : null;
};

/** The least one person may propose, as a role states it. With no minimum, the whole role only. */
export function rangeMin(min: number | null | undefined): number {
  return typeof min === "number" && Number.isInteger(min) && min >= 1 && min <= 100 ? min : 100;
}

/** The choices a person picks from: each step of 10 from the minimum (rounded up to a step) to 100, the steps the terms accept. */
export function commitmentChoices(min: number | null | undefined): number[] {
  const out: number[] = [];
  for (let v = Math.ceil(rangeMin(min) / COMMITMENT_STEP) * COMMITMENT_STEP; v <= 100; v += COMMITMENT_STEP) out.push(v);
  return out;
}

/**
 * The listed price at a commitment: straight proportional to the full band (ruling 1), whole units, rounded
 * down. The band is the full role, priced at 100%, so the commitment is applied once (shared/rolePayMath.ts).
 */
export function ceilingAt(band: number, pct: number): number {
  if (!Number.isFinite(band) || band <= 0 || !Number.isFinite(pct) || pct <= 0) return 0;
  return Math.floor(payForTime(band, Math.min(pct, 100), 100));
}

/**
 * The most a proposal may ask at a commitment: ROLE_PAY_CAP_PCT of the listed price there (Rye, 15 Nov 2026),
 * whole units, rounded down. $13,000 at 100% caps at $15,600; at 50%, $7,800. Worked in whole numbers so
 * the cap never lands a unit short by floating point.
 */
export function capAt(band: number, pct: number): number {
  if (!Number.isInteger(band) || band <= 0 || !Number.isFinite(pct) || pct <= 0) return 0;
  return Math.floor((band * Math.round(Math.min(pct, 100) * 100) * ROLE_PAY_CAP_PCT) / 1_000_000);
}

/** Whether an amount ask goes above the cap at a commitment. With no commitment chosen, the full role's cap. */
export function askAboveCap(ask: PayAsk | null | undefined, band: number, pct: number | null | undefined): boolean {
  if (!ask || ask.kind !== "amount") return false;
  const cap = capAt(band, typeof pct === "number" && pct > 0 ? pct : 100);
  return cap > 0 && ask.monthly > cap;
}

/** How full a role is: what its holders give in all against what it needs. Never ranks anyone. */
export interface RoleFill {
  heldPct: number;
  targetPct: number;
  /** What is still open, never below 0. */
  openPct: number;
  covered: boolean;
  /** Only covered or open is known: the exact share would be one named person's commitment (security sweep L3). */
  coarse?: true;
}

/** A fill as a public page may read it: covered or open only, without the share. */
export interface CoarseFill {
  coarse: true;
  targetPct: number;
  covered: boolean;
}

/**
 * The fill a page anyone can read is sent (security sweep L3, 15 Nov 2026). When one person holds the role
 * and the village shows its people by name, the share held IS that named person's commitment, so only
 * covered or open goes out. Two or more holders, or no names shown, and the arithmetic stays exact.
 */
export function publicFill(f: RoleFill, people: number, namesShown: boolean): RoleFill | CoarseFill {
  return namesShown && people === 1 ? { coarse: true, targetPct: f.targetPct, covered: f.covered } : f;
}

/**
 * The fill of one role from its holders' commitments. A holder whose terms name no commitment holds the
 * whole role (100), as everyone did before commitments were written down.
 */
export function roleFill(holderPcts: ReadonlyArray<number | null | undefined>, target: number | null | undefined): RoleFill {
  const targetPct = typeof target === "number" && target >= 1 ? target : COMMITMENT_TARGET_DEFAULT;
  const heldPct = holderPcts.reduce<number>((n, p) => n + (typeof p === "number" && p > 0 ? Math.min(p, 100) : 100), 0);
  return { heldPct, targetPct, openPct: Math.max(0, targetPct - heldPct), covered: heldPct >= targetPct };
}

/** "50% held · 50% open", "120% held · covered". */
export function fillWords(f: RoleFill): string {
  if (f.coarse) return f.covered ? "Covered" : "Held, still open";
  return f.covered ? `${f.heldPct}% held · covered` : `${f.heldPct}% held · ${f.openPct}% open`;
}

/**
 * The applicant's optional pay ask (ruling 3): a monthly amount, or "negotiate on the first call if chosen",
 * with an optional line on why. As a contractor they may propose more or less than the suggested price
 * (Rye, 14 Nov 2026: "they can suggest a price higher or lower (to be more competitive as a proposal)
 * than the suggested price"), above the full role's band included. The contract decides the amount.
 */
export type PayAsk = {
  kind: "amount";
  /** The amount, for one `per`. The name is from when every ask was monthly; an ask with no `per` is a month. */
  monthly: number;
  /** The period the amount is for: the role's ceiling period when the form wrote it (QA F7, 15 Nov 2026). */
  per?: AskPeriod;
  why?: string;
} | { kind: "negotiate"; why?: string };

/** The period an amount ask is for: what it says, or a month for an ask written before asks said. */
export const askPeriod = (ask: { per?: AskPeriod }): AskPeriod => ask.per ?? "month";

/** The difference a proposed price makes on the suggested one, as a whole percent: +8, -15, 0. Null when either is 0 or missing: nothing to compare. */
export function priceDifferencePct(suggested: number, proposed: number): number | null {
  if (!Number.isFinite(suggested) || suggested <= 0 || !Number.isFinite(proposed) || proposed <= 0) return null;
  return Math.round(((proposed - suggested) / suggested) * 100);
}

/** "+8%", "-15%", "0%". */
export const signedPct = (n: number): string => (n > 0 ? `+${n}%` : `${n}%`);

/**
 * An ask as the form sent it. Absent is no ask; an amount must be a whole positive number. Refused, never
 * quietly dropped or reread (QA-1115 hostile edges, price-ask attacks): a present ask that is neither kind,
 * "negotiate" sent with a figure, and a period the role cannot list. The cap is the route's to check, against
 * the role's own band (`askAboveCap`).
 */
export function readPayAsk(raw: unknown): RangeRead<PayAsk | null> {
  if (raw === null || raw === undefined) return { ok: true, value: null };
  if (typeof raw !== "object" || Array.isArray(raw)) return { ok: false, problem: RANGE_WORDS.askShape };
  const o = raw as Record<string, unknown>;
  const whyRaw = typeof o.why === "string" ? o.why.trim() : "";
  if (whyRaw.length > PRICE_WHY_MAX) return { ok: false, problem: RANGE_WORDS.askWhy };
  const why = whyRaw ? { why: whyRaw } : {};
  if (o.kind === "negotiate") {
    // A figure typed beside "negotiate" is never dropped without a word.
    if (o.monthly !== undefined && o.monthly !== null && o.monthly !== "") return { ok: false, problem: RANGE_WORDS.askBoth };
    return { ok: true, value: { kind: "negotiate", ...why } };
  }
  if (o.kind === "amount") {
    const n = typeof o.monthly === "number" ? o.monthly : typeof o.monthly === "string" ? digitsOf(o.monthly, 9) : NaN;
    if (o.per !== undefined && !(ASK_PERIODS as readonly unknown[]).includes(o.per)) return { ok: false, problem: RANGE_WORDS.askPeriod };
    const per = o.per !== undefined ? { per: o.per as AskPeriod } : {};
    return Number.isInteger(n) && n > 0 && n <= 100_000_000 ? { ok: true, value: { kind: "amount", monthly: n, ...per, ...why } } : { ok: false, problem: RANGE_WORDS.askAmount };
  }
  return { ok: false, problem: RANGE_WORDS.askShape };
}

/** The refusal for an ask above the cap: the cap is given in the caller's money words. */
export const aboveCap = (capWords: string, pct: number): string =>
  `Proposals for this role go up to ${capWords} at ${pct}%, ${ROLE_PAY_CAP_PCT}% of its listed price. Choose a price at or below that.`;

/** The refusal for an ask in another period than the role's: the cap can only be read in the role's own. */
export const askPeriodWrong = (per: AskPeriod): string => `Write your price for each ${per}, the way the role lists it.`;

/** The refusal for a commitment below what the role takes from one person. */
export const belowMinimum = (min: number): string => `This role takes proposals from ${min}% to 100%. Choose ${min}% or more.`;

/** An ask as stored, read tolerantly. */
export function payAskOf(raw: unknown): PayAsk | null {
  const r = readPayAsk(raw);
  return r.ok ? r.value : null;
}
