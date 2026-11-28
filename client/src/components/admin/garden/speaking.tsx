/**
 * HOW THE GARDEN SPEAKS, AND HOW MUCH (the founder, 28 Nov 2026: "Go with warm
 * and plain with the brief and quiet toggle").
 *
 * WARM AND PLAIN is the voice everywhere: the band's line, the legend under a
 * map, the guide's own lines. BRIEF AND QUIET is the `quiet` setting of the
 * speaking dial each person has: the same facts in the fewest words. The game-guide voice ("the Hall's lantern burns
 * brightest") is not used. A place's name is a name, never a way of talking.
 *
 * `useGuideSpeaking` is the dial: one setting per person, kept in their own
 * browser the way the lens and the dock's state are, and every reader on the
 * page stays in step. The type holds all three settings (quiet, decisions,
 * walk); a screen shows ONE toggle, brief and quiet on or off, because
 * nothing follows from the other two yet.
 *
 * `useGardenWords` holds the garden's own fixed lines in BOTH forms, each
 * pair side by side, so a reader of this file sees what the toggle changes.
 * Every form is its own message with its own translation. A caller hands the
 * facts (the village's name, how many places need the person) and gets the
 * line for this person's setting.
 */
import { useCallback, useSyncExternalStore } from "react";
import { useLingui } from "@lingui/react/macro";
import { useGardenSettings } from "./Garden";
import { personalKey, recall, remember, subscribe } from "./gardenMemory";

/**
 * The dial's three settings (the founder, 27 Nov 2026: "quiet, at decisions,
 * walk with me"). All three are in the type so the data never changes shape.
 * Only `quiet` behaves differently today. The garden holds its own copy of
 * the list so it needs nothing outside its folder; the guide's dock holds the
 * server's copy to the same three.
 */
export const GUIDE_SPEAKING = ["quiet", "decisions", "walk"] as const;
export type GuideSpeaking = (typeof GUIDE_SPEAKING)[number];

/** What a person who never chose gets: she speaks at decisions, warm and plain. */
export const DEFAULT_GUIDE_SPEAKING: GuideSpeaking = "decisions";

/** A kept value read back as a setting. Anything unknown is the default. */
export function readGuideSpeaking(v: unknown): GuideSpeaking {
  return typeof v === "string" && (GUIDE_SPEAKING as readonly string[]).includes(v) ? (v as GuideSpeaking) : DEFAULT_GUIDE_SPEAKING;
}

/** Whether a setting is the brief and quiet one. */
export const speaksBriefly = (setting: GuideSpeaking): boolean => setting === "quiet";

export const GARDEN_SPEAKING_KEY = "garden.speaking";

export interface GuideSpeakingState {
  /** The person's setting. */
  speaking: GuideSpeaking;
  /** True on brief and quiet. */
  quiet: boolean;
  setSpeaking: (next: GuideSpeaking) => void;
  /** The one toggle a person is shown: brief and quiet on, or back to the default. */
  setQuiet: (on: boolean) => void;
}

/**
 * This person's speaking dial. Inside a <Garden> it is kept under the garden's
 * own person key, like the lens; a caller that draws outside one (the guide's
 * dock, fixed beside an older page) names the person itself.
 */
export function useGuideSpeaking(opts: { personKey?: string } = {}): GuideSpeakingState {
  const settings = useGardenSettings();
  const key = personalKey(GARDEN_SPEAKING_KEY, settings.personKey ?? opts.personKey);
  const kept = useSyncExternalStore(
    subscribe,
    () => recall(key),
    () => null,
  );
  const speaking = kept === null ? DEFAULT_GUIDE_SPEAKING : readGuideSpeaking(kept);
  // The default is kept as nothing at all, so a person who never chose leaves no trace.
  const setSpeaking = useCallback((next: GuideSpeaking) => remember(key, next === DEFAULT_GUIDE_SPEAKING ? null : next), [key]);
  const setQuiet = useCallback((on: boolean) => setSpeaking(on ? "quiet" : DEFAULT_GUIDE_SPEAKING), [setSpeaking]);
  return { speaking, quiet: speaksBriefly(speaking), setSpeaking, setQuiet };
}

/** The part of the day a line names: "this morning", "this afternoon", "tonight". */
export type DayPart = "morning" | "afternoon" | "evening";

/** Morning from five, afternoon from noon, evening from five until five. PURE. */
export function dayPartOf(hour: number): DayPart {
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 17) return "afternoon";
  return "evening";
}

/** A small count as a word ("four places"), the way a neighbour says it; a larger one stays a number. */
export function useNumberWord(): (n: number) => string {
  const { t } = useLingui();
  return (n) => {
    switch (n) {
      case 2:
        return t({ message: "two", context: "garden, a small count said as a word" });
      case 3:
        return t({ message: "three", context: "garden, a small count said as a word" });
      case 4:
        return t({ message: "four", context: "garden, a small count said as a word" });
      case 5:
        return t({ message: "five", context: "garden, a small count said as a word" });
      case 6:
        return t({ message: "six", context: "garden, a small count said as a word" });
      case 7:
        return t({ message: "seven", context: "garden, a small count said as a word" });
      case 8:
        return t({ message: "eight", context: "garden, a small count said as a word" });
      case 9:
        return t({ message: "nine", context: "garden, a small count said as a word" });
      case 10:
        return t({ message: "ten", context: "garden, a small count said as a word" });
      default:
        return String(n);
    }
  };
}

export interface GardenWords {
  /** True when this person asked for brief and quiet. */
  quiet: boolean;
  /** The part of the day the lines name. */
  dayPart: DayPart;
  /** The band's one line: how many places need the person now. The village's own name, from its brand. */
  band: (input: { village?: string; needing: number }) => string;
  /** Under a map: what a lit lantern is. A description of the picture, said plainly. */
  legend: string;
  /** Under a map with places not built yet: what scaffolding is. */
  unbuilt: string;
}

/**
 * The garden's own fixed lines for this person's setting. `now` is for a test
 * or a photograph; left out, it is the clock.
 */
export function useGardenWords(opts: { personKey?: string; now?: Date } = {}): GardenWords {
  const { t } = useLingui();
  const { quiet } = useGuideSpeaking({ personKey: opts.personKey });
  const word = useNumberWord();
  const dayPart = dayPartOf((opts.now ?? new Date()).getHours());
  /** Warm and plain, or brief and quiet: the pair is written together and the dial picks. */
  const say = (full: string, brief: string) => (quiet ? brief : full);

  const band: GardenWords["band"] = ({ village, needing }) => {
    const name = village?.trim() || t({ message: "The village", context: "garden band, where the village has no name of its own yet" });
    const n = Math.max(0, Math.floor(Number.isFinite(needing) ? needing : 0));
    if (n === 0) {
      return say(
        dayPart === "morning"
          ? t({ message: "The village is quiet this morning. Nothing needs you.", context: "garden band, nothing waits" })
          : dayPart === "afternoon"
            ? t({ message: "The village is quiet this afternoon. Nothing needs you.", context: "garden band, nothing waits" })
            : t({ message: "The village is quiet tonight. Nothing needs you.", context: "garden band, nothing waits" }),
        t({ message: "All clear.", context: "garden band, nothing waits, brief" }),
      );
    }
    if (n === 1) {
      return say(
        dayPart === "morning"
          ? t({ message: `${name} this morning: one place needs you.`, context: "garden band, one place waits" })
          : dayPart === "afternoon"
            ? t({ message: `${name} this afternoon: one place needs you.`, context: "garden band, one place waits" })
            : t({ message: `${name} tonight: one place needs you.`, context: "garden band, one place waits" }),
        t({ message: "1 place needs you.", context: "garden band, one place waits, brief" }),
      );
    }
    const count = word(n);
    return say(
      dayPart === "morning"
        ? t({ message: `${name} this morning: ${count} places need you.`, context: "garden band, several places wait" })
        : dayPart === "afternoon"
          ? t({ message: `${name} this afternoon: ${count} places need you.`, context: "garden band, several places wait" })
          : t({ message: `${name} tonight: ${count} places need you.`, context: "garden band, several places wait" }),
      t({ message: `${n} places need you.`, context: "garden band, several places wait, brief" }),
    );
  };

  return {
    quiet,
    dayPart,
    band,
    legend: say(
      t({ message: "A lit lantern marks a place that needs you.", context: "garden map legend" }),
      t({ message: "Lit: needs you.", context: "garden map legend, brief" }),
    ),
    unbuilt: say(
      t({ message: "A place under scaffolding is not set up yet.", context: "garden map legend, places not built" }),
      t({ message: "Scaffolding: not set up.", context: "garden map legend, places not built, brief" }),
    ),
  };
}
