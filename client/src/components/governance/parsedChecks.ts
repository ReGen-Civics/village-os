/**
 * THE SHARED PARSERS' REFUSALS, IN THE READER'S LANGUAGE (lane ES-A, 27 Nov 2026).
 *
 * parseGoals (shared/proposalGoals.ts) and judgeTermsStep (shared/termsWords.ts) answer a refusal with its English,
 * which the server sends as it is, and beside it a `code` and what the sentence was said with. A page draws the same
 * sentence here from the code, through the catalog, at render. A refusal with no code (one from an older server, or a
 * code this build does not know) is said in its own English.
 *
 * The mirrors are declared with `mirrorOf`, because the client already ships the shared English (the parsers run in
 * the form), so a production build drops each `message` here and falls back to the shared entry where the catalog
 * has no word.
 */
// A value import of the runtime: precompileEnglish compiles the messages of a file that imports it and skips one
// that only uses `msg` (client/src/components/roleCard/payBandWords.ts says the same).
import { i18n as appI18n, type I18n } from "@lingui/core";
import { msg } from "@lingui/core/macro";
// The app's one Lingui instance, activated in English at load: a check can run before any page mounts a provider.
import "@/i18n/i18n";
import { GOAL_LIMITS, GOAL_WORDS, type GoalCode } from "@shared/proposalGoals";
import { TERM_LABELS, TERM_NOTE_MAX, TERMS_STEP_WORDS, type TermKey, type TermsStepCode } from "@shared/termsWords";
import { drawWords, mirrorOf } from "@/i18n/wordTable";

const max = GOAL_LIMITS.max;

/** GOAL_WORDS in the reader's language. */
export const GOAL_MIRROR = mirrorOf(() => GOAL_WORDS, {
  notAList: msg({ message: "Send your goals as a list.", context: "role goals: check" }),
  needOne: msg({ message: "Add at least one goal for your first moon.", context: "role goals: check" }),
  tooMany: msg({ message: `Up to ${max} goals for a role.`, context: "role goals: check" }),
  badGoal: msg({ message: "One of your goals could not be read.", context: "role goals: check" }),
  needTitle: (n: number) => msg({ message: `Name goal ${n}.`, context: "role goals: check" }),
  needDoneWhen: (n: number) => msg({ message: `Say when goal ${n} is done.`, context: "role goals: check" }),
  // The parser names one of two parts; a part it does not name yet is said as written.
  tooLong: (what: string, n: number) =>
    what === "A goal"
      ? msg({ message: `A goal is too long. Keep it under ${n} characters.`, context: "role goals: check" })
      : what === "Done when"
        ? msg({ message: `Done when is too long. Keep it under ${n} characters.`, context: "role goals: check" })
        : msg({ message: `${what} is too long. Keep it under ${n} characters.`, context: "role goals: check" }),
  notTheRole: (n: number) => msg({ message: `Goal ${n} moves a goal this role does not have. Pick one from the role's own goals.`, context: "role goals: check" }),
  notASeasonGoal: (n: number) => msg({ message: `Goal ${n} names a season goal this season does not have.`, context: "role goals: check" }),
  badDate: (n: number) => msg({ message: `Write the date for goal ${n} as a day, like 2026-11-16.`, context: "role goals: check" }),
  dateOutside: (n: number) => msg({ message: `The date for goal ${n} falls outside this moon.`, context: "role goals: check" }),
  notThisProposal: (n: number) => msg({ message: `Goal ${n} names a role that is not in this proposal.`, context: "role goals: check" }),
});

/** TERM_LABELS in the reader's language: the name a terms refusal gives a setting. */
export const TERM_LABEL_MIRROR = mirrorOf(() => TERM_LABELS, {
  term: msg({ message: "Term", context: "role terms: a setting a check names" }),
  clocks: msg({ message: "Clocks", context: "role terms: a setting a check names" }),
  rhythm: msg({ message: "Rhythm", context: "role terms: a setting a check names" }),
  allowance: msg({ message: "Allowance", context: "role terms: a setting a check names" }),
  bonus: msg({ message: "Bonus", context: "role terms: a setting a check names" }),
  goals: msg({ message: "Goals", context: "role terms: a setting a check names" }),
  scoreboard: msg({ message: "Scoreboard", context: "role terms: a setting a check names" }),
  ending: msg({ message: "Ending", context: "role terms: a setting a check names" }),
});

/** TERMS_STEP_WORDS in the reader's language. */
export const TERMS_STEP_MIRROR = mirrorOf(() => TERMS_STEP_WORDS, {
  unanswered: (label: string) => msg({ message: `Say whether you accept or would like to talk about ${label}.`, context: "role terms: check" }),
  noteTooLong: (label: string, max: number) => msg({ message: `Keep your note on ${label} to ${max} characters.`, context: "role terms: check" }),
  commitment: msg({ message: "Choose your commitment, from 0 to 100 in steps of 10.", context: "role terms: check" }),
});

/** A goals refusal as parseGoals answers it; `code` and `args` may be missing from an older answer. */
export interface GoalsRefusalLike {
  error: string;
  code?: GoalCode | string;
  args?: readonly unknown[];
}

/** A parseGoals refusal in the reader's language, or its own English when it carries no code this build knows. */
export function goalsRefusal(r: GoalsRefusalLike, i18n: I18n = appI18n): string {
  if (!r.code || !Object.prototype.hasOwnProperty.call(GOAL_MIRROR, r.code)) return r.error;
  const said = drawWords(GOAL_MIRROR, i18n)[r.code as GoalCode] as string | ((...a: unknown[]) => string);
  return typeof said === "function" ? said(...(r.args ?? [])) : said;
}

/** A terms refusal as judgeTermsStep answers it; `code` may be missing from an older answer. */
export interface TermsRefusalLike {
  error: string;
  code?: TermsStepCode | string;
  key?: TermKey | "commitment";
}

/** A judgeTermsStep refusal in the reader's language, or its own English when it carries no code this build knows. */
export function termsRefusal(r: TermsRefusalLike, i18n: I18n = appI18n): string {
  const words = drawWords(TERMS_STEP_MIRROR, i18n);
  if (r.code === "commitment") return words.commitment;
  const key = r.key && r.key !== "commitment" && Object.prototype.hasOwnProperty.call(TERM_LABELS, r.key) ? r.key : null;
  if (!key) return r.error;
  const label = drawWords(TERM_LABEL_MIRROR, i18n)[key];
  if (r.code === "unanswered") return words.unanswered(label);
  if (r.code === "noteTooLong") return words.noteTooLong(label, TERM_NOTE_MAX);
  return r.error;
}
