/**
 * SUGGESTED NEXT STEPS, so the talk box is never blank (the plan's "a blank
 * chat box tells people nothing about what is possible").
 *
 * Up to four short lines above the box, in words a founder would say. A press
 * puts the words into the box and stops there: nothing is asked until the
 * person presses Send. They depend on where the person is (the open Admin tab,
 * or the launch or organizing guide) and on whether the conversation has
 * started.
 *
 * WHAT A SUGGESTION MAY NEVER DO. Name money, pay, a vote or a person, or
 * invite ranking, comparing or judging anybody: those stay a person's own
 * (the founder's rulings of 27 Nov 2026, and "no AI in selection"). Each line
 * is also something the guide can answer from what she reads: settings, help
 * text, the Admin map and the shape of the org chart. dockSuggestions.test.ts
 * holds every line to that list.
 *
 * `useDockSuggestions` reads the words through the Lingui runtime, which is
 * also what makes the build compile this module's English
 * (client/src/i18n/precompileEnglish.ts skips a file that only declares).
 */
import type { MessageDescriptor } from "@lingui/core";
import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react/macro";

/** The Admin tabs that have suggestions of their own. Any other tab reads the general four. */
export const SUGGESTED_TABS = [
  "home",
  "setup",
  "variables",
  "modules",
  "integrations",
  "season",
  "org-chart",
  "faqs",
  "events-admin",
  "quests-admin",
] as const;
export type SuggestedTab = (typeof SUGGESTED_TABS)[number];

/** Which of the dock's conversations is open. */
export type SuggestionPlace = { mode: "helper"; tab: string } | { mode: "launch" } | { mode: "organize" };

export const MAX_SUGGESTIONS = 4;

const GENERAL: readonly MessageDescriptor[] = [
  msg({ message: "What needs me today?", context: "guide dock, a suggested question" }),
  msg({ message: "Where do I set the timezone?", context: "guide dock, a suggested question" }),
  msg({ message: "What is still not set up?", context: "guide dock, a suggested question" }),
  msg({ message: "What can you help me with?", context: "guide dock, a suggested question" }),
];

/** Once a conversation has started: ways to go on from the last answer. */
const GOING_ON: readonly MessageDescriptor[] = [
  msg({ message: "Tell me more.", context: "guide dock, a suggested follow-up" }),
  msg({ message: "Where is that page?", context: "guide dock, a suggested follow-up" }),
  msg({ message: "Say that in plainer words.", context: "guide dock, a suggested follow-up" }),
  msg({ message: "What should I do first?", context: "guide dock, a suggested follow-up" }),
];

const BY_TAB: Record<SuggestedTab, readonly MessageDescriptor[]> = {
  home: [
    msg({ message: "What needs me today?", context: "guide dock, a suggested question" }),
    msg({ message: "Where do I set the timezone?", context: "guide dock, a suggested question" }),
    msg({ message: "Which page changes the menu?", context: "guide dock, a suggested question" }),
    msg({ message: "What can you help me with?", context: "guide dock, a suggested question" }),
  ],
  setup: [
    msg({ message: "What is still not set up?", context: "guide dock, a suggested question" }),
    msg({ message: "Where do I change the village's name?", context: "guide dock, a suggested question" }),
    msg({ message: "Where do I add our logo?", context: "guide dock, a suggested question" }),
    msg({ message: "What should I do first?", context: "guide dock, a suggested follow-up" }),
  ],
  variables: [
    msg({ message: "What does this page control?", context: "guide dock, a suggested question" }),
    msg({ message: "Where do I set the timezone?", context: "guide dock, a suggested question" }),
    msg({ message: "Which settings should I look at first?", context: "guide dock, a suggested question" }),
    msg({ message: "Find a setting for me.", context: "guide dock, a suggested question" }),
  ],
  modules: [
    msg({ message: "What can this village run?", context: "guide dock, a suggested question" }),
    msg({ message: "What does preview mean for a module?", context: "guide dock, a suggested question" }),
    msg({ message: "Put the Library in preview.", context: "guide dock, a suggested request" }),
    msg({ message: "What should I turn on first?", context: "guide dock, a suggested question" }),
  ],
  integrations: [
    msg({ message: "What should I connect first?", context: "guide dock, a suggested question" }),
    msg({ message: "Where does the guide's own key go?", context: "guide dock, a suggested question" }),
    msg({ message: "Where do I connect email?", context: "guide dock, a suggested question" }),
    msg({ message: "What is this page for?", context: "guide dock, a suggested question" }),
  ],
  season: [
    msg({ message: "What is a season here?", context: "guide dock, a suggested question" }),
    msg({ message: "Where do I name the season?", context: "guide dock, a suggested question" }),
    msg({ message: "Where do I set the season's dates?", context: "guide dock, a suggested question" }),
    msg({ message: "What is this page for?", context: "guide dock, a suggested question" }),
  ],
  "org-chart": [
    msg({ message: "Which circles do we have?", context: "guide dock, a suggested question" }),
    msg({ message: "How many roles are still open?", context: "guide dock, a suggested question" }),
    msg({ message: "Where do I add a role?", context: "guide dock, a suggested question" }),
    msg({ message: "What does this page show?", context: "guide dock, a suggested question" }),
  ],
  faqs: [
    msg({ message: "Draft an FAQ for residents.", context: "guide dock, a suggested request" }),
    msg({ message: "Where do visitors read these?", context: "guide dock, a suggested question" }),
    msg({ message: "What is this page for?", context: "guide dock, a suggested question" }),
    msg({ message: "What can you help me with?", context: "guide dock, a suggested question" }),
  ],
  "events-admin": [
    msg({ message: "How do I add a gathering?", context: "guide dock, a suggested question" }),
    msg({ message: "Where do members see the calendar?", context: "guide dock, a suggested question" }),
    msg({ message: "What is this page for?", context: "guide dock, a suggested question" }),
    msg({ message: "What can you help me with?", context: "guide dock, a suggested question" }),
  ],
  "quests-admin": [
    msg({ message: "How do quests work here?", context: "guide dock, a suggested question" }),
    msg({ message: "Where do I add a quest?", context: "guide dock, a suggested question" }),
    msg({ message: "What is this page for?", context: "guide dock, a suggested question" }),
    msg({ message: "What can you help me with?", context: "guide dock, a suggested question" }),
  ],
};

const LAUNCH: readonly MessageDescriptor[] = [
  msg({ message: "What is blocking the launch?", context: "guide dock, a suggested question on the road to launch" }),
  msg({ message: "Walk me through what is left.", context: "guide dock, a suggested request on the road to launch" }),
  msg({ message: "What should I do first?", context: "guide dock, a suggested follow-up" }),
  msg({ message: "What does this step mean?", context: "guide dock, a suggested question on the road to launch" }),
];

const LAUNCH_GOING_ON: readonly MessageDescriptor[] = [
  msg({ message: "What comes next?", context: "guide dock, a suggested follow-up on the road to launch" }),
  msg({ message: "Where do I do that?", context: "guide dock, a suggested follow-up on the road to launch" }),
  msg({ message: "Why does that matter?", context: "guide dock, a suggested follow-up on the road to launch" }),
  msg({ message: "Tell me more.", context: "guide dock, a suggested follow-up" }),
];

const ORGANIZE: readonly MessageDescriptor[] = [
  msg({ message: "How do we decide things well together?", context: "guide dock, a suggested question about organizing" }),
  msg({ message: "How do we handle a disagreement?", context: "guide dock, a suggested question about organizing" }),
  msg({ message: "How should we welcome new members?", context: "guide dock, a suggested question about organizing" }),
  msg({ message: "What does our brief say about this?", context: "guide dock, a suggested question about organizing" }),
];

const isSuggestedTab = (tab: string): tab is SuggestedTab => (SUGGESTED_TABS as readonly string[]).includes(tab);

/** The suggestions for a place, as descriptors. PURE. At most four. */
export function suggestionsFor(place: SuggestionPlace, empty: boolean): readonly MessageDescriptor[] {
  const pick =
    place.mode === "launch"
      ? empty ? LAUNCH : LAUNCH_GOING_ON
      : place.mode === "organize"
        ? empty ? ORGANIZE : GOING_ON
        : !empty
          ? GOING_ON
          : isSuggestedTab(place.tab)
            ? BY_TAB[place.tab]
            : GENERAL;
  return pick.slice(0, MAX_SUGGESTIONS);
}

/** Every suggestion there is, for the test that holds each one to the rules above. */
export function everySuggestion(): readonly MessageDescriptor[] {
  return [GENERAL, GOING_ON, LAUNCH, LAUNCH_GOING_ON, ORGANIZE, ...SUGGESTED_TABS.map((t) => BY_TAB[t])].flat();
}

/** The suggestions for a place, in the reader's language. */
export function useDockSuggestions(place: SuggestionPlace, empty: boolean): string[] {
  const { i18n } = useLingui();
  return Array.from(new Set(suggestionsFor(place, empty).map((d) => i18n._(d))));
}
