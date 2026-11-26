/**
 * A NOTICE'S WORDS, against the real notifications table (migration 0435, shared/noticeKeys.ts).
 *
 * The spine stores a producer's key and values beside its English, hands them back on the bell's read, and never
 * lets them outlive the words they translate: the erasure clears them with the rest of a notice that named a
 * departed member, and a row an older release rewrote (title only, `words` untouched) reads as having none. The
 * English is stored exactly as before in every case, and a retried producer still inserts once.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import mysql from "mysql2/promise";
import { testPool, provisionTestDb, testDbConfigured, type TestDb } from "./db/testDb";
import { insertNotification, notificationsFor, type NotifyDeps } from "./lib/notify";
import { presenceTest } from "./lib/memberPresence";
import { DEPARTED_NOTICE_TITLE, forgetNoticesOf } from "./repos/noticesNaming";

const isPresent = presenceTest("notice-words-db-test-secret");
const configured = testDbConfigured();
if (!configured) {
  console.warn("[noticeWords.db] TEST_DATABASE_URL not set - DB-backed tests SKIPPED.");
}

let db: TestDb;
let pool: mysql.Pool;

beforeAll(async () => {
  if (!configured) return;
  db = await provisionTestDb();
  pool = testPool(db, { connectionLimit: 4 }); // module-review-ok: the S5 scratch-schema harness pool, as every DB suite holds
});

afterAll(async () => {
  if (!configured) return;
  await pool?.end();
  await db?.drop();
});

function deps(over: Partial<NotifyDeps> = {}): NotifyDeps {
  return {
    pool,
    memberById: async (id: string) => ({ id, email: `${id}@example.test`, passwordHash: "hash", prefs: { notify: { governanceEmail: "off", emailsOff: true } } }),
    sendEmail: async () => ({ accepted: true, status: "queued" }),
    origin: () => "https://example.test",
    projectName: () => "Test village",
    isPresent,
    ...over,
  };
}

const reminder = (userId: string, dedupeKey: string, extra: Record<string, unknown> = {}) => ({
  userId,
  type: "season_plan_reminder",
  title: "Your season is not filed yet",
  body: "3 days left.",
  dedupeKey,
  words: { key: "season_plan.reminder" as const, params: { daysLeft: 3 } },
  ...extra,
});

const bell = async (userId: string) => (await notificationsFor(pool, userId)).notifications;

describe.skipIf(!configured)("a notice's words, stored beside its English", () => {
  it("stores the English as before, and hands the words back on the bell's read", async () => {
    const r = await insertNotification(deps(), reminder("u-ana", "nw:1"));
    expect(r.fresh).toBe(true);
    const [n] = await bell("u-ana");
    expect(n.title).toBe("Your season is not filed yet");
    expect(n.body).toBe("3 days left.");
    expect(n.words).toEqual({ key: "season_plan.reminder", params: { daysLeft: 3 }, own: [] });
  });

  it("a retried producer still inserts once", async () => {
    expect((await insertNotification(deps(), reminder("u-ana", "nw:1"))).fresh).toBe(false);
    expect((await bell("u-ana")).filter((n) => n.title === "Your season is not filed yet")).toHaveLength(1);
  });

  it("stores no words for an unknown key or a wrong value, and the notice still lands in English", async () => {
    await insertNotification(deps(), reminder("u-bea", "nw:2", { words: { key: "nope", params: {} } }));
    await insertNotification(deps(), reminder("u-bea", "nw:3", { words: { key: "season_plan.reminder", params: { daysLeft: "three" } } }));
    const rows = await bell("u-bea");
    expect(rows).toHaveLength(2);
    expect(rows.map((n) => n.words)).toEqual([null, null]);
    const [[raw]] = await pool.query<any[]>("SELECT COUNT(*) AS n FROM notifications WHERE user_id = 'u-bea' AND words IS NOT NULL"); // module-review-ok: a fixture read against the S5 scratch schema, never a production table
    expect(Number(raw.n)).toBe(0);
  });

  it("marks a title the village wrote itself as its own", async () => {
    const village = deps({ noticeWords: () => ({ words: { season_plan_reminder: { title: "File your plan, friend" } }, vars: {} }) });
    await insertNotification(village, reminder("u-cai", "nw:4"));
    const [n] = await bell("u-cai");
    expect(n.title).toBe("File your plan, friend");
    expect(n.words?.own).toEqual(["title"]);
  });

  it("reads a malformed value as no words, and the bell still answers", async () => {
    await pool.query( // module-review-ok: fixture SQL against the S5 scratch schema, never a production table
      "INSERT INTO notifications (id, user_id, type, title, dedupe_key, words) VALUES (?,?,?,?,?,?)",
      ["ntf-bad", "u-dee", "season_plan_reminder", "Your season is not filed yet", "nw:5", "{not json"],
    );
    const [n] = await bell("u-dee");
    expect(n.title).toBe("Your season is not filed yet");
    expect(n.words).toBeNull();
  });

  it("the erasure clears the words of a notice that named a departed member", async () => {
    await insertNotification(deps(), reminder("u-eli", "nw:6", { actorUserId: "u-wren" }));
    const counts = await forgetNoticesOf(pool, { userId: "u-wren" });
    expect(counts.rewritten).toBeGreaterThanOrEqual(1);
    const [[row]] = await pool.query<any[]>("SELECT title, body, words FROM notifications WHERE dedupe_key = 'nw:6'"); // module-review-ok: a fixture read against the S5 scratch schema, never a production table
    expect(row.title).toBe(DEPARTED_NOTICE_TITLE);
    expect(row.body).toBeNull();
    expect(row.words).toBeNull();
  });

  it("a row an older release rewrote, title only, reads as having no words", async () => {
    await insertNotification(deps(), reminder("u-fay", "nw:7"));
    await pool.query("UPDATE notifications SET title = ?, body = NULL WHERE dedupe_key = 'nw:7'", [DEPARTED_NOTICE_TITLE]); // module-review-ok: fixture SQL standing in for an older release's sweep
    const [n] = await bell("u-fay");
    expect(n.title).toBe(DEPARTED_NOTICE_TITLE);
    expect(n.words).toBeNull();
  });
});
