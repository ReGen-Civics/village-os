/**
 * THE COMMITMENT SLIDER'S AND THE SPLIT'S WORDS (the lead, 17 Nov 2026), wrapped for translation.
 *
 *   "Band: $9,623 to $12,029 a month in total comp" at 100%, both ends straight proportional below it
 *   (shared/commitmentRange.ts `ceilingAt`, ruling 1), whole currency units as moneyWords writes them.
 *
 * The band is the role's public pay range (`card.publicPay`, kind range), drawn only while the village shows pay
 * ranges (`org.show_pay_ranges`, read by the card as `showPayRanges`). Display only: the contract sets the pay.
 * No figure here is the 120% cap: that stays a backend rule and is never shown to an applicant (the lead, 17 Nov).
 */
// A value import of the runtime, as rewardWords.ts has: precompileEnglish compiles the messages of a file that imports it.
import { i18n as appI18n, type I18n } from "@lingui/core";
import { msg } from "@lingui/core/macro";
import { ceilingAt, commitmentChoices, rangeMin } from "@shared/commitmentRange";
import type { PublicPay } from "@shared/rolePublicPay";
import { moneyWords } from "@shared/roleRewardWords";
import { minorDigits } from "@shared/seatSettings";
import type { Split } from "@shared/proposalSplit";

/** A band in whole currency units at a commitment: both ends straight proportional, rounded down. */
export interface BandAt {
  lo: number;
  hi: number;
  currency: string;
  per: PublicPay["per"];
  pct: number;
}

/** Whether a role takes less than the whole from one person, so the card offers a slider. */
export const offersSlider = (min: number | null | undefined): boolean => rangeMin(min) < 100;

/** The steps the slider moves through: the same steps the application's terms accept. */
export const sliderSteps = (min: number | null | undefined): number[] => commitmentChoices(min);

/** The band at a commitment, or null for anything but a readable range while the village shows ranges. */
export function bandAt(pay: PublicPay | null | undefined, shown: boolean, pct: number): BandAt | null {
  if (!shown || !pay || pay.kind !== "range" || !pay.currency) return null;
  const { minMinor: lo, maxMinor: hi } = pay;
  if (!Number.isInteger(lo) || !Number.isInteger(hi) || (lo as number) < 0 || (lo as number) > (hi as number)) return null;
  const unit = 10 ** minorDigits(pay.currency);
  const at = Math.max(1, Math.min(100, pct));
  return { lo: ceilingAt((lo as number) / unit, at), hi: ceilingAt((hi as number) / unit, at), currency: pay.currency, per: pay.per, pct: at };
}

/** "Band: $9,623 to $12,029 a month in total comp" at 100%, "Band at 60%: $5,773 to $7,217 a month in total comp" below. */
export function bandAtWords(i18n: I18n = appI18n, b: BandAt, sayPct = false): string {
  const min = moneyWords(b.lo, b.currency, i18n.locale || "en");
  const max = moneyWords(b.hi, b.currency, i18n.locale || "en");
  const pct = b.pct;
  if (pct >= 100 && !sayPct) {
    if (b.per === "month") return i18n._(msg({ message: `Band: ${min} to ${max} a month in total comp`, context: "role card rewards: the pay band under the listed price, each month" }));
    if (b.per === "moon") return i18n._(msg({ message: `Band: ${min} to ${max} a moon in total comp`, context: "role card rewards: the pay band under the listed price, each moon" }));
    return i18n._(msg({ message: `Band: ${min} to ${max} in total comp`, context: "role card rewards: the pay band under the listed price, no period" }));
  }
  if (b.per === "month") return i18n._(msg({ message: `Band at ${pct}%: ${min} to ${max} a month in total comp`, context: "role card rewards: the pay band at the chosen commitment, each month" }));
  if (b.per === "moon") return i18n._(msg({ message: `Band at ${pct}%: ${min} to ${max} a moon in total comp`, context: "role card rewards: the pay band at the chosen commitment, each moon" }));
  return i18n._(msg({ message: `Band at ${pct}%: ${min} to ${max} in total comp`, context: "role card rewards: the pay band at the chosen commitment, no period" }));
}

/** What a screen reader hears on the slider: the commitment, and the band or price at it when there is one. */
export function sliderValueText(i18n: I18n = appI18n, pct: number, amounts: string | null): string {
  return amounts
    ? i18n._(msg({ message: `${pct}% commitment, ${amounts}`, context: "commitment slider: what a screen reader hears" }))
    : i18n._(msg({ message: `${pct}% commitment`, context: "commitment slider: what a screen reader hears" }));
}

/** "$5,773 to $7,217": a band's two ends, for the slider's spoken value. */
export function bandEnds(i18n: I18n = appI18n, b: BandAt): string {
  const min = moneyWords(b.lo, b.currency, i18n.locale || "en");
  const max = moneyWords(b.hi, b.currency, i18n.locale || "en");
  return i18n._(msg({ message: `${min} to ${max}`, context: "commitment slider: the band's two ends" }));
}

/**
 * How a split's total sits against the band at the same commitment: inside it says nothing, above or below says
 * so plainly with the band's ends. No cap figure is ever named.
 */
export function totalAgainstBand(i18n: I18n = appI18n, split: Split, band: BandAt | null): string | null {
  if (split.total === null || !band) return null;
  const ends = bandEnds(i18n, band);
  if (split.total > band.hi) return i18n._(msg({ message: `Your total is above the band at ${band.pct}% (${ends}). You can still propose it.`, context: "split control: a total above the band" }));
  if (split.total < band.lo) return i18n._(msg({ message: `Your total is below the band at ${band.pct}% (${ends}).`, context: "split control: a total below the band" }));
  return null;
}

