/**
 * THE INTAKE, SENT AGAIN OR EDITED (hostile-edges QA, 15 Nov 2026), over real
 * HTTP and the scratch schema.
 *
 *   - The same application for the same role, while one from the address
 *     waits, keeps nothing new: the address is told in one email, and the
 *     sender reads what any send reads, so the form says nothing to a stranger
 *     about who has applied. On a local 1.3.9 boot three copies were kept.
 *   - A post with no commitment at all, which only an edited request sends,
 *     is refused for a role that takes a least commitment. On 1.3.9 it was
 *     kept with no commitment.
 */
import http from "node:http";
import express from "express";
import type mysql from "mysql2/promise";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { OutgoingEmail, PostResult } from "../../shared/comms/contracts";
import { AGAIN_WORDS } from "../../shared/applicationAgain";
import { belowMinimum } from "../../shared/commitmentRange";
import { OPEN_WORDS } from "../../shared/openProposals";
import { provisionTestDb, testDbConfigured, type TestDb, testPool } from "../db/testDb";
import { escapeHtml } from "../lib/comms/mailer";
import { createOrgRole, updateOrgRole } from "../lib/orgChart";
import { usersRepo } from "../repos/users";
import { register } from "./openProposals";

const configured = testDbConfigured();
if (!configured) console.warn("[openProposals.again] TEST_DATABASE_URL not set - DB cases SKIPPED. A skip is not a pass.");

const NEXT = { id: "s-next", name: "Season of Roots", startsOn: "2099-01-01", endsOn: "2099-03-20", goals: [] };
const NOW_SEASON = { id: "s-now", name: "Season of Seeds", startsOn: "2000-01-01", endsOn: "2098-12-31" };

describe.skipIf(!configured)("the intake, sent again or edited", () => {
  let db: TestDb;
  let pool: mysql.Pool;
  let server: http.Server;
  let base = "";
  let gate = "";
  let well = "";
  let held = "";
  const state = { sent: [] as OutgoingEmail[], answer: { status: "sent", messageId: "m-1" } as PostResult };
  const q = (sql: string, args: unknown[] = []) => pool.query<any[]>(sql, args).then(([rows]) => rows); // module-review-ok: fixture SQL on the scratch schema this suite provisioned

  beforeAll(async () => {
    db = await provisionTestDb();
    pool = testPool(db, { connectionLimit: 4 });
    await q("INSERT INTO circles (id, name, aliases, is_example) VALUES ('c-land', 'Land Circle', '[]', 0)");
    gate = await createOrgRole(pool, { id: "opa-role-gate", name: "Gate Keeper", seats: 2, circleId: "c-land", aim: "Open the gate at dawn." });
    well = await createOrgRole(pool, { id: "opa-role-well", name: "Well Tender", seats: 2, circleId: "c-land", aim: "Keep the well clean." });
    held = await createOrgRole(pool, { id: "opa-role-held", name: "Seed Keeper", seats: 2, circleId: "c-land", aim: "Keep the seeds." });
    await updateOrgRole(pool, held, { commitmentMin: 50 } as any);
    const app = express();
    app.use(express.json());
    register(app, {
      getPool: () => pool,
      overLimit: async () => false,
      clientIp: () => "203.0.113.9",
      guardCapability: async (_req: any, res: any) => {
        res.status(401).json({ error: "auth_required" });
        return false;
      },
      authedUser: async () => null,
      commsPostOffice: { getPool: () => pool },
      deploymentOrigin: () => "https://village.example.test",
      projectName: () => "Test Village",
      escapeHtml,
      seasonState: () => ({ current: NOW_SEASON, seasons: [NOW_SEASON, NEXT], timezone: "UTC" }),
      postEmail: async (email: OutgoingEmail) => {
        state.sent.push(email);
        return state.answer;
      },
      governanceLifecycle: () => "public",
      notify: async () => ({ fresh: true }),
      notifyAdmins: async () => undefined,
      members: usersRepo(pool),
      liveHoldersOf: async () => [],
      rolesCarrying: () => [],
      loadRoleHolders: () => [],
      seatCalendar: () => ({ seasons: [NOW_SEASON, NEXT], currentSeasonId: "s-now", timezone: "UTC" }),
      lapse: () => ({ currentSeasonId: "s-now", cadence: "season_turn" }),
      stageOf: async () => "guest",
      recordStageEvent: async () => undefined,
    } as any);
    server = http.createServer(app);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const addr = server.address();
    if (!addr || typeof addr === "string") throw new Error("the test server did not report a port");
    base = `http://127.0.0.1:${addr.port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server?.close(() => resolve()));
    await pool?.end();
    await db?.drop();
  });

  beforeEach(() => {
    state.sent.length = 0;
    state.answer = { status: "sent", messageId: "m-1" };
  });

  const proposal = (email: string, roleId: string, over: Record<string, unknown> = {}) => ({
    name: "Rowan Field",
    email,
    roles: [{ roleId, note: "I open gates for a living." }],
    why: "I live up the road and the gate is always shut.",
    aim: "The gate opens at dawn every day.",
    ...over,
  });
  const post = async (path: string, body: unknown) => {
    const res = await fetch(`${base}${path}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }); // module-review-ok: a test calling its own local server
    return { status: res.status, body: (await res.json()) as any };
  };
  const rowsFor = (email: string) => q("SELECT id, status FROM open_role_proposals WHERE email = ? ORDER BY created_at, id", [email]);
  const tokenOf = (email: OutgoingEmail) => new URL(/https?:\/\/\S+confirm\?token=\S+/.exec(email.text ?? "")?.[0] ?? "http://x").searchParams.get("token");

  it("keeps one application per role per address while it waits, and answers the second send as any send", async () => {
    const first = await post("/api/open-proposals", proposal("rowan.again@example.test", gate));
    expect(first.status).toBe(200);
    const token = tokenOf(state.sent[0]);
    expect(token).toBeTruthy();
    expect((await post("/api/open-proposals/confirm", { token })).status).toBe(200);
    state.sent.length = 0;

    const again = await post("/api/open-proposals", proposal("rowan.again@example.test", gate));
    expect(again.status).toBe(200);
    // What a stranger reads is the ordinary answer: nothing says this address applied before.
    expect(again.body).toEqual(expect.objectContaining({ sent: true, email: "rowan.again@example.test", message: OPEN_WORDS.sent("rowan.again@example.test") }));
    expect((await rowsFor("rowan.again@example.test")).map((r: any) => r.status)).toEqual(["confirmed"]);
    // The address alone hears it, once, in words that say nothing more needs sending.
    expect(state.sent).toHaveLength(1);
    expect(state.sent[0].to.email).toBe("rowan.again@example.test");
    expect(state.sent[0].subject).toBe(AGAIN_WORDS.en.subject);
    expect(state.sent[0].text).toContain("Gate Keeper");
    expect(state.sent[0].text).not.toContain("token=");
  });

  it("still takes the same address for a different role", async () => {
    const r = await post("/api/open-proposals", proposal("rowan.again@example.test", well));
    expect(r.status).toBe(200);
    expect((await rowsFor("rowan.again@example.test")).length).toBe(2);
  });

  it("keeps one kept application when the email is down and the person presses send again", async () => {
    state.answer = { status: "failed", messageId: null };
    const one = await post("/api/open-proposals", proposal("down@example.test", gate));
    expect(one.body.kept).toBe(true);
    const two = await post("/api/open-proposals", proposal("down@example.test", gate));
    expect(two.status).toBe(200);
    expect(two.body).toEqual(expect.objectContaining({ sent: true, kept: true, message: OPEN_WORDS.keptNotSent("down@example.test") }));
    expect((await rowsFor("down@example.test")).length).toBe(1);
  });

  it("refuses a post with no commitment for a role that takes a least one, and keeps nothing", async () => {
    const r = await post("/api/open-proposals", proposal("nocard@example.test", held));
    expect(r.status).toBe(400);
    expect(r.body).toEqual({ error: belowMinimum(50), field: "terms" });
    expect(await rowsFor("nocard@example.test")).toEqual([]);
  });

  it("takes a post with no commitment for a role that asks none, as before", async () => {
    const r = await post("/api/open-proposals", proposal("nocard.free@example.test", well));
    expect(r.status).toBe(200);
  });
});
