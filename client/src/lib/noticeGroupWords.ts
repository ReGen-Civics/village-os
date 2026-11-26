/**
 * The bell's section headings in the reader's language. shared/notificationKinds.ts names each group in English
 * for the server and the admin panel; the bell draws these. Small on purpose: the bell rides every page.
 * client/src/lib/noticeKindWordsI18n.test.ts holds them to the shared names.
 */
// A value import of the runtime: precompileEnglish compiles the messages of a file that imports it.
import { i18n as appI18n, type I18n, type MessageDescriptor } from "@lingui/core";
import { msg } from "@lingui/core/macro";

export const GROUP_TITLE_MSG: Readonly<Record<string, MessageDescriptor>> = {
  "decisions": msg({ message: "Decisions", context: "the bell: a section heading" }),
  "economy": msg({ message: "Economy", context: "the bell: a section heading" }),
  "work": msg({ message: "Work", context: "the bell: a section heading" }),
  "people": msg({ message: "People", context: "the bell: a section heading" }),
  "village": msg({ message: "The village", context: "the bell: a section heading" }),
};

/** A section heading in the reader's language; a group this file does not know keeps its English. */
export function groupTitle(id: string, english: string, i18n: I18n = appI18n): string {
  const d = GROUP_TITLE_MSG[id];
  return d && i18n.locale ? i18n._(d) : english; // no language started yet: the shared English
}
