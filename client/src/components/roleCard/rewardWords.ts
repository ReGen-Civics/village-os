/**
 * THE REWARDS PIECE'S WORDS (Rye, 14 Nov 2026; the copy sweep, 15 Nov 2026), wrapped for translation.
 *
 *   "Up to $13,000 a month for the full role*"
 *   "Take on all of it, or part of it: we're open to proposals from 30% to 100%. ..."
 *   "Your proposal sets your rewards. ... At 50%, the suggested price is $6,500 a month. You can propose more or less."
 *   "*At 100% commitment. Your first month often starts lower and follows what you deliver. ..."
 *
 * The figure is the card's own ceiling (shared/roleCardSections.ts); the share is straight proportional
 * (shared/commitmentRange.ts, ruling 1). A role offered at 100% only says nothing about sharing. Display only:
 * the contract sets the pay.
 */
// A value import of the runtime, as client/src/lib/unsavedChanges.ts has: precompileEnglish compiles the messages of
// a file that imports it and skips one that only uses `msg`, which ships its English uncompiled (CI, 15 Nov 2026).
import { i18n as appI18n, type I18n } from "@lingui/core";
import { msg } from "@lingui/core/macro";
import { ceilingAt, rangeMin } from "@shared/commitmentRange";
import type { CeilingPeriod, PayCeiling, PayShare, ShareAmount } from "@shared/roleCardSections";
import { moneyWords } from "@shared/roleRewardWords";

export interface RewardWords {
  headline: string;
  /** Null for a role offered at 100% only. */
  range: string | null;
  proposal: string;
  footnote: string;
}

/** The example share the proposal line names: 50%, or the role's minimum when that is higher. */
export const exampleShare = (min: number | null | undefined): number => Math.max(rangeMin(min), 50);

/** "$6,500 a month", "$78,000 a year", in the reader's language. */
export function perPeriod(i18n: I18n = appI18n, money: string, per: CeilingPeriod): string {
  if (per === "year") return i18n._(msg({ message: `${money} a year`, context: "an amount for each year" }));
  if (per === "moon") return i18n._(msg({ message: `${money} a moon`, context: "an amount for each moon" }));
  return i18n._(msg({ message: `${money} a month`, context: "an amount for each month" }));
}

/**
 * The equity and credits clause shows on every card for now (Rye, 15 Nov 2026: "Show the equity and credits
 * section and we will soon be turning on the village and issuing these tokens so leave them on for now").
 * Set false to show it only when the split in force pays a token share (`paysInTokens`).
 */
export const TOKEN_TERMS_ALWAYS = true;

/** Does the split in force pay any of the reward in equity or credits? A share above 0% only. */
export function paysInTokens(shape: readonly PayShare[] | null | undefined): boolean {
  return (shape ?? []).some((s) => s.pct > 0 && /equity|credit/i.test(s.label));
}

/**
 * The headline is the LISTED price, the high end the card shows (steelman, 15 Nov 2026; no cap line since 17 Nov 2026): "Up to" read as a ceiling
 * beside "you can propose more". The footnote (Rye, 15 Nov 2026): the commitment, "Your first month often
 * starts lower and follows what you deliver." with no figure, because the amount is the applicant's to
 * propose; the equity and credits clause (always for now, `TOKEN_TERMS_ALWAYS`; otherwise only when the split
 * in force, the card's else the village's, pays a share above 0% in equity or credits); then the village's note.
 */
/**
 * The headline for a card that names each share's amount (founding team, 16 Nov 2026; `splitsAmounts`,
 * shared/roleCardSections.ts): "Up to $4,000 in cash and $6,000 in equity a month for the full role*".
 * The shares are `ceilingShares`: each share above 0% of the full role's figure, in whole units.
 */
export function splitHeadline(i18n: I18n, c: PayCeiling, shares: readonly ShareAmount[]): string {
  const parts = shares.map((s) => {
    const money = moneyWords(s.amount, c.currency, i18n.locale);
    const label = s.label.toLowerCase();
    return i18n._(msg({ message: `${money} in ${label}`, context: "role card rewards: one share of the listed price as its own amount" }));
  });
  let list = parts.join(", ");
  try {
    list = new Intl.ListFormat(i18n.locale || "en", { style: "long", type: "conjunction" }).format(parts);
  } catch {
    /* An engine without ListFormat keeps the commas. */
  }
  if (c.per === "year") return i18n._(msg({ message: `Up to ${list} a year for the full role*`, context: "role card rewards: the listed price, each share as its own amount" }));
  if (c.per === "moon") return i18n._(msg({ message: `Up to ${list} a moon for the full role*`, context: "role card rewards: the listed price, each share as its own amount" }));
  return i18n._(msg({ message: `Up to ${list} a month for the full role*`, context: "role card rewards: the listed price, each share as its own amount" }));
}

export function rewardWords(i18n: I18n, c: PayCeiling, min: number | null | undefined, note = "", shape: readonly PayShare[] = [], split: readonly ShareAmount[] = []): RewardWords {
  const lo = rangeMin(min);
  const shared = lo < 100;
  const at = exampleShare(min);
  const full = perPeriod(i18n, moneyWords(c.amount, c.currency, i18n.locale), c.per);
  const atPrice = perPeriod(i18n, moneyWords(ceilingAt(c.amount, at), c.currency, i18n.locale), c.per);
  return {
    // One figure for the full role, as cards read by default; each share's amount when the card or the village says so.
    headline: split.length
      ? splitHeadline(i18n, c, split)
      : i18n._(msg({ message: `Listed price: ${full} for the full role*`, context: "role card rewards: the full role's listed price" })),
    range: shared
      ? i18n._(msg({ message: `Take on all of it, or part of it: we're open to proposals from ${lo}% to 100%. One person can hold the whole role, or a few people can share it.`, context: "role card rewards: a role that can be shared" }))
      : null,
    proposal: [
      i18n._(msg({ message: "Your proposal sets your rewards. Tell us what you'd deliver each month and how much of yourself that takes; that becomes your contract.", context: "role card rewards: the proposal sets the pay" })),
      shared ? i18n._(msg({ message: `At ${at}%, the suggested price is ${atPrice}.`, context: "role card rewards: the price at an example share" })) : null,
      i18n._(msg({ message: "You can propose more or less.", context: "role card rewards: the proposal sets the pay" })),
    ]
      .filter(Boolean)
      .join(" "),
    // No cap line (lead, 17 Nov 2026): the 120% cap is a backend rule (capAt, ROLE_PAY_CAP_PCT), and the card shows the
    // listed price as the high end, with the band under it where the village shows pay ranges.
    footnote: [
      i18n._(msg({ message: "*At 100% commitment.", context: "role card rewards: the one footnote" })),
      i18n._(msg({ message: "Your first month often starts lower and follows what you deliver.", context: "role card rewards: the footnote, the first month" })),
      TOKEN_TERMS_ALWAYS || paysInTokens(shape) ? i18n._(msg({ message: "Equity and credit terms are still being written and are subject to legal review.", context: "role card rewards: the footnote, equity and credits" })) : null,
      String(note ?? "").replace(/^\*\s*/, "").trim(),
    ]
      .filter(Boolean)
      .join(" "),
  };
}

/**
 * THE BAND under the listed price: "Band: $9,623 to $12,029 a month in total comp". Read from the role's
 * public pay (`card.publicPay`, server/lib/roleCardProjection.ts), which the server sends only for a listed
 * open role while the village shows pay ranges (`org.show_pay_ranges`). `shown` is the card's own read of
 * that switch, so an older payload that still carries a range draws nothing while the village hides it.
 * Null for anything but a range of two whole minor amounts, low to high, in a currency.
 */
/** The commitment row: "Full or part commitment (from 30%)", or "Full commitment (100%)" for a role offered whole. */
export function commitmentRowWords(i18n: I18n, min: number | null | undefined): string {
  const lo = rangeMin(min);
  return lo < 100
    ? i18n._(msg({ message: `Full or part commitment (from ${lo}%)`, context: "role card fact: a role that can be shared" }))
    : i18n._(msg({ message: "Full commitment (100%)", context: "role card fact: a role offered whole" }));
}

