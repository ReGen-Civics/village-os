/**
 * A NEW HOLDER'S FIRST DAYS, IN THE READER'S LANGUAGE: the mirror of `ONBOARDING_WORDS` in ./OnboardingPath.tsx,
 * the path a member who was just adopted into a role walks on their profile.
 *
 * The English table stays the source; the path draws this mirror through `useOnboardingPathWords()`. Typed off
 * it, so a key added there and not here fails the compiler; onboardingPathWords.test.ts holds the English equal.
 */
// A value import of the runtime: precompileEnglish compiles the messages of a file that imports it and skips one
// that only uses `msg` (client/src/components/roleCard/payBandWords.ts says the same).
import { i18n as appI18n, type I18n } from "@lingui/core";
import { msg, plural } from "@lingui/core/macro";
import { drawWords, useWords, type Drawn, type WordMirror } from "@/i18n/wordTable";
import type { ONBOARDING_WORDS } from "./OnboardingPath";

export type OnboardingPathWords = Drawn<typeof ONBOARDING_WORDS>;

export const ONBOARDING_PATH_MIRROR: WordMirror<typeof ONBOARDING_WORDS> = {
  heading: (role) => [role],
  line: (day, due) => msg({ message: `Day ${day}. The steps are due by ${due}.`, context: "onboarding path: line" }),
  days: (a, b) => (a === b ? msg({ message: `Day ${a}`, context: "onboarding path: days, one day" }) : msg({ message: `Days ${a} to ${b}`, context: "onboarding path: days" })),
  holderOf: (role) => msg({ message: `A new holder in ${role}`, context: "onboarding path: holderOf" }),
  buddy: (name) => msg({ message: `Your buddy is ${name}.`, context: "onboarding path: buddy" }),
  noBuddy: msg({ message: "No buddy is named yet. Ask the one who adopted you.", context: "onboarding path: noBuddy" }),
  open: (n) => msg({ message: plural(n, { one: "# step open", other: "# steps open" }), context: "onboarding path: open" }),
  allDone: msg({ message: "Every step is done.", context: "onboarding path: allDone" }),
  tick: msg({ message: "Mark done", context: "onboarding path: tick" }),
  doneWhen: msg({ message: "Done when:", context: "onboarding path: doneWhen" }),
  due: (d) => msg({ message: `by day ${d}`, context: "onboarding path: due" }),
  withOwner: (name) => msg({ message: `With ${name}.`, context: "onboarding path: withOwner" }),
  later: msg({ message: "After the first fourteen days", context: "onboarding path: later" }),
  checkins: msg({ message: "Check-ins", context: "onboarding path: checkins" }),
  checkinOpen: (d) => msg({ message: `File your day ${d} check-in`, context: "onboarding path: checkinOpen" }),
  filed: (d) => msg({ message: `Day ${d} filed`, context: "onboarding path: filed" }),
  clarity: msg({ message: "How clear is your role? (1 to 5)", context: "onboarding path: clarity" }),
  overall: msg({ message: "How is it going overall? (1 to 5)", context: "onboarding path: overall" }),
  connection: msg({ message: "Who have you worked with? Who do you still want to meet?", context: "onboarding path: connection" }),
  culture: msg({ message: "What has surprised you about how we work together?", context: "onboarding path: culture" }),
  basics: msg({ message: "Do you have the access and tools you need? What is missing?", context: "onboarding path: basics" }),
  load: msg({ message: "How stretched or steady do we feel against the commitment we agreed?", context: "onboarding path: load" }),
  oneThing: msg({ message: "One thing that would help most next moon", context: "onboarding path: oneThing" }),
  file: msg({ message: "File check-in", context: "onboarding path: file" }),
  failed: msg({ message: "The onboarding path did not load.", context: "onboarding path: failed" }),
  retry: msg({ message: "Retry", context: "onboarding path: retry" }),
}
;

/** The path's words in `i18n`'s language, for code outside a component. */
export function onboardingPathWords(i18n: I18n = appI18n): OnboardingPathWords {
  return drawWords(ONBOARDING_PATH_MIRROR, i18n);
}

/** The path's words in the reader's language. */
export function useOnboardingPathWords(): OnboardingPathWords {
  return useWords(ONBOARDING_PATH_MIRROR);
}
