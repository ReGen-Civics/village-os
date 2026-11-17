/**
 * A circle's own calendar, read through a title word (0401), against a real
 * schema and through the real doors. A calendar that holds more than the
 * circle's meetings ("Dentist" beside "Anchor steward sync") is attached with
 * a filter, so only the events titled with the word become the circle's
 * meetings: under Coming up, and in what a follower's feed carries. The filter
 * changes without the address, and the address is never handed back.
 *
 * Reading the calendar goes through the rhythm module's test seam
 * (`fetchCalendarText`); the address is a public address literal, so the
 * outbound guard passes it without asking DNS. The village holds a secrets
 * key for the suite, since an address is sealed before it is kept.
 *
 * No TEST_DATABASE_URL and the suite skips (harness rule).
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type mysql from "mysql2/promise";
import { provisionTestDb, testDbConfigured, testPool, type TestDb } from "./db/testDb";
import { loadModuleSettings } from "./lib/modules";
import { loadSecrets } from "./lib/secrets";
import { importedRowsFor, ownCalendars } from "./lib/circleOwnCalendar";
import { register as registerRoom } from "./routes/liveSessions";
import { register as registerLibrary } from "./routes/sessionLibrary";
import { register as registerRhythm } from "./routes/sessionRhythm";
import { OWN_CALENDAR_REFUSALS } from "../shared/sessionCalendar";
import type { ComingUpRow } from "../shared/sessionRhythm";

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
};

const DAY_MS = 86_400_000;
const URL = "https://8.8.8.8/shared-team.ics";
const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
const at = (days: number, hour: number) => {
  const d = new Date(Date.now() + days * DAY_MS);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), hour, 0));
};
const event = (uid: string, title: string, start: Date, minutes: number) => [
  "BEGIN:VEVENT",
  `UID:${uid}`,
  `DTSTAMP:${stamp(new Date("2026-10-01T00:00:00Z"))}`,
  `DTSTART:${stamp(start)}`,
  `DTEND:${stamp(new Date(start.getTime() + minutes * 60_000))}`,
  `SUMMARY:${title}`,
  "END:VEVENT",
];

const configured = testDbConfigured();

describe.skipIf(!configured)("a circle's own calendar read through a title word", () => {
  let db: TestDb;
  let pool: mysql.Pool;
  let handlers: Map<string, Handler>;
  let whoami: string | null = null;
  const CIRCLES = [{ id: "c-anchor", name: "Anchor circle", status: "active" }];
  const dentist = at(1, 9);
  const sync = at(2, 13);
  const serving = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//village test//EN",
    ...event("dentist@test", "Dentist", dentist, 60),
    ...event("sync@test", "Anchor Steward Sync", sync, 120),
    "END:VCALENDAR",
    "",
  ].join("\r\n");

  const q = async (sql: string, params: unknown[] = []) => (await pool.query<any[]>(sql, params))[0]; // module-review-ok: fixture SQL against the S5 scratch schema this suite provisioned, never a production table
  const as = async (who: string | null, key: string, req: any = {}) => {
    whoami = who;
    const handler = handlers.get(key);
    if (!handler) throw new Error(`no handler registered for ${key}`);
    const { res, out } = makeRes();
    await handler({ params: {}, body: {}, query: {}, headers: {}, ...req }, res);
    return out;
  };
  const anchorRow = async (): Promise<ComingUpRow | undefined> =>
    (await as("m-cai", "GET /api/sessions")).body.comingUp.rows.find((r: ComingUpRow) => r.circleId === "c-anchor");
  const filter = (who: string, titleFilter: unknown) => as(who, "PATCH /api/sessions/circles/:circleId/calendar", { params: { circleId: "c-anchor" }, body: { titleFilter } });

  beforeAll(async () => {
    db = await provisionTestDb();
    pool = testPool(db, { connectionLimit: 4 });
    await q("INSERT INTO `module_settings` (`module_id`, `lifecycle`) VALUES ('sessions', 'members')"); // module-review-ok: turns Live Sessions on in the scratch schema this suite provisioned
    await loadModuleSettings(pool);
    process.env.VILLAGE_SECRETS_KEY = "d5".repeat(32);
    await loadSecrets(pool);
    const c = collect();
    const deps = {
      authedUser: async () => (whoami ? { ...(PEOPLE[whoami] ?? { id: whoami }), id: whoami } : null),
      isAdmin: async () => false,
      getPool: () => pool,
      overLimit: async () => false,
      members: { byId: async (id: string) => PEOPLE[id] ?? null },
      notify: async () => ({ fresh: true }),
      notifyAdmins: async () => undefined,
      circlesRepo: { all: () => CIRCLES },
      lapseContext: () => ({ currentSeasonId: null, cadence: "never" }),
      fetchCalendarText: async () => serving,
    } as any;
    registerRoom(c.app, deps);
    registerLibrary(c.app, deps);
    registerRhythm(c.app, deps);
    handlers = c.handlers;
    await q("INSERT INTO `org_roles` (`id`, `circle_id`, `name`, `active`, `is_example`) VALUES ('seat-steward', 'c-anchor', 'Steward', 1, 0)");
    await q(
      "INSERT INTO `org_role_assignments` (`id`, `org_role_id`, `holder_kind`, `user_id`, `holder_key`, `term_ends_at`) VALUES ('ora-cai', 'seat-steward', 'member', 'm-cai', 'm-cai', NULL)",
    );
  }, 240_000);

  afterAll(async () => {
    await pool?.end();
    await db?.drop();
  });

  it("attaches a mixed calendar with a title word, and only the events titled with it become the circle's meetings", async () => {
    const out = await as("m-cai", "PUT /api/sessions/circles/:circleId/calendar", { params: { circleId: "c-anchor" }, body: { url: URL, titleFilter: "steward sync" } });
    expect(out.status, JSON.stringify(out.body)).toBe(200);
    expect(out.body.ownCalendar).toMatchObject({ host: "8.8.8.8", titleFilter: "steward sync" });
    // The sooner event is the dentist; the word passes it by. Case does not matter.
    expect(out.body.row).toMatchObject({ nextFrom: "calendar", nextTitle: "Anchor Steward Sync", next: { at: sync.toISOString() }, durationMin: 120 });
    expect(JSON.stringify(out.body)).not.toContain("shared-team.ics");
    expect(await q("SELECT `title_filter` FROM `live_session_circle_calendars`")).toEqual([{ title_filter: "steward sync" }]);
    // A follower's feed carries the circle's meetings only.
    const rows = await importedRowsFor(pool, await ownCalendars(pool), "all", new Date(Date.now() - DAY_MS), new Date(Date.now() + 10 * DAY_MS));
    expect(rows.map((r) => r.title)).toEqual(["Anchor Steward Sync"]);
  });

  it("changes the word without the address, for the circle's members only", async () => {
    expect(await filter("m-eve", "")).toMatchObject({ status: 403, body: { error: OWN_CALENDAR_REFUSALS.notYours } });
    const cleared = await filter("m-cai", "");
    expect(cleared.status, JSON.stringify(cleared.body)).toBe(200);
    expect(cleared.body.ownCalendar.titleFilter).toBeNull();
    // With no word, every timed event counts again, as before 0401: the dentist comes first.
    expect(cleared.body.row).toMatchObject({ nextTitle: "Dentist", next: { at: dentist.toISOString() } });
    expect(JSON.stringify(cleared.body)).not.toContain("shared-team.ics");
    expect((await filter("m-cai", "Sync")).body.row).toMatchObject({ nextTitle: "Anchor Steward Sync" });
    expect((await anchorRow())?.nextTitle).toBe("Anchor Steward Sync");
    // A word nothing holds leaves the circle with nothing coming from the calendar.
    expect((await filter("m-cai", "harvest")).body.row).toBeNull();
  });

  it("refuses a filter for a circle with no calendar attached", async () => {
    await as("m-cai", "DELETE /api/sessions/circles/:circleId/calendar", { params: { circleId: "c-anchor" } });
    expect(await filter("m-cai", "sync")).toMatchObject({ status: 404, body: { error: OWN_CALENDAR_REFUSALS.noneAttached } });
  });
});
