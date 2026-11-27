/**
 * The word before an agent's proposal lapses: told once, one day before, to whoever may decide it, and to nobody for
 * a proposal that is not about to lapse, a letter, or one already decided.
 */
import type mysql from "mysql2/promise";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { provisionTestDb, testDbConfigured, testPool, type TestDb } from "../db/testDb";
import { lapseNoticeTitle, noticeLapsingApprovals } from "./approvalLapseNotice";

const configured = testDbConfigured();
let db: TestDb;
let pool: mysql.Pool;
const NOW = new Date("2026-11-26T12:00:00.000Z");
const ago = (h: number) => new Date(NOW.getTime() - h * 3_600_000);

describe.skipIf(!configured)("the word before an agent's proposal lapses", () => {
  beforeAll(async () => {
    db = await provisionTestDb();
    pool = testPool(db, { connectionLimit: 2 });
    const add = (id: string, kind: string, title: string, at: Date, status = "waiting") =>
      pool.query("INSERT INTO agent_proposals (id, kind, status, proposed_by, title, created_at) VALUES (?,?,?,?,?,?)", [id, kind, status, "agent-1", title, at]); // module-review-ok: fixture SQL on the scratch schema this suite provisioned
    await add("p-soon", "setting", "Turn the reply window to ten days", ago(6.5 * 24));
    await add("p-seat", "seating", "Seat Zephyrine Quillfeather as Land Liaison", ago(6.2 * 24));
    await add("p-young", "setting", "Not yet near its end", ago(2 * 24));
    await add("p-gone", "setting", "Already past its seven days", ago(7.5 * 24));
    await add("p-letter", "letter", "A letter never lapses", ago(6.5 * 24));
    await add("p-done", "setting", "Decided already", ago(6.5 * 24), "approved");
  });

  afterAll(async () => {
    await pool?.end();
    await db?.drop();
  });

  it("tells each person who may decide it, once per proposal, about only what lapses in the day ahead", async () => {
    const sent: Array<{ userId: string; type: string; title: string; link: string; dedupeKey: string }> = [];
    const deps = { pool, now: () => NOW, deciders: async () => ["admin-1", "steward-1", "admin-1"], notify: async (n: any) => void sent.push(n) };
    expect(await noticeLapsingApprovals(deps)).toBe(4);
    expect(sent.map((n) => n.dedupeKey).sort()).toEqual([
      "approval-lapse:p-seat:admin-1",
      "approval-lapse:p-seat:steward-1",
      "approval-lapse:p-soon:admin-1",
      "approval-lapse:p-soon:steward-1",
    ]);
    expect(sent.every((n) => n.type === "approval_lapsing" && n.link === "/approvals")).toBe(true);
    expect(sent.find((n) => n.dedupeKey.includes("p-soon"))?.title).toBe('"Turn the reply window to ten days" lapses tomorrow if nobody decides it');
    // A seating's own words may name a person; its notice does not.
    expect(sent.filter((n) => n.dedupeKey.includes("p-seat")).every((n) => !n.title.includes("Zephyrine"))).toBe(true);
    // The next hourly pass sends the same keys, which notify.ts's unique key makes a no-op.
    const again: string[] = [];
    await noticeLapsingApprovals({ ...deps, notify: async (n: any) => void again.push(n.dedupeKey) });
    expect(again.sort()).toEqual(sent.map((n) => n.dedupeKey).sort());
  });

  it("one person's bell failing never stops the rest hearing", async () => {
    const reached: string[] = [];
    const n = await noticeLapsingApprovals({
      pool,
      now: () => NOW,
      deciders: async () => ["broken", "fine"],
      notify: async (i: any) => {
        if (i.userId === "broken") throw new Error("no bell");
        reached.push(i.dedupeKey);
      },
    });
    expect(n).toBe(2);
    expect(reached.every((k) => k.endsWith(":fine"))).toBe(true);
  });
});

describe("the notice's words", () => {
  it("name a proposal by its title, and a seating by its kind only", () => {
    expect(lapseNoticeTitle({ kind: "listing", title: "List the Bookkeeper" })).toBe('"List the Bookkeeper" lapses tomorrow if nobody decides it');
    expect(lapseNoticeTitle({ kind: "seating", title: "Seat a named person" })).toBe("A proposed seating lapses tomorrow if nobody decides it");
  });
});
