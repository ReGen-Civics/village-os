/**
 * `app_config['launch-state']`: one founder's answer to one launch-checklist
 * row, written as that row's keys and nothing else (audit S3). The reasoning
 * is on `writeLaunchAnswer` below; the caller is `confirmManual` in
 * server/lib/launch.ts.
 */
import type { Pool } from "mysql2/promise";

/** The SQL condition "this document has not launched": both spellings of absent. */
const NOT_LAUNCHED_SQL =
  "(JSON_EXTRACT(value, '$.launchedAt') IS NULL OR JSON_TYPE(JSON_EXTRACT(value, '$.launchedAt')) = 'NULL')";

/**
 * ONE FOUNDER'S ANSWER TO ONE ROW, written as that row's keys and nothing else.
 *
 * `confirmManual` used to read the whole launch-state document and write the
 * whole of it back. The launch closer writes `launchedAt`, `launchedBy` and
 * `launchedByBallotId` into the same document (`recordLaunchCarried`), so a
 * confirm that read before the close and wrote after it put the old document
 * back and erased the launch. This writes only `manualConfirms.<id>` and
 * `declines.<id>`, in the database, the way the closer writes its own keys,
 * and only while the document has not launched: after the launch the answers
 * are history, and the condition is in the same statement so a race with the
 * closer cannot slip past it. True when the write landed.
 *
 * Every function used is one `recordLaunchCarried` already runs on production,
 * plus JSON_REMOVE and JSON_OBJECT, which both engines carry.
 */
export async function writeLaunchAnswer(
  pool: Pool,
  reqId: string,
  answer: { confirm: { by: string; at: string } | null; decline: { by: string; at: string } | null },
): Promise<boolean> {
  // Registry ids are slugs; anything else never reaches a JSON path.
  if (!/^[A-Za-z0-9_-]+$/.test(reqId)) throw new Error(`refusing a launch requirement id that is not a slug: ${reqId}`);
  await pool.query(
    "INSERT IGNORE INTO app_config (config_key, value) VALUES ('launch-state', ?)",
    [JSON.stringify({ manualConfirms: {}, declines: {}, launchedAt: null, launchedBy: null, launchedByBallotId: null })],
  );
  // An older document may carry neither map, and JSON_SET does not make a parent.
  for (const map of ["manualConfirms", "declines"]) {
    await pool.query(
      `UPDATE app_config SET value = JSON_SET(value, '$.${map}', JSON_OBJECT()) WHERE config_key = 'launch-state' ` +
        `AND (JSON_EXTRACT(value, '$.${map}') IS NULL OR JSON_TYPE(JSON_EXTRACT(value, '$.${map}')) <> 'OBJECT')`,
    );
  }
  const confirmPath = `$.manualConfirms."${reqId}"`;
  const declinePath = `$.declines."${reqId}"`;
  let expr = `JSON_REMOVE(JSON_REMOVE(value, '${confirmPath}'), '${declinePath}')`;
  const params: string[] = [];
  if (answer.confirm) {
    expr = `JSON_SET(${expr}, '${confirmPath}', JSON_OBJECT('by', ?, 'at', ?))`;
    params.push(answer.confirm.by, answer.confirm.at);
  }
  if (answer.decline) {
    expr = `JSON_SET(${expr}, '${declinePath}', JSON_OBJECT('by', ?, 'at', ?))`;
    params.push(answer.decline.by, answer.decline.at);
  }
  const [result] = await pool.query<any>(
    `UPDATE app_config SET value = ${expr} WHERE config_key = 'launch-state' AND ${NOT_LAUNCHED_SQL}`,
    params,
  );
  return Number(result.affectedRows) > 0;
}
