/**
 * The page counts against a real scratch schema (migration 0431): a visit adds
 * one to its page's day, two at once both count, and the totals read a window.
 */
import mysql from "mysql2/promise";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { testPool, provisionTestDb, testDbConfigured, type TestDb } from "../db/testDb";
import { countVisit, firstVisitDay, visitTotals, visitTotalsBetween } from "./navVisits";

describe.skipIf(!testDbConfigured())("nav_path_visits", () => {
  let db: TestDb;
  let pool: mysql.Pool;

  beforeAll(async () => {
    db = await provisionTestDb();
    pool = testPool(db, { connectionLimit: 4 });
  });

  afterAll(async () => {
    await pool?.end();
    await db?.drop();
  });

  it("counts a page per day, with no column that could name a person", async () => {
    await Promise.all([countVisit(pool, "2026-11-20", "/quests"), countVisit(pool, "2026-11-20", "/quests")]);
    await countVisit(pool, "2026-11-23", "/quests");
    await countVisit(pool, "2026-11-23", "/roles");
    await countVisit(pool, "2026-11-01", "/roles");
    expect(await visitTotals(pool, "2026-11-10")).toEqual([
      { path: "/quests", count: 3 },
      { path: "/roles", count: 1 },
    ]);
    const [cols] = await pool.query<mysql.RowDataPacket[]>("SHOW COLUMNS FROM nav_path_visits");
    expect(cols.map((c) => c.Field).sort()).toEqual(["day", "path", "visits"]);
  });

  it("reads a window of days, its first day in and its last day out, and the first day counted", async () => {
    // The rows the first test wrote: 2026-11-01 roles 1, 2026-11-20 quests 2, 2026-11-23 quests 1 and roles 1.
    expect(await visitTotalsBetween(pool, "2026-11-01", "2026-11-23")).toEqual([
      { path: "/quests", count: 2 },
      { path: "/roles", count: 1 },
    ]);
    expect(await visitTotalsBetween(pool, "2026-11-23", "2026-11-24")).toEqual([
      { path: "/quests", count: 1 },
      { path: "/roles", count: 1 },
    ]);
    expect(await visitTotalsBetween(pool, "2026-12-01", "2027-01-01")).toEqual([]);
    expect(await firstVisitDay(pool)).toBe("2026-11-01");
  });
});
