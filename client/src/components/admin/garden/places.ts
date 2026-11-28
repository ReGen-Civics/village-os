/**
 * THE TEN PLACES OF THE ADMIN GARDEN, as one typed table (Rye, 27 Nov 2026:
 * "the place names stand", and each person may rename them for themselves).
 *
 * Keyed by the union in shared/gardenArt.ts, so a place added there does not
 * compile until it has a name, a line and a spot on the land here.
 *
 * `name` is the platform's default. A village's own name, and then a person's
 * own, come before it (usePlaceNames in placeNames.tsx). `holds` is the one
 * line that says what the place is for; a caller's own line replaces it.
 *
 * `x` and `y` put the place on the land, in percent of the land's box: `x` is
 * the middle of the building, `y` its top. `w` is the building's width in
 * percent of the land's width. They follow the approved Grounds frame.
 */
import { msg } from "@lingui/core/macro";
// The runtime as a value the build keeps: precompileEnglish compiles the messages of a file that imports it
// (client/src/i18n/precompileEnglish.ts), and a type-only import is erased before it looks. Without this line the
// ten names and lines below reach the bundle uncompiled, and the first build that mounts the garden fails.
export { i18n as gardenPlacesRuntime } from "@lingui/core";
import type { MessageDescriptor } from "@lingui/core";
import { GARDEN_PLACE_KEYS, type GardenPlaceKey } from "@shared/gardenArt";

export { GARDEN_PLACE_KEYS, type GardenPlaceKey };

export interface GardenPlace {
  name: MessageDescriptor;
  holds: MessageDescriptor;
  x: number;
  y: number;
  w: number;
}

export const GARDEN_PLACES: Record<GardenPlaceKey, GardenPlace> = {
  fire: { name: msg({ message: "The Fire", context: "garden place" }), holds: msg({ message: "Today", context: "garden place, what it holds" }), x: 50, y: 32, w: 26 },
  hall: { name: msg({ message: "The Hall", context: "garden place" }), holds: msg({ message: "Review and proposals", context: "garden place, what it holds" }), x: 16, y: 4, w: 18 },
  gate: { name: msg({ message: "The Gate", context: "garden place" }), holds: msg({ message: "People", context: "garden place, what it holds" }), x: 13, y: 37, w: 14.5 },
  library: { name: msg({ message: "The Library", context: "garden place" }), holds: msg({ message: "Words and agreements", context: "garden place, what it holds" }), x: 50, y: 2, w: 14.5 },
  greenhouse: { name: msg({ message: "The Greenhouse", context: "garden place" }), holds: msg({ message: "What the village runs", context: "garden place, what it holds" }), x: 84, y: 5, w: 16 },
  store: { name: msg({ message: "The Store", context: "garden place" }), holds: msg({ message: "Money", context: "garden place, what it holds" }), x: 86, y: 39, w: 16 },
  tower: { name: msg({ message: "The Tower", context: "garden place" }), holds: msg({ message: "Messages", context: "garden place, what it holds" }), x: 70, y: 22, w: 7 },
  spring: { name: msg({ message: "The Spring", context: "garden place" }), holds: msg({ message: "Health", context: "garden place, what it holds" }), x: 16, y: 66, w: 18 },
  stage: { name: msg({ message: "The Stage", context: "garden place" }), holds: msg({ message: "The Village board", context: "garden place, what it holds" }), x: 84, y: 68, w: 18 },
  ceiba: { name: msg({ message: "The Ceiba", context: "garden place" }), holds: msg({ message: "The road to launch", context: "garden place, what it holds" }), x: 50, y: 63, w: 20 },
};

/** The longest name a person may give a place. */
export const PLACE_NAME_MAX = 40;

/** A typed name tidied: trimmed, inner runs of space made one, cut to the longest allowed. Empty means "no name of my own". */
export function tidyPlaceName(raw: string): string {
  return raw.replace(/\s+/g, " ").trim().slice(0, PLACE_NAME_MAX).trim();
}
