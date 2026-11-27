/**
 * "I'VE READ THIS" UNDER HOW WE WORK TOGETHER FOLLOWS THE MEMBER (`GET` and `PUT /api/profile/how-we-work-read`,
 * shared/howWeWorkRead.ts; the lead, 27 Nov 2026).
 *
 * The tick is kept in the member's own `prefs`, so it survives a reload and reaches every device. The server stamps
 * the moment; `false` clears it. The route writes only the signed-in member's own row, keeps every other pref, and
 * the read never leaves the server inside a user object (`publicUser` carries named prefs only).
 *
 * Driven through the real handlers with the real users repository, on a scratch schema. No TEST_DATABASE_URL:
 * skips loudly, never passes hollowly.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import mysql from "mysql2/promise";
import { testPool, provisionTestDb, testDbConfigured, type TestDb } from "../db/testDb";
import { usersRepo } from "../repos/users";
import { publicPrefs } from "../lib/publicPrefs";
import { HOW_WE_WORK_READ_PREF } from "../../shared/howWeWorkRead";
import { register as registerProfileRoutes } from "./profile";

const configured = testDbConfigured();
if (!configured) console.warn("[profile.howWeWorkRead] TEST_DATABASE_URL not set. DB-backed tests SKIPPED. A skip is not a pass.");

let db: TestDb;
let pool: mysql.Pool;

const q = async (sql: string, params: unknown[] = []): Promise<any[]> => {
  const [rows] = await pool.query<any[]>(sql, params); // module-review-ok: fixture SQL against the S5 scratch schema, never a production table
  return rows;
};

async function seedMember(id: string, prefs: Record<string, unknown> | null = null): Promise<void> {
  await q(
    "INSERT INTO `users` (`id`, `name`, `email`, `password_hash`, `handle`, `bio`, `prefs`) VALUES (?,?,?,'x',?,'',?)", // module-review-ok: fixture SQL against the S5 scratch schema, never a production table
    [id, `Member ${id}`, `${id}@example.test`, `${id}-h`, prefs ? JSON.stringify(prefs) : null],
  );
}

async function prefsOf(id: string): Promise<any> {
  const raw = (await q("SELECT `prefs` FROM `users` WHERE `id` = ?", [id]))[0]?.prefs; // module-review-ok: fixture SQL against the S5 scratch schema, never a production table
  return typeof raw === "string" ? JSON.parse(raw) : raw;
}

type Handler = (req: any, res: any) => Promise<unknown>;

/** The two routes, as this member (or as nobody), called with plain requests. A fresh call is a fresh device. */
function routes(as: string | null) {
  const got: Record<string, Handler> = {};
  const app = {
    get: (p: string, h: Handler) => void (got[`GET ${p}`] = h),
    post: () => undefined,
    put: (p: string, h: Handler) => void (got[`PUT ${p}`] = h),
  } as any;
  registerProfileRoutes(app, {
    authedUser: (async () => (as ? usersRepo(pool).byId(as) : null)) as any,
    members: usersRepo(pool),
    publicUser: (u: any) => u,
    getPool: () => pool,
  });
  const call = async (key: string, body?: unknown) => {
    const out: { status: number; body: any } = { status: 200, body: null };
    const res: any = {
      status: (s: number) => ((out.status = s), res),
      set: () => res,
      json: (b: any) => ((out.body = b), res),
    };
    await got[key]!({ body, headers: {}, query: {} }, res);
    return out;
  };
  return {
    read: () => call("GET /api/profile/how-we-work-read"),
    tick: (read: unknown) => call("PUT /api/profile/how-we-work-read", { read }),
  };
}

describe.skipIf(!configured)("a member's read of How we work together (MySQL)", () => {
  beforeAll(async () => {
    db = await provisionTestDb();
    pool = testPool(db, { connectionLimit: 4 }); // module-review-ok: the suite's own pool onto the scratch schema it provisioned
  }, 240_000);

  afterAll(async () => {
    await pool?.end();
    await db?.drop();
  });

  it("reads null before the tick, stores the moment on it, and the next device reads the same moment", async () => {
    await seedMember("hw-ana");
    expect((await routes("hw-ana").read()).body).toEqual({ readAt: null });
    const before = Date.now();
    const ticked = await routes("hw-ana").tick(true);
    expect(ticked.status, JSON.stringify(ticked.body)).toBe(200);
    const at = Date.parse(ticked.body.readAt);
    expect(at).toBeGreaterThanOrEqual(before - 1000);
    expect(at).toBeLessThanOrEqual(Date.now() + 1000);
    // A reload, or another device, asks afresh.
    expect((await routes("hw-ana").read()).body).toEqual({ readAt: ticked.body.readAt });
  });

  it("clears the read on an untick", async () => {
    await seedMember("hw-bo");
    await routes("hw-bo").tick(true);
    expect((await routes("hw-bo").tick(false)).body).toEqual({ readAt: null });
    expect((await prefsOf("hw-bo"))?.[HOW_WE_WORK_READ_PREF]).toBeUndefined();
    expect((await routes("hw-bo").read()).body).toEqual({ readAt: null });
  });

  it("keeps every other pref the member holds, and writes only their own row", async () => {
    await seedMember("hw-cy", { displayCurrency: "EUR", speedCards: ["/map", null, null, null, null, null] });
    await seedMember("hw-di");
    await routes("hw-cy").tick(true);
    const prefs = await prefsOf("hw-cy");
    expect(prefs.displayCurrency).toBe("EUR");
    expect(prefs.speedCards).toEqual(["/map", null, null, null, null, null]);
    expect(typeof prefs[HOW_WE_WORK_READ_PREF]).toBe("string");
    expect((await prefsOf("hw-di"))?.[HOW_WE_WORK_READ_PREF]).toBeUndefined();
  });

  it("is never carried in a user object (publicUser's prefs are named ones only)", async () => {
    await seedMember("hw-ed", { locale: "es" });
    await routes("hw-ed").tick(true);
    const stored = await prefsOf("hw-ed");
    expect(stored[HOW_WE_WORK_READ_PREF]).toBeTruthy();
    const shown = publicPrefs(stored);
    expect(shown).toEqual({ locale: "es" });
    expect(Object.keys(shown ?? {})).not.toContain(HOW_WE_WORK_READ_PREF);
  });

  it("refuses anything but true or false, and writes nothing", async () => {
    await seedMember("hw-fi");
    for (const bad of ["yes", 1, null, undefined, { read: true }]) {
      const out = await routes("hw-fi").tick(bad);
      expect(out.status, `refused: ${JSON.stringify(bad)}`).toBe(400);
    }
    expect((await prefsOf("hw-fi"))?.[HOW_WE_WORK_READ_PREF]).toBeUndefined();
  });

  it("refuses a stranger", async () => {
    const nobody = routes(null);
    expect((await nobody.read()).status).toBe(401);
    expect((await nobody.tick(true)).status).toBe(401);
  });
});
