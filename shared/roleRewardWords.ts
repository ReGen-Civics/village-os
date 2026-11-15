/**
 * MONEY IN WORDS for the rewards piece, the price popup and the decider's page.
 *
 * The rewards piece's sentences moved to the client (client/src/components/roleCard/rewardWords.ts), where they
 * are wrapped for translation (copy sweep, 15 Nov 2026). They were, as Rye set them on 14 Nov 2026:
 *
 *   "Up to $13,000 a month for the full role*"
 *   "Take on all of it, or part of it: we're open to proposals from 30% to 100%. One person can hold
 *    the whole role, or a few people can share it."
 *   "Your proposal sets your pay. Tell us what you'd deliver each moon and how much of yourself that
 *    takes; that becomes your contract (value in, value out). At 50%, this role pays up to $6,500 a
 *    month."
 *   "*The full band, at 100% commitment. Your first moon starts lower and is tied to what you deliver."
 *
 * The figure is the card's own ceiling (shared/roleCardSections.ts); the share is straight
 * proportional (shared/commitmentRange.ts, ruling 1). A role offered at 100% only says nothing about
 * sharing. Display only: the contract sets the pay.
 *
 * Pure: no Node builtins.
 */

/** "$13,000", or "13,000 XYZ" for a code the formatter does not know. Pass the reader's locale (lingui's `i18n.locale`). */
export function moneyWords(amount: number, currency: string, locale = "en-US"): string {
  try {
    return new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: 0, minimumFractionDigits: 0 }).format(amount);
  } catch {
    return `${amount.toLocaleString(locale)} ${currency}`;
  }
}
