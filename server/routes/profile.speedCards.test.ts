/**
 * A MEMBER'S SPEED CARDS FOLLOW THEM (`GET` and `PUT /api/profile/speed-cards`, shared/speedCards.ts).
 *
 * The six quick cards on the phone's More sheet are kept in the member's own `prefs`, so a phone and a laptop draw
 * the same cards. The route writes only the signed-in member's own row, keeps every other pref they hold, refuses a
 * malformed list without writing, and `null` clears the list back to the defaults.
 *
 * Driven through the real handlers with the real users repository, on a scratch schema. No TEST_DATABASE_URL:
 * skips loudly, never passes hollowly.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import mysql from "mysql2/promise";
import { testPool, provisionTestDb, testDbConfigured, type TestDb } from "../db/testDb";
import { usersRepo } from "../repos/users";
import { register as registerProfileRoutes } from "./profile";

const configured = testDbConfigured();
if (!configured) console.warn("[profile.speedCards] TEST_DATABASE_URL not set. DB-backed tests SKIPPED. A skip is not a pass.");

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

/** The two routes, as this member (or as nobody), called with plain requests. */
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
    read: () => call("GET /api/profile/speed-cards"),
    save: (slots: unknown) => call("PUT /api/profile/speed-cards", { slots }),
  };
}

describe.skipIf(!configured)("a member's speed cards (MySQL)", () => {
  beforeAll(async () => {
    db = await provisionTestDb();
    pool = testPool(db, { connectionLimit: 4 }); // module-review-ok: the suite's own pool onto the scratch schema it provisioned
  }, 240_000);

  afterAll(async () => {
    await pool?.end();
    await db?.drop();
  });

  it("reads null for a member who never chose, then round-trips what they save", async () => {
    await seedMember("sc-ana");
    const me = routes("sc-ana");
    expect((await me.read()).body).toEqual({ slots: null });
    const saved = await me.save(["/map", "/profile", null, "pull-a-card"]);
    expect(saved.status, JSON.stringify(saved.body)).toBe(200);
    expect(saved.body.slots).toEqual(["/map", "/profile", null, "pull-a-card", null, null]);
    // A second device asks afresh and gets the same six.
    expect((await routes("sc-ana").read()).body.slots).toEqual(["/map", "/profile", null, "pull-a-card", null, null]);
  });

  it("keeps every other pref the member holds", async () => {
    await seedMember("sc-bo", { displayCurrency: "EUR", notify: { digest: "weekly" } });
    await routes("sc-bo").save(["/journal"]);
    const prefs = await prefsOf("sc-bo");
    expect(prefs.displayCurrency).toBe("EUR");
    expect(prefs.notify).toEqual({ digest: "weekly" });
    expect(prefs.speedCards).toEqual(["/journal", null, null, null, null, null]);
  });

  it("writes only the signed-in member's own row", async () => {
    await seedMember("sc-cy");
    await seedMember("sc-di");
    await routes("sc-cy").save(["/forum"]);
    expect((await prefsOf("sc-di"))?.speedCards).toBeUndefined();
    expect((await routes("sc-di").read()).body.slots).toBeNull();
  });

  it("refuses a malformed list and writes nothing", async () => {
    await seedMember("sc-ed");
    const me = routes("sc-ed");
    await me.save(["/map"]);
    for (const bad of [["a", "b", "c", "d", "e", "f", "g"], ["/map", "/map"], "/map", [{ href: "/x" }], ["has space"]]) {
      const out = await me.save(bad);
      expect(out.status, `refused: ${JSON.stringify(bad)}`).toBe(400);
    }
    expect((await me.read()).body.slots).toEqual(["/map", null, null, null, null, null]);
  });

  it("null clears the list, so the member sees the defaults again", async () => {
    await seedMember("sc-fi");
    const me = routes("sc-fi");
    await me.save(["/map"]);
    expect((await me.save(null)).body).toEqual({ slots: null });
    expect((await prefsOf("sc-fi"))?.speedCards).toBeUndefined();
  });

  it("refuses a stranger", async () => {
    const nobody = routes(null);
    expect((await nobody.read()).status).toBe(401);
    expect((await nobody.save(["/map"])).status).toBe(401);
  });
});
