/**
 * PAID ON WHAT WE TRULY ACCOMPLISH (Rye, 14 Nov 2026).
 *
 * Every role holder reads these words: before seating on the goals step of a
 * proposal (both doors), and after seating under the My moon header. They
 * say how pay works at each moon's end: goals guide the moon, the project
 * needs us to be responsive, and the End of Moon review sets what was agreed
 * beside what was delivered (progress on the member's own goals, and the
 * other tasks they took on, including work outside their roles). When the two
 * are far apart, the Treasurer may propose a different amount with a reason,
 * the member sees it and can reply, and nothing pays until the Treasurer
 * confirms. People decide any change; nothing here scores anyone.
 *
 * Kept in its own small file so the proposal form can carry it without
 * loading the End of Moon module. Message descriptors, so each is read in the
 * reader's language where it is drawn (copy sweep, 15 Nov 2026): `t(WORDS.title)`.
 */

// A value import of the runtime, as client/src/lib/unsavedChanges.ts has: precompileEnglish compiles the messages of
// a file that imports it and skips one that only uses `msg`, which ships its English uncompiled (CI, 15 Nov 2026).
import { i18n as appI18n, type I18n } from "@lingui/core";
import { msg } from "@lingui/core/macro";

export const ACCOMPLISHED_PAY_WORDS = {
  title: msg({ message: "Goals guide us. Pay follows what you truly accomplish.", context: "how pay works" }),
  goals: msg({
    message:
      "Your goals for the moon are what we agree to, and we work toward them, because that's what we're here for. This is an early-stage project, and what it needs can change mid-moon. So we stay responsive, and we're paid on what we truly accomplish.",
    context: "how pay works",
  }),
  review: msg({
    message:
      "At each moon's end we look at two things together: your progress on your own goals, and the other tasks you took on, including ones outside your roles. If that's far from what you agreed, your pay can change to match, up or down.",
    context: "how pay works",
  }),
  confirm: msg({ message: "The Treasurer proposes any change with a reason. You see it and can reply, and nothing is paid until the Treasurer confirms.", context: "how pay works" }),
  /** The toggle under the My moon header. */
  show: msg({ message: "How pay works", context: "how pay works, the toggle" }),
} as const;

/** One of the words, in the reader's language. */
export const accomplishedPayLine = (key: keyof typeof ACCOMPLISHED_PAY_WORDS, i18n: I18n = appI18n): string => i18n._(ACCOMPLISHED_PAY_WORDS[key]);
