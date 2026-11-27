/**
 * The quest card, part 2 (the lead, 27 Nov 2026), through the real routes
 * against a real MySQL:
 *
 *   - work turned in can be taken back until it is consented (approved and
 *     paid in one commit): it goes back to `claimed` keeping everything, the
 *     stewards are told once, and a turn-in after it rings them again;
 *   - each step can take words or a file; a quest whose steps need a
 *     submission cannot be turned in until each has one, and a quest whose
 *     steps need none behaves as before;
 *   - a quest put back takes its step submissions and their files with it;
 *   - the suited list matches a quest's role gate and a seated circle only.
 *
 * Runs against the S5 harness. No TEST_DATABASE_URL and the suite skips loudly.
 */
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import express from "express";
import mysql from "mysql2/promise";
import sharp from "sharp";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { testPool, provisionTestDb, testDbConfigured, type TestDb } from "../db/testDb";
import { claimsRepo, questsRepo, type ClaimsRepo, type QuestsRepo } from "../repos/quests";
import { stepSubmissionsForClaim } from "../repos/questStepSubmissions";
import { crewsRepo as makeCrewsRepo } from "../lib/crews";
import { createOrgRole, seatHolder } from "../lib/orgChart";
import { register as registerQuestRoutes } from "./quests";

const configured = testDbConfigured();
if (!configured) {
  // eslint-disable-next-line no-console
  console.warn("[questSteps.routes.test] TEST_DATABASE_URL not set, so this suite is SKIPPED.");
}

type Person = { id: string; name: string };
const ADA: Person = { id: "u-ada-qs", name: "Ada Wren" };
const RICK: Person = { id: "u-rick-qs", name: "Rick Moss" };

let db: TestDb;
let pool: mysql.Pool;
let server: http.Server;
let base = "";
let quests: QuestsRepo;
let claims: ClaimsRepo;
let signedIn: Person | null = ADA;
let admin = false;
let rung: Array<{ userId: string; type: string; dedupeKey: string }> = [];
let gameRoles: Record<string, string[]> = {};
const uploads = fs.mkdtempSync(path.join(os.tmpdir(), "quest-steps-"));

const call = async (method: string, p: string, body?: unknown) => {
  const r = await fetch(`${base}${p}`, { // module-review-ok: the suite's own in-process server on 127.0.0.1, never an outbound call, so there is no correlation id to carry
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: r.status, body: (await r.json().catch(() => undefined)) as any };
};

const sendFile = async (p: string, kind: string, bytes: Buffer, name: string) => {
  const form = new FormData();
  form.append("kind", kind);
  form.append("file", new Blob([new Uint8Array(bytes)]), name);
  const r = await fetch(`${base}${p}`, { method: "POST", body: form }); // module-review-ok: the suite's own in-process server on 127.0.0.1
  return { status: r.status, body: (await r.json().catch(() => undefined)) as any };
};

const quest = (id: string, extra: Record<string, unknown> = {}) =>
  quests.add({ id, title: `Quest ${id}`, gratitude: "10", status: "Open", tags: [], order: 1, ...extra } as any);

describe.skipIf(!configured)("the quest card, part 2 (MySQL)", () => {
  beforeAll(async () => {
    db = await provisionTestDb();
    pool = testPool(db, { connectionLimit: 6 }); // module-review-ok: the suite's own pool onto the scratch schema it provisioned
    quests = questsRepo(pool);
    claims = claimsRepo(pool);
    const deps: any = {
      isAdmin: async () => admin,
      authedUser: async () => signedIn,
      adminActor: () => null,
      getPool: () => pool,
      uploadsDir: uploads,
      members: { all: async () => [], byId: async () => null, update: async () => null },
      questsRepo: quests,
      claimsRepo: claims,
      crewsRepo: makeCrewsRepo(pool),
      firstName: (n: string) => String(n).split(" ")[0],
      notify: async (n: any) => {
        rung.push({ userId: n.userId, type: n.type, dedupeKey: n.dedupeKey });
      },
      stageOf: async () => "member",
      loadRoles: () => [],
      roleIdsFor: (id: string) => gameRoles[id] ?? [],
      currentPatternId: () => null,
      questConsentRecipients: async () => [RICK.id],
      overLimit: async () => false,
      clientIp: () => "127.0.0.1",
      projectCurrency: () => "USD",
      limitState: async () => "ok",
      questNextStep: async () => null,
      circles: () => [{ id: "c-garden", name: "Garden", aliases: ["Food forest"] }],
      lapseContext: () => ({ currentSeasonId: null, cadence: "never" }),
    };
    const app = express();
    app.use(express.json());
    registerQuestRoutes(app, deps);
    server = http.createServer(app);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const addr = server.address();
    base = `http://127.0.0.1:${typeof addr === "object" && addr ? addr.port : 0}`;
    // No repo writes a circle row; the fixture helper the org route suites use (agentProposals.test.ts) does.
    const q = (sql: string, args: unknown[] = []) => pool.query<any[]>(sql, args).then(([rows]) => rows); // module-review-ok: fixture SQL on the scratch schema this suite provisioned
    await q("INSERT INTO circles (id, name, aliases, is_example) VALUES ('c-garden', 'Garden', '[]', 0)");
    await createOrgRole(pool, { id: "garden-steward", name: "Garden Steward", seats: 1, circleId: "c-garden" });
    await seatHolder(pool, "garden-steward", { userId: ADA.id });
  }, 300_000);

  afterAll(async () => {
    await new Promise<void>((resolve) => (server ? server.close(() => resolve()) : resolve()));
    await pool?.end();
    await db?.drop();
    fs.rmSync(uploads, { recursive: true, force: true });
  });

  beforeEach(() => {
    signedIn = ADA;
    admin = false;
    rung = [];
    gameRoles = {};
  });

  it("takes back work turned in, keeps it, tells the steward once, and a turn-in after it rings again", async () => {
    await quest("q-pb");
    await call("POST", "/api/game/quests/q-pb/claim");
    expect((await call("POST", "/api/game/quests/q-pb/submit", { note: "Planted the guild." })).status).toBe(200);
    expect(rung.filter((r) => r.type === "quest_submitted").map((r) => r.userId)).toEqual([RICK.id]);

    const back = await call("POST", "/api/game/quests/q-pb/pull-back");
    expect(back.status).toBe(200);
    const held = (await claims.forUser(ADA.id)).find((c) => c.questId === "q-pb")!;
    expect(held.status).toBe("claimed");
    expect(held.note).toBe("Planted the guild.");
    expect(rung.filter((r) => r.type === "quest_pulled_back")).toEqual([
      { userId: RICK.id, type: "quest_pulled_back", dedupeKey: `quest-pullback:${held.id}:${held.submittedAt}:${RICK.id}` },
    ]);

    // Again: already in hand, nobody is rung.
    expect((await call("POST", "/api/game/quests/q-pb/pull-back")).body.already).toBe(true);
    expect(rung.filter((r) => r.type === "quest_pulled_back")).toHaveLength(1);

    // Turned in again: a new turn-in, so the steward is rung under a key of its own.
    rung = [];
    expect((await call("POST", "/api/game/quests/q-pb/submit", { note: "Planted the guild, and mulched it." })).status).toBe(200);
    expect(rung).toHaveLength(1);
    expect(rung[0].type).toBe("quest_submitted");
    expect(rung[0].dedupeKey).not.toBe(`quest-submission:${held.id}:${RICK.id}`);
  });

  it("refuses to take back work once it is consented", async () => {
    await quest("q-paid");
    await call("POST", "/api/game/quests/q-paid/claim");
    await call("POST", "/api/game/quests/q-paid/submit", { note: "Done." });
    const c = (await claims.forUser(ADA.id)).find((x) => x.questId === "q-paid")!;
    // Consented through the repo's own door, with no value to post: the status is what the take-back reads.
    const consented = await claims.consentOnce(c.id, ["submitted"], (x) => { x.status = "consented"; }, null);
    expect(consented.ok).toBe(true);
    const back = await call("POST", "/api/game/quests/q-paid/pull-back");
    expect(back.status).toBe(409);
    expect(back.body.status).toBe("consented");
  });

  it("a step that needs a submission holds the turn-in until it has one, words or a file", async () => {
    await quest("q-steps", { steps: ["Dig the swale", "Photograph it", "Water it"] });
    admin = true;
    const set = await call("PUT", "/api/admin/quests/q-steps/step-needs", { stepNeeds: [false, true, true, true] });
    expect(set.status).toBe(200);
    expect(set.body.stepNeeds).toEqual([false, true, true]);
    admin = false;

    await call("POST", "/api/game/quests/q-steps/claim");
    const early = await call("POST", "/api/game/quests/q-steps/submit", { note: "All done." });
    expect(early.status).toBe(409);
    expect(early.body.missingSteps).toEqual([1, 2]);

    const png = await sharp({ create: { width: 4, height: 4, channels: 3, background: "#3a7" } }).png().toBuffer();
    const photo = await sendFile("/api/game/quests/q-steps/steps/1", "photo", png, "swale.png");
    expect(photo.status).toBe(200);
    expect(photo.body.submission.fileUrl).toMatch(/^\/api\/uploads\/queststep-\d{13}-[a-z0-9]{8}\.png$/);
    const words = await call("POST", "/api/game/quests/q-steps/steps/2", { body: "Watered twice." });
    expect(words.status).toBe(200);

    const mine = await call("GET", "/api/game/quests/q-steps/steps");
    expect(mine.body.stepNeeds).toEqual([false, true, true]);
    expect(mine.body.submissions.map((s: any) => [s.stepIndex, s.kind])).toEqual([[1, "photo"], [2, "text"]]);

    // The steps carry the evidence, so no link or note is needed.
    expect((await call("POST", "/api/game/quests/q-steps/submit", {})).status).toBe(200);
    // Turned in: the steps are the steward's to read now.
    expect((await call("POST", "/api/game/quests/q-steps/steps/0", { body: "More." })).status).toBe(409);
  });

  it("a quest put back takes its step submissions and their files", async () => {
    await quest("q-back", { steps: ["One"] });
    await call("POST", "/api/game/quests/q-back/claim");
    const png = await sharp({ create: { width: 2, height: 2, channels: 3, background: "#000" } }).png().toBuffer();
    const added = await sendFile("/api/game/quests/q-back/steps/0", "photo", png, "a.png");
    const file = decodeURIComponent(String(added.body.submission.fileUrl).replace("/api/uploads/", ""));
    expect(fs.existsSync(path.join(uploads, file))).toBe(true);
    const claimId = (await claims.forUser(ADA.id)).find((c) => c.questId === "q-back")!.id;

    expect((await call("POST", "/api/game/quests/q-back/withdraw")).status).toBe(200);
    expect(await stepSubmissionsForClaim(pool, claimId)).toEqual([]);
    expect(fs.existsSync(path.join(uploads, file))).toBe(false);
  });

  it("a member removes their own piece of a step, and nobody else's", async () => {
    await quest("q-del", { steps: ["One"] });
    await call("POST", "/api/game/quests/q-del/claim");
    const added = await call("POST", "/api/game/quests/q-del/steps/0", { body: "First try." });
    signedIn = RICK;
    await call("POST", "/api/game/quests/q-del/claim");
    expect((await call("DELETE", `/api/game/quests/q-del/steps/submissions/${added.body.submission.id}`)).status).toBe(404);
    signedIn = ADA;
    expect((await call("DELETE", `/api/game/quests/q-del/steps/submissions/${added.body.submission.id}`)).status).toBe(200);
    expect((await call("GET", "/api/game/quests/q-del/steps")).body.submissions).toEqual([]);
  });

  it("lists the quests suited to the member's roles: a role gate held, or a seated circle, and nothing else", async () => {
    await quest("q-gate", { requiresRole: "beekeeper" });
    await quest("q-circle", { circle: "Food forest" });
    await quest("q-other", { circle: "Kitchen" });
    gameRoles = { [ADA.id]: ["beekeeper"] };
    const r = await call("GET", "/api/game/quests/suited");
    expect(r.status).toBe(200);
    const ids = r.body.quests.map((q: any) => q.id);
    expect(ids).toContain("q-gate");
    expect(ids).toContain("q-circle");
    expect(ids).not.toContain("q-other");
    expect(r.body.quests.find((q: any) => q.id === "q-gate").why).toBe("role");
    expect(r.body.quests.find((q: any) => q.id === "q-circle").why).toBe("circle");

    signedIn = null;
    expect((await call("GET", "/api/game/quests/suited")).status).toBe(401);
  });
});
