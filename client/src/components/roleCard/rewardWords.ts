/**
 * THE REWARDS PIECE'S WORDS (Rye, 14 Nov 2026; the copy sweep, 15 Nov 2026), wrapped for translation.
 *
 *   "Up to $13,000 a month for the full role*"
 *   "Take on all of it, or part of it: we're open to proposals from 30% to 100%. ..."
 *   "Your proposal sets your pay. ... At 50%, the suggested price is $6,500 a month. You can propose more or less."
 *   "*At 100% commitment. Your first month starts lower and follows what you deliver. ..."
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
import type { CeilingPeriod, PayCeiling } from "@shared/roleCardSections";
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

export function rewardWords(i18n: I18n, c: PayCeiling, min: number | null | undefined): RewardWords {
  const lo = rangeMin(min);
  const shared = lo < 100;
  const at = exampleShare(min);
  const full = perPeriod(i18n, moneyWords(c.amount, c.currency, i18n.locale), c.per);
  const atPrice = perPeriod(i18n, moneyWords(ceilingAt(c.amount, at), c.currency, i18n.locale), c.per);
  return {
    headline: i18n._(msg({ message: `Up to ${full} for the full role*`, context: "role card rewards: the full role's ceiling" })),
    range: shared
      ? i18n._(msg({ message: `Take on all of it, or part of it: we're open to proposals from ${lo}% to 100%. One person can hold the whole role, or a few people can share it.`, context: "role card rewards: a role that can be shared" }))
      : null,
    proposal: [
      i18n._(msg({ message: "Your proposal sets your pay. Tell us what you'd deliver each month and how much of yourself that takes; that becomes your contract.", context: "role card rewards: the proposal sets the pay" })),
      shared ? i18n._(msg({ message: `At ${at}%, the suggested price is ${atPrice}.`, context: "role card rewards: the price at an example share" })) : null,
      i18n._(msg({ message: "You can propose more or less.", context: "role card rewards: the proposal sets the pay" })),
    ]
      .filter(Boolean)
      .join(" "),
    footnote: i18n._(msg({ message: "*At 100% commitment. Your first month starts lower and follows what you deliver. Equity and credit terms are still being written and are subject to legal review.", context: "role card rewards: the one footnote" })),
  };
}

/** The commitment row: "Full or part commitment (from 30%)", or "Full commitment (100%)" for a role offered whole. */
export function commitmentRowWords(i18n: I18n, min: number | null | undefined): string {
  const lo = rangeMin(min);
  return lo < 100
    ? i18n._(msg({ message: `Full or part commitment (from ${lo}%)`, context: "role card fact: a role that can be shared" }))
    : i18n._(msg({ message: "Full commitment (100%)", context: "role card fact: a role offered whole" }));
}
