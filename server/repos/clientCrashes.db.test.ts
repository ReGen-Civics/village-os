/**
 * WHICH BROWSER CRASH EMAILS, against a real MySQL (S5 harness, drizzle/0429). The rules are server/lib/crashTriage.test.ts
 * and the route's are server/routes/clientCrash.test.ts, both over an in-memory store; this proves the SQL that
 * store stands in for:
 *
 *  - a signature's count, first and last seen, and `ours` once any report was ours;
 *  - different visitors are counted within the window and not outside it;
 *  - two reports racing for one window's email send one (the conditional UPDATE), and the next window sends again;
 *  - the digest holds what was recorded and not emailed, once;
 *  - Village Health reads each signature with its browsers and pages.
 *
 * No TEST_DATABASE_URL: skips loudly, never passes hollowly (house rule).
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import mysql from "mysql2/promise";
import { testPool, provisionTestDb, testDbConfigured, type TestDb } from "../db/testDb";
import { TRIAGE_DEFAULTS, type Sighting } from "../lib/crashTriage";
import { claimEmail, digestGroups, markDigested, recordSighting, signatureViews } from "./clientCrashes";

const configured = testDbConfigured();
let db: TestDb;
let pool: mysql.Pool;

const T0 = new Date("2026-11-25T01:00:00.000Z");
const at = (minutes: number) => new Date(T0.getTime() + minutes * 60_000);
const sighting = (over: Partial<Sighting> = {}): Sighting => ({
  message: "n is null",
  frames: ["@https://cdn.example.test/widget.js:3:4"],
  browser: "WebKit iOS",
  route: "/apply",
  visitor: "v1",
  now: T0,
  ...over,
});

describe.skipIf(!configured)("crash triage (MySQL)", () => {
  beforeAll(async () => {
    db = await provisionTestDb();
    pool = testPool(db, { connectionLimit: 4 }); // module-review-ok: the S5 scratch-schema harness pool
  });
  afterAll(async () => {
    if (pool) await pool.end();
    await db?.drop();
  });

  it("counts a signature, its visitors within the window, and remembers it was ever ours", async () => {
    const a = await recordSighting(pool, sighting(), TRIAGE_DEFAULTS);
    expect(a).toMatchObject({ seenCount: 1, ours: false, visitorsInWindow: 1, emailedAt: null, emailsSent: 0 });
    const b = await recordSighting(pool, sighting({ visitor: "v1", now: at(5) }), TRIAGE_DEFAULTS);
    expect(b).toMatchObject({ id: a.id, seenCount: 2, visitorsInWindow: 1 });
    const c = await recordSighting(pool, sighting({ visitor: "v2", now: at(10) }), TRIAGE_DEFAULTS);
    expect(c.visitorsInWindow).toBe(2);
    // Two hours on, the earlier visitors are outside the window.
    const d = await recordSighting(pool, sighting({ visitor: "v3", now: at(130) }), TRIAGE_DEFAULTS);
    expect(d.visitorsInWindow).toBe(1);
    expect(d.firstSeenAt.toISOString()).toBe(T0.toISOString());
    expect(d.lastSeenAt.toISOString()).toBe(at(130).toISOString());
    // A later report whose top frame is the same but which also carried a frame of ours makes the signature ours.
    const e = await recordSighting(pool, sighting({ visitor: "v4", now: at(131), frames: ["@https://cdn.example.test/widget.js:3:4", "go@/assets/Apply-B6yHa53f.js:1:1"] }), TRIAGE_DEFAULTS);
    expect(e).toMatchObject({ id: a.id, ours: true, seenCount: 5 });
  });

  it("two reports racing for one window's email send one; the next window sends the second", async () => {
    const s1 = await recordSighting(pool, sighting({ message: "race", visitor: "r1", now: at(200) }), TRIAGE_DEFAULTS);
    const s2 = await recordSighting(pool, sighting({ message: "race", visitor: "r2", now: at(200) }), TRIAGE_DEFAULTS);
    const won = await Promise.all([claimEmail(pool, s1, TRIAGE_DEFAULTS, at(200)), claimEmail(pool, s2, TRIAGE_DEFAULTS, at(200))]);
    expect(won.filter((n) => n !== null)).toEqual([1]);
    const later = await recordSighting(pool, sighting({ message: "race", visitor: "r3", now: at(200 + 25 * 60) }), TRIAGE_DEFAULTS);
    expect(later.emailsSent).toBe(1);
    expect(await claimEmail(pool, later, TRIAGE_DEFAULTS, at(200 + 25 * 60))).toBe(2);
  });

  it("the digest holds what was recorded and not emailed, by signature, browser and page, once", async () => {
    const now = at(3000);
    await recordSighting(pool, sighting({ message: "digest me", route: "/roles", browser: "Chrome 131 Android", visitor: "d1", now: at(2990) }), TRIAGE_DEFAULTS);
    await recordSighting(pool, sighting({ message: "digest me", route: "/roles", browser: "Chrome 130 Android", visitor: "d2", now: at(2991) }), TRIAGE_DEFAULTS);
    const emailed = await recordSighting(pool, sighting({ message: "told already", visitor: "d3", now: at(2992) }), TRIAGE_DEFAULTS);
    expect(await claimEmail(pool, emailed, TRIAGE_DEFAULTS, at(2992))).toBe(1);
    const { groups, ids } = await digestGroups(pool, now);
    const mine = groups.filter((g) => g.message === "digest me");
    expect(mine).toEqual([expect.objectContaining({ route: "/roles", browser: "Chrome Android", count: 2 })]);
    expect(groups.some((g) => g.message === "told already")).toBe(false);
    await markDigested(pool, ids, now);
    expect((await digestGroups(pool, now)).ids).toEqual([]);
  });

  it("Village Health reads each signature with its browsers and pages", async () => {
    const views = await signatureViews(pool, 50);
    const v = views.find((x) => x.message === "digest me");
    expect(v).toMatchObject({ seenCount: 2, ours: false, routes: ["/roles"], browsers: ["Chrome Android"] });
  });
});
