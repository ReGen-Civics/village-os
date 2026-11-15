/**
 * THE MOON'S SPLITS, EACH WITH ITS DAYS (Rye, 15 Nov 2026, P1-3), against a
 * real schema. `splitPeriodsForPay` reads the member's split through `splitOn`
 * alone, day by day, and folds days under the same word into one stretch.
 * Every person here is invented.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type mysql from "mysql2/promise";
import { provisionTestDb, testDbConfigured, testPool, type TestDb } from "../db/testDb";
import { splitForPay, splitPeriodsForPay } from "./splitForPay";

const configured = testDbConfigured();
const MOON = { firstDay: "2026-10-01", lastDay: "2026-10-30" };
const split = (r1: number) => JSON.stringify([{ roleId: "r1", share: r1 }, { roleId: "r2", share: 100 - r1 }]);

describe.skipIf(!configured)("splitPeriodsForPay, against a real schema", () => {
  let db: TestDb;
  let pool: mysql.Pool;
  const q = async (sql: string, params: unknown[] = []) => (await pool.query<any[]>(sql, params))[0]; // module-review-ok: fixture SQL against the S5 scratch schema, never a production table
  const word = (pct: number, fromDate: string, splitJson: string | null) =>
    q("INSERT INTO `member_commitments` (`user_id`, `pct`, `from_date`, `period_kind`, `note`, `split_json`) VALUES ('m-wren', ?, ?, 'season', NULL, ?)", [pct, fromDate, splitJson]); // module-review-ok: fixture SQL

  beforeAll(async () => {
    db = await provisionTestDb();
    pool = testPool(db, { connectionLimit: 4 });
    await q("INSERT INTO `users` (`id`, `name`, `email`, `password_hash`, `handle`) VALUES ('m-wren', 'Wren', 'm-wren@example.test', 'x', 'wren')"); // module-review-ok: fixture SQL
  }, 180_000);
  afterAll(async () => {
    await pool?.end();
    await db?.drop();
  });
  beforeEach(async () => {
    await q("DELETE FROM `member_commitments`"); // module-review-ok: fixture SQL
  });

  it("a split said mid-moon gives two stretches, each with its days", async () => {
    await word(100, "2026-09-01", split(50));
    await word(100, "2026-10-11", split(80));
    expect(await splitPeriodsForPay(pool, "m-wren", MOON)).toEqual([
      { fromDay: "2026-10-01", days: 10, givenPct: 100, split: JSON.parse(split(50)) },
      { fromDay: "2026-10-11", days: 20, givenPct: 100, split: JSON.parse(split(80)) },
    ]);
    // The last day's word is still what the member reads now.
    expect(await splitForPay(pool, "m-wren", MOON.lastDay)).toEqual({ split: JSON.parse(split(80)), givenPct: 100 });
  });

  it("days before any split are a stretch with none; a word for after the moon waits", async () => {
    await word(60, "2026-10-16", split(70));
    await word(60, "2026-11-05", split(10));
    expect(await splitPeriodsForPay(pool, "m-wren", MOON)).toEqual([
      { fromDay: "2026-10-01", days: 15, givenPct: null, split: null },
      { fromDay: "2026-10-16", days: 15, givenPct: 60, split: JSON.parse(split(70)) },
    ]);
  });

  it("one word all moon is one stretch of the moon's days", async () => {
    await word(100, "2026-09-01", split(50));
    expect(await splitPeriodsForPay(pool, "m-wren", MOON)).toEqual([{ fromDay: "2026-10-01", days: 30, givenPct: 100, split: JSON.parse(split(50)) }]);
  });
});
