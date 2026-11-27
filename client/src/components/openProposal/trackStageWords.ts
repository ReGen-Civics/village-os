/**
 * AN APPLICATION'S STAGES IN THE READER'S LANGUAGE (lane ES-A, 26 Nov 2026).
 *
 * The mirror of the applicant track's `TRACK_WORDS` (shared/applicantOnboarding.ts), keyed by the stage, drawn
 * through the catalog (client/src/i18n/wordTable.ts). The shared table stays English for the server.
 */
// A value import of the runtime: precompileEnglish compiles the messages of a file that imports it and skips one
// that only uses `msg` (client/src/components/roleCard/payBandWords.ts says the same).
import { i18n as appI18n, type I18n } from "@lingui/core";
import { msg } from "@lingui/core/macro";
import type { TRACK_WORDS } from "@shared/applicantOnboarding";
import { drawWords, useWords, type Drawn, type WordMirror } from "@/i18n/wordTable";

export type TrackStageWords = Drawn<typeof TRACK_WORDS>;

export const TRACK_STAGE_MIRROR: WordMirror<typeof TRACK_WORDS> = {
  received: msg({ message: "Received", context: "application stage" }),
  review: msg({ message: "Our review", context: "application stage" }),
  references: msg({ message: "References and proposal", context: "application stage" }),
  final_interview: msg({ message: "Final conversation", context: "application stage" }),
  agreement: msg({ message: "Agreement", context: "application stage" }),
  start: msg({ message: "Start", context: "application stage" }),
};

/** The stages in `i18n`'s language, for code outside a component. */
export function trackStageWords(i18n: I18n = appI18n): TrackStageWords {
  return drawWords(TRACK_STAGE_MIRROR, i18n);
}

/** The stages in the reader's language. */
export function useTrackStageWords(): TrackStageWords {
  return useWords(TRACK_STAGE_MIRROR);
}
