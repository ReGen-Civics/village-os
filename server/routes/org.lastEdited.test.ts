/**
 * "LAST EDITED" MOVES WITH AN ADMIN'S OR AN AGENT'S WRITE TO A ROLE CARD
 * (coordinator, 14 Nov 2026).
 *
 * A card's "Last edited by … on …" read only the role editor's two saves (its
 * published draft and its founding sections). A write through
 * PUT /api/admin/org/roles/:id, which is what an admin's edit and the agent
 * connector's role-card write both are, changed the words and left the date
 * where it was. Now that write stamps the card (`stampCardEdit`), and
 * `lastEditedOf` reads the newest of the three.
 *
 * Over the real handler and a scratch schema.
 */
import type mysql from "mysql2/promise";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { provisionTestDb, testDbConfigured, testPool, type TestDb } from "../db/testDb";
import { createOrgRole } from "../lib/orgChart";
import { editedOnDay, lastEditedOf, saveSections, sectionsFor, stampCardEdit } from "../lib/roleCardSections";
import { usersRepo } from "../repos/users";
import { register } from "./org";

const configured = testDbConfigured();
if (!configured) console.warn("[org.lastEdited] TEST_DATABASE_URL not set - DB cases SKIPPED. A skip is not a pass.");

type Handler = (req: any, res: any) => Promise<unknown> | unknown;

describe.skipIf(!configured)("a role card's Last edited, on a real schema", () => {
  let db: TestDb;
  let pool: mysql.Pool;
  const handlers = new Map<string, Handler>();
  let actor = "u-mara";

  beforeAll(async () => {
    db = await provisionTestDb();
    pool = testPool(db, { connectionLimit: 4 });
    const users = usersRepo(pool);
    await users.add({ id: "u-mara", name: "Mara Stone", email: "mara@example.test", passwordHash: "x", paths: [] } as any);
    await users.add({ id: "u-ivo", name: "Ivo Lantern", email: "ivo@example.test", passwordHash: "x", paths: [] } as any);
    const record = (method: string) => (p: string, h: Handler) => void handlers.set(`${method} ${p}`, h);
    register({ get: record("GET"), post: record("POST"), put: record("PUT"), delete: record("DELETE"), patch: record("PATCH"), use: () => {} } as any, {
      isAdmin: async () => true,
      authedUser: async () => ({ id: actor, name: "Admin" }),
      guardCapability: async () => true,
      getPool: () => pool,
      members: usersRepo(pool),
      firstName: (n: string) => String(n).split(" ")[0],
      capabilityCtx: async () => ({}),
      lapseContext: () => ({}),
      currentPatternId: () => null,
      seasonState: () => null,
      notify: async () => {},
    } as any);
  });

  afterAll(async () => {
    await pool?.end();
    await db?.drop();
  });

  const put = async (id: string, body: Record<string, unknown>) => {
    const out: { status: number; body: any } = { status: 200, body: undefined };
    const res: any = {
      status(code: number) {
        out.status = code;
        return res;
      },
      json(b: unknown) {
        out.body = b;
        return res;
      },
    };
    await handlers.get("PUT /api/admin/org/roles/:id")!({ params: { id }, body, query: {} }, res);
    return out;
  };

  it("an admin or agent write to the card's words moves Last edited to today, by the writer", async () => {
    const id = await createOrgRole(pool, { id: "le-finance", name: "Finance Steward", aim: "Keep the books." });
    expect(await lastEditedOf(pool, id, { peopleShown: true })).toBeNull();
    const r = await put(id, { name: "Finance & Legal Steward", aim: "Keep the books and the contracts." });
    expect(r.body).toEqual({ success: true });
    const today = new Date().toISOString().slice(0, 10);
    expect(await lastEditedOf(pool, id, { peopleShown: true })).toEqual({ by: "Mara", on: today });
    // A reader the village does not show names to reads the day alone.
    expect(await lastEditedOf(pool, id, { peopleShown: false })).toEqual({ by: null, on: today });
  });

  it("dates the edit in the village's time zone, never the UTC day (QA, 15 Nov 2026)", async () => {
    const id = await createOrgRole(pool, { id: "le-tz", name: "Time Steward", aim: "Keep the hours." });
    // 22:45 on 14 Nov in Costa Rica is 04:45 on 15 Nov in UTC.
    await stampCardEdit(pool, id, "u-mara", new Date("2026-11-15T04:45:00Z"));
    expect(await lastEditedOf(pool, id, { peopleShown: true, timeZone: "America/Costa_Rica" })).toEqual({ by: "Mara", on: "2026-11-14" });
    // The same instant in a village on UTC is the 15th (control).
    expect(await lastEditedOf(pool, id, { peopleShown: true, timeZone: "UTC" })).toEqual({ by: "Mara", on: "2026-11-15" });
  });

  it("a write that changes nothing leaves Last edited where it was (control)", async () => {
    const id = await createOrgRole(pool, { id: "le-land", name: "Land Steward", aim: "Hold the land." });
    expect((await put(id, { aim: "Hold the land." })).body).toEqual({ success: true });
    expect(await lastEditedOf(pool, id, { peopleShown: true })).toBeNull();
  });

  it("the newest of the editor's save and the admin write wins, and stamping keeps the saved sections", async () => {
    const id = await createOrgRole(pool, { id: "le-community", name: "Community Steward", aim: "Bring people in." });
    const sections = (await sectionsFor(pool, id)).sections;
    await saveSections(pool, id, { ...sections, idealBackground: ["Events, at scale"] } as any, "u-ivo", new Date("2026-11-01T12:00:00Z"));
    expect(await lastEditedOf(pool, id, { peopleShown: true })).toEqual({ by: "Ivo", on: "2026-11-01" });
    await stampCardEdit(pool, id, "u-mara", new Date("2026-11-10T12:00:00Z"));
    expect(await lastEditedOf(pool, id, { peopleShown: true })).toEqual({ by: "Mara", on: "2026-11-10" });
    // The stamp left the editor's sections as they were.
    expect((await sectionsFor(pool, id)).sections).toMatchObject({ idealBackground: ["Events, at scale"] });
    // A later editor save wins again, and keeps the stamps of other roles.
    await stampCardEdit(pool, "le-other", "u-mara", new Date("2026-11-11T12:00:00Z"));
    await saveSections(pool, id, { ...sections, idealBackground: ["Events, at any scale"] } as any, "u-ivo", new Date("2026-11-12T12:00:00Z"));
    expect(await lastEditedOf(pool, id, { peopleShown: true })).toEqual({ by: "Ivo", on: "2026-11-12" });
    expect(await lastEditedOf(pool, "le-other", { peopleShown: false })).toEqual({ by: null, on: "2026-11-11" });
  });
});

describe("the day of an edit, read in a time zone", () => {
  it("reads the instant in the zone, and falls back to UTC for a zone it cannot read", () => {
    expect(editedOnDay("2026-11-15T04:45:00.000Z", "America/Costa_Rica")).toBe("2026-11-14");
    expect(editedOnDay("2026-11-15T04:45:00.000Z", "Asia/Tokyo")).toBe("2026-11-15");
    expect(editedOnDay("2026-11-15T04:45:00.000Z", "Not/AZone")).toBe("2026-11-15");
  });
});
