/**
 * The pages members visit, counted without people (migration 0431): one row per
 * page per day, and nothing that names a person, a session or a device. The
 * responsive bottom bar reads the sums (shared/navPopularity.ts).
 */
import type { Pool, RowDataPacket } from "mysql2/promise";
import type { PathCount } from "../../shared/navPopularity";

/** "YYYY-MM-DD" for a UTC day. */
export const utcDay = (at: Date): string => at.toISOString().slice(0, 10);

/** One more visit to `path` on `day`. One statement, so two at once both count. */
export async function countVisit(pool: Pool, day: string, path: string): Promise<void> {
  await pool.query(
    "INSERT INTO nav_path_visits (`day`, `path`, `visits`) VALUES (?, ?, 1) ON DUPLICATE KEY UPDATE `visits` = `visits` + 1",
    [day, path],
  );
}

/** Each page's visits from `sinceDay` on (inclusive), most first. */
export async function visitTotals(pool: Pool, sinceDay: string): Promise<PathCount[]> {
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT `path`, SUM(`visits`) AS total FROM nav_path_visits WHERE `day` >= ? GROUP BY `path` ORDER BY total DESC LIMIT 200",
    [sinceDay],
  );
  return rows.map((r) => ({ path: String(r.path), count: Number(r.total) }));
}

/**
 * Each page's visits in a window of days, `fromDay` inclusive and `untilDay` exclusive, most first (the admin's "How
 * the menu is used", wayfinding lane). A season is such a window.
 */
export async function visitTotalsBetween(pool: Pool, fromDay: string, untilDay: string): Promise<PathCount[]> {
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT `path`, SUM(`visits`) AS total FROM nav_path_visits WHERE `day` >= ? AND `day` < ? GROUP BY `path` ORDER BY total DESC LIMIT 500",
    [fromDay, untilDay],
  );
  return rows.map((r) => ({ path: String(r.path), count: Number(r.total) }));
}

/** The first day any visit was counted, "YYYY-MM-DD", or null before the first. Formatted in SQL so no clock shifts it. */
export async function firstVisitDay(pool: Pool): Promise<string | null> {
  const [rows] = await pool.query<RowDataPacket[]>("SELECT DATE_FORMAT(MIN(`day`), '%Y-%m-%d') AS first FROM nav_path_visits");
  const first = rows[0]?.first;
  return typeof first === "string" && first ? first : null;
}
