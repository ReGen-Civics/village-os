/**
 * WHAT THE GARDEN MOUNTS: which Admin tabs and which pages open INSIDE a place of the Admin Garden.
 *
 * This is a seam, and it is empty today. The garden is not mounted on the real /admin yet: the running garden lane
 * builds that mount (wave 2 of the Admin Garden plan: "every existing tab opening inside its place"), and it fills
 * the list below from the same table the mount itself reads, so the two cannot disagree.
 *
 * The scoreboard (shared/gardenScore.ts) reads it for two of its counts:
 *
 *   Functions   a row of the parity ledger works in its garden place when every act that carries it opens on a tab
 *               or a page this list mounts, in the place the act names
 *   Old doors   an old address lands inside the garden when the tab or the page it settles on is mounted here
 *
 * An empty list means nothing is in the garden, and both counts say so. Nothing here decides access: a mount is a
 * word about where a thing is drawn.
 *
 * Pure: no I/O, no clock.
 */
import type { AdminPlace } from "./adminTabs";

/** One place of the garden and what opens inside it. */
export interface GardenMount {
  place: AdminPlace;
  /** The Admin tab keys (shared/adminTabs.ts) that open inside this place. */
  tabs: readonly string[];
  /** The pages beside Admin that open inside this place: each a path, with no query and no hash. */
  pages: readonly string[];
}

/** Filled by the running garden lane when it mounts the garden on /admin. Empty until then. */
export const GARDEN_MOUNTS: readonly GardenMount[] = [];

/** A path as a mount names it: its query and its hash taken off. */
export function barePath(address: string): string {
  return address.replace(/[?#].*$/, "");
}

/** The place a tab or a page opens inside, or null when the garden does not mount it. */
export function gardenPlaceOf(at: { tab?: string; path?: string }, mounts: readonly GardenMount[] = GARDEN_MOUNTS): AdminPlace | null {
  for (const m of mounts) {
    if (at.tab && m.tabs.includes(at.tab)) return m.place;
    if (!at.tab && at.path && m.pages.includes(barePath(at.path))) return m.place;
  }
  return null;
}

/**
 * A ROW OF THE PARITY LEDGER THE FOUNDER RULED OUT. Each entry carries the ruling itself: the day it was given and
 * its words. A row named here counts as settled on the scoreboard without a place in the garden. Empty today: a
 * function that was folded into another page is still counted where it lives now.
 */
export interface CutByRuling {
  /** The ledger row, by its id (shared/adminActs/ledger.ts). */
  row: string;
  /** The day of the ruling, as YYYY-MM-DD. */
  date: string;
  /** The ruling, in the founder's own words. */
  words: string;
}

export const CUT_BY_RULING: readonly CutByRuling[] = [];
