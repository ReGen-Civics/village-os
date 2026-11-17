/**
 * PRIORITIES EVERYONE CAN SEE, end to end on a real schema (shared/priorities.ts).
 *
 * The room's, the templates' and the role tensions' route modules are
 * registered on a fake Express with the scratch schema's pool behind them, so
 * every case goes through the real doors. The cases run in order and share
 * one story:
 *
 *   1. Each person's top priority: set from the profile, read by the team by
 *      name, replaced in the same week, refused with a goal the season lacks.
 *   2. The Monday round: a person sets their own, a host types one in for
 *      somebody here, anybody else is refused.
 *   3. The priority board: kept behind the gate, put on a meeting's agenda,
 *      voted, and the order the facilitator set kept on the board, never
 *      before it is set.
 *   4. Friday reads each line back: the person or a host marks it.
 *   5. An ask's place in line: only a holder, only once taken; whoever raised
 *      it reads the place; answering it takes it off the line.
 *   6. Erasure takes a member's lines; their export carries them.
 *
 * No TEST_DATABASE_URL and the suite skips (harness rule).
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type mysql from "mysql2/promise";
import { provisionTestDb, testDbConfigured, testPool, type TestDb } from "./db/testDb";
import { register as registerRoom } from "./routes/liveSessions";
import { register as registerLibrary } from "./routes/sessionLibrary";
import { register as registerTemplates } from "./routes/sessionTemplates";
import { register as registerTensions } from "./routes/roleTensions";
import { exportMemberSessions, forgetMemberSessions } from "./lib/liveSessions";
import { seasonRefOf } from "./lib/sessionTemplates";
import { thisWeekOf } from "./lib/priorities";
import { readDoc } from "./repos/priorities";
import { PLACES_DOC, PRIORITY_REFUSALS, WEEK_DOC, addWeeks, readWeekDoc, type BoardPayload, type WeekPayload } from "../shared/priorities";
import type { SessionTemplate, TemplateRoomView } from "../shared/sessionTemplates";

type Handler = (req: any, res: any) => Promise<unknown> | unknown;

function collect(): { app: any; handlers: Map<string, Handler> } {
  const handlers = new Map<string, Handler>();
  const record = (method: string) => (p: string, handler: Handler) => {
    handlers.set(`${method} ${p}`, handler);
  };
  return {
    app: { get: record("GET"), post: record("POST"), put: record("PUT"), patch: record("PATCH"), delete: record("DELETE"), use: () => undefined },
    handlers,
  };
}

function makeRes() {
  const out: { status: number; body: any } = { status: 200, body: undefined };
  const res: any = {
    status(code: number) {
      out.status = code;
      return res;
    },
    json(body: unknown) {
      out.body = body;
      return res;
    },
    setHeader() {},
    send() {
      return res;
    },
    end() {
      return res;
    },
  };
  return { res, out };
}

const member = (id: string, name: string) => ({ id, name, handle: id.slice(2), stage: "member", membershipGranted: true });
const PEOPLE: Record<string, any> = {
  "m-ana": member("m-ana", "Ana Reyes"),
  "m-ben": member("m-ben", "Ben Ortiz"),
  "m-cai": member("m-cai", "Cai Moreno"),
};

const SEASON = {
  id: "s-one",
  name: "Season one",
  startsOn: "2026-01-01",
  goals: [{ text: "Water for every home" }, { text: "A kitchen garden" }],
};

const configured = testDbConfigured();
if (!configured) console.warn("[priorities.db] TEST_DATABASE_URL not set - DB cases SKIPPED. A skip is not a pass.");

describe.skipIf(!configured)("priorities everyone can see, on a real schema", () => {
  let db: TestDb;
  let pool: mysql.Pool;
  let handlers: Map<string, Handler>;
  let whoami: string | null = null;
  const keepers = new Set(["m-ana"]);
  const goals = seasonRefOf(SEASON)!.goals;
  const week = thisWeekOf(new Date(), "UTC");

  const q = async (sql: string, params: unknown[] = []) => (await pool.query<any[]>(sql, params))[0]; // module-review-ok: fixture SQL against the S5 scratch schema this suite provisioned, never a production table

  const as = async (who: string | null, key: string, req: any = {}) => {
    whoami = who;
    const handler = handlers.get(key);
    if (!handler) throw new Error(`no handler registered for ${key}`);
    const { res, out } = makeRes();
    await handler({ params: {}, body: {}, query: {}, headers: {}, ...req }, res);
    return out;
  };
  const ok = (out: { status: number; body: any }) => {
    expect(out.status, JSON.stringify(out.body)).toBe(200);
    return out.body;
  };
  const weekOf = async (who: string): Promise<WeekPayload> => ok(await as(who, "GET /api/session-templates/week"));
  const template = async (name: string): Promise<SessionTemplate> =>
    (ok(await as("m-ana", "GET /api/session-templates")).templates as SessionTemplate[]).find((t) => t.name === name)!;
  const openRoom = async (title: string, templateId: number): Promise<number> => {
    const id = Number(ok(await as("m-ana", "POST /api/sessions", { body: { title, circleId: "c-core", durationMin: 60, templateId } })).id);
    for (const who of ["m-ben", "m-cai"]) expect((await as(who, "POST /api/sessions/:id/join", { params: { id: String(id) } })).status).toBe(200);
    return id;
  };
  const room = async (who: string, id: number): Promise<TemplateRoomView> => ok(await as(who, "GET /api/session-templates/rooms/:sessionId", { params: { sessionId: String(id) } }));
  const roomAct = (who: string, id: number, method: "POST" | "PATCH", tail: string, body: unknown, extra: Record<string, string> = {}) =>
    as(who, `${method} /api/session-templates/rooms/:sessionId${tail}`, { params: { sessionId: String(id), ...extra }, body });

  beforeAll(async () => {
    db = await provisionTestDb();
    pool = testPool(db, { connectionLimit: 4 });
    const c = collect();
    const deps = {
      authedUser: async () => (whoami ? (PEOPLE[whoami] ?? null) : null),
      isAdmin: async () => false,
      getPool: () => pool,
      overLimit: async () => false,
      members: { byId: async (id: string) => PEOPLE[id] ?? null },
      notify: async () => ({ fresh: true }),
      notifyAdmins: async () => undefined,
      circlesRepo: { all: () => [{ id: "c-core", name: "Core circle", status: "active" }] },
      lapseContext: () => ({ currentSeasonId: null, cadence: "never" }),
      seasonState: () => ({ current: SEASON, seasons: [SEASON], timezone: "UTC" }),
      mayAct: async (_req: any, cap: string) => ({ ok: cap === "session.template" && keepers.has(whoami ?? "") }),
      guardCapability: async (_req: any, res: any, cap: string, refusal?: { status: number; body: Record<string, unknown> }) => {
        if (cap === "session.template" && keepers.has(whoami ?? "")) return true;
        res.status(refusal?.status ?? 403).json(refusal?.body ?? { error: "forbidden" });
        return false;
      },
    } as any;
    registerRoom(c.app, deps);
    registerLibrary(c.app, deps);
    registerTemplates(c.app, deps);
    registerTensions(c.app, deps);
    handlers = c.handlers;

    await q("INSERT INTO `circles` (`id`, `name`, `aliases`, `is_example`) VALUES ('c-core', 'Core circle', '[]', 0)");
    await q("INSERT INTO `org_roles` (`id`, `circle_id`, `name`, `active`, `is_example`) VALUES ('role-water', 'c-core', 'Water keeper', 1, 0), ('role-kitchen', 'c-core', 'Kitchen keeper', 1, 0)");
    await q(
      "INSERT INTO `org_role_assignments` (`id`, `org_role_id`, `holder_kind`, `user_id`, `holder_key`, `term_ends_at`) VALUES ('ora-ben', 'role-water', 'member', 'm-ben', 'm-ben', NULL)",
    );
  }, 240_000);

  afterAll(async () => {
    await pool?.end();
    await db?.drop();
  });

  it("1. a member sets their top priority for the week and the team reads it by name", async () => {
    expect((await weekOf("m-ana")).mine).toBeNull();
    const bad = await as("m-ana", "PUT /api/session-templates/week", { body: { text: "Fix the tank", servesGoalId: "no-such-goal" } });
    expect(bad).toEqual({ status: 400, body: { error: PRIORITY_REFUSALS.goalUnknown } });
    expect((await as("m-ana", "PUT /api/session-templates/week", { body: { text: "  " } })).body.error).toBe(PRIORITY_REFUSALS.textNeeded);

    ok(await as("m-ana", "PUT /api/session-templates/week", { body: { text: "Fix the tank", servesGoalId: goals[0].id } }));
    // The same week again replaces the line: one line a week, never two.
    const set = ok(await as("m-ana", "PUT /api/session-templates/week", { body: { text: "Fix the big tank", servesGoalId: goals[0].id } })) as WeekPayload;
    expect(set.weekOf).toBe(week);
    expect(set.mine).toMatchObject({ text: "Fix the big tank", servesGoal: "Water for every home", weekOf: week, outcome: null });

    const ben = await weekOf("m-ben");
    expect(ben.mine).toBeNull();
    expect(ben.team).toEqual([expect.objectContaining({ name: "Ana Reyes", thisWeek: true, line: expect.objectContaining({ text: "Fix the big tank" }) })]);
    // The team view carries names and never an id or a member number.
    expect(JSON.stringify(ben.team)).not.toMatch(/m-ana|"no"/);
  });

  let monday = 0;

  it("2. the Monday round: a person sets their own line, a host types one in for somebody here, nobody else does", async () => {
    const t = await template("Monday planning");
    expect(t.flow.map((s) => s.kind)).toEqual(expect.arrayContaining(["top_priorities", "priority_vote"]));
    monday = await openRoom("Monday, week 1", t.id);

    ok(await roomAct("m-cai", monday, "POST", "/tops", { text: "Plant the beds", servesGoalId: goals[1].id }));
    const refused = await roomAct("m-cai", monday, "POST", "/tops", { text: "Ben does the tank", forNo: 999 });
    expect(refused.status).toBe(403);
    expect(refused.body.error).toBe(PRIORITY_REFUSALS.ownOnly);

    const view = await room("m-ana", monday);
    const benNo = view.here.find((p) => p.name === "Ben Ortiz")!.no;
    // Ana opened the room, so she facilitates and may type Ben's in.
    const typed = ok(await roomAct("m-ana", monday, "POST", "/tops", { text: "Mend the fence", forNo: benNo })) as TemplateRoomView;
    const lines = Object.fromEntries((typed.tops?.people ?? []).map((p) => [p.name, p.line?.text ?? null]));
    expect(lines).toEqual({ "Ana Reyes": "Fix the big tank", "Ben Ortiz": "Mend the fence", "Cai Moreno": "Plant the beds" });
    // A line captured in the room names the session; the profile's names none.
    const doc = readWeekDoc(await readDoc(pool, WEEK_DOC));
    expect(Object.values(doc.lines).flat().map((l) => l.sessionId).sort()).toEqual([monday, monday, null].sort());
  });

  it("3. the board is kept behind the gate, voted in a meeting, and keeps the order the facilitator set", async () => {
    const refused = await as("m-cai", "POST /api/session-templates/board", { body: { text: "A rain tank" } });
    expect(refused).toEqual({ status: 403, body: { error: PRIORITY_REFUSALS.mayNotKeep } });
    expect((await as("m-ana", "POST /api/session-templates/board", { body: { text: "A rain tank", ownerRoleId: "role-nope" } })).body.error).toBe(PRIORITY_REFUSALS.roleUnknown);

    ok(await as("m-ana", "POST /api/session-templates/board", { body: { text: "A rain tank", servesGoalId: goals[0].id, ownerRoleId: "role-water" } }));
    ok(await as("m-ana", "POST /api/session-templates/board", { body: { text: "Seed library", servesGoalId: goals[1].id } }));
    const third = ok(await as("m-ana", "POST /api/session-templates/board", { body: { text: "Compost bays", ownerRoleId: "role-kitchen" } })) as BoardPayload;
    expect(third.items.map((i) => [i.place, i.text, i.ownerRole, i.status])).toEqual([
      [1, "A rain tank", "Water keeper", "not_started"],
      [2, "Seed library", null, "not_started"],
      [3, "Compost bays", "Kitchen keeper", "not_started"],
    ]);
    const compost = third.items[2].id;
    const underWay = ok(await as("m-ana", "PATCH /api/session-templates/board/:id", { params: { id: String(third.items[1].id) }, body: { status: "under_way" } })) as BoardPayload;
    expect(underWay.items[1].status).toBe("under_way");
    expect((await as("m-ana", "PATCH /api/session-templates/board/:id", { params: { id: String(compost) }, body: { status: "finished" } })).body.error).toBe(PRIORITY_REFUSALS.status);

    // A member who may not keep it reads it all the same, with no roles to pick from.
    const read = ok(await as("m-cai", "GET /api/session-templates/board")) as BoardPayload;
    expect(read.mayKeep).toBe(false);
    expect(read.roles).toEqual([]);
    expect(read.items).toHaveLength(3);

    // Only a host puts it on the agenda.
    expect((await roomAct("m-cai", monday, "POST", "/board", { act: "agenda" })).status).toBe(403);
    const onAgenda = ok(await roomAct("m-ana", monday, "POST", "/board", { act: "agenda" })) as TemplateRoomView;
    expect(onAgenda.board?.onAgenda).toBe(3);
    // Twice puts nothing on twice.
    expect((await roomAct("m-ana", monday, "POST", "/board", { act: "agenda" })).body.error).toBe(PRIORITY_REFUSALS.nothingToVote);

    // Keeping before the facilitator sets the order is refused: the board never takes a score.
    expect((await roomAct("m-ana", monday, "POST", "/board", { act: "keep" })).body.error).toBe(PRIORITY_REFUSALS.setOrderFirst);

    const items = (await q("SELECT `id`, `title` FROM `live_session_items` WHERE `session_id` = ? ORDER BY `position`", [monday])) as { id: number; title: string }[];
    const compostItem = items.find((i) => i.title === "Compost bays")!.id;
    for (const who of ["m-ana", "m-ben", "m-cai"]) {
      expect((await as(who, "POST /api/sessions/:id/items/:itemId/vote", { params: { id: String(monday), itemId: String(compostItem) }, body: { vote: 1 } })).status).toBe(200);
    }
    expect((await as("m-ana", "POST /api/sessions/:id/agenda/order", { params: { id: String(monday) }, body: { set: true } })).status).toBe(200);
    const kept = ok(await roomAct("m-ana", monday, "POST", "/board", { act: "keep" })) as TemplateRoomView;
    expect(kept.board?.items.map((i) => i.text)).toEqual(["Compost bays", "A rain tank", "Seed library"]);
    const after = ok(await as("m-ben", "GET /api/session-templates/board")) as BoardPayload;
    expect(after.items.map((i) => [i.place, i.text])).toEqual([
      [1, "Compost bays"],
      [2, "A rain tank"],
      [3, "Seed library"],
    ]);
  });

  it("4. Friday reads each line back: the person or a host marks it", async () => {
    const friday = await openRoom("Friday, week 1", (await template("Friday check-in")).id);
    const view = await room("m-ben", friday);
    expect(view.tops?.people.map((p) => p.line?.text).sort()).toEqual(["Fix the big tank", "Mend the fence", "Plant the beds"]);
    const benNo = view.here.find((p) => p.name === "Ben Ortiz")!.no;
    const caiNo = view.here.find((p) => p.name === "Cai Moreno")!.no;

    expect((await roomAct("m-cai", friday, "PATCH", "/tops/:no", { outcome: "done" }, { no: String(benNo) })).body.error).toBe(PRIORITY_REFUSALS.ownOnly);
    ok(await roomAct("m-ben", friday, "PATCH", "/tops/:no", { outcome: "done" }, { no: String(benNo) }));
    expect((await roomAct("m-ben", friday, "PATCH", "/tops/:no", { outcome: "maybe" }, { no: String(benNo) })).body.error).toBe(PRIORITY_REFUSALS.outcome);
    const marked = ok(await roomAct("m-ana", friday, "PATCH", "/tops/:no", { outcome: "carried" }, { no: String(caiNo) })) as TemplateRoomView;
    const outcomes = Object.fromEntries((marked.tops?.people ?? []).map((p) => [p.name, p.line?.outcome ?? null]));
    expect(outcomes).toEqual({ "Ana Reyes": null, "Ben Ortiz": "done", "Cai Moreno": "carried" });
    // A carried line stays the person's line until they set a new one.
    expect((await weekOf("m-cai")).mine).toMatchObject({ text: "Plant the beds", outcome: "carried" });
    // The Monday template has no read-back section, so it marks nothing.
    expect((await roomAct("m-ben", monday, "PATCH", "/tops/:no", { outcome: "done" }, { no: String(benNo) })).body.error).toBe(PRIORITY_REFUSALS.noSection);
  });

  it("5. an ask's place in line: a holder says it once taken, whoever raised it reads it, an answer takes it off", async () => {
    const raised = await as("m-cai", "POST /api/roles/:id/tensions", { params: { id: "role-water" }, body: { text: "The tank by the kitchen leaks." } });
    expect(raised.status, JSON.stringify(raised.body)).toBe(201);
    const id = raised.body.tension.id as string;
    const place = (who: string, body: unknown) => as(who, "POST /api/role-tensions/:id/place", { params: { id }, body });

    expect((await place("m-ben", { position: 3 })).body.error).toBe(PRIORITY_REFUSALS.takeFirst);
    expect((await as("m-ben", "POST /api/role-tensions/:id/respond", { params: { id }, body: { action: "take" } })).status).toBe(200);
    // Someone who does not hold the role cannot place it.
    expect((await place("m-ana", { position: 3 })).status).toBe(403);
    expect((await place("m-ben", { position: 0 })).body.error).toBe(PRIORITY_REFUSALS.position);
    expect((await place("m-ben", { position: 3, inWeeks: 99 })).body.error).toBe(PRIORITY_REFUSALS.inWeeks);

    expect(ok(await place("m-ben", { position: 14, inWeeks: 4 })).place).toEqual({ position: 14, expectWeek: addWeeks(week, 4) });
    // Leaving the week out keeps it.
    expect(ok(await place("m-ben", { position: 12 })).place).toEqual({ position: 12, expectWeek: addWeeks(week, 4) });

    const asks = ok(await as("m-cai", "GET /api/role-tensions/raised")).asks;
    expect(asks).toEqual([expect.objectContaining({ id, role: "Water keeper", status: "taken", place: { position: 12, expectWeek: addWeeks(week, 4) } })]);
    // The holder's own row carries it too.
    const mine = ok(await as("m-ben", "GET /api/role-tensions/mine")).tensions;
    expect(mine[0].place).toEqual({ position: 12, expectWeek: addWeeks(week, 4) });
    // Nobody else reads another member's asks.
    expect(ok(await as("m-ana", "GET /api/role-tensions/raised")).asks).toEqual([]);

    expect((await as("m-ben", "POST /api/role-tensions/:id/respond", { params: { id }, body: { action: "answer", note: "Fixed." } })).status).toBe(200);
    expect(ok(await as("m-cai", "GET /api/role-tensions/raised")).asks).toEqual([]);
    expect((await readDoc(pool, PLACES_DOC)) as Record<string, unknown>).not.toHaveProperty(id);
  });

  it("6. a member's lines come with their export and go with them on erasure", async () => {
    const out = await exportMemberSessions(pool, "m-cai");
    expect(out.weekPriorities).toEqual([expect.objectContaining({ weekOf: week, text: "Plant the beds", outcome: "carried" })]);
    await forgetMemberSessions(pool, "m-cai", async (id) => PEOPLE[id] ?? null);
    const doc = readWeekDoc(await readDoc(pool, WEEK_DOC));
    expect(Object.values(doc.lines).flat().map((l) => l.text).sort()).toEqual(["Fix the big tank", "Mend the fence"]);
    expect((await weekOf("m-ana")).team.map((t) => t.name)).toEqual(["Ana Reyes", "Ben Ortiz"]);
  });
});
