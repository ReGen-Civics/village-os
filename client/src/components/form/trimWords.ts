/**
 * The trim a box over its limit needs, in words (the ops request of 19 Nov 2026): one message, shown under the box
 * (LimitSigns.tsx) and named at send (fireflyPath/limitProblems.ts), so the two always say the same.
 */
import type { I18n } from "@lingui/core";
import { msg } from "@lingui/core/macro";

/** "1,240 characters over the limit. Trim 1,240 characters to send. Everything you wrote is kept." */
export function trimWords(over: number, i18n: I18n): string {
  let count = String(over);
  try {
    count = new Intl.NumberFormat(i18n.locale || undefined).format(over);
  } catch {
    /* the plain number */
  }
  return i18n._(msg({ message: `${count} characters over the limit. Trim ${count} characters to send. Everything you wrote is kept.`, context: "limit notice under a box" }));
}
