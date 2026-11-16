/**
 * EVERY STORED LINK TO A SEASON GOAL, BY ITS ID: the reads and writes the
 * goal-link repair needs (server/lib/goalLinkRemap.ts).
 *
 * A season goal is named by id in six columns. Each read returns the rows that
 * name one goal id together with whatever that row carries to place it in a
 * season, because no column below holds a season id except `moon_recaps`:
 *
 *   live_session_priorities.serves_goal_id   the session's `created_at`
 *   live_session_shares.serves_goal_id       the session's `created_at`
 *   live_session_entries.serves_goal_id      the session's `created_at`
 *   moon_recap_items.season_goal_id          its recap's `season_id`, else its recap's moon
 *   moon_goals.season_goal_id                its own moon (`cycle_id`)
 *   member_tasks.serves_goal_id              `done_at`, else `created_on`
 *
 * The three live-session tables also keep the goal's words (`serves_goal`), so
 * a moved link takes the new goal's words in the same statement.
 *
 * Every write names the ids it moves AND the id it moves them from, so a row
 * somebody relinked between the read and the write is left as they left it.
 */
import type { RowDataPacket } from "mysql2/promise";
import type { Queryable } from "./liveSessions";

export const GOAL_ID_COLUMNS = {
  live_session_priorities: "serves_goal_id",
  live_session_shares: "serves_goal_id",
  live_session_entries: "serves_goal_id",
  moon_recap_items: "season_goal_id",
  moon_goals: "season_goal_id",
  member_tasks: "serves_goal_id",
} as const;

export type GoalLinkTable = keyof typeof GOAL_ID_COLUMNS;
export const GOAL_ID_TABLES = Object.keys(GOAL_ID_COLUMNS) as GoalLinkTable[];

/** The tables that also keep the goal's words beside its id (0292, 0298). */
const WORDS_TABLES: ReadonlySet<GoalLinkTable> = new Set<GoalLinkTable>(["live_session_priorities", "live_session_shares", "live_session_entries"]);

/** One stored link and what places it in a season. */
export interface GoalLinkRow {
  id: string;
  /** A season id the row itself carries (only a moon recap does). */
  seasonId: string | null;
  /** A moon id (`cycle_id`) the row belongs to. */
  cycleId: string | null;
  /** An instant the row belongs to. */
  at: Date | null;
  /** A village-calendar day the row belongs to. */
  day: string | null;
}

const rowsOf = async (q: Queryable, sql: string, params: unknown[]): Promise<RowDataPacket[]> => {
  const [rows] = await q.query<RowDataPacket[]>(sql, params);
  return rows;
};

const str = (v: unknown): string | null => (v == null || v === "" ? null : String(v));
const date = (v: unknown): Date | null => (v instanceof Date ? v : v == null ? null : new Date(String(v)));

const READS: Record<GoalLinkTable, string> = {
  live_session_priorities:
    "SELECT t.`id`, s.`created_at` AS `at` FROM `live_session_priorities` t JOIN `live_sessions` s ON s.`id` = t.`session_id` WHERE t.`serves_goal_id` = ?",
  live_session_shares:
    "SELECT t.`id`, s.`created_at` AS `at` FROM `live_session_shares` t JOIN `live_sessions` s ON s.`id` = t.`session_id` WHERE t.`serves_goal_id` = ?",
  live_session_entries:
    "SELECT t.`id`, s.`created_at` AS `at` FROM `live_session_entries` t JOIN `live_sessions` s ON s.`id` = t.`session_id` WHERE t.`serves_goal_id` = ?",
  moon_recap_items:
    "SELECT i.`id`, r.`season_id` AS `season_id`, r.`cycle_id` AS `cycle_id` FROM `moon_recap_items` i JOIN `moon_recaps` r ON r.`id` = i.`recap_id` WHERE i.`season_goal_id` = ?",
  moon_goals: "SELECT `id`, `cycle_id` FROM `moon_goals` WHERE `season_goal_id` = ?",
  member_tasks: "SELECT `id`, `done_at` AS `at`, DATE_FORMAT(`created_on`, '%Y-%m-%d') AS `day` FROM `member_tasks` WHERE `serves_goal_id` = ?",
};

/** Every row of `table` that names goal `goalId`. A link whose session is gone has no date and is never moved. */
export async function linksNaming(q: Queryable, table: GoalLinkTable, goalId: string): Promise<GoalLinkRow[]> {
  const rows = await rowsOf(q, READS[table], [goalId]);
  return rows.map((r) => ({
    id: String(r.id),
    seasonId: str(r.season_id),
    cycleId: str(r.cycle_id),
    at: date(r.at),
    day: str(r.day),
  }));
}

const CHUNK = 500;

/**
 * Move these rows of `table` from goal `from` to goal `to`. Only a row that
 * still names `from` moves, so a second run, or a row relinked in between,
 * moves nothing. Answers the rows moved.
 */
export async function moveLinks(q: Queryable, table: GoalLinkTable, ids: readonly string[], from: string, to: { id: string; text: string }): Promise<number> {
  const col = GOAL_ID_COLUMNS[table];
  let moved = 0;
  for (let i = 0; i < ids.length; i += CHUNK) {
    const part = ids.slice(i, i + CHUNK);
    const marks = part.map(() => "?").join(", ");
    const set = WORDS_TABLES.has(table) ? `\`${col}\` = ?, \`serves_goal\` = ?` : `\`${col}\` = ?`;
    const setArgs = WORDS_TABLES.has(table) ? [to.id, to.text] : [to.id];
    const [r] = await q.query(`UPDATE \`${table}\` SET ${set} WHERE \`${col}\` = ? AND \`id\` IN (${marks})`, [...setArgs, from, ...part]);
    moved += Number((r as { affectedRows?: number }).affectedRows ?? 0);
  }
  return moved;
}
