/**
 * PAY TO BE DETERMINED, in the reader's language (the lead, 20 Nov 2026: "Leave the pay for both of these 'to be
 * determined'"). The terms' own words (`PAY_TBD_WORDS`, shared/seatSettings.ts) are English; every place a member
 * reads the to-be-determined pay draws it through here. Kept off shared/seatSettings.ts so the role card does not
 * carry that module for one line; client/src/lib/payTbdWords.test.ts holds the English to the shared words.
 */
// A value import of the runtime, as client/src/components/roleCard/rewardWords.ts has: precompileEnglish compiles the
// messages of a file that imports it and skips one that only uses `msg`.
import { i18n as appI18n, type I18n } from "@lingui/core";
import { msg } from "@lingui/core/macro";

export const PAY_TBD = msg({ message: "Pay to be determined", context: "pay on offer: paid, the amount still to be set" });

/** "Pay to be determined", in the reader's language. */
export const payTbdLine = (i18n: I18n = appI18n): string => i18n._(PAY_TBD);

/** A pay headline from the terms' words, with the to-be-determined one said in the reader's language. */
export const payHeadlineIn = (headline: string, english: string, i18n: I18n = appI18n): string => (headline === english ? payTbdLine(i18n) : headline);
