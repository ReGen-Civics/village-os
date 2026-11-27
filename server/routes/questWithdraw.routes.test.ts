/**
 * Putting a quest back (the lead, 27 Nov 2026), through the real claim, submit
 * and withdraw routes against a real MySQL: a quest taken and not turned in goes
 * back, leaves the member's claims and opens for somebody else; a quest turned
 * in stays, with the steward's work untouched; a stranger and a member holding
 * nothing get nothing.
 *
 * Runs against the S5 harness. No TEST_DATABASE_URL and the suite skips loudly.
 */
import http from "node:http";
import os from "node:os";
import express from "express";
import mysql from "mysql2/promise";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { testPool, provisionTestDb, testDbConfigured, type TestDb } from "../db/testDb";
import { claimsRepo, questsRepo, type ClaimsRepo, type QuestsRepo } from "../repos/quests";
import { crewsRepo as makeCrewsRepo } from "../lib/crews";
import { register as registerQuestRoutes } from "./quests";

const configured = testDbConfigured();
if (!configured) {
  // eslint-disable-next-line no-console
  console.warn("[questWithdraw.routes.test] TEST_DATABASE_URL not set, so this suite is SKIPPED.");
}

type Person = { id: string; name: string };
const ADA: Person = { id: "u-ada-wd", name: "Ada Wren" };
const RICK: Person = { id: "u-rick-wd", name: "Rick Moss" };

let db: TestDb;
let pool: mysql.Pool;
let server: http.Server;
let base = "";
let quests: QuestsRepo;
let claims: ClaimsRepo;
let signedIn: Person | null = ADA;

const call = async (method: string, path: string, body?: unknown) => {
  const r = await fetch(`${base}${path}`, { // module-review-ok: the suite's own in-process server on 127.0.0.1, never an outbound call, so there is no correlation id to carry
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: r.status, body: (await r.json().catch(() => undefined)) as any };
};

describe.skipIf(!configured)("putting a quest back (MySQL)", () => {
  beforeAll(async () => {
    db = await provisionTestDb();
    pool = testPool(db, { connectionLimit: 6 }); // module-review-ok: the suite's own pool onto the scratch schema it provisioned
    quests = questsRepo(pool);
    claims = claimsRepo(pool);
    const deps: any = {
      isAdmin: async () => false,
      authedUser: async () => signedIn,
      adminActor: () => null,
      getPool: () => pool,
      uploadsDir: os.tmpdir(),
      members: { all: async () => [], byId: async () => null, update: async () => null },
      questsRepo: quests,
      claimsRepo: claims,
      crewsRepo: makeCrewsRepo(pool),
      firstName: (n: string) => String(n).split(" ")[0],
      notify: async () => undefined,
      stageOf: async () => "member",
      loadRoles: () => [],
      roleIdsFor: () => [],
      currentPatternId: () => null,
      questConsentRecipients: async () => [],
      overLimit: async () => false,
      clientIp: () => "127.0.0.1",
      projectCurrency: () => "USD",
      limitState: async () => "ok",
      questNextStep: async () => null,
    };
    const app = express();
    app.use(express.json());
    registerQuestRoutes(app, deps);
    server = http.createServer(app);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const addr = server.address();
    base = `http://127.0.0.1:${typeof addr === "object" && addr ? addr.port : 0}`;
  }, 300_000);

  afterAll(async () => {
    await new Promise<void>((resolve) => (server ? server.close(() => resolve()) : resolve()));
    await pool?.end();
    await db?.drop();
  });

  beforeEach(() => {
    signedIn = ADA;
  });

  it("puts back a quest taken and not turned in: it leaves the member's claims and opens for somebody else", async () => {
    await quests.add({ id: "q-wd-1", title: "Tend the food forest", gratitude: "10", status: "Open", tags: [], order: 1 } as any);
    const took = await call("POST", "/api/game/quests/q-wd-1/claim");
    expect(took.status).toBe(200);

    const back = await call("POST", "/api/game/quests/q-wd-1/withdraw");
    expect(back.status).toBe(200);
    expect(back.body).toEqual({ ok: true, questId: "q-wd-1", claimId: took.body.id });
    expect((await claims.forUser(ADA.id)).filter((c) => c.questId === "q-wd-1")).toEqual([]);

    // Open again, for Ada or anybody.
    signedIn = RICK;
    expect((await call("POST", "/api/game/quests/q-wd-1/claim")).status).toBe(200);
    signedIn = ADA;
    expect((await call("POST", "/api/game/quests/q-wd-1/claim")).status).toBe(200);
  });

  it("keeps a quest that was turned in, and says who can hand it back", async () => {
    await quests.add({ id: "q-wd-2", title: "Mulch the beds", gratitude: "10", status: "Open", tags: [], order: 2 } as any);
    await call("POST", "/api/game/quests/q-wd-2/claim");
    expect((await call("POST", "/api/game/quests/q-wd-2/submit", { note: "Mulched all six beds." })).status).toBe(200);

    const back = await call("POST", "/api/game/quests/q-wd-2/withdraw");
    expect(back.status).toBe(409);
    expect(back.body.status).toBe("submitted");
    expect(back.body.error).toContain("Ask the steward");
    const still = (await claims.forUser(ADA.id)).find((c) => c.questId === "q-wd-2");
    expect(still?.status).toBe("submitted");
    expect(still?.note).toBe("Mulched all six beds.");
  });

  it("answers a member holding nothing with 404, and a stranger with 401", async () => {
    await quests.add({ id: "q-wd-3", title: "Water the seedlings", gratitude: "10", status: "Open", tags: [], order: 3 } as any);
    expect((await call("POST", "/api/game/quests/q-wd-3/withdraw")).status).toBe(404);
    // Someone else's claim is not Ada's to put back.
    signedIn = RICK;
    await call("POST", "/api/game/quests/q-wd-3/claim");
    signedIn = ADA;
    expect((await call("POST", "/api/game/quests/q-wd-3/withdraw")).status).toBe(404);
    expect((await claims.forUser(RICK.id)).find((c) => c.questId === "q-wd-3")?.status).toBe("claimed");
    signedIn = null;
    expect((await call("POST", "/api/game/quests/q-wd-3/withdraw")).status).toBe(401);
  });
});
