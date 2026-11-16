/**
 * SEASON PLACES, THE DOORS, against a real scratch schema: the proposal road
 * and the served road, a holder's adopt, the cap under concurrency, the
 * waitlist and its notice, the ballot closer, circle places at a gathering,
 * and role prerequisites at the member door's reader.
 *
 * Every circle, member, product and season here is invented.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type mysql from "mysql2/promise";
import { provisionTestDb, testDbConfigured, testPool, type TestDb } from "../db/testDb";
import { createOrgRole, seatHolder } from "../lib/orgChart";
import { loadVariables, setVariable } from "../lib/variables";
import { loadModuleSettings, setModuleLifecycle } from "../lib/modules";
import { admit, type PlaceDeps } from "../lib/seasonPlaces";
import { prerequisiteRefusal } from "../lib/rolePrerequisites";
import { listSeason, readPlace, withSeasonLock, writePlace } from "../repos/seasonPlaces";
import { register, seasonPlaceCloser } from "./seasonPlaces";
import { register as registerRolePath } from "./rolePrerequisites";

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
  const out: { status: number; body: any } = { status: 200, body: undefined };
  const res: any = {
    status(code: number) { out.status = code; return res; },
    json(body: unknown) { out.body = body; return res; },
    set() { return res; },
  };
  return { res, out };
}

const SEASONS = [
  { id: "s1", name: "First", startsOn: "2025-01-01", endsOn: "2025-04-01" },
  { id: "s2", name: "Second", startsOn: "2025-04-01", endsOn: "2025-07-01" },
  { id: "s3", name: "Third", startsOn: "2025-07-01", endsOn: "2099-01-01" },
  { id: "s4", name: "Fourth", startsOn: "2099-01-01", endsOn: null },
];

describe("season places: the module gate", () => {
  it("mounts the module's gate in front of every door", () => {
    const { app, handlers, mounts } = collect();
    register(app, fakeDeps(null as any, () => null, { holders: [] }));
    expect(mounts).toContain("/api/season-places");
    for (const key of handlers.keys()) expect(key.split(" ")[1].startsWith("/api/season-places")).toBe(true);
  });
});

interface Told { userId: string; type: string; title: string; dedupeKey: string }

function fakeDeps(pool: mysql.Pool, who: () => string | null, o: { holders: string[]; told?: Told[]; manage?: Set<string>; closers?: Record<string, any> }) {
  return {
    authedUser: async () => (who() ? { id: who() } : null),
    capabilityCtx: async () => ({ villageHeld: [], roleCapabilities: [], stageIndex: 0, stageIndexOf: () => 0 }) as any,
    guardCapability: async (_req: any, res: any, _cap: string, refusal?: any) => {
      if (o.manage?.has(who() ?? "")) return true;
      res.status(refusal?.status ?? 403).json(refusal?.body ?? {});
      return false;
    },
    getPool: () => pool,
    notify: async (n: any) => { o.told?.push(n); return { ok: true } as any; },
    overLimit: async () => false,
    firstName: (n: string) => n.split(" ")[0] ?? "",
    liveHoldersOf: async () => o.holders,
    roleBallotSetup: async () => { throw new Error("no ballot in this test"); },
    seasonState: () => ({ current: SEASONS[2], upcoming: SEASONS[3], seasons: SEASONS, timezone: "UTC" }),
    lapse: () => ({ currentSeasonId: null, cadence: "never" }),
    closers: o.closers ?? {},
  } as any;
}

const configured = testDbConfigured();

describe.skipIf(!configured)("season places against a real schema", () => {
  let db: TestDb;
  let pool: mysql.Pool;
  let me = "u-a1";
  const told: Told[] = [];
  const closers: Record<string, any> = {};
  let handlers: Map<string, Handler>;

  const call = async (key: string, req: any = {}) => {
    const h = handlers.get(key);
    if (!h) throw new Error(`no handler ${key}`);
    const { res, out } = makeRes();
    await h({ params: {}, body: {}, query: {}, headers: {}, ...req }, res);
    return out;
  };

  async function circle(id: string, name: string, crew: string[]) {
    await pool.query("INSERT INTO circles (id, name) VALUES (?, ?)", [id, name]); // module-review-ok: fixture SQL against the S5 scratch schema, never a production table
    const roleId = await createOrgRole(pool, { id: `${id}-crew`, name: `${name} crew`, circleId: id, seats: 10 });
    for (const u of crew) await seatHolder(pool, roleId, { userId: u });
  }

  beforeAll(async () => {
    db = await provisionTestDb();
    pool = testPool(db, { connectionLimit: 6 });
    await loadVariables(pool);
    await loadModuleSettings(pool);
    const on = await setModuleLifecycle("events", "members", null, { sharedPasswordPosture: () => false });
    if (on && (on as any).ok === false) throw new Error(`events would not switch on: ${JSON.stringify(on)}`);
    for (const [id, name] of [["u-a1", "Ada One"], ["u-a2", "Ada Two"], ["u-b1", "Bo One"], ["u-c1", "Cy One"], ["u-h", "Hal Holder"]]) {
      await pool.query("INSERT INTO users (id, name, email, password_hash, paths) VALUES (?, ?, ?, 'x', '[]')", [id, name, `${id}@example.test`]); // module-review-ok: fixture SQL against the S5 scratch schema, never a production table
    }
    await circle("crew-a", "Crew A", ["u-a1", "u-a2"]);
    await circle("crew-b", "Crew B", ["u-b1"]);
    await circle("crew-c", "Crew C", ["u-c1"]);
    const c = collect();
    register(c.app, fakeDeps(pool, () => me, { holders: ["u-h"], told, closers, manage: new Set(["u-h"]) }));
    handlers = c.handlers;
  }, 240_000);

  afterAll(async () => {
    await pool?.end();
    await db?.drop();
  });

  beforeEach(async () => {
    told.length = 0;
    await pool.query("DELETE FROM season_places"); // module-review-ok: fixture SQL against the S5 scratch schema, never a production table
    await pool.query("DELETE FROM event_circle_places"); // module-review-ok: fixture SQL against the S5 scratch schema, never a production table
    await pool.query("DELETE FROM event_circle_settings"); // module-review-ok: fixture SQL against the S5 scratch schema, never a production table
    await setVariable(pool, "season_places.cap", "");
    await setVariable(pool, "season_places.free_after", "");
    await setVariable(pool, "season_crew.picker_role", "");
    await setVariable(pool, "season_crew.needs_place", "false");
    await pool.query("DELETE FROM season_crew_applications"); // module-review-ok: fixture SQL against the S5 scratch schema, never a production table
    await pool.query("DELETE FROM season_crew_berths"); // module-review-ok: fixture SQL against the S5 scratch schema, never a production table
  });

  it("refuses a visitor, and a member who is not in the circle", async () => {
    me = "";
    expect((await call("GET /api/season-places")).status).toBe(401);
    me = "u-b1";
    const out = await call("POST /api/season-places", { body: { circleId: "crew-a" } });
    expect(out.status).toBe(403);
    expect(out.body.error).toBe("not_crew");
  });

  it("a new circle's proposal waits on a holder outside it, who adopts it into a place", async () => {
    me = "u-a1";
    const made = await call("POST /api/season-places", { body: { circleId: "crew-a", words: "We bring a kitchen." } });
    expect(made.body).toMatchObject({ success: true, road: "proposal", status: "proposed", waitsOn: "holder", served: 0 });
    expect(told.map((t) => [t.userId, t.type])).toEqual([["u-h", "season_place_waiting"]]);

    // The crew cannot adopt its own.
    const own = await call("POST /api/season-places/:id/adopt", { params: { id: made.body.id } });
    expect(own.status).toBe(403);

    me = "u-h";
    const adopted = await call("POST /api/season-places/:id/adopt", { params: { id: made.body.id } });
    expect(adopted.body).toMatchObject({ success: true, status: "taking_part" });
    expect(told.filter((t) => t.type === "season_place_placed").map((t) => t.userId).sort()).toEqual(["u-a1", "u-a2"]);
    expect(told.find((t) => t.type === "season_place_placed")?.title).toBe("Crew A takes part in Fourth.");

    const page = await call("GET /api/season-places");
    expect(page.body.taken).toBe(1);
    expect(page.body.places[0]).toMatchObject({ name: "Crew A", status: "taking_part", words: "We bring a kitchen." });
  });

  it("a circle that served the dial's seasons takes part without a proposal", async () => {
    await setVariable(pool, "season_places.free_after", "3");
    for (const s of ["s1", "s2", "s3"]) {
      await withSeasonLock(pool, s, async (conn) => {
        const w = await writePlace(conn, { seasonId: s, subjectKind: "circle", subjectId: "crew-b", road: "proposal", words: null, proposedBy: "u-b1", status: "proposed" });
        if (w.ok) await conn.query("UPDATE season_places SET status = 'taking_part' WHERE id = ?", [w.id]); // module-review-ok: fixture SQL against the S5 scratch schema, never a production table
      });
    }
    me = "u-b1";
    const out = await call("POST /api/season-places", { body: { circleId: "crew-b" } });
    expect(out.body).toMatchObject({ success: true, road: "served", served: 3, status: "taking_part" });
    // Control: with the dial at 4 the same history still needs a proposal.
    await pool.query("DELETE FROM season_places WHERE season_id = 's4'"); // module-review-ok: fixture SQL against the S5 scratch schema, never a production table
    await setVariable(pool, "season_places.free_after", "4");
    expect((await call("POST /api/season-places", { body: { circleId: "crew-b" } })).body.road).toBe("proposal");
  });

  it("over the cap a circle waits in order, and takes the first place that frees, and its crew is told", async () => {
    await setVariable(pool, "season_places.cap", "1");
    await setVariable(pool, "season_places.free_after", "0");
    me = "u-a1";
    expect((await call("POST /api/season-places", { body: { circleId: "crew-a" } })).body.status).toBe("taking_part");
    me = "u-b1";
    expect((await call("POST /api/season-places", { body: { circleId: "crew-b" } })).body).toMatchObject({ status: "waitlisted", position: 1 });
    me = "u-c1";
    expect((await call("POST /api/season-places", { body: { circleId: "crew-c" } })).body).toMatchObject({ status: "waitlisted", position: 2 });

    told.length = 0;
    me = "u-a2";
    const rows = await listSeason(pool, "s4");
    const a = rows.find((r) => r.subjectId === "crew-a")!;
    const gone = await call("POST /api/season-places/:id/withdraw", { params: { id: a.id } });
    expect(gone.body).toMatchObject({ success: true, placeWentTo: 1 });
    const after = await listSeason(pool, "s4");
    expect(after.find((r) => r.subjectId === "crew-b")?.status).toBe("taking_part");
    expect(after.find((r) => r.subjectId === "crew-c")?.status).toBe("waitlisted");
    expect(told).toEqual([expect.objectContaining({ userId: "u-b1", type: "season_place_opened", title: "A place opened. Crew B takes part in Fourth." })]);
  });

  it("never gives the last place twice, however many adopt at once", async () => {
    await setVariable(pool, "season_places.cap", "1");
    const ids: string[] = [];
    for (const [c, u] of [["crew-a", "u-a1"], ["crew-b", "u-b1"], ["crew-c", "u-c1"]]) {
      const w = await withSeasonLock(pool, "s4", (conn) => writePlace(conn, { seasonId: "s4", subjectKind: "circle", subjectId: c, road: "proposal", words: null, proposedBy: u, status: "proposed" }));
      if (w.ok) ids.push(w.id);
    }
    const deps: PlaceDeps = { getPool: () => pool, notify: async () => undefined, lapse: () => ({ currentSeasonId: null, cadence: "never" }), seasons: () => ({ current: SEASONS[2], upcoming: SEASONS[3], seasons: SEASONS }) };
    const out = await Promise.all(ids.map((id) => admit(deps, id, ["proposed"], "u-h")));
    expect(out.filter((o) => o.result === "taking_part")).toHaveLength(1);
    expect(out.filter((o) => o.result === "waitlisted")).toHaveLength(2);
  });

  it("the ballot closer declines on a no and places on a landed yes", async () => {
    const closer = closers.season_place;
    expect(closer).toBeDefined();
    const mk = async (c: string, u: string) => {
      const w = await withSeasonLock(pool, "s4", (conn) => writePlace(conn, { seasonId: "s4", subjectKind: "circle", subjectId: c, road: "proposal", words: null, proposedBy: u, status: "voting" }));
      if (!w.ok) throw new Error("not written");
      return w.id;
    };
    const no = await mk("crew-a", "u-a1");
    await closer.settle({ id: "bal-1", subjectRef: no } as any, "failed", "", "system");
    expect((await readPlace(pool, no))?.status).toBe("declined");
    expect(told.some((t) => t.type === "season_place_declined" && t.title === "Crew A does not take part in Fourth.")).toBe(true);

    const yes = await mk("crew-b", "u-b1");
    expect(await closer.settle({ id: "bal-2", subjectRef: yes } as any, "passed", "", "system")).toMatchObject({ applied: [] });
    expect((await readPlace(pool, yes))?.status).toBe("voting");
    const landed = await closer.execute({ id: "bal-2", subjectRef: yes } as any, "system");
    expect(landed.applied).toEqual(["A place this season"]);
    expect((await readPlace(pool, yes))).toMatchObject({ status: "taking_part", decidedBy: "bal-2" });
    // Landing twice changes nothing.
    expect((await closer.execute({ id: "bal-2", subjectRef: yes } as any, "system")).held).toMatch(/no longer waiting/);
  });

  describe("circle places at a gathering", () => {
    beforeAll(async () => {
      await pool.query( // module-review-ok: fixture SQL against the S5 scratch schema, never a production table
        "INSERT INTO events (id, title, starts_at, status, kind) VALUES ('ev-host', 'Spring gathering', '2099-02-01 10:00:00', 'scheduled', 'gathering')",
      ).catch(async () => {
        await pool.query("INSERT INTO events (id, title, starts_at, status) VALUES ('ev-host', 'Spring gathering', '2099-02-01 10:00:00', 'scheduled')"); // module-review-ok: fixture SQL against the S5 scratch schema, never a production table
      });
    });

    it("only a holder of event.manage changes the settings", async () => {
      me = "u-a1";
      expect((await call("PUT /api/season-places/gatherings/:eventId/settings", { params: { eventId: "ev-host" }, body: { takesCircles: true } })).status).toBe(403);
      me = "u-h";
      const ok = await call("PUT /api/season-places/gatherings/:eventId/settings", { params: { eventId: "ev-host" }, body: { takesCircles: true, circleCap: 1 } });
      expect(ok.body.settings).toEqual({ takesCircles: true, circleCap: 1, needsSeasonPlace: true });
    });

    it("needs a season place, caps circles, and lets the next in when one leaves", async () => {
      me = "u-h";
      await call("PUT /api/season-places/gatherings/:eventId/settings", { params: { eventId: "ev-host" }, body: { takesCircles: true, circleCap: 1 } });
      me = "u-a1";
      const refused = await call("POST /api/season-places/gatherings/:eventId/circles", { params: { eventId: "ev-host" }, body: { circleId: "crew-a" } });
      expect(refused.status).toBe(409);
      expect(refused.body.error).toBe("needs_season_place");

      await setVariable(pool, "season_places.free_after", "0");
      expect((await call("POST /api/season-places", { body: { circleId: "crew-a" } })).body.status).toBe("taking_part");
      me = "u-b1";
      expect((await call("POST /api/season-places", { body: { circleId: "crew-b" } })).body.status).toBe("taking_part");

      me = "u-a1";
      expect((await call("POST /api/season-places/gatherings/:eventId/circles", { params: { eventId: "ev-host" }, body: { circleId: "crew-a" } })).body).toMatchObject({ status: "going" });
      me = "u-b1";
      expect((await call("POST /api/season-places/gatherings/:eventId/circles", { params: { eventId: "ev-host" }, body: { circleId: "crew-b" } })).body).toMatchObject({ status: "waiting", position: 1 });

      told.length = 0;
      me = "u-a2";
      const left = await call("POST /api/season-places/gatherings/:eventId/circles/:circleId/leave", { params: { eventId: "ev-host", circleId: "crew-a" } });
      expect(left.body).toMatchObject({ success: true, placeWentTo: 1 });
      expect(told).toEqual([expect.objectContaining({ userId: "u-b1", type: "circle_place_opened", title: "A place opened at Spring gathering. Crew B is going." })]);
    });
  });

  describe("season crew: everyone applies, each circle's picker picks", () => {
    beforeAll(async () => {
      const lead = await createOrgRole(pool, { id: "crew-a-lead", name: "Lead", circleId: "crew-a", seats: 1 });
      await seatHolder(pool, lead, { userId: "u-a1" });
    });

    const apply = (circleId?: string) => call("POST /api/season-places/crew/apply", { body: { circleId, words: "I cook." } });
    const pick = (id: string, circleId: string) => call("POST /api/season-places/crew/:id/pick", { params: { id }, body: { circleId } });

    it("the named role picks, a crew member who does not hold it cannot, and berths cap the crew", async () => {
      await setVariable(pool, "season_crew.picker_role", "lead");
      me = "u-c1";
      const mine = await apply("crew-a");
      expect(mine.body).toMatchObject({ success: true, status: "applied" });
      expect(told).toEqual([expect.objectContaining({ userId: "u-a1", type: "season_crew_applied" })]);

      me = "u-a2";
      expect((await pick(mine.body.id, "crew-a")).status).toBe(403);
      // Only a picker sees the pool; everyone sees the counts.
      const seen = await call("GET /api/season-places/crew");
      expect(seen.body.pool).toBeNull();
      expect(seen.body.circles.find((c: any) => c.circleId === "crew-a")).toMatchObject({ pickedBy: { role: "Lead", names: ["Ada"] }, wanted: 1 });

      me = "u-a1";
      expect((await call("PUT /api/season-places/crew/circles/:circleId/berths", { params: { circleId: "crew-a" }, body: { berths: 1 } })).body.berths).toBe(1);
      told.length = 0;
      expect((await pick(mine.body.id, "crew-a")).body).toMatchObject({ success: true, status: "picked" });
      expect(told).toEqual([expect.objectContaining({ userId: "u-c1", type: "season_crew_picked", title: "You're in this season! Crew A picked you for Fourth." })]);
      expect((await call("GET /api/season-places/crew")).body.pool.map((p: any) => p.status)).toEqual(["picked"]);

      me = "u-b1";
      const second = await apply();
      me = "u-a1";
      const full = await pick(second.body.id, "crew-a");
      expect(full.status).toBe(409);
      expect(full.body.error).toBe("full");
    });

    it("never gives one person to two circles, however many pick at once", async () => {
      me = "u-c1";
      const a = await apply();
      // Below the doors: the doors read one shared signed-in user, so two at once is raced at the lock they both take.
      const { pickOn } = await import("../repos/seasonCrew");
      const race = await Promise.all(["crew-a", "crew-b"].map((c) => withSeasonLock(pool, "s4", (conn) => pickOn(conn, a.body.id, c, "u-h"))));
      expect(race.filter(Boolean)).toHaveLength(1);
    });

    it("a circle with no live picker is picked for by its crew; a season place can be required; release and withdraw", async () => {
      await setVariable(pool, "season_crew.picker_role", "lead");
      me = "u-c1";
      const a = await apply();
      // Crew B has no Lead, so its crew picks.
      me = "u-b1";
      await setVariable(pool, "season_crew.needs_place", "true");
      const refused = await pick(a.body.id, "crew-b");
      expect(refused.status).toBe(409);
      expect(refused.body.error).toBe("needs_place");
      await setVariable(pool, "season_crew.needs_place", "false");
      expect((await pick(a.body.id, "crew-b")).body.status).toBe("picked");

      // Crew A's picker cannot release somebody crew B picked.
      me = "u-a1";
      expect((await call("POST /api/season-places/crew/:id/release", { params: { id: a.body.id }, body: { circleId: "crew-a" } })).body.error).toBe("not_yours");
      me = "u-b1";
      expect((await call("POST /api/season-places/crew/:id/release", { params: { id: a.body.id }, body: { circleId: "crew-b" } })).body.status).toBe("applied");
      me = "u-b1";
      expect((await call("POST /api/season-places/crew/:id/withdraw", { params: { id: a.body.id } })).status).toBe(403);
      me = "u-c1";
      expect((await call("POST /api/season-places/crew/:id/withdraw", { params: { id: a.body.id } })).body.status).toBe("withdrawn");
    });

    it("a Landfall is signed up by the circle's picker, not any crew member", async () => {
      await setVariable(pool, "season_crew.picker_role", "lead");
      me = "u-h";
      await call("PUT /api/season-places/gatherings/:eventId/settings", { params: { eventId: "ev-host" }, body: { takesCircles: true, circleCap: null, needsSeasonPlace: false } });
      me = "u-a2";
      expect((await call("POST /api/season-places/gatherings/:eventId/circles", { params: { eventId: "ev-host" }, body: { circleId: "crew-a" } })).status).toBe(403);
      me = "u-a1";
      expect((await call("POST /api/season-places/gatherings/:eventId/circles", { params: { eventId: "ev-host" }, body: { circleId: "crew-a" } })).body.status).toBe("going");
      // The list a member's season page reads: each gathering that takes circles, and where theirs stands.
      me = "u-a2";
      const list = await call("GET /api/season-places/gatherings");
      expect(list.body.gatherings).toEqual([
        expect.objectContaining({ eventId: "ev-host", title: "Spring gathering", circleCap: null, going: 1, waiting: 0, mine: [{ circleId: "crew-a", name: "Crew A", status: "going", position: null }] }),
      ]);
    });
  });

  describe("a role's path", () => {
    it("names the role's holders and lists what it asks, with what the reader has, in order", async () => {
      await pool.query("INSERT INTO payment_products (id, name, kind, amount_minor, created_by) VALUES ('prod-path', 'Path fee', 'fee', 70000, 'u-h')"); // module-review-ok: fixture SQL against the S5 scratch schema, never a production table
      await pool.query("INSERT INTO quests (id, title, description) VALUES ('q-path-1', 'First lesson', 'Walk around it.')"); // module-review-ok: fixture SQL against the S5 scratch schema, never a production table
      await setVariable(pool, "roles.prerequisites", "crew-a-lead = product:prod-path, quest:q-path-1");
      const c = collect();
      registerRolePath(c.app, { authedUser: async () => ({ id: "u-c1" }), getPool: () => pool, firstName: (n: string) => n.split(" ")[0], lapse: () => ({ currentSeasonId: null, cadence: "never" }) } as any);
      const h = c.handlers.get("GET /api/governance/role-path/:roleId")!;
      const { res, out } = makeRes();
      await h({ params: { roleId: "crew-a-lead" }, query: {}, headers: {} }, res);
      expect(out.body).toMatchObject({ roleId: "crew-a-lead", name: "Lead", holders: ["Ada"] });
      expect(out.body.items).toEqual([
        expect.objectContaining({ kind: "product", title: "Path fee", amountMinor: 70000, done: false }),
        expect.objectContaining({ kind: "quest", title: "First lesson", detail: "Walk around it.", done: false }),
      ]);
      const missing = makeRes();
      await h({ params: { roleId: "no-such-role" }, query: {}, headers: {} }, missing.res);
      expect(missing.out.status).toBe(404);
      await setVariable(pool, "roles.prerequisites", "");
    });
  });

  describe("role prerequisites", () => {
    beforeAll(async () => {
      await pool.query( // module-review-ok: fixture SQL against the S5 scratch schema, never a production table
        "INSERT INTO payment_products (id, name, kind, amount_minor, created_by) VALUES ('prod-lessons', 'Lessons', 'fee', 10000, 'u-h')",
      );
    });

    it("refuses until the product is paid, and a reversed payment does not count", async () => {
      await setVariable(pool, "roles.prerequisites", "lead-role = product:prod-lessons");
      const name = () => "Lead";
      const before = await prerequisiteRefusal(pool, "u-c1", ["lead-role"], name);
      expect(before).toMatchObject({ code: "prerequisites_missing", error: "Lead asks for one thing before you apply: Pay for Lessons." });
      // A role the dial does not name asks nothing.
      expect(await prerequisiteRefusal(pool, "u-c1", ["other-role"], name)).toBeNull();

      await pool.query("INSERT INTO product_purchases (id, product_id, user_id, amount_minor, receipt_no, status) VALUES ('pp-1', 'prod-lessons', 'u-c1', 10000, 9001, 'reversed')"); // module-review-ok: fixture SQL against the S5 scratch schema, never a production table
      expect(await prerequisiteRefusal(pool, "u-c1", ["lead-role"], name)).not.toBeNull();
      await pool.query("INSERT INTO product_purchases (id, product_id, user_id, amount_minor, receipt_no, status) VALUES ('pp-2', 'prod-lessons', 'u-c1', 10000, 9002, 'paid')"); // module-review-ok: fixture SQL against the S5 scratch schema, never a production table
      expect(await prerequisiteRefusal(pool, "u-c1", ["lead-role"], name)).toBeNull();
      await setVariable(pool, "roles.prerequisites", "");
    });
  });
});
