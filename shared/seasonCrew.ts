/**
 * SEASON CREW: every season starts fresh. Each member applies to sail that
 * season, naming the circle they would like (or none), and each circle's
 * picker for that season picks its crew from everyone who applied, up to the
 * circle's berths. Module `season-places`; the SQL is server/repos/seasonCrew.ts
 * and the doors server/routes/seasonCrew.ts.
 *
 * WHO PICKS. `season_crew.picker_role` names the role, in each circle, whose
 * live holder picks that circle's crew (a village writes its own word, such as
 * the title its circles give their lead). Blank, or a circle with no live
 * holder of that role, falls back to every live role holder in the circle, so
 * a circle is never left with nobody able to pick (constitution 0.4).
 *
 * Pure: no pool, no clock.
 */
import type { PlaceSeason } from "./seasonPlaces";

export const PICKER_ROLE_KEY = "season_crew.picker_role";
export const SHIP_NEEDS_PLACE_KEY = "season_crew.needs_place";

export const CREW_STATUSES = ["applied", "picked", "withdrawn"] as const;
export type CrewStatus = (typeof CREW_STATUSES)[number];

export const CREW_WORDS_MAX = 600;
export const BERTHS_MAX = 1000;

/** Whether a role's name is the picker role the dial names. Case and outer space never matter. */
export function isPickerRole(roleName: string, dial: string): boolean {
  const want = dial.trim().toLowerCase();
  return want !== "" && roleName.trim().toLowerCase() === want;
}

/** Room left on a circle: null is no limit, 0 is full. */
export function berthsLeft(berths: number | null, picked: number): number | null {
  return berths === null ? null : Math.max(0, berths - picked);
}

/** Read a berth count from a request. Blank or null is no limit. */
export function parseBerths(raw: unknown): { ok: true; berths: number | null } | { ok: false; error: string } {
  if (raw === null || raw === undefined || raw === "") return { ok: true, berths: null };
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 0 || n > BERTHS_MAX) return { ok: false, error: `Berths are a whole number from 0 to ${BERTHS_MAX}, or blank for no limit.` };
  return { ok: true, berths: n };
}

/** The seasons a member may apply for: running now, or next. */
export function crewSeasons(state: { current: PlaceSeason | null; upcoming: PlaceSeason | null }): PlaceSeason[] {
  return [state.current, state.upcoming].filter((s): s is PlaceSeason => Boolean(s));
}

export const CREW_STATUS_WORDS: Readonly<Record<CrewStatus, string>> = {
  applied: "Applied",
  picked: "Crew this season",
  withdrawn: "Withdrawn",
};

/** Notice titles. They name the circle and the season, never a person. */
export const CREW_NOTICES = {
  picked: (circle: string, season: string) => `You're crew this season! ${circle} picked you for ${season}.`,
  released: (circle: string, season: string) => `${circle} released your place for ${season}. Your application stands, and any circle can still pick you.`,
  applied: (season: string) => `Somebody applied to sail in ${season}, and you pick a crew.`,
} as const;

export const CREW_REFUSALS = {
  notPicker: "A circle's crew is picked by whoever holds its picking role this season, or by its crew when nobody does.",
  full: (circle: string) => `${circle} has no berths left this season.`,
  needsPlace: (circle: string, season: string) => `${circle} needs a place in ${season} before it can pick a crew.`,
  taken: "Another circle picked this person a moment ago.",
  noSeason: "There is no season open to apply for. The village's seasons are dated in Admin, Season.",
} as const;
