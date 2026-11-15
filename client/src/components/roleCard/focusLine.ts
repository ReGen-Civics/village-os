/**
 * THE FOCUS LINE'S WORDS, IN THE READER'S LANGUAGE (Rye, 15 Nov 2026; shared/focusLine.ts).
 *
 * A qualities line written as the token draws "Fully focused: <village> is your main work" at 60% and above
 * and "Focused: <village> is a main part of your work" below. Every other line is the village's own and is
 * returned as written.
 */
// A value import of the runtime, as client/src/lib/unsavedChanges.ts has: precompileEnglish compiles the messages of
// a file that imports it and skips one that only uses `msg`, which ships its English uncompiled (CI, 15 Nov 2026).
import { i18n as appI18n, type I18n } from "@lingui/core";
import { msg } from "@lingui/core/macro";
import { focusLevel, isFocusLine } from "@shared/focusLine";

export function focusWords(i18n: I18n = appI18n, village: string, pct: number | null): string {
  return focusLevel(pct) === "main"
    ? i18n._(msg({ message: `Fully focused: ${village} is your main work`, context: "role card quality, 60% and above" }))
    : i18n._(msg({ message: `Focused: ${village} is a main part of your work`, context: "role card quality, below 60%" }));
}

/** The qualities with the token line drawn for this commitment. */
export function withFocusLine(i18n: I18n = appI18n, lines: readonly string[], village: string, pct: number | null): string[] {
  return lines.map((l) => (isFocusLine(l) ? focusWords(i18n, village, pct) : l));
}
