/**
 * THE FOCUS LINE'S WORDS, IN THE READER'S LANGUAGE (Rye, 15 Nov 2026; shared/focusLine.ts).
 *
 * A qualities line written as the token draws the words of the band the commitment falls in. FOCUS_BANDS in
 * shared/focusLine.ts is the table of the English; each band is said again here as a message so it translates,
 * and focusLine.test.tsx fails when the two disagree. Every other line is the village's own, returned as written.
 */
// A value import of the runtime, as client/src/lib/unsavedChanges.ts has: precompileEnglish compiles the messages of
// a file that imports it and skips one that only uses `msg`, which ships its English uncompiled (CI, 15 Nov 2026).
import { i18n as appI18n, type I18n } from "@lingui/core";
import { msg } from "@lingui/core/macro";
import { focusBand, isFocusLine, type FocusBand } from "@shared/focusLine";

export function focusWords(i18n: I18n = appI18n, village: string, pct: number | null): string {
  return bandWords(i18n, focusBand(pct), village);
}

/** One band's words. Keyed by the band, so a band added to the table is a compile error here until it is said. */
export function bandWords(i18n: I18n, band: FocusBand, village: string): string {
  const words: Record<FocusBand, () => string> = {
    10: () => i18n._(msg({ message: `On your mind: ${village} gets a dedicated work block once a week`, context: "role card focus line, from 10%" })),
    30: () => i18n._(msg({ message: `Steady: ${village} gets about a day and a half of your week`, context: "role card focus line, from 30%" })),
    50: () => i18n._(msg({ message: `Focused: ${village} is a main part of your work, about half your week`, context: "role card focus line, from 50%" })),
    60: () => i18n._(msg({ message: `Fully focused: ${village} is your main work`, context: "role card focus line, from 60%" })),
    80: () => i18n._(msg({ message: `Deeply committed: ${village} is your main work, about four days a week`, context: "role card focus line, from 80%" })),
    100: () => i18n._(msg({ message: `All in: ${village} is your full-time work`, context: "role card focus line, 100%" })),
  };
  return words[band]();
}

/** The qualities with the token line drawn for this commitment. */
export function withFocusLine(i18n: I18n = appI18n, lines: readonly string[], village: string, pct: number | null): string[] {
  return lines.map((l) => (isFocusLine(l) ? focusWords(i18n, village, pct) : l));
}
