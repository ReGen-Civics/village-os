/**
 * The trim a box over its limit needs, in words (the ops request of 19 Nov 2026): one message, shown under the box
 * (LimitSigns.tsx) and named at send (fireflyPath/limitProblems.ts), so the two always say the same.
 */
// A value import of the runtime, as fireflyPath/applyWordsT.ts has: precompileEnglish compiles the messages of a
// file that imports it and skips one that only uses `msg` (client/src/i18n/precompileEnglish.ts).
import { i18n as appI18n, type I18n } from "@lingui/core";
import { msg } from "@lingui/core/macro";

/** "1,240 characters over the limit. Trim 1,240 characters to send. Everything you wrote is kept." */
export function trimWords(over: number, i18n: I18n = appI18n): string {
  let count = String(over);
  try {
    count = new Intl.NumberFormat(i18n.locale || undefined).format(over);
  } catch {
    /* the plain number */
  }
  return i18n._(msg({ message: `${count} characters over the limit. Trim ${count} characters to send. Everything you wrote is kept.`, context: "limit notice under a box" }));
}
