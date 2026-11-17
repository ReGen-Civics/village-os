/**
 * A circle's rhythms (0271, 0401): `live_session_rhythms`, one row per circle
 * with when it first meets (its key is "main" in the code), and
 * `live_session_more_rhythms`, a circle's further rhythms by their own key. Every statement server/lib/sessionRhythm.ts runs against it,
 * one function each, and the two small reads it makes beside it: when the
 * circle's last meeting closed, and who was in it.
 *
 * Each function hands back what the driver handed back. Mapping, rights and
 * refusals stay in the lib, the split server/repos/liveSessions.ts makes.
 * Every UPDATE sets `updated_at`: the column has no ON UPDATE.
 */
import type { RowDataPacket } from "mysql2/promise";
import type { Queryable } from "./liveSessions";

const rowsOf = async (q: Queryable, sql: string, params: unknown[] = []): Promise<RowDataPacket[]> => {
  const [rows] = await q.query<RowDataPacket[]>(sql, params);
  return rows;
};

/** `IN (?)` with an empty list is a syntax error, so an empty list reads nothing. */
const none = <T>(list: readonly T[]): boolean => list.length === 0;

const COLUMNS = "`circle_id`, `name`, `kind`, `recurrence`, `starts_on`, `time_of_day`, `duration_min`, `set_by_no`, `created_at`, `updated_at`";

/** Both tables as one list: each row carries its `rhythm_key`, "main" for the first rhythm. */
const BOTH =
  `SELECT 'main' AS \`rhythm_key\`, ${COLUMNS} FROM \`live_session_rhythms\`` +
  ` UNION ALL SELECT \`rhythm_key\`, ${COLUMNS} FROM \`live_session_more_rhythms\``;

/** The order a circle's rhythms are listed in: the first, then the others as they were added. */
const ORDER = "ORDER BY `circle_id`, (`rhythm_key` <> 'main'), `created_at`, `rhythm_key`";

/** Every rhythm of every circle, by circle, each circle's first rhythm first. */
export async function rhythmRows(q: Queryable): Promise<RowDataPacket[]> {
  return rowsOf(q, `SELECT * FROM (${BOTH}) r ${ORDER}`);
}

/** One circle's FIRST rhythm (0271). `lock` takes the row for the rest of the transaction. */
export async function rhythmRow(q: Queryable, circleId: string, lock = false): Promise<RowDataPacket[]> {
  return rowsOf(q, `SELECT 'main' AS \`rhythm_key\`, ${COLUMNS} FROM \`live_session_rhythms\` WHERE \`circle_id\` = ? LIMIT 1${lock ? " FOR UPDATE" : ""}`, [circleId]);
}

/**
 * Every rhythm of one circle, its first rhythm first. `lock` takes each row of
 * both tables for the rest of the transaction, and the gaps beside them, so two
 * adds at once count each other.
 */
export async function circleRhythmRows(q: Queryable, circleId: string, lock = false): Promise<RowDataPacket[]> {
  const tail = lock ? " FOR UPDATE" : "";
  const main = await rowsOf(q, `SELECT 'main' AS \`rhythm_key\`, ${COLUMNS} FROM \`live_session_rhythms\` WHERE \`circle_id\` = ?${tail}`, [circleId]);
  const more = await rowsOf(
    q,
    `SELECT \`rhythm_key\`, ${COLUMNS} FROM \`live_session_more_rhythms\` WHERE \`circle_id\` = ? ORDER BY \`created_at\`, \`rhythm_key\`${tail}`,
    [circleId],
  );
  return [...main, ...more];
}

type RhythmWrite = { circleId: string; name: string; kind: string; recurrence: string | null; startsOn: string; time: string; durationMin: number; setByNo: number; now: Date };

/** Set a circle's FIRST rhythm, whole: a new one, or one written over the last. */
export async function putRhythm(q: Queryable, row: RhythmWrite): Promise<void> {
  await q.query(
    "INSERT INTO `live_session_rhythms` (`circle_id`, `name`, `kind`, `recurrence`, `starts_on`, `time_of_day`, `duration_min`, `set_by_no`, `created_at`, `updated_at`) " +
      "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE `name` = VALUES(`name`), `kind` = VALUES(`kind`), `recurrence` = VALUES(`recurrence`), " +
      "`starts_on` = VALUES(`starts_on`), `time_of_day` = VALUES(`time_of_day`), `duration_min` = VALUES(`duration_min`), " +
      "`set_by_no` = VALUES(`set_by_no`), `updated_at` = VALUES(`updated_at`)",
    [row.circleId, row.name, row.kind, row.recurrence, row.startsOn, row.time, row.durationMin, row.setByNo, row.now, row.now],
  );
}

/** Set one of a circle's FURTHER rhythms, whole, by its key. */
export async function putMoreRhythm(q: Queryable, rhythmKey: string, row: RhythmWrite): Promise<void> {
  await q.query(
    "INSERT INTO `live_session_more_rhythms` (`circle_id`, `rhythm_key`, `name`, `kind`, `recurrence`, `starts_on`, `time_of_day`, `duration_min`, `set_by_no`, `created_at`, `updated_at`) " +
      "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE `name` = VALUES(`name`), `kind` = VALUES(`kind`), `recurrence` = VALUES(`recurrence`), " +
      "`starts_on` = VALUES(`starts_on`), `time_of_day` = VALUES(`time_of_day`), `duration_min` = VALUES(`duration_min`), " +
      "`set_by_no` = VALUES(`set_by_no`), `updated_at` = VALUES(`updated_at`)",
    [row.circleId, rhythmKey, row.name, row.kind, row.recurrence, row.startsOn, row.time, row.durationMin, row.setByNo, row.now, row.now],
  );
}

/** The recurrence alone, for a skipped meeting, of one rhythm ("main" for the first). Hands back 1 or 0. */
export async function writeRecurrence(q: Queryable, circleId: string, recurrence: string, setByNo: number, now: Date, rhythmKey = "main"): Promise<number> {
  const [r] =
    rhythmKey === "main"
      ? await q.query<any>("UPDATE `live_session_rhythms` SET `recurrence` = ?, `set_by_no` = ?, `updated_at` = ? WHERE `circle_id` = ?", [recurrence, setByNo, now, circleId])
      : await q.query<any>(
          "UPDATE `live_session_more_rhythms` SET `recurrence` = ?, `set_by_no` = ?, `updated_at` = ? WHERE `circle_id` = ? AND `rhythm_key` = ?",
          [recurrence, setByNo, now, circleId, rhythmKey],
        );
  return Number(r.affectedRows ?? 0);
}

/** One rhythm goes ("main" for the first, the default an older caller meant). */
export async function deleteRhythm(q: Queryable, circleId: string, rhythmKey = "main"): Promise<void> {
  if (rhythmKey === "main") await q.query("DELETE FROM `live_session_rhythms` WHERE `circle_id` = ?", [circleId]);
  else await q.query("DELETE FROM `live_session_more_rhythms` WHERE `circle_id` = ? AND `rhythm_key` = ?", [circleId, rhythmKey]);
}

/** When some sessions closed, for "last met". */
export async function closedAtRows(q: Queryable, sessionIds: readonly number[]): Promise<RowDataPacket[]> {
  if (none(sessionIds)) return [];
  return rowsOf(q, "SELECT `id`, `closed_at` FROM `live_sessions` WHERE `id` IN (?)", [sessionIds]);
}

/** Who was in some sessions, as member numbers, for the circle's members. */
export async function peopleOfRows(q: Queryable, sessionIds: readonly number[]): Promise<RowDataPacket[]> {
  if (none(sessionIds)) return [];
  return rowsOf(q, "SELECT `session_id`, `member_no` FROM `live_session_people` WHERE `session_id` IN (?)", [sessionIds]);
}

// ── One member: the export and the erasure ──────────────────────────────────

/** The rhythms this member set last. */
export async function memberRows(q: Queryable, no: number): Promise<RowDataPacket[]> {
  return rowsOf(q, `SELECT \`circle_id\`, \`rhythm_key\`, \`updated_at\` FROM (${BOTH}) r WHERE \`set_by_no\` = ? ${ORDER}`, [no]);
}

/** The member leaves: a rhythm they set last says it was set by nobody. */
export async function forgetMember(q: Queryable, no: number): Promise<void> {
  await q.query("UPDATE `live_session_rhythms` SET `set_by_no` = 0 WHERE `set_by_no` = ?", [no]);
  await q.query("UPDATE `live_session_more_rhythms` SET `set_by_no` = 0 WHERE `set_by_no` = ?", [no]);
}
