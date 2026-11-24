/**
 * The two questions the starter quests ask of the `quests` tables, and nothing
 * else.
 *
 * A file of its own, importing nothing but the pool's types, because its
 * readers are `server/lib/examples.ts` (should a fresh board get starters?)
 * and `server/lib/launch.ts` (are any still waiting?), and `server/repos/
 * quests.ts` reaches the calendar and the comms modules, several of which
 * import examples.ts back. Raw SQL lives in `server/repos`, so here it is.
 */
import type { Pool, RowDataPacket } from "mysql2/promise";

/**
 * Which example quests are the platform's STARTERS, as a WHERE fragment.
 *
 * Every starter the examples seed has ever written carries an `ex-quest-` id
 * (server/seeds/examples-seed.json, every revision). Since 24 Nov 2026 a
 * village can also mark one of its OWN quests as an example (the board's
 * "coming soon" stamp, `markQuestExample` in server/repos/quests.ts), and
 * those are not starters: retirement must not delete them, the Journey row
 * must not count them as starters waiting, and a board of them is a village
 * that has spoken for itself. The flag says "example"; this says "ours".
 */
export const STARTER_QUEST_IDS = "id LIKE 'ex-quest-%'";

/**
 * How many standing-example quests are on the board: the starters a founder
 * has neither kept nor cleared. The Journey to Launch row reads this. A quest
 * the village marked as an example itself is not a starter and is not counted.
 */
export async function exampleQuestCount(pool: Pool): Promise<number> {
  const [[r]] = await pool.query<RowDataPacket[]>(`SELECT COUNT(*) AS n FROM quests WHERE is_example = 1 AND ${STARTER_QUEST_IDS}`);
  return Number(r?.n ?? 0);
}

/**
 * Has this village ever had quests of its own?
 *
 * A real quest on the board says yes, and so does a quest of the village's own
 * that it marked as an example. So does any claim ever taken: a village
 * that worked through its board and then deleted every quest has still spoken
 * for itself, and starters must never be layered back over it. The old live
 * seed did exactly that, re-seeding fourteen claimable quests onto any empty
 * table at every boot.
 */
export async function villageHasOwnQuests(pool: Pool): Promise<boolean> {
  const [[q]] = await pool.query<RowDataPacket[]>(`SELECT COUNT(*) AS n FROM quests WHERE is_example = 0 OR NOT (${STARTER_QUEST_IDS})`);
  if (Number(q?.n ?? 0) > 0) return true;
  const [[c]] = await pool.query<RowDataPacket[]>("SELECT COUNT(*) AS n FROM quest_claims");
  return Number(c?.n ?? 0) > 0;
}
