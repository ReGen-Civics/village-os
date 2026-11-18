/**
 * THE CONTRACT'S PRICE AT ADOPTION (the coordinator, 15 Nov 2026, as the plain reading of Rye's rulings:
 * "your proposal sets your pay", the 120% cap, the Treasurer confirms; QA-1115 treasurer audit P0-1).
 *
 * Adopting a role application writes the contract's `pay` group, so End of Moon has a figure to invoice
 * (before this, nobody seated through an application could be paid there). The figure is, in order:
 *   - the accepted price ask, held to the cap;
 *   - with no ask, the suggested price: the listed band times the agreed commitment;
 *   - "negotiate on the first call": the suggested price too, and the note says it was negotiate, so the
 *     Treasurer knows it is still to agree.
 * The commitment is the agreed one (a counter-offer's, when there was one), applied once
 * (shared/rolePayMath.ts). The note travels with the terms and is shown to the member and the Treasurer
 * beside every invoice line drawn from them; the decider reads the same figure before adopting.
 *
 * A yearly band becomes a monthly contract (a twelfth), because a contract pays by the month or the moon.
 * No band, no figure: the contract records no pay, as before, and a Treasurer writes it.
 *
 * Pure: no Node builtins, no clock.
 */
import { askPeriod, capAt, ceilingAt, type PayAsk } from "./commitmentRange";
import { ROLE_PAY_CAP_PCT } from "./rolePayMath";
import type { PayCeiling } from "./roleCardSections";
import { minorDigits, moneyWords } from "./seatSettings";

/** `countered`: the price the people who seat the role countered with, and the applicant accepted (the lead, 18 Nov 2026). */
export type ContractPriceSource = "ask" | "suggested" | "negotiate" | "countered";

export interface ContractPrice {
  kind: "fixed";
  /** Whole minor units, for one `per`. */
  amountMinor: number;
  currency: string;
  per: "month" | "moon";
  source: ContractPriceSource;
  /** The ask was above the cap and was held at it. */
  capped: boolean;
  /** Where the figure came from, in plain words: the terms' `pay.note`. */
  note: string;
  /** The split the card showed when they applied (its own, else the village's default), written on the contract. */
  shape?: Array<{ label: string; pct: number }>;
}

/** The words a contract's price carries, by where it came from. */
export const CONTRACT_PRICE_WORDS = {
  ask: (pct: number) => `From their price ask, at ${pct}% commitment.`,
  suggested: (pct: number) => `The suggested price: the listed price at ${pct}% commitment.`,
  negotiate: (pct: number) => `They chose to negotiate on the first call. This is the suggested price at ${pct}% commitment until a price is agreed.`,
  countered: (pct: number) => `From our counter-offer on the price, at ${pct}% commitment.`,
  capped: ` Their ask was above ${ROLE_PAY_CAP_PCT}% of the listed price, so it is held there.`,
  heading: "Pay this contract will record",
  none: "This role lists no price, so the contract records no pay. A Treasurer writes it.",
} as const;

/** A whole-unit amount for a ceiling period, as a contract's minor units and period. */
function asContract(whole: number, per: PayCeiling["per"], currency: string): { amountMinor: number; per: "month" | "moon" } {
  const minor = Math.round(whole * 10 ** minorDigits(currency));
  return per === "year" ? { amountMinor: Math.floor(minor / 12), per: "month" } : { amountMinor: minor, per };
}

/**
 * The pay group adoption writes, from the role's band, the agreed commitment and the price ask. Null with
 * no band, or a band that prices to nothing.
 */
/**
 * The price with a counter-offer on it (the lead, 18 Nov 2026): the countered amount, in the role's own period, as the
 * price agreed, held to the same cap a price ask is. Without one, `contractPriceOf` as it always was.
 */
export function contractPriceWith(ceiling: PayCeiling | null | undefined, agreedPct: number | null | undefined, ask: PayAsk | null | undefined, countered: number | null): ContractPrice | null {
  if (countered === null || !ceiling) return contractPriceOf(ceiling, agreedPct, ask);
  const price = contractPriceOf(ceiling, agreedPct, { kind: "amount", monthly: countered, per: ceiling.per });
  if (!price) return null;
  const pct = typeof agreedPct === "number" && agreedPct > 0 && agreedPct <= 100 ? agreedPct : 100;
  return { ...price, source: "countered", note: `${CONTRACT_PRICE_WORDS.countered(pct)}${price.capped ? CONTRACT_PRICE_WORDS.capped : ""}` };
}

export function contractPriceOf(ceiling: PayCeiling | null | undefined, agreedPct: number | null | undefined, ask: PayAsk | null | undefined): ContractPrice | null {
  if (!ceiling || !Number.isInteger(ceiling.amount) || ceiling.amount <= 0) return null;
  const pct = typeof agreedPct === "number" && agreedPct > 0 && agreedPct <= 100 ? agreedPct : 100;
  const suggested = ceilingAt(ceiling.amount, pct);
  const cap = capAt(ceiling.amount, pct);
  if (suggested <= 0) return null;
  // An ask in another period than the band's is not read: the server refuses those at intake (shared/commitmentRange.ts).
  const amountAsk = ask?.kind === "amount" && askPeriod(ask) === ceiling.per && Number.isInteger(ask.monthly) && ask.monthly > 0 ? ask.monthly : null;
  const source: ContractPriceSource = amountAsk !== null ? "ask" : ask?.kind === "negotiate" ? "negotiate" : "suggested";
  const capped = amountAsk !== null && amountAsk > cap;
  const whole = amountAsk === null ? suggested : Math.min(amountAsk, cap);
  const { amountMinor, per } = asContract(whole, ceiling.per, ceiling.currency);
  const note = `${CONTRACT_PRICE_WORDS[source](pct)}${capped ? CONTRACT_PRICE_WORDS.capped : ""}`;
  return { kind: "fixed", amountMinor, currency: ceiling.currency, per, source, capped, note };
}

/** The pay group as the terms store it (shared/seatSettings.ts `pay`). */
export function payGroupOf(p: ContractPrice): { kind: "fixed"; amountMinor: number; currency: string; per: "month" | "moon"; note: string; shape?: Array<{ label: string; pct: number }> } {
  return { kind: "fixed", amountMinor: p.amountMinor, currency: p.currency, per: p.per, note: p.note, ...(p.shape && p.shape.length ? { shape: p.shape.map((s) => ({ label: s.label, pct: s.pct })) } : {}) };
}

/** "$6,500 a month. From their price ask, at 50% commitment." */
export function contractPriceLine(p: ContractPrice): string {
  return `${moneyWords(p.amountMinor, p.currency, "en-US")} ${p.per === "month" ? "a month" : "a moon"}. ${p.note}`;
}
