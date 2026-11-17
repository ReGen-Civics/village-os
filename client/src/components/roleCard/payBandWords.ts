/**
 * THE PAY BAND'S WORDS, kept in their own module so only the role card that draws them carries them: the price
 * ask on /propose-a-role imports rewardWords.ts and stays off these (guard-route-first-views).
 */
// A value import of the runtime, as rewardWords.ts has: precompileEnglish compiles the messages of a file that
// imports it and skips one that only uses `msg`.
import { i18n as appI18n, type I18n } from "@lingui/core";
import { msg } from "@lingui/core/macro";
import type { PublicPay } from "@shared/rolePublicPay";
import { moneyWords } from "@shared/roleRewardWords";

/**
 * Whole minor units as money, by the currency's own minor digits (two for USD, none for JPY). Kept here, off
 * shared/seatSettings.ts, so the role card does not carry that module on its first view.
 */
function minorWords(minor: number, currency: string, locale: string): string {
  let digits = 2;
  try {
    digits = new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions().maximumFractionDigits ?? 2;
  } catch {
    /* An unknown code keeps two digits, and moneyWords says it by its code. */
  }
  return moneyWords(minor / 10 ** digits, currency, locale);
}

export function bandWords(i18n: I18n = appI18n, pay: PublicPay | null | undefined, shown: boolean): string | null {
  if (!shown || !pay || pay.kind !== "range" || !pay.currency) return null;
  const { minMinor: lo, maxMinor: hi } = pay;
  if (!Number.isInteger(lo) || !Number.isInteger(hi) || (lo as number) < 0 || (lo as number) > (hi as number)) return null;
  const min = minorWords(lo as number, pay.currency, i18n.locale || "en");
  const max = minorWords(hi as number, pay.currency, i18n.locale || "en");
  if (pay.per === "month") return i18n._(msg({ message: `Band: ${min} to ${max} a month in total comp`, context: "role card rewards: the pay band under the listed price, each month" }));
  if (pay.per === "moon") return i18n._(msg({ message: `Band: ${min} to ${max} a moon in total comp`, context: "role card rewards: the pay band under the listed price, each moon" }));
  return i18n._(msg({ message: `Band: ${min} to ${max} in total comp`, context: "role card rewards: the pay band under the listed price, no period" }));
}
