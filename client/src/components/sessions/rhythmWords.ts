/**
 * THE MEETING RHYTHM IN THE READER'S LANGUAGE: the mirror of `RHYTHM_COPY` (shared/sessionRhythm.ts), drawn through `useRhythmWords()`
 * in a component and `rhythmWords()` outside one. Typed off the shared table, so a key added there and not here
 * fails the compiler; the test beside it holds the English equal and every entry to the catalog.
 */
// A value import of the runtime: precompileEnglish compiles the messages of a file that imports it and skips one
// that only uses `msg` (client/src/components/roleCard/payBandWords.ts says the same).
import { i18n as appI18n, type I18n } from "@lingui/core";
import { msg, plural } from "@lingui/core/macro";
import type { RHYTHM_COPY } from "@shared/sessionRhythm";
import { drawWords, useWords, type Drawn, type WordMirror } from "@/i18n/wordTable";

/** The circle's name, and whether it already says "circle" (shared/sessionTasks.ts `circleWords`). */
function circleNamed(circleName: string): { named: boolean; name: string } {
  const name = circleName.trim();
  return { named: /\bcircle$/i.test(name), name };
}

export const RHYTHM_COPY_MIRROR: WordMirror<typeof RHYTHM_COPY> = {
  sectionTitle: msg({ message: "Coming up", context: "live sessions: sectionTitle" }),
  empty: msg({ message: "No circle has a meeting rhythm yet.", context: "live sessions: empty" }),
  setRhythm: msg({ message: "Set a meeting rhythm", context: "live sessions: setRhythm" }),
  change: msg({ message: "Change", context: "live sessions: change" }),
  skip: msg({ message: "Skip this one", context: "live sessions: skip" }),
  skipRhythm: (when) => msg({ message: `Skip the rhythm's meeting ${when}`, context: "live sessions: skipRhythm" }),
  getReady: msg({ message: "Get the room ready", context: "live sessions: getReady" }),
  roomTitle: (circleName, day) => {
    const { named, name } = circleNamed(circleName);
    return named
      ? msg({ message: `${name}, ${day}`, context: "live sessions: roomTitle, a circle named with its own word" })
      : msg({ message: `${name} circle, ${day}`, context: "live sessions: roomTitle" });
  },
  join: msg({ message: "Join the room", context: "live sessions: join" }),
  openNow: msg({ message: "Happening now", context: "live sessions: openNow" }),
  waiting: (n) =>
    n === 0
      ? msg({ message: "No agenda items yet", context: "live sessions: waiting" })
      : msg({ message: plural(n, { one: "# agenda item waiting", other: "# agenda items waiting" }), context: "live sessions: waiting" }),
  formTitle: msg({ message: "A meeting rhythm", context: "live sessions: formTitle" }),
  circleLabel: msg({ message: "Which circle?", context: "live sessions: circleLabel" }),
  circleChoose: msg({ message: "Choose a circle", context: "live sessions: circleChoose" }),
  howOftenLabel: msg({ message: "How often?", context: "live sessions: howOftenLabel" }),
  howOften: {
    every1: msg({ message: "Every week", context: "live sessions: howOften.every1" }),
    every2: msg({ message: "Every 2 weeks", context: "live sessions: howOften.every2" }),
    every3: msg({ message: "Every 3 weeks", context: "live sessions: howOften.every3" }),
    every4: msg({ message: "Every 4 weeks", context: "live sessions: howOften.every4" }),
    new_moon: msg({ message: "At each new moon", context: "live sessions: howOften.new_moon" }),
    full_moon: msg({ message: "At each full moon", context: "live sessions: howOften.full_moon" }),
    once: msg({ message: "Once", context: "live sessions: howOften.once" }),
  },
  weekdayLabel: msg({ message: "On which day?", context: "live sessions: weekdayLabel" }),
  startsOnLabel: msg({ message: "Starting from", context: "live sessions: startsOnLabel" }),
  onLabel: msg({ message: "On which date?", context: "live sessions: onLabel" }),
  timeLabel: msg({ message: "At what time?", context: "live sessions: timeLabel" }),
  durationLabel: msg({ message: "How long, in minutes", context: "live sessions: durationLabel" }),
  zoneHint: (zone) => msg({ message: `Times are the village's own (${zone}).`, context: "live sessions: zoneHint" }),
  save: msg({ message: "Save the rhythm", context: "live sessions: save" }),
  saving: msg({ message: "Saving...", context: "live sessions: saving" }),
  clear: msg({ message: "Stop this rhythm", context: "live sessions: clear" }),
  clearConfirm: (circleName) => {
    const { named, name } = circleNamed(circleName);
    return named
      ? msg({ message: `Stop the meeting rhythm of the ${name}? Its meetings leave Coming up, and nobody hears the day before.`, context: "live sessions: clearConfirm, a circle named with its own word" })
      : msg({ message: `Stop the meeting rhythm of the ${name} circle? Its meetings leave Coming up, and nobody hears the day before.`, context: "live sessions: clearConfirm" });
  },
  clearYes: msg({ message: "Stop it", context: "live sessions: clearYes" }),
  keep: msg({ message: "Keep it", context: "live sessions: keep" }),
  cancel: msg({ message: "Cancel", context: "live sessions: cancel" }),
  failed: msg({ message: "That did not go through. Try again in a moment.", context: "live sessions: failed" }),
  saved: (circleName) => {
    const { named, name } = circleNamed(circleName);
    return named
      ? msg({ message: `Saved. The ${name} has its meeting rhythm.`, context: "live sessions: saved, a circle named with its own word" })
      : msg({ message: `Saved. The ${name} circle has its meeting rhythm.`, context: "live sessions: saved" });
  },
  skipped: (circleName, when) => {
    const { named, name } = circleNamed(circleName);
    return named
      ? msg({ message: `Skipped. The next ${name} meeting is ${when}.`, context: "live sessions: skipped, a circle named with its own word" })
      : msg({ message: `Skipped. The next ${name} circle meeting is ${when}.`, context: "live sessions: skipped" });
  },
  skippedLast: (circleName) => {
    const { named, name } = circleNamed(circleName);
    return named
      ? msg({ message: `Skipped. The ${name} has no meeting coming up now.`, context: "live sessions: skippedLast, a circle named with its own word" })
      : msg({ message: `Skipped. The ${name} circle has no meeting coming up now.`, context: "live sessions: skippedLast" });
  },
  stopped: (circleName) => {
    const { named, name } = circleNamed(circleName);
    return named
      ? msg({ message: `Stopped. The ${name} has no meeting rhythm now.`, context: "live sessions: stopped, a circle named with its own word" })
      : msg({ message: `Stopped. The ${name} circle has no meeting rhythm now.`, context: "live sessions: stopped" });
  },
}
;

export type RhythmWords = Drawn<typeof RHYTHM_COPY>;

/** The rhythm's words in `i18n`'s language, for code outside a component. */
export function rhythmWords(i18n: I18n = appI18n): RhythmWords {
  return drawWords(RHYTHM_COPY_MIRROR, i18n);
}

/** The rhythm's words in the reader's language. */
export function useRhythmWords(): RhythmWords {
  return useWords(RHYTHM_COPY_MIRROR);
}
