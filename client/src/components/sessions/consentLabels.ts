/**
 * A CONSENT ROUND'S FOUR ANSWERS IN THE READER'S LANGUAGE (lane ES-A, 26 Nov 2026).
 *
 * The mirror of `CONSENT_LABELS` (shared/sessions.ts), keyed by the stored answer, drawn through the catalog
 * (client/src/i18n/wordTable.ts). The shared table stays English for the server's record of the round.
 */
// A value import of the runtime: precompileEnglish compiles the messages of a file that imports it and skips one
// that only uses `msg` (client/src/components/roleCard/payBandWords.ts says the same).
import { i18n as appI18n, type I18n } from "@lingui/core";
import { msg } from "@lingui/core/macro";
import type { CONSENT_LABELS } from "@shared/sessions";
import { drawWords, useWords, type Drawn, type WordMirror } from "@/i18n/wordTable";

export type ConsentLabels = Drawn<typeof CONSENT_LABELS>;

export const CONSENT_LABEL_MIRROR: WordMirror<typeof CONSENT_LABELS> = {
  consent: msg({ message: "I consent", context: "consent round: answer" }),
  concern: msg({ message: "I consent, with a concern", context: "consent round: answer" }),
  object: msg({ message: "I object", context: "consent round: answer" }),
  sleep: msg({ message: "I'll sleep on it", context: "consent round: answer" }),
};

/** The four answers in `i18n`'s language, for code outside a component. */
export function consentLabels(i18n: I18n = appI18n): ConsentLabels {
  return drawWords(CONSENT_LABEL_MIRROR, i18n);
}

/** The four answers in the reader's language. */
export function useConsentLabels(): ConsentLabels {
  return useWords(CONSENT_LABEL_MIRROR);
}
