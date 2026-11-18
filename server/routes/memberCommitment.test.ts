/**
 * "How much can you give right now?" on the routes (0383, lane E1), and the
 * quest editor's percent. The pool is a small fake that keeps rows in memory
 * and records every statement, so "a change is a new row, never an edit" is
 * read off the SQL the route actually sends.
 */
import { describe, expect, it, vi } from "vitest";
import { register as registerCommitment } from "./memberCommitment";
import { register as registerQuests } from "./quests";

type Handler = (req: any, res: any) => Promise<unknown> | unknown;

function harness() {
  const handlers = new Map<string, Handler>();
  const record = (method: string) => (path: string, handler: Handler) => handlers.set(`${method} ${path}`, handler);
  const app: any = { get: record("GET"), post: record("POST"), put: record("PUT"), delete: record("DELETE") };
  const call = async (key: string, req: any = {}) => {
    const h = handlers.get(key);
    if (!h) throw new Error(`no handler for ${key}`);
    const out: { status: number; body: any } = { status: 200, body: undefined };
    const res: any = {
      status(c: number) { out.status = c; return res; },
      json(b: unknown) { out.body = b; return res; },
      type: () => res, set: () => res, send: () => res,
    };
    await h({ params: {}, body: {}, query: {}, headers: {}, ...req }, res);
    return out;
  };
  return { app, call };
}

function memberPool() {
  const rows: any[] = [];
  const sql: string[] = [];
  let next = 1;
  const pool: any = {
    async query(text: string, params: any[] = []) {
      sql.push(text);
      if (text.includes("FROM `member_time_zones`")) return [[], []];
      if (text.startsWith("INSERT INTO `member_commitments`")) {
        const [user_id, pct, from_date, period_kind, note, split_json] = params;
        rows.push({ id: next++, user_id, pct, from_date, period_kind, note, split_json, created_at: new Date("2026-11-12T10:00:00Z") });
        return [{ insertId: next - 1, affectedRows: 1 }, []];
      }
      if (text.includes("FROM `member_commitments`")) {
        const mine = rows.filter((r) => r.user_id === params[0]);
        const upTo = text.includes("`from_date` <= ?") ? mine.filter((r) => r.from_date <= params[1]) : mine;
        const sorted = [...upTo].sort((a, b) => (a.from_date < b.from_date ? 1 : a.from_date > b.from_date ? -1 : b.id - a.id));
        return [text.includes("LIMIT 1") ? sorted.slice(0, 1) : sorted, []];
      }
      return [[], []];
    },
  };
  return { pool, rows, sql };
}

function mountCommitment(user: { id: string } | null = { id: "m-wren" }, villageZone?: string) {
  const { app, call } = harness();
  const store = memberPool();
  registerCommitment(app, { authedUser: async () => user, getPool: () => store.pool, overLimit: async () => false, villageZone: () => villageZone } as any);
  return { call, ...store };
}

describe("a member's commitment on the routes", () => {
  it("asks who is signed in, and answers only for them", async () => {
    const { call } = mountCommitment(null);
    expect((await call("GET /api/me/commitment")).status).toBe(401);
    expect((await call("POST /api/me/commitment", { body: { pct: 50 } })).status).toBe(401);
  });

  it("a change is a new row; the earlier word stays in the history", async () => {
    const { call, rows, sql } = mountCommitment();
    const first = await call("POST /api/me/commitment", { body: { pct: 80, period: "season" } });
    expect(first.status).toBe(200);
    expect(first.body.now.pct).toBe(80);
    const second = await call("POST /api/me/commitment", { body: { pct: 40, period: "moon", note: "planting" } });
    expect(second.body.now).toMatchObject({ pct: 40, period: "moon", note: "planting" });
    expect(second.body.history.map((h: any) => h.pct)).toEqual([40, 80]);
    expect(rows.map((r) => r.pct)).toEqual([80, 40]);
    expect(sql.filter((s) => /^\s*(UPDATE|DELETE|REPLACE)/i.test(s) && s.includes("member_commitments"))).toEqual([]);
  });

  it("refuses what is not a percent, an unknown period and a back-dated word, and stores nothing", async () => {
    const { call, rows } = mountCommitment();
    for (const body of [{ pct: 0 }, { pct: 150 }, { pct: "lots" }, { pct: 50, period: "year" }, { pct: 50, fromDate: "2020-01-01" }]) {
      const r = await call("POST /api/me/commitment", { body });
      expect(r.status, JSON.stringify(body)).toBe(400);
      expect(typeof r.body.error).toBe("string");
    }
    expect(rows).toEqual([]);
  });

  it("keeps a split across roles on the same word, and reads it back", async () => {
    const { call, rows } = mountCommitment();
    const split = [{ roleId: "r-host", share: 60 }, { roleId: "r-well", share: 40 }];
    const r = await call("POST /api/me/commitment", { body: { pct: 50, period: "season", split } });
    expect(r.status).toBe(200);
    expect(r.body.now).toMatchObject({ pct: 50, split });
    expect(rows).toHaveLength(1);
    expect(JSON.parse(rows[0].split_json)).toEqual(split);
    const plain = await call("POST /api/me/commitment", { body: { pct: 30 } });
    expect(plain.body.now.split).toBeNull();
    expect(rows[1].split_json).toBeNull();
  });

  it("dates a split by the village's day, the one the moon is counted in, and a plain word by the member's (QA F10)", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      const split = [{ roleId: "r-host", share: 60 }, { roleId: "r-well", share: 40 }];
      // The member's day (no saved zone: UTC) is 14 November; the village is already on the 15th.
      vi.setSystemTime(new Date("2026-11-14T12:00:00Z"));
      const ahead = mountCommitment({ id: "m-wren" }, "Pacific/Kiritimati");
      expect((await ahead.call("POST /api/me/commitment", { body: { pct: 50, split } })).status).toBe(200);
      expect((await ahead.call("POST /api/me/commitment", { body: { pct: 40 } })).status).toBe(200);
      expect(ahead.rows.map((r) => r.from_date)).toEqual(["2026-11-15", "2026-11-14"]);
      // The village is still on the 13th: the split holds from the village's day, and is not refused as back-dated.
      vi.setSystemTime(new Date("2026-11-14T05:00:00Z"));
      const behind = mountCommitment({ id: "m-wren" }, "Pacific/Pago_Pago");
      const r = await behind.call("POST /api/me/commitment", { body: { pct: 50, split } });
      expect(r.status, JSON.stringify(r.body)).toBe(200);
      expect(behind.rows.map((x) => x.from_date)).toEqual(["2026-11-13"]);
      // A date the member gives is kept as given.
      expect((await behind.call("POST /api/me/commitment", { body: { pct: 50, split, fromDate: "2026-11-20" } })).status).toBe(200);
      expect(behind.rows[1].from_date).toBe("2026-11-20");
    } finally {
      vi.useRealTimers();
    }
  });

  it("a split is never dated before the village's own day, even when the member's clock is a day behind it (audit, 15 Nov 2026)", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      const split = [{ roleId: "r-host", share: 60 }, { roleId: "r-well", share: 40 }];
      // The member's day is 14 November; the village is already on the 15th.
      vi.setSystemTime(new Date("2026-11-14T12:00:00Z"));
      const ahead = mountCommitment({ id: "m-wren" }, "Pacific/Kiritimati");
      const back = await ahead.call("POST /api/me/commitment", { body: { pct: 50, split, fromDate: "2026-11-14" } });
      expect(back.status, JSON.stringify(back.body)).toBe(400);
      expect(ahead.rows).toEqual([]);
      // CONTROL: the village's own day is accepted.
      expect((await ahead.call("POST /api/me/commitment", { body: { pct: 50, split, fromDate: "2026-11-15" } })).status).toBe(200);
    } finally {
      vi.useRealTimers();
    }
  });

  it("refuses a split that does not add up to the whole, or names a role twice, and stores nothing", async () => {
    const { call, rows } = mountCommitment();
    for (const split of [
      [{ roleId: "r-host", share: 60 }, { roleId: "r-well", share: 30 }],
      [{ roleId: "r-host", share: 50 }, { roleId: "r-host", share: 50 }],
      [{ roleId: "r-host", share: 100.5 }],
      [{ roleId: "", share: 100 }],
      "half",
    ]) {
      const r = await call("POST /api/me/commitment", { body: { pct: 50, split } });
      expect(r.status, JSON.stringify(split)).toBe(400);
      expect(typeof r.body.error).toBe("string");
    }
    expect(rows).toEqual([]);
  });
});

describe("the quest editor's percent", () => {
  function mountQuests() {
    const { app, call } = harness();
    const saved: any[] = [];
    const quest = { id: "q-well", title: "Dig the well", gratitude: "", status: "Open", tags: [], order: 1 };
    registerQuests(app, {
      isAdmin: async () => true,
      authedUser: async () => null,
      adminActor: () => ({ id: "u-admin" }),
      getPool: () => ({ query: async () => [[], []] }),
      uploadsDir: "/tmp/not-used-here",
      members: { byId: async () => null },
      questsRepo: {
        byId: async () => quest,
        all: async () => [quest],
        update: async (_id: string, mutate: (q: any) => void) => {
          const q = { ...quest };
          mutate(q);
          saved.push(q);
          return q;
        },
      },
      claimsRepo: {},
      crewsRepo: {},
      firstName: (n: string) => n,
      notify: async () => {},
      stageOf: async () => "member",
      loadRoles: () => [],
      roleIdsFor: () => [],
      currentPatternId: () => null,
      questConsentRecipients: async () => [],
      overLimit: async () => false,
      clientIp: () => "127.0.0.1",
      projectCurrency: () => "USD",
    } as any);
    return { call, saved };
  }

  it("refuses a percent outside 1 to 100 with the sentence, and saves nothing", async () => {
    const { call, saved } = mountQuests();
    for (const commitmentPct of [0, 101, "most of it"]) {
      const r = await call("PUT /api/admin/quests/:id", { params: { id: "q-well" }, body: { commitmentPct } });
      expect(r.status).toBe(400);
      expect(r.body.error).toBe("A commitment is a whole percent from 1 to 100.");
    }
    expect(saved).toEqual([]);
  });

  it("reads a typed percent and clears with null", async () => {
    const { call, saved } = mountQuests();
    expect((await call("PUT /api/admin/quests/:id", { params: { id: "q-well" }, body: { commitmentPct: "40" } })).status).toBe(200);
    expect((await call("PUT /api/admin/quests/:id", { params: { id: "q-well" }, body: { commitmentPct: null } })).status).toBe(200);
    expect(saved.map((q) => q.commitmentPct)).toEqual([40, null]);
  });
});
