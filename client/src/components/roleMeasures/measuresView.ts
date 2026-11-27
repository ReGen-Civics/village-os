/**
 * How the role-journey measures are arranged for reading (the fold of
 * /role-measures into Circles & Roles, 27 Nov 2026). Pure: handed the rows
 * `GET /api/role-measures` serves, it picks the seasons, the order and the
 * circle, and says how each number reads. It never computes a measure: that
 * is shared/roleMeasures.ts on the server, which withholds a number built
 * from fewer than three people before it ever reaches here.
 */
import type { MeasureRow, Share } from "@shared/roleMeasures";

/** One served row: a season, a circle and its numbers, with the circle's name. */
export type ServedRow = MeasureRow & { circleName: string | null };

/** The seasons the rows cover: the current one first, then the newest, and "no season" last. */
export function seasonsOf(rows: readonly ServedRow[], currentId: string | null): Array<string | null> {
  const ids = Array.from(new Set(rows.map((r) => r.seasonId)));
  return ids.sort((a, b) => {
    if (a === b) return 0;
    if (a === null) return 1;
    if (b === null) return -1;
    if (a === currentId) return -1;
    if (b === currentId) return 1;
    return b.localeCompare(a);
  });
}

/** The rows for one season, in the order a reader looks for them: named circles by name, then roles in no circle. */
export function rowsFor(rows: readonly ServedRow[], season: string | null, circleId?: string): ServedRow[] {
  return rows
    .filter((r) => r.seasonId === season && (circleId === undefined || r.circleId === circleId))
    .sort((a, b) => {
      if (a.circleId === null) return 1;
      if (b.circleId === null) return -1;
      return String(a.circleName ?? a.circleId).localeCompare(String(b.circleName ?? b.circleId));
    });
}

/** A share as a whole percentage (0 is a real zero), or null where nothing was recorded (NO_DATA). */
export const percent = (s: Share): number | null => (s.share === null ? null : Math.round(s.share * 100));

/** A median length of time: hours under two days, whole days after; null where nothing was recorded (NO_DATA). */
export function span(h: number | null): { unit: "hours" | "days"; n: number } | null {
  if (h === null) return null;
  if (h < 48) return { unit: "hours", n: Math.round(h) };
  return { unit: "days", n: Math.round(h / 24) };
}

/** True when a row has nothing stamped in it at all. */
export const isEmptyRow = (r: MeasureRow): boolean => r.applications.count === 0 && r.holders.count === 0;
