/**
 * Several named rhythms per circle (0401), against a real schema, through the
 * real doors: a circle that meets twice a week, an agenda item for one of the
 * two meetings, skips kept per rhythm, the day-before notice for each, the
 * village calendar mirror, and the single rhythm a circle kept before 0401
 * still read and changed the way an older page sends it.
 *
 * THE CASES RUN IN ORDER and share one story: the anchor circle has the one
 * rhythm the previous release wrote (a weekly meeting three days out at
 * 13:00), adds a named second one (tomorrow's weekday at 12:00), brings an
 * item for each, hears the day before each, skips one meeting of each, is
 * mirrored onto the village calendar, and stops the second.
 *
 * No TEST_DATABASE_URL and the suite skips (harness rule).
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type mysql from "mysql2/promise";
import { provisionTestDb, testDbConfigured, testPool, type TestDb } from "./db/testDb";
import { loadModuleSettings } from "./lib/modules";
import { runComingUpNotes } from "./lib/sessionRhythm";
import { mirrorRhythms } from "./lib/sessionCalendar";
import { register as registerRoom } from "./routes/liveSessions";
import { register as registerLibrary } from "./routes/sessionLibrary";
import { liveCircles, register as registerRhythm } from "./routes/sessionRhythm";
import { MIRROR_SOURCE } from "../shared/sessionCalendar";
import { LIBRARY_REFUSALS } from "../shared/sessionLibrary";
import { MAIN_RHYTHM, RHYTHM_LIMITS, RHYTHM_NOTICES, RHYTHM_REFUSALS, WEEKDAYS, type ComingUpRow } from "../shared/sessionRhythm";

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

const PEOPLE: Record<string, any> = {
  "m-cai": { id: "m-cai", name: "Cai Moreno", email: "cai@village.example.test" },
  "m-eve": { id: "m-eve", name: "Eve Strand", email: "eve@village.example.test" },
  "m-founder": { id: "m-founder", name: "Founding Admin", role: "admin", email: "founder@village.example.test" },
};

const DAY_MS = 86_400_000;
const dayFromNow = (days: number) => new Date(Date.now() + days * DAY_MS).toISOString().slice(0, 10);
const weekdayIn = (days: number) => new Date(Date.now() + days * DAY_MS).getUTCDay();

const configured = testDbConfigured();

describe.skipIf(!configured)("several named rhythms per circle against a real schema", () => {
  let db: TestDb;
  let pool: mysql.Pool;
  let handlers: Map<string, Handler>;
  let whoami: string | null = null;
  const notices: any[] = [];
  const CIRCLES = [{ id: "c-anchor", name: "Anchor circle", status: "active" }];
  const circles = () => liveCircles({ all: () => CIRCLES } as any);
  /** The second rhythm's key, once it is added. */
  let monday = "";
  /** The two items: one for the second rhythm's meeting, one for any meeting. */
  let forMonday = 0;
  let forAny = 0;

  const q = async (sql: string, params: unknown[] = []) => (await pool.query<any[]>(sql, params))[0]; // module-review-ok: fixture SQL against the S5 scratch schema this suite provisioned, never a production table

  const as = async (who: string | null, key: string, req: any = {}) => {
    whoami = who;
    const handler = handlers.get(key);
    if (!handler) throw new Error(`no handler registered for ${key}`);
    const { res, out } = makeRes();
    await handler({ params: {}, body: {}, query: {}, headers: {}, ...req }, res);
    return out;
  };
  const anchorRow = async (who = "m-cai"): Promise<ComingUpRow> => {
    const out = await as(who, "GET /api/sessions");
    expect(out.status, JSON.stringify(out.body)).toBe(200);
    return out.body.comingUp.rows.find((r: ComingUpRow) => r.circleId === "c-anchor");
  };
  const put = (who: string, body: Record<string, unknown>) => as(who, "PUT /api/sessions/circles/:circleId/rhythm", { params: { circleId: "c-anchor" }, body });
  const add = (who: string, body: Record<string, unknown>) => as(who, "POST /api/sessions/circles/:circleId/rhythms", { params: { circleId: "c-anchor" }, body });
  const skip = (who: string, body: Record<string, unknown>) => as(who, "POST /api/sessions/circles/:circleId/rhythm/skip", { params: { circleId: "c-anchor" }, body });
  const jobDeps = () => ({
    circles,
    lapseContext: () => ({ currentSeasonId: null, cadence: "never" }) as any,
    getPool: () => pool as any,
    notify: async (n: any) => {
      notices.push(n);
      return { fresh: true };
    },
    window: () => ({ start: 0, end: 24 }),
    lifecycle: () => "members",
  });

  beforeAll(async () => {
    db = await provisionTestDb();
    pool = testPool(db, { connectionLimit: 4 });
    await q("INSERT INTO `module_settings` (`module_id`, `lifecycle`) VALUES ('sessions', 'members')"); // module-review-ok: turns Live Sessions on in the scratch schema this suite provisioned, since the mirror measures the module's state
    await loadModuleSettings(pool);
    const c = collect();
    const deps = {
      authedUser: async () => (whoami ? { ...(PEOPLE[whoami] ?? { id: whoami }), id: whoami } : null),
      isAdmin: async () => whoami === "m-founder",
      getPool: () => pool,
      overLimit: async () => false,
      members: { byId: async (id: string) => PEOPLE[id] ?? null },
      notify: async () => ({ fresh: true }),
      notifyAdmins: async () => undefined,
      circlesRepo: { all: () => CIRCLES },
      lapseContext: () => ({ currentSeasonId: null, cadence: "never" }),
    } as any;
    registerRoom(c.app, deps);
    registerLibrary(c.app, deps);
    registerRhythm(c.app, deps);
    handlers = c.handlers;
    // Cai keeps the anchor circle's steward seat: a member of it by standing.
    await q("INSERT INTO `org_roles` (`id`, `circle_id`, `name`, `active`, `is_example`) VALUES ('seat-steward', 'c-anchor', 'Steward', 1, 0)");
    await q(
      "INSERT INTO `org_role_assignments` (`id`, `org_role_id`, `holder_kind`, `user_id`, `holder_key`, `term_ends_at`) VALUES ('ora-cai', 'seat-steward', 'member', 'm-cai', 'm-cai', NULL)",
    );
    // The row the PREVIOUS release wrote: its own column list, no name, so the 0401 default applies.
    const rec = JSON.stringify({ freq: "weekly", byWeekday: [weekdayIn(3)], interval: 1 });
    await q(
      "INSERT INTO `live_session_rhythms` (`circle_id`, `kind`, `recurrence`, `starts_on`, `time_of_day`, `duration_min`, `set_by_no`, `created_at`, `updated_at`) " +
        "VALUES ('c-anchor', 'weekly', ?, ?, '13:00', 60, 0, NOW(), NOW())",
      [rec, dayFromNow(3)],
    );
  }, 240_000);

  afterAll(async () => {
    await pool?.end();
    await db?.drop();
  });

  it("reads the rhythm the previous release kept as the circle's first, and an older page's change keeps it", async () => {
    const row = await anchorRow();
    expect(row.rhythms).toHaveLength(1);
    expect(row.rhythms![0]).toMatchObject({ key: MAIN_RHYTHM, name: "", words: `Every ${WEEKDAYS[weekdayIn(3)]} at 13:00` });
    expect(row).toMatchObject({ rhythmWords: `Every ${WEEKDAYS[weekdayIn(3)]} at 13:00`, nextRhythmKey: MAIN_RHYTHM, next: { key: dayFromNow(3) } });
    expect(row.rhythm).toMatchObject({ kind: "weekly", weekday: weekdayIn(3), time: "13:00", startsOn: dayFromNow(3) });
    // A name, given once, is kept by an older page's save, which never sends one.
    expect((await put("m-cai", { kind: "weekly", weekday: weekdayIn(3), everyWeeks: 1, time: "13:00", durationMin: 60, name: "Thursday steward sync" })).status).toBe(200);
    const older = await put("m-cai", { kind: "weekly", weekday: weekdayIn(3), everyWeeks: 1, time: "13:00", durationMin: 120 });
    expect(older.status, JSON.stringify(older.body)).toBe(200);
    expect(await q("SELECT `name`, `duration_min`, `starts_on` FROM `live_session_rhythms` WHERE `circle_id` = 'c-anchor'")).toEqual([
      { name: "Thursday steward sync", duration_min: 120, starts_on: dayFromNow(3) },
    ]);
    expect(await q("SELECT COUNT(*) AS n FROM `live_session_more_rhythms`")).toEqual([{ n: 0 }]);
  });

  it("adds a second named rhythm, and Coming up shows the sooner meeting with both listed, soonest first", async () => {
    expect((await add("m-eve", { kind: "weekly", weekday: weekdayIn(1), everyWeeks: 1, time: "12:00" })).body.error).toBe(RHYTHM_REFUSALS.notYours);
    expect((await add("m-cai", { kind: "none" })).status).toBe(400);
    const out = await add("m-cai", { kind: "weekly", weekday: weekdayIn(1), everyWeeks: 1, time: "12:00", durationMin: 90, name: "Monday all-staff" });
    expect(out.status, JSON.stringify(out.body)).toBe(200);
    monday = out.body.rhythmKey;
    expect(monday).toMatch(/^r[0-9a-f]{10}$/);
    const row: ComingUpRow = out.body.row;
    expect(row).toMatchObject({ next: { key: dayFromNow(1) }, nextRhythmKey: monday, nextName: "Monday all-staff", durationMin: 90 });
    expect(row.rhythms!.map((l) => [l.key, l.name, l.next?.key])).toEqual([
      [monday, "Monday all-staff", dayFromNow(1)],
      [MAIN_RHYTHM, "Thursday steward sync", dayFromNow(3)],
    ]);
    expect(row.rhythmWords).toBe(
      `Monday all-staff: Every ${WEEKDAYS[weekdayIn(1)]} at 12:00; Thursday steward sync: Every ${WEEKDAYS[weekdayIn(3)]} at 13:00`,
    );
    // An older page still reads `rhythm` as the circle's first rhythm, and `rhythmNext` as the soonest meeting.
    expect(row.rhythm).toMatchObject({ kind: "weekly", weekday: weekdayIn(3), time: "13:00" });
    expect(row.rhythmNext?.key).toBe(dayFromNow(1));
    // The summary on the circle's home page lists both.
    const summary = await as("m-eve", "GET /api/sessions/circles/:circleId/summary", { params: { circleId: "c-anchor" } });
    expect(summary.body.rhythms.map((r: any) => r.name)).toEqual(["Monday all-staff", "Thursday steward sync"]);
    expect(summary.body.next.key).toBe(dayFromNow(1));
  });

  it("keeps at most the limit of rhythms per circle", async () => {
    const extra: string[] = [];
    for (let i = 2; i < RHYTHM_LIMITS.perCircle; i += 1) {
      const out = await add("m-cai", { kind: "weekly", weekday: weekdayIn(5), everyWeeks: 2, time: `0${i}:00` });
      expect(out.status, JSON.stringify(out.body)).toBe(200);
      extra.push(out.body.rhythmKey);
    }
    expect(await add("m-cai", { kind: "weekly", weekday: weekdayIn(5), everyWeeks: 1, time: "09:00" })).toMatchObject({
      status: 409,
      body: { error: RHYTHM_REFUSALS.tooMany },
    });
    // Each one stops alone, by its key; the circle's others stay.
    for (const key of extra) expect((await put("m-cai", { kind: "none", rhythmKey: key })).status).toBe(200);
    expect((await anchorRow()).rhythms!.map((l) => l.key)).toEqual([monday, MAIN_RHYTHM]);
    expect((await put("m-cai", { kind: "weekly", weekday: 1, everyWeeks: 1, time: "09:00", rhythmKey: "nope" })).status).toBe(404);
  });

  it("lets an agenda item wait for one of the meetings, and counts it there only", async () => {
    const bad = await as("m-cai", "POST /api/sessions/library", { body: { title: "Payroll", circleId: "c-anchor", rhythmKey: "rzzzz" } });
    expect(bad).toMatchObject({ status: 400, body: { error: LIBRARY_REFUSALS.meetingUnknown } });
    expect((await as("m-cai", "POST /api/sessions/library", { body: { title: "Payroll", rhythmKey: monday } })).status).toBe(400);
    const one = await as("m-cai", "POST /api/sessions/library", { body: { title: "Staff rota", circleId: "c-anchor", rhythmKey: monday } });
    expect(one.status, JSON.stringify(one.body)).toBe(200);
    expect(one.body.item).toMatchObject({ rhythmKey: monday, rhythmName: "Monday all-staff" });
    forMonday = one.body.item.id;
    const any = await as("m-cai", "POST /api/sessions/library", { body: { title: "Water report", circleId: "c-anchor" } });
    expect(any.body.item).toMatchObject({ rhythmKey: null });
    forAny = any.body.item.id;
    // An item for any meeting reads as one before 0401 did: '' in the column.
    expect(await q("SELECT `id`, `rhythm_key` FROM `live_session_library` ORDER BY `id`")).toEqual([
      { id: forMonday, rhythm_key: monday },
      { id: forAny, rhythm_key: "" },
    ]);
    const row = await anchorRow();
    expect(row.waiting).toBe(2);
    expect(Object.fromEntries(row.rhythms!.map((l) => [l.key, l.waiting]))).toEqual({ [monday]: 2, [MAIN_RHYTHM]: 1 });
    // Its hosts move it to the other meeting; the counts follow.
    expect((await as("m-cai", "PATCH /api/sessions/library/:itemId", { params: { itemId: String(forMonday) }, body: { rhythmKey: MAIN_RHYTHM } })).status).toBe(200);
    expect(Object.fromEntries((await anchorRow()).rhythms!.map((l) => [l.key, l.waiting]))).toEqual({ [monday]: 1, [MAIN_RHYTHM]: 2 });
    expect((await as("m-cai", "PATCH /api/sessions/library/:itemId", { params: { itemId: String(forMonday) }, body: { rhythmKey: monday } })).status).toBe(200);
  });

  it("tells the circle the day before each meeting, by its name, with what waits for that one", async () => {
    const row = await anchorRow();
    const byKey = new Map(row.rhythms!.map((l) => [l.key, l.next!]));
    notices.length = 0;
    const beforeMonday = new Date(Date.parse(byKey.get(monday)!.at) - 2 * 3_600_000);
    await runComingUpNotes(jobDeps(), beforeMonday);
    expect(notices.map((n) => [n.userId, n.title, n.body])).toEqual([
      ["m-cai", RHYTHM_NOTICES.comingUpNamed("Anchor circle", "today at 12:00", "Monday all-staff"), RHYTHM_NOTICES.agenda(["Staff rota", "Water report"], 0)],
    ]);
    notices.length = 0;
    const beforeThursday = new Date(Date.parse(byKey.get(MAIN_RHYTHM)!.at) - 2 * 3_600_000);
    await runComingUpNotes(jobDeps(), beforeThursday);
    expect(notices.map((n) => [n.title, n.body])).toEqual([
      [RHYTHM_NOTICES.comingUpNamed("Anchor circle", "today at 13:00", "Thursday steward sync"), RHYTHM_NOTICES.agenda(["Water report"], 0)],
    ]);
    // The key of the first rhythm's notice is the one it always was, so nobody hears twice across the release.
    expect(notices[0].dedupeKey).toBe(`session-coming:c-anchor:${dayFromNow(3)}T13:00:m-cai`);
  });

  it("keeps each rhythm's skips its own, and an older page's skip finds the rhythm by its date", async () => {
    expect((await skip("m-cai", { key: dayFromNow(1), rhythmKey: "rnope" })).status).toBe(404);
    // A Monday skip named on the Thursday rhythm is no meeting of it.
    expect((await skip("m-cai", { key: dayFromNow(1), rhythmKey: MAIN_RHYTHM })).status).toBe(409);
    const named = await skip("m-cai", { key: dayFromNow(1), rhythmKey: monday });
    expect(named.status, JSON.stringify(named.body)).toBe(200);
    // The next meeting is now the Thursday sync: the Monday one moved a week on, the Thursday one did not move.
    expect(named.body.row).toMatchObject({ next: { key: dayFromNow(3) }, nextRhythmKey: MAIN_RHYTHM });
    const older = await skip("m-cai", { key: dayFromNow(3) });
    expect(older.status, JSON.stringify(older.body)).toBe(200);
    const rows = await q("SELECT `recurrence` FROM `live_session_rhythms` WHERE `circle_id` = 'c-anchor'");
    const more = await q("SELECT `recurrence` FROM `live_session_more_rhythms` WHERE `circle_id` = 'c-anchor'");
    expect(JSON.parse(rows[0].recurrence).exceptions).toEqual([dayFromNow(3)]);
    expect(JSON.parse(more[0].recurrence).exceptions).toEqual([dayFromNow(1)]);
    const row = await anchorRow();
    expect(Object.fromEntries(row.rhythms!.map((l) => [l.key, l.next?.key]))).toEqual({ [monday]: dayFromNow(8), [MAIN_RHYTHM]: dayFromNow(10) });
  });

  it("mirrors each rhythm onto the village calendar as its own gathering, the first under its old id", async () => {
    expect(await mirrorRhythms(pool, { circles, lifecycle: () => "members" })).toMatchObject({ written: 2 });
    // The four rhythms stopped above are retired rows; the two that keep meeting are live.
    const mirrored = await q("SELECT `source_id`, `title`, `removed_at` FROM `events` WHERE `source_module` = ? AND `removed_at` IS NULL ORDER BY `source_id`", [MIRROR_SOURCE]);
    expect(mirrored).toEqual([
      { source_id: "c-anchor", title: "Anchor circle: Thursday steward sync", removed_at: null },
      { source_id: `c-anchor~${monday}`, title: "Anchor circle: Monday all-staff", removed_at: null },
    ]);
  });

  it("stops one rhythm alone, and its items wait for the circle's next meeting again", async () => {
    const out = await put("m-cai", { kind: "none", rhythmKey: monday });
    expect(out.status, JSON.stringify(out.body)).toBe(200);
    expect(out.body.row.rhythms.map((l: any) => l.key)).toEqual([MAIN_RHYTHM]);
    const lib = (await as("m-cai", "GET /api/sessions")).body.library.items;
    expect(lib.find((i: any) => i.id === forMonday)).toMatchObject({ rhythmKey: null, rhythmName: null });
    expect((await anchorRow()).rhythms![0].waiting).toBe(2);
    await mirrorRhythms(pool, { circles, lifecycle: () => "members" });
    const live = await q("SELECT `source_id` FROM `events` WHERE `source_module` = ? AND `removed_at` IS NULL", [MIRROR_SOURCE]);
    expect(live).toEqual([{ source_id: "c-anchor" }]);
    // An older page's stop names no rhythm: it stops the first, and the circle has none left.
    expect((await put("m-cai", { kind: "none" })).body.row).toBeNull();
  });
});
