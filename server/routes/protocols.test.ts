/**
 * PROTOCOLS ROUTES, against a real scratch schema.
 *
 * What a member's phone depends on when it sends a run made with no signal:
 * every write is safe to repeat, a refusal the phone should not retry is a
 * 422 with a sentence, a role step is the holder's alone (and not a lapsed
 * holder's), and a run with a required step open cannot be completed. And
 * what a founder depends on: a save is a new version, a run keeps the version
 * it started on, and an import saves nothing until the whole file is clean.
 *
 * Every person and role here is invented.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type mysql from "mysql2/promise";
import { provisionTestDb, testDbConfigured, testPool, type TestDb } from "../db/testDb";
import { loadModuleSettings, setModuleLifecycle } from "../lib/modules";
import type { LapseContext } from "../lib/orgChart";
import { register } from "./protocols";

type Handler = (req: any, res: any) => Promise<unknown> | unknown;

function collect() {
  const handlers = new Map<string, Handler>();
  const mounts: string[] = [];
  const record = (method: string) => (p: string, handler: Handler) => handlers.set(`${method} ${p}`, handler);
  return {
    app: { get: record("GET"), post: record("POST"), put: record("PUT"), patch: record("PATCH"), delete: record("DELETE"), use: (p: string) => mounts.push(p) } as any,
    handlers,
    mounts,
  };
}

function makeRes() {
  const out: { status: number; body: any; headers: Record<string, string> } = { status: 200, body: undefined, headers: {} };
  const res: any = {
    status(code: number) { out.status = code; return res; },
    json(body: unknown) { out.body = body; return res; },
    setHeader(k: string, v: string) { out.headers[k.toLowerCase()] = v; },
    type(t: string) { out.headers["content-type"] = t; return res; },
  };
  return { res, out };
}

describe("the routes, with no database", () => {
  it("mounts the member routes behind the module gate and the manifest outside it", () => {
    const c = collect();
    register(c.app, {
      authedUser: async () => null,
      isAdmin: async () => false,
      getPool: () => { throw new Error("no pool"); },
      lapseContext: () => ({ currentSeasonId: null, cadence: "never" }),
      overLimit: async () => false,
      projectName: () => "Test Village",
      brandColour: () => "#123456",
      appIcon: () => "/icon.svg",
    } as any);
    expect(c.mounts).toEqual(["/api/protocols"]);
    expect(c.handlers.has("GET /api/protocols-app.webmanifest")).toBe(true);
    expect(c.handlers.has("POST /api/protocols/runs/:id/ticks")).toBe(true);
  });
});

describe.skipIf(!testDbConfigured())("protocols against a real schema", () => {
  let db: TestDb;
  let pool: mysql.Pool;
  let whoami: string | null = "m-wren";
  let admin = false;
  let lapse: LapseContext = { currentSeasonId: null, cadence: "never" };
  let handlers: Map<string, Handler>;
  const q = async (sql: string, params: unknown[] = []) => (await pool.query<any[]>(sql, params))[0]; // module-review-ok: fixture SQL against the S5 scratch schema, never a production table

  const call = async (key: string, req: { params?: any; body?: any } = {}) => {
    const h = handlers.get(key);
    if (!h) throw new Error(`no handler ${key}`);
    const { res, out } = makeRes();
    await h({ params: req.params ?? {}, body: req.body ?? {}, query: {}, headers: {} }, res);
    return out;
  };

  const LIST = {
    title: "Opening up",
    summary: "Before anyone arrives.",
    steps: [
      { id: "lights", text: "Lights on" },
      { id: "kettle", text: "Kettle filled", required: false },
      { id: "unlock", text: "Front door unlocked", who: { kind: "role", roleId: "role-keyholder" } },
    ],
  };

  beforeAll(async () => {
    db = await provisionTestDb();
    pool = testPool(db, { connectionLimit: 4 });
    await loadModuleSettings(pool);
    await setModuleLifecycle("protocols", "members", null, { sharedPasswordPosture: () => false });
    await q( // module-review-ok: fixture SQL against the S5 scratch schema
      "INSERT INTO `users` (`id`, `name`, `email`, `password_hash`) VALUES (?,?,?,'x'), (?,?,?,'x')",
      ["m-wren", "Wren Alder", "wren@example.test", "m-kai", "Kai Moss", "kai@example.test"],
    );
    await q("INSERT INTO `org_roles` (`id`, `name`) VALUES ('role-keyholder', 'Keyholder')"); // module-review-ok: fixture SQL against the S5 scratch schema
    await q( // module-review-ok: fixture SQL against the S5 scratch schema
      "INSERT INTO `org_role_assignments` (`id`, `org_role_id`, `holder_kind`, `user_id`, `holder_key`, `is_example`) VALUES ('seat-kai', 'role-keyholder', 'member', 'm-kai', 'm-kai', 0)",
    );
    const c = collect();
    register(c.app, {
      authedUser: async () => (whoami ? { id: whoami, name: whoami === "m-kai" ? "Kai Moss" : "Wren Alder" } : null),
      isAdmin: async () => admin,
      getPool: () => pool,
      lapseContext: () => lapse,
      overLimit: async () => false,
      projectName: () => "Test Village",
      brandColour: () => "#123456",
      appIcon: () => "/icon.svg",
    } as any);
    handlers = c.handlers;
    admin = true;
    const saved = await call("PUT /api/admin/protocols/:id", { params: { id: "opening-up" }, body: LIST });
    expect(saved.status).toBe(200);
    admin = false;
  }, 180_000);

  afterAll(async () => {
    await pool?.end();
    await db?.drop();
  });

  beforeEach(() => {
    whoami = "m-wren";
    admin = false;
    lapse = { currentSeasonId: null, cadence: "never" };
  });

  const RUN = "run-aaaaaaaa-0001";

  it("a member reads the protocols, their own live roles and no runs yet", async () => {
    const r = await call("GET /api/protocols");
    expect(r.status).toBe(200);
    expect(r.body.protocols.map((p: any) => [p.id, p.version, p.steps.length])).toEqual([["opening-up", 1, 3]]);
    expect(r.body.viewer).toEqual({ id: "m-wren", name: "Wren Alder", roleIds: [] });
    // The role step's holders by first name, for "Keyholder (Kai) ticks this one".
    expect(r.body.roleHolders).toEqual({ "role-keyholder": ["Kai"] });
    whoami = "m-kai";
    expect((await call("GET /api/protocols")).body.viewer.roleIds).toEqual(["role-keyholder"]);
  });

  it("starting a run twice with the same id is one run", async () => {
    const body = { id: RUN, protocolId: "opening-up", version: 1, startedAt: "2026-11-15T10:00:00.000Z" };
    const first = await call("POST /api/protocols/runs", { body });
    expect(first.status).toBe(201);
    const again = await call("POST /api/protocols/runs", { body });
    expect(again.status).toBe(200);
    expect(again.body.repeat).toBe(true);
    expect((await q("SELECT COUNT(*) AS n FROM `protocol_runs`"))[0].n).toBe(1); // module-review-ok: fixture SQL against the S5 scratch schema
    expect(first.body.run.startedAt).toBe("2026-11-15T10:00:00.000Z");
  });

  it("a member step ticks, and the same tick sent twice is recorded once", async () => {
    const tick = { id: "tick-wren-0001", stepId: "lights", done: true, at: "2026-11-15T10:01:00.000Z" };
    expect((await call("POST /api/protocols/runs/:id/ticks", { params: { id: RUN }, body: tick })).status).toBe(201);
    const again = await call("POST /api/protocols/runs/:id/ticks", { params: { id: RUN }, body: tick });
    expect(again.status).toBe(200);
    expect(again.body.run.ticks.map((t: any) => [t.stepId, t.by, t.byName])).toEqual([["lights", "m-wren", "Wren Alder"]]);
  });

  it("a role step is refused to a member who does not hold the role, with the role named", async () => {
    const r = await call("POST /api/protocols/runs/:id/ticks", { params: { id: RUN }, body: { id: "tick-wren-0002", stepId: "unlock", done: true } });
    expect(r.status).toBe(422);
    expect(r.body.code).toBe("not_your_step");
    expect(r.body.error).toBe('Only the Keyholder can tick "Front door unlocked".');
  });

  it("completing with a required step open is refused, naming the step and whose it is", async () => {
    const r = await call("POST /api/protocols/runs/:id/complete", { params: { id: RUN }, body: { at: "2026-11-15T10:03:00.000Z" } });
    expect(r.status).toBe(422);
    expect(r.body.code).toBe("steps_open");
    expect(r.body.error).toBe("One required step is still open: Front door unlocked (Keyholder).");
  });

  it("a lapsed holder ticks nothing", async () => {
    await q("UPDATE `org_role_assignments` SET `term_ends_at` = '2020-01-01 00:00:00' WHERE `id` = 'seat-kai'"); // module-review-ok: fixture SQL against the S5 scratch schema
    whoami = "m-kai";
    const r = await call("POST /api/protocols/runs/:id/ticks", { params: { id: RUN }, body: { id: "tick-kai-00001", stepId: "unlock", done: true } });
    expect(r.status).toBe(422);
    await q("UPDATE `org_role_assignments` SET `term_ends_at` = NULL WHERE `id` = 'seat-kai'"); // module-review-ok: fixture SQL against the S5 scratch schema
  });

  it("the holder ticks the role step; the run completes once, and a repeat of the ending is a no-op", async () => {
    whoami = "m-kai";
    const t = await call("POST /api/protocols/runs/:id/ticks", { params: { id: RUN }, body: { id: "tick-kai-00002", stepId: "unlock", done: true, at: "2026-11-15T10:02:00.000Z" } });
    expect(t.status).toBe(201);
    whoami = "m-wren";
    const done = await call("POST /api/protocols/runs/:id/complete", { params: { id: RUN }, body: { at: "2026-11-15T10:03:00.000Z" } });
    expect(done.status).toBe(200);
    expect([done.body.run.status, done.body.run.endedBy, done.body.run.endedAt]).toEqual(["complete", "m-wren", "2026-11-15T10:03:00.000Z"]);
    const again = await call("POST /api/protocols/runs/:id/complete", { params: { id: RUN }, body: {} });
    expect(again.status).toBe(200);
    expect(again.body.repeat).toBe(true);
    const late = await call("POST /api/protocols/runs/:id/ticks", { params: { id: RUN }, body: { id: "tick-wren-0003", stepId: "kettle", done: true } });
    expect(late.status).toBe(422);
    expect(late.body.code).toBe("run_ended");
  });

  it("a tick for a run the server never got is a 422 the phone can show", async () => {
    const r = await call("POST /api/protocols/runs/:id/ticks", { params: { id: "run-never-arrived" }, body: { id: "tick-wren-0004", stepId: "lights" } });
    expect(r.status).toBe(422);
    expect(r.body.code).toBe("no_run");
  });

  it("a device clock ahead of the server is recorded at the server's now", async () => {
    const body = { id: "run-bbbbbbbb-0002", protocolId: "opening-up", version: 1, startedAt: "2099-01-01T00:00:00.000Z" };
    const r = await call("POST /api/protocols/runs", { body });
    expect(Date.parse(r.body.run.startedAt)).toBeLessThanOrEqual(Date.now() + 1000);
    await call("POST /api/protocols/runs/:id/set-aside", { params: { id: "run-bbbbbbbb-0002" }, body: {} });
  });

  it("saving an edit makes version 2, the old run keeps version 1, and an identical save writes nothing", async () => {
    admin = true;
    const edited = { ...LIST, steps: [...LIST.steps, { id: "sign", text: "Sign the book" }] };
    const r = await call("PUT /api/admin/protocols/:id", { params: { id: "opening-up" }, body: edited });
    expect([r.status, r.body.version, r.body.changed]).toEqual([200, 2, true]);
    const same = await call("PUT /api/admin/protocols/:id", { params: { id: "opening-up" }, body: edited });
    expect([same.body.version, same.body.changed]).toEqual([2, false]);
    const run = await call("GET /api/protocols/runs/:id", { params: { id: RUN } });
    expect(run.body.run.version).toBe(1);
    expect(run.body.run.steps).toHaveLength(3);
  });

  it("an admin save naming a role the chart lacks is refused by name", async () => {
    admin = true;
    const r = await call("PUT /api/admin/protocols/:id", {
      params: { id: "closing" },
      body: { title: "Closing", steps: [{ text: "Alarm set", who: { kind: "role", roleId: "role-missing" } }] },
    });
    expect(r.status).toBe(400);
    expect(r.body.problems[0]).toMatch(/pick a role that is on the org chart/);
  });

  it("an import is checked first, refused whole with a missing role, and saved when clean", async () => {
    admin = true;
    const file = JSON.stringify({
      protocols: [
        { id: "closing", title: "Closing", steps: [{ id: "lights-off", text: "Lights off", who: "anyone" }, { id: "lock", text: "Door locked", who: "keyholder" }] },
        { id: "night", title: "Night", steps: [{ id: "round", text: "Last round", who: "Night warden" }] },
      ],
    });
    const bad = await call("POST /api/admin/protocols/import", { body: { file, dryRun: false } });
    expect(bad.status).toBe(400);
    expect(bad.body.saved).toBe(false);
    expect(bad.body.missingRoles).toEqual(["Night warden"]);
    expect((await q("SELECT COUNT(*) AS n FROM `protocols` WHERE `id` = 'closing'"))[0].n).toBe(0); // module-review-ok: fixture SQL against the S5 scratch schema

    const good = JSON.stringify({ protocols: [JSON.parse(file).protocols[0]] });
    const dry = await call("POST /api/admin/protocols/import", { body: { file: good } });
    expect([dry.status, dry.body.saved, dry.body.plan]).toEqual([200, false, [{ id: "closing", title: "Closing", steps: 2, action: "create" }]]);
    const real = await call("POST /api/admin/protocols/import", { body: { file: good, dryRun: false } });
    expect(real.body.saved).toBe(true);
    const lock = real.body.protocols.find((p: any) => p.id === "closing").steps[1];
    expect(lock.who).toEqual({ kind: "role", roleId: "role-keyholder", roleTitle: "Keyholder" });
  });

  it("an archived protocol is hidden from members and starts no new run", async () => {
    admin = true;
    expect((await call("POST /api/admin/protocols/:id/status", { params: { id: "closing" }, body: { status: "archived" } })).status).toBe(200);
    admin = false;
    const list = await call("GET /api/protocols");
    expect(list.body.protocols.map((p: any) => p.id)).toEqual(["opening-up"]);
    const r = await call("POST /api/protocols/runs", { body: { id: "run-cccccccc-0003", protocolId: "closing", version: 1 } });
    expect(r.status).toBe(422);
    expect(r.body.code).toBe("protocol_gone");
  });

  it("admin routes refuse a member", async () => {
    expect((await call("GET /api/admin/protocols")).status).toBe(401);
  });

  it("the installed app's manifest starts and stays at /protocols", async () => {
    const r = await call("GET /api/protocols-app.webmanifest");
    expect(r.status).toBe(200);
    expect([r.body.start_url, r.body.scope, r.body.id, r.body.name]).toEqual(["/protocols", "/protocols", "/protocols", "Test Village Protocols"]);
  });
});
