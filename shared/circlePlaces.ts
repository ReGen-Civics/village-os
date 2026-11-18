/**
 * CIRCLE PLACES AT A GATHERING: a host gathering takes circles up to a cap its
 * own host sets (module `season-places`). People still answer as people; this
 * is a second count beside the gathering's person capacity.
 *
 * Pure: no pool, no clock unless handed one. The SQL is
 * server/repos/circlePlaces.ts and the doors server/routes/seasonPlaceGatherings.ts.
 */
import type { PlaceSeason } from "./seasonPlaces";

export const CIRCLE_PLACE_STATUSES = ["going", "waiting", "left"] as const;
export type CirclePlaceStatus = (typeof CIRCLE_PLACE_STATUSES)[number];

export interface CircleSettings {
  takesCircles: boolean;
  /** At most this many circles; null is no cap, 0 is none (caps fail closed). */
  circleCap: number | null;
  needsSeasonPlace: boolean;
}

/** A gathering that never said anything takes no circles. */
export const NO_CIRCLES: CircleSettings = { takesCircles: false, circleCap: null, needsSeasonPlace: true };

export const CIRCLE_CAP_MAX = 100000;

/** Read a host's change. Fields left out keep what is stored. */
export function circleSettingsChange(
  raw: unknown,
  stored: CircleSettings,
): { ok: true; settings: CircleSettings } | { ok: false; error: string } {
  const b = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const out: CircleSettings = { ...stored };
  if (b.takesCircles !== undefined) {
    if (typeof b.takesCircles !== "boolean") return { ok: false, error: "Say whether this gathering takes circles: true or false." };
    out.takesCircles = b.takesCircles;
  }
  if (b.needsSeasonPlace !== undefined) {
    if (typeof b.needsSeasonPlace !== "boolean") return { ok: false, error: "Say whether a circle needs a season place: true or false." };
    out.needsSeasonPlace = b.needsSeasonPlace;
  }
  if (b.circleCap !== undefined) {
    if (b.circleCap === null || b.circleCap === "") out.circleCap = null;
    else {
      const n = Number(b.circleCap);
      if (!Number.isInteger(n) || n < 0 || n > CIRCLE_CAP_MAX) return { ok: false, error: `The circle cap is a whole number from 0 to ${CIRCLE_CAP_MAX}, or blank for no cap.` };
      out.circleCap = n;
    }
  }
  return { ok: true, settings: out };
}

/** Going, or the waitlist. */
export function goingOrWaiting(going: number, cap: number | null): "going" | "waiting" {
  return cap === null || going < cap ? "going" : "waiting";
}

/** The season a gathering starts in: begun by its date and not ended. The latest wins, as `seasonState` picks. */
export function seasonCovering(day: string, seasons: readonly PlaceSeason[]): PlaceSeason | null {
  const running = [...seasons]
    .filter((s) => s.startsOn <= day && (!s.endsOn || day < s.endsOn))
    .sort((a, b) => a.startsOn.localeCompare(b.startsOn));
  return running.length ? running[running.length - 1] : null;
}

export const CIRCLE_STATUS_WORDS: Readonly<Record<CirclePlaceStatus, string>> = {
  going: "Going",
  waiting: "On the waitlist",
  left: "Not going",
};

/** Notice titles. They name the circle and the gathering, never a person. */
export const CIRCLE_NOTICES = {
  going: (circle: string, gathering: string) => `${circle} is going to ${gathering}.`,
  waiting: (circle: string, gathering: string, position: number) =>
    `${gathering} is full for circles. ${circle} is number ${position} on its waitlist, and you will hear the moment a place opens.`,
  opened: (circle: string, gathering: string) => `A place opened at ${gathering}. ${circle} is going.`,
} as const;

export const CIRCLE_REFUSALS = {
  notTaking: "This gathering does not take circles. Its host can turn that on.",
  recurring: "Circle places are for one-off gatherings. A repeating gathering takes people only.",
  closed: "This gathering is not taking answers: it is cancelled or still a draft.",
  needsPlace: (circle: string, season: string) =>
    `${circle} needs a place in ${season} before it can sign up for this gathering. Propose it on the season places page.`,
  noSeason: "This gathering starts outside every dated season, so no circle can hold a place for it yet.",
} as const;
