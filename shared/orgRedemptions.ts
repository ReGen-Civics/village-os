/**
 * A VENTURE REDEEMS ITS CREDITS (0420, credits lane 2), the shapes and the
 * decisions both ends agree on.
 *
 * The lead's decisions of 23 Nov 2026, which this file is the reading of:
 *
 *   - Only ventures redeem. Members never cash out.
 *   - A redemption key holder (the Treasury role) confirms each one after the
 *     cash has been paid outside the platform, and never anybody who runs the
 *     venture.
 *   - One credit is worth one unit of the peg currency (1 USD), redeemed in
 *     whichever offered currency the venture chooses, with the rate used
 *     written on the redemption.
 *   - A per-moon cap across every venture, failing closed: 0 means zero.
 *   - Credits never expire, and neither does a request: it waits until it is
 *     confirmed, refused or cancelled.
 *   - Switched off until the village's legal review clears it.
 *
 * Nothing here posts and nothing here reads a row. The ledger work is in
 * server/lib/orgRedemptions.ts, the SQL in server/repos/orgRedemptions.ts and
 * the doors in server/routes/orgRedemptions.ts. Every function here is pure,
 * so every refusal a venture or a confirmer will ever meet is testable with no
 * database at all.
 */
import { convertMinor, crossRate, exponentOf } from "./money";

// ── The dials, all four in shared/gameVariables.ts ──────────────────────────

/** Ventures may ask to redeem. Off when a village is born. */
export const ORG_REDEMPTION_OPEN_KEY = "ledger.org_redemption_open";
/** Whole credits all ventures together may redeem in one cycle. 0 means none. */
export const ORG_REDEMPTION_CAP_KEY = "ledger.org_redemption_moon_cap";
/** What one whole credit is worth in the first currency of the list below. */
export const ORG_REDEMPTION_RATE_KEY = "ledger.org_redemption_rate";
/** The currencies a venture may be paid in, the first being the one the rate is in. */
export const ORG_REDEMPTION_CURRENCIES_KEY = "ledger.org_redemption_currencies";

// ── The ledger's names ──────────────────────────────────────────────────────

/** Credits held against a venture's open redemption. Seeded by 0420, not a faucet. */
export const ORG_REDEMPTION_HOLD = "sys:org-redemption-hold";
export const ORG_REDEMPTION_HOLD_SOURCE = "org_redemption_hold";
export const ORG_REDEMPTION_BURN_SOURCE = "org_redemption_burn";
export const ORG_REDEMPTION_RELEASE_SOURCE = "org_redemption_release";

/** Where the venture asked to be paid. Long enough for an account and a name. */
export const PAY_TO_MAX = 300;
/** The Treasury's payment reference. */
export const PAYMENT_REF_MAX = 200;

export const ORG_REDEMPTION_STATES = ["requested", "confirmed", "refused", "cancelled"] as const;
export type OrgRedemptionState = (typeof ORG_REDEMPTION_STATES)[number];

/**
 * The three ways out of `requested`, and nothing else. A confirmed redemption
 * has been paid in cash outside the platform, so nothing may undo it here: a
 * refusal after a confirmation would hand back credits the venture was also
 * paid for.
 */
export function orgRedemptionMoveRefusal(from: OrgRedemptionState, to: OrgRedemptionState): string | null {
  if (from === "confirmed") return "This redemption is confirmed and its credits are gone";
  if (from !== "requested") return `This redemption is already ${from}`;
  if (to === "requested") return "A redemption cannot go back to waiting";
  return null;
}

// ── The currencies and the rate ─────────────────────────────────────────────

/** The offered currencies, cleaned. Never empty: a blank or broken list reads as USD. */
export function parseOrgRedemptionCurrencies(raw: string | null | undefined): string[] {
  const out: string[] = [];
  for (const code of String(raw ?? "").split(",")) {
    const c = code.trim().toUpperCase();
    if (/^[A-Z]{3}$/.test(c) && !out.includes(c)) out.push(c);
  }
  return out.length ? out : ["USD"];
}

export interface OrgRedemptionQuote {
  currency: string;
  pegCurrency: string;
  /** Peg currency units per whole credit, as the dial read. */
  pegRate: number;
  /** Units of `currency` per one unit of `pegCurrency`. Null when the two are one currency. */
  fxRate: number | null;
  fxAsOf: string | null;
  /** Minor units of `currency` for one whole credit. */
  rateMinor: number;
  /** Minor units of `currency` the Treasury is asked to pay. */
  grossMinor: number;
}

/**
 * What a redemption comes to, or null when this village cannot say today.
 *
 * NULL IS A REFUSAL HERE, unlike a member's redemption, where a request with
 * no price may carry words instead. A venture is redeeming for cash, so a
 * request that cannot be priced cannot be measured against anything and is not
 * taken. The venture can choose the peg currency, which always prices.
 */
export function quoteOrgRedemption(input: {
  wholeCredits: number;
  currency: string;
  pegCurrency: string;
  pegRate: number;
  /** The daily table, units per one EUR, as `latestRates` reads it. */
  rates: Record<string, number>;
  asOf: string | null;
}): OrgRedemptionQuote | null {
  if (!(input.pegRate > 0) || !(input.wholeCredits > 0)) return null;
  const pegMinor = Math.round(input.pegRate * Math.pow(10, exponentOf(input.pegCurrency)));
  let rateMinor = pegMinor;
  let fxRate: number | null = null;
  if (input.currency !== input.pegCurrency) {
    const r = crossRate(input.rates, input.pegCurrency, input.currency);
    if (r === null) return null;
    fxRate = r;
    rateMinor = convertMinor(pegMinor, input.pegCurrency, input.currency, r);
  }
  if (!(rateMinor > 0)) return null;
  return {
    currency: input.currency,
    pegCurrency: input.pegCurrency,
    pegRate: input.pegRate,
    fxRate,
    fxAsOf: fxRate === null ? null : input.asOf,
    rateMinor,
    grossMinor: Math.round(input.wholeCredits * rateMinor),
  };
}

// ── The refusals, in words ──────────────────────────────────────────────────

/** What a venture's ask looks like, gathered at the route boundary. Whole credits throughout. */
export interface OrgRedeemAsk {
  open: boolean;
  /** Whether the asker is seated in the venture's role right now. */
  runsIt: boolean;
  ventureHasAccount: boolean;
  tokenName: string;
  /** False when this token is not a village credit a venture may redeem. */
  tokenRedeemable: boolean;
  wholeCredits: number;
  /** The token's decimal places, for the "too fine" sentence. */
  decimals: number;
  /** True when the amount carries more places than the token. */
  tooFine: boolean;
  heldCredits: number;
  /** The offered currencies, and the one asked for. */
  currencies: string[];
  currency: string;
  priced: boolean;
  payTo: string;
  /** The cycle cap in whole credits, and what every venture has spoken for in this cycle. */
  capCredits: number;
  usedCredits: number;
}

/**
 * Why this venture cannot redeem this now, in words, or null.
 *
 * ORDERED SO THE ASKER HEARS THE NEAREST TRUE THING: the village's door first,
 * then who is asking, then the token, then the venture's own numbers, then the
 * village's cap. Sentences carry no trailing period; the surface frames them.
 */
export function orgRedeemRefusal(ask: OrgRedeemAsk): string | null {
  if (!ask.open) return "Ventures cannot redeem credits in this village yet";
  if (!ask.ventureHasAccount) return "That venture has no account here";
  if (!ask.runsIt) return "Only the people seated in a venture's role can redeem its credits";
  if (!ask.tokenRedeemable) return `${ask.tokenName} is not a village credit a venture can redeem`;
  if (ask.tooFine || !Number.isFinite(ask.wholeCredits) || ask.wholeCredits <= 0) {
    return ask.decimals > 0
      ? `Ask for ${ask.tokenName} in positive amounts with at most ${ask.decimals} decimal places`
      : `Ask for ${ask.tokenName} in whole positive amounts`;
  }
  if (ask.wholeCredits > ask.heldCredits) {
    return `The venture holds ${ask.heldCredits} ${ask.tokenName}, and that is what there is to redeem`;
  }
  if (!ask.currencies.includes(ask.currency)) {
    return `This village pays redemptions in ${ask.currencies.join(" or ")}`;
  }
  if (!ask.priced) {
    return `There is no daily rate for ${ask.currency} today. Choose ${ask.currencies[0]}, or try again tomorrow`;
  }
  if (!ask.payTo.trim()) return "Say where the money should go, so the Treasury can pay it";
  if (ask.capCredits <= 0) return "This village is not redeeming any credits this moon";
  const left = Math.max(0, ask.capCredits - ask.usedCredits);
  if (ask.wholeCredits > left) {
    return `Ventures together can redeem ${left} more ${ask.tokenName} this moon, and this asks for ${ask.wholeCredits}. The count starts again at the new moon`;
  }
  return null;
}

/** What a confirmer or refuser is, gathered at the route boundary. */
export interface OrgDecideAsk {
  to: "confirmed" | "refused";
  /** Seated in the venture's role right now. */
  actorRunsIt: boolean;
  /** The person who asked for this redemption. */
  actorAsked: boolean;
  paymentRef: string;
  note: string;
}

/**
 * Why this person cannot decide this redemption, in words, or null.
 *
 * NOBODY WHO RUNS THE VENTURE DECIDES ITS REDEMPTION, either way, and neither
 * does the person who asked, even after they have left the role. A confirmation
 * is somebody saying the cash went out, and the people the cash went to cannot
 * be the ones who say so.
 */
export function orgDecideRefusal(ask: OrgDecideAsk): string | null {
  if (ask.actorAsked) return "You asked for this redemption. Someone else in the Treasury decides it";
  if (ask.actorRunsIt) return "You run this venture, so its redemption is decided by someone who does not";
  if (ask.to === "confirmed" && !ask.paymentRef.trim()) {
    return "Give the payment's reference, so the record shows which payment this was";
  }
  if (ask.to === "refused" && !ask.note.trim()) return "Say why, in a sentence. The venture reads it";
  return null;
}

// ── What the routes answer with ─────────────────────────────────────────────

/** One venture redemption as people read it. Amounts in `credits` are whole. */
export interface OrgRedemptionView {
  id: string;
  orgRoleId: string;
  ventureLabel: string;
  token: string;
  tokenName: string;
  credits: number;
  currency: string;
  pegCurrency: string;
  pegRate: number;
  fxRate: number | null;
  fxAsOf: string | null;
  rateMinor: number;
  grossMinor: number;
  /** Formatted once on the server, so every surface agrees. */
  grossText: string;
  rateText: string;
  payTo: string;
  state: OrgRedemptionState;
  requestedBy: string;
  requestedByName: string | null;
  paymentRef: string | null;
  decisionNote: string | null;
  decidedByName: string | null;
  decidedAt: string | null;
  createdAt: string;
}

/** The redeem door's settings, as an operator's card reads them. */
export interface OrgRedemptionTerms {
  open: boolean;
  currencies: string[];
  pegCurrency: string;
  pegRate: number;
  capCredits: number;
  usedCredits: number;
  leftCredits: number;
  /** Minor units of each currency for one whole credit today, or null with no daily rate. */
  rateMinor: Record<string, number | null>;
}
