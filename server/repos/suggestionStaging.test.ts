/**
 * Staging and outcomes against a real scratch schema (migration 0432): a re-send of an open filing
 * is a no-op, the engine's answer is written and re-written without churn, only a reconsider can be
 * released, closing frees the key, erasure takes a member's own filings and nobody else's, and the
 * outcome log names no person.
 */
import mysql from "mysql2/promise";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { testPool, provisionTestDb, testDbConfigured, type TestDb } from "../db/testDb";
import { runEngine, type EngineContext } from "../../shared/suggestionPipeline/engine";
import { applyEngineResult, closeStaged, forgetStagedOf, openStaged, releaseReconsider, stageSuggestion, stagedById, type StageInput } from "./suggestionStaging";
import { engineHistory, recordOutcome } from "./suggestionOutcomes";

const NOW = new Date("2026-11-25T10:00:00.000Z");

const filing = (over: Partial<StageInput> = {}): StageInput => ({
  stream: "connector",
  streamRef: "pc_1",
  filer: "agent-1",
  filerKind: "agent",
  kind: "role_card",
  target: { roleId: "water" },
  body: { words: { purpose: "Tends the springs." } },
  why: "The circle said so.",
  now: NOW,
  ...over,
});

const ctx = (over: Partial<EngineContext> = {}): EngineContext => ({
  now: NOW.toISOString(),
  rediscardDays: 30,
  caps: { perFilerPerDay: 50, optionsPerThing: 5 },
  alreadyLive: new Set(),
  targetGone: new Set(),
  liveRefs: new Set(["role:water"]),
  discarded: [],
  openVotes: [],
  decisions: [],
  released: new Set(),
  ...over,
});

describe.skipIf(!testDbConfigured())("suggestion_staging and suggestion_outcomes", () => {
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

  it("treats a re-send of an open filing as the same row, and another filer's identical one as a new row", async () => {
    const a = await stageSuggestion(pool, filing());
    const again = await stageSuggestion(pool, filing({ streamRef: "pc_2", why: "Said twice." }));
    const other = await stageSuggestion(pool, filing({ filer: "agent-2" }));
    expect(a.duplicate).toBe(false);
    expect(again).toEqual({ id: a.id, duplicate: true });
    expect(other.duplicate).toBe(false);
    expect(other.id).not.toBe(a.id);
  });

  it("writes the engine's answer, and a second run with the same answer changes nothing", async () => {
    const rows = await openStaged(pool);
    const out = runEngine(rows.map((r) => r.staged), ctx());
    expect(out.cards).toHaveLength(1);
    expect(out.cards[0].shape).toBe("joined");
    expect(await applyEngineResult(pool, out, NOW)).toBe(2);
    expect(await applyEngineResult(pool, out, NOW)).toBe(0);
    const after = await openStaged(pool);
    expect(after.every((r) => r.state === "carded" && r.cardId === out.cards[0].id)).toBe(true);
  });

  it("moves a row from a card to Held with its code when the engine says so", async () => {
    const rows = await openStaged(pool);
    const first = rows[0].staged.id;
    const out = runEngine(rows.map((r) => r.staged), ctx({ alreadyLive: new Set([first]) }));
    await applyEngineResult(pool, out, NOW);
    const row = await stagedById(pool, first);
    expect(row?.state).toBe("held");
    expect(row?.heldCode).toBe("already_live");
    expect(row?.cardId).toBeNull();
  });

  it("releases only a row held as a reconsider, and records the capability that released it", async () => {
    const rows = await openStaged(pool);
    const held = rows.find((r) => r.state === "held")!;
    expect(await releaseReconsider(pool, held.staged.id, "intake.moderate", NOW)).toBe(false);
    await pool.query("UPDATE suggestion_staging SET held_code = 'reconsider_waits' WHERE id = ?", [held.staged.id]);
    expect(await releaseReconsider(pool, held.staged.id, "intake.moderate", NOW)).toBe(true);
    expect((await stagedById(pool, held.staged.id))?.released).toBe(true);
    const [cols] = await pool.query<mysql.RowDataPacket[]>("SELECT released_by_capability FROM suggestion_staging WHERE id = ?", [held.staged.id]);
    expect(cols[0].released_by_capability).toBe("intake.moderate");
  });

  it("frees a closed row's key, so the same value sent again later is a new filing", async () => {
    const first = await stageSuggestion(pool, filing({ filer: "agent-3" }));
    expect(await closeStaged(pool, first.id, NOW)).toBe(true);
    expect(await closeStaged(pool, first.id, NOW)).toBe(false);
    const again = await stageSuggestion(pool, filing({ filer: "agent-3" }));
    expect(again.duplicate).toBe(false);
    expect(again.id).not.toBe(first.id);
    expect((await openStaged(pool)).some((r) => r.staged.id === first.id)).toBe(false);
  });

  it("erases a member's own filings and leaves an agent's with the same id untouched", async () => {
    const mine = await stageSuggestion(pool, filing({ filer: "member-9", filerKind: "member", body: { words: { purpose: "Mine." } } }));
    const agents = await stageSuggestion(pool, filing({ filer: "member-9", filerKind: "agent", stream: "agent", body: { words: { purpose: "Theirs." } } }));
    await forgetStagedOf(pool, "member-9");
    expect(await stagedById(pool, mine.id)).toBeNull();
    expect(await stagedById(pool, agents.id)).not.toBeNull();
  });

  it("records each decision once, reads discards and decisions back for the engine, and names no person", async () => {
    const o = {
      id: "so_test_1",
      stream: "connector" as const,
      sourceId: "sg_x",
      kind: "role_card",
      valueDigest: "0123456789abcdef",
      keys: ["/api/admin/org/roles/water#words.purpose"],
      proposerKind: "agent" as const,
      outcome: "discarded" as const,
      decidedByCapability: "story.tell",
      filedAt: NOW,
      decidedAt: NOW,
    };
    expect(await recordOutcome(pool, o)).toBe(true);
    expect(await recordOutcome(pool, o)).toBe(true);
    expect(await recordOutcome(pool, { ...o, id: "so_test_2", outcome: "accepted" })).toBe(true);
    const [n] = await pool.query<mysql.RowDataPacket[]>("SELECT COUNT(*) AS n FROM suggestion_outcomes");
    expect(Number(n[0].n)).toBe(2);
    const h = await engineHistory(pool, "2026-10-26T00:00:00.000Z");
    expect(h.discarded).toEqual([{ keys: o.keys, valueDigest: o.valueDigest, at: NOW.toISOString(), code: "so_test_1" }]);
    expect(h.decisions.map((d) => d.code)).toEqual(["so_test_2"]);
    const [cols] = await pool.query<mysql.RowDataPacket[]>("SHOW COLUMNS FROM suggestion_outcomes");
    const names = cols.map((c) => String(c.Field));
    expect(names.filter((c) => /user|member|name|email|by$|person/.test(c))).toEqual([]);
  });

  it("adds three nullable columns to proposed_changes that an insert naming none of them leaves NULL", async () => {
    const [cols] = await pool.query<mysql.RowDataPacket[]>("SHOW COLUMNS FROM proposed_changes WHERE Field IN ('conflict_group','options_json','credits_json')");
    expect(cols.map((c) => [String(c.Field), String(c.Null)]).sort()).toEqual([
      ["conflict_group", "YES"],
      ["credits_json", "YES"],
      ["options_json", "YES"],
    ]);
  });
});
