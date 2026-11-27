/**
 * A ROLE APPLICATION'S OWN CHECKS, IN THE READER'S LANGUAGE (lane ES-A, 26 Nov 2026).
 *
 * The sentences roleApplicationType.ts wrote itself, and the shared `DRAFT_WORDS.blocked` (shared/seraDrafts.ts) that
 * stops a send while Sera's draft is still a draft. Each is drawn through the catalog when the check runs, which is at
 * render, so it follows the page's language. The shared `blocked` stays English for the server; here the list of
 * drafted parts is joined by the sentence itself, never by English "and".
 *
 * Not here: the messages the shared parsers return. parseGoals and judgeTermsStep carry a code now and are said in
 * parsedChecks.ts; parseSeatSettings still arrives as finished English and waits on carrying one.
 */
// A value import of the runtime: precompileEnglish compiles the messages of a file that imports it and skips one
// that only uses `msg` (client/src/components/roleCard/payBandWords.ts says the same).
import { i18n } from "@lingui/core";
import { msg } from "@lingui/core/macro";
// The app's one Lingui instance, activated in English at load: a check can run before any page mounts a provider.
import "@/i18n/i18n";
import type { DraftKind } from "@shared/seraDrafts";

/** "Say whether you accept each setting, …": the door's terms step with no answer yet. */
export const termsUnanswered = (): string =>
  i18n._(msg({ message: "Say whether you accept each setting, or would like to talk about it, and choose your commitment.", context: "role application: check" }));

/** The terms parser's first refusal, and how many more there are. */
export const moreToFix = (first: string, more: number): string =>
  more > 0 ? i18n._(msg({ message: `${first} And ${more} more to fix in the terms.`, context: "role application: check" })) : first;

export const pickRole = (): string => i18n._(msg({ message: "Pick the role you are proposing for.", context: "role application: check" }));

export const atMostRoles = (max: number): string => i18n._(msg({ message: `One proposal holds at most ${max} roles.`, context: "role application: check" }));

export const sayAim = (): string => i18n._(msg({ message: "Say your aim for this role.", context: "role application: check" }));

export const pickVillageGoal = (): string => i18n._(msg({ message: "Pick the village goal your work serves.", context: "role application: check" }));

/** One drafted part, as the start of a sentence and inside one. */
function part(kind: DraftKind, start: boolean): string {
  if (kind === "aim") return start ? i18n._(msg({ message: "Your aim", context: "role application: a drafted part, starting a sentence" })) : i18n._(msg({ message: "your aim", context: "role application: a drafted part" }));
  if (kind === "goals") return start ? i18n._(msg({ message: "Your goals", context: "role application: a drafted part, starting a sentence" })) : i18n._(msg({ message: "your goals", context: "role application: a drafted part" }));
  return start ? i18n._(msg({ message: "Your story line", context: "role application: a drafted part, starting a sentence" })) : i18n._(msg({ message: "your story line", context: "role application: a drafted part" }));
}

/** The sentence that stops a send while a part is still Sera's draft (shared `DRAFT_WORDS.blocked`). */
export function draftBlocked(what: readonly DraftKind[]): string {
  if (what.length === 0) return "";
  const first = part(what[0], true);
  if (what.length === 1) {
    return i18n._(msg({ message: `${first} is still a draft from Sera. Edit it or press "Keep this", then send.`, context: "role application: check" }));
  }
  const middle = what.slice(1, -1).map((k) => part(k, false)).join(", ");
  const head = middle ? `${first}, ${middle}` : first;
  const last = part(what[what.length - 1], false);
  return i18n._(msg({ message: `${head} and ${last} are still a draft from Sera. Edit them or press "Keep this", then send.`, context: "role application: check" }));
}
