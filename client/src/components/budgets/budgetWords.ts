/**
 * The budget desk's shared words, keyed by the unions the server sends, so a
 * category or a reason added in shared/budgets.ts fails the typecheck here
 * instead of drawing an empty space.
 */
// A value import of the runtime, as payBandWords.ts has: precompileEnglish compiles the messages of a file that
// imports it and skips one that only uses `msg`.
import { i18n as appI18n, type I18n, type MessageDescriptor } from "@lingui/core";
import { msg } from "@lingui/core/macro";
import type { BudgetCategory, LineStatus, NotCountedReason } from "@shared/budgets";

export const CATEGORY_WORDS: Record<BudgetCategory, MessageDescriptor> = {
  role_pay: msg({ message: "Role pay", context: "budget category" }),
  quest_pay: msg({ message: "Quest pay", context: "budget category" }),
  materials: msg({ message: "Materials", context: "budget category" }),
  other: msg({ message: "Other", context: "budget category" }),
};

export const STATUS_WORDS: Record<LineStatus, MessageDescriptor> = {
  approved: msg({ message: "Counts", context: "budget line status" }),
  draft: msg({ message: "Draft", context: "budget line status" }),
  closed: msg({ message: "Closed", context: "budget line status" }),
  withdrawn: msg({ message: "Withdrawn", context: "budget line status" }),
};

export const NOT_COUNTED_WORDS: Record<NotCountedReason, MessageDescriptor> = {
  status: msg({ message: "it is a draft or withdrawn", context: "why a budget line does not count" }),
  currency: msg({ message: "it is in another currency with no rate locked", context: "why a budget line does not count" }),
  no_currency: msg({ message: "the village has no currency set", context: "why a budget line does not count" }),
  not_adopted: msg({ message: "it came from a source and nobody has adopted it yet", context: "why a budget line does not count" }),
  unmatched: msg({ message: "its circle or role could not be matched", context: "why a budget line does not count" }),
  no_circle: msg({ message: "it names no circle", context: "why a budget line does not count" }),
  name_held: msg({ message: "its words are held until someone renames it", context: "why a budget line does not count" }),
};

/** One of these words in the reader's language: the provider's i18n when a component has it, the app's otherwise. */
export const wordOf = (d: MessageDescriptor, i18n: I18n = appI18n): string => i18n._(d);
