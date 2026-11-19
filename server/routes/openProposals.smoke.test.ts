/**
 * A RELEASE SMOKE TEST'S APPLICATION (server/lib/smokeTest.ts), through the
 * real intake on a real schema: judged like any other, never mailed, never on
 * a reviewer's list, and only with the server's token AND the reserved domain.
 * Copies the register harness from openProposals.test.ts so that file is left
 * as it is.
 */
import http from "node:http";
import express from "express";
import type mysql from "mysql2/promise";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { OutgoingEmail, PostResult } from "../../shared/comms/contracts";
import { OPEN_WHY_MAX } from "../../shared/openProposals";
import { provisionTestDb, testDbConfigured, type TestDb, testPool } from "../db/testDb";
import { escapeHtml } from "../lib/comms/mailer";
import { createOrgRole } from "../lib/orgChart";
import { isSmokeSubmission, SMOKE_DOMAIN, SMOKE_HEADER } from "../lib/smokeTest";
import { usersRepo } from "../repos/users";
import { register } from "./openProposals";

const configured = testDbConfigured();
if (!configured) console.warn("[openProposals.smoke] TEST_DATABASE_URL not set - DB cases SKIPPED. A skip is not a pass.");

const TOKEN = "smoke-token-0123456789abcdef"; // module-review-ok: a fixture token for a scratch-schema test server, never a real credential
const ORIGIN = "https://village.example.test";
const ADMIN = { id: "u-admin", name: "Ada Stone" };
const NEXT = { id: "s-next", name: "Season of Roots", startsOn: "2099-01-01", endsOn: "2099-03-20", goals: [{ id: "g-roots", text: "Roots in the ground", done: false }] };
const NOW_SEASON = { id: "s-now", name: "Season of Seeds", startsOn: "2000-01-01", endsOn: "2098-12-31" };

describe("isSmokeSubmission", () => {
  it("needs the server's token, the same token in the header, and the reserved domain", () => {
    expect(isSmokeSubmission(TOKEN, `run@${SMOKE_DOMAIN.slice(1)}`, TOKEN)).toBe(true);
    expect(isSmokeSubmission(TOKEN, `run@${SMOKE_DOMAIN.slice(1)}`, undefined)).toBe(false);
    expect(isSmokeSubmission(TOKEN, `run@${SMOKE_DOMAIN.slice(1)}`, "short")).toBe(false);
    expect(isSmokeSubmission("wrong-token-0123456789abcdef", `run@${SMOKE_DOMAIN.slice(1)}`, TOKEN)).toBe(false);
    expect(isSmokeSubmission(TOKEN, "run@example.test", TOKEN)).toBe(false);
    expect(isSmokeSubmission(undefined, `run@${SMOKE_DOMAIN.slice(1)}`, TOKEN)).toBe(false);
  });
});

describe.skipIf(!configured)("a smoke test's application, on a real schema", () => {
  let db: TestDb;
  let pool: mysql.Pool;
  let server: http.Server;
  let base = "";
  let gate = "";
  const state = {
    viewer: null as { id: string; name: string } | null,
    moderators: [ADMIN.id] as string[],
    governance: "public",
    seasons: [NOW_SEASON, NEXT] as any[],
    limited: [] as string[],
    counting: false,
    sent: [] as OutgoingEmail[],
    answer: { status: "sent", messageId: "m-1" } as PostResult,
    clock: null as Date | null,
    admins: [] as Array<{ type: string; title: string; dedupeKey: string; link?: string }>,
  };
  const hits = new Map<string, number>();
  const q = (sql: string, args: unknown[] = []) => pool.query<any[]>(sql, args).then(([rows]) => rows); // module-review-ok: fixture SQL on the scratch schema this suite provisioned
  const before = process.env.SMOKE_TEST_TOKEN;

  beforeAll(async () => {
    process.env.SMOKE_TEST_TOKEN = TOKEN;
    db = await provisionTestDb();
    pool = testPool(db, { connectionLimit: 4 });
    await q("INSERT INTO circles (id, name, aliases, is_example) VALUES ('c-land', 'Land Circle', '[]', 0)");
    gate = await createOrgRole(pool, { id: "op-role-gate", name: "Gate Keeper", seats: 2, circleId: "c-land", aim: "Open the gate at dawn." });
    const app = express();
    app.use(express.json());
    register(app, {
      getPool: () => pool,
      overLimit: async (bucket: string, max: number) => {
        if (state.limited.some((b) => bucket.startsWith(b))) return true;
        if (!state.counting) return false;
        const n = (hits.get(bucket) ?? 0) + 1;
        hits.set(bucket, n);
        return n > max;
      },
      clientIp: (req: any) => String(req.headers["x-test-ip"] ?? "203.0.113.9"),
      guardCapability: async (_req: any, res: any) => {
        if (state.viewer && state.moderators.includes(state.viewer.id)) return true;
        res.status(state.viewer ? 403 : 401).json({ error: state.viewer ? "forbidden" : "auth_required" });
        return false;
      },
      authedUser: async () => state.viewer,
      commsPostOffice: { getPool: () => pool },
      deploymentOrigin: () => ORIGIN,
      projectName: () => "Test Village",
      escapeHtml,
      seasonState: () => ({ current: NOW_SEASON, seasons: state.seasons, timezone: "UTC" }),
      postEmail: async (email: OutgoingEmail) => {
        state.sent.push(email);
        return state.answer;
      },
      governanceLifecycle: () => state.governance,
      now: () => state.clock ?? new Date(),
      // What the confirm step reads to ask the circle (part B, server/routes/openProposalDecide.test.ts pins it).
      notify: async () => ({ fresh: true }),
      notifyAdmins: async (type: string, title: string, dedupeKey: string, link?: string) => {
        state.admins.push({ type, title, dedupeKey, link });
      },
      members: usersRepo(pool),
      liveHoldersOf: async () => [],
      rolesCarrying: () => [],
      loadRoleHolders: () => [],
      seatCalendar: () => ({ seasons: state.seasons, currentSeasonId: "s-now", timezone: "UTC" }),
      lapse: () => ({ currentSeasonId: "s-now", cadence: "season_turn" }),
      stageOf: async () => "guest",
      recordStageEvent: async () => undefined,
      // An admin reads the pay ceiling while the village keeps pay hidden; nobody else here does.
      mayReadPay: async () => state.viewer?.id === ADMIN.id,
    } as any);
    server = http.createServer(app);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const addr = server.address();
    if (!addr || typeof addr === "string") throw new Error("the test server did not report a port");
    base = `http://127.0.0.1:${addr.port}`;
  });

  afterAll(async () => {
    if (before === undefined) delete process.env.SMOKE_TEST_TOKEN;
    else process.env.SMOKE_TEST_TOKEN = before;
    await new Promise<void>((resolve) => server?.close(() => resolve()));
    await pool?.end();
    await db?.drop();
  });

  beforeEach(() => {
    state.viewer = null;
    state.sent.length = 0;
    state.limited = [];
  });

  const post = async (body: unknown, header?: string) => {
    const res = await fetch(`${base}/api/open-proposals`, { // module-review-ok: a test calling its own local server, never an outside host
      method: "POST",
      headers: { "content-type": "application/json", ...(header ? { [SMOKE_HEADER]: header } : {}) },
      body: JSON.stringify(body),
    });
    return { status: res.status, body: (await res.json()) as any };
  };
  const application = (email: string) => ({
    name: "Smoke Test",
    email,
    roles: [{ roleId: gate, note: "A release smoke test." }],
    // As long as the village takes: the realistic long answer the smoke sends.
    why: "I keep the gate. ".repeat(Math.ceil(OPEN_WHY_MAX / 17)).slice(0, OPEN_WHY_MAX),
    aim: "The gate opens at dawn every day.",
  });
  const rows = async (email: string) => (await q("SELECT id FROM open_role_proposals WHERE email = ?", [email])).length;

  it("is judged and answered as sent, sends no mail, keeps no row, and no reviewer can list it", async () => {
    const email = `release-1${SMOKE_DOMAIN}`;
    const r = await post(application(email), TOKEN);
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect(r.body).toMatchObject({ sent: true, test: true });
    expect(state.sent).toHaveLength(0);
    expect(await rows(email)).toBe(0);
    state.viewer = ADMIN;
    const desk = await fetch(`${base}/api/admin/open-proposals`).then((x) => x.json() as Promise<any>); // module-review-ok: a test calling its own local server
    expect(JSON.stringify(desk)).not.toContain(email);
  });

  it("is still refused like any application when an answer breaks a rule", async () => {
    const r = await post({ ...application(`release-2${SMOKE_DOMAIN}`), why: "x".repeat(OPEN_WHY_MAX + 1) }, TOKEN);
    expect(r).toMatchObject({ status: 400, body: { field: "why" } });
  });

  it("spends no cap, so a deploy's smoke never locks out the next one", async () => {
    state.limited = ["open-proposal:ip:", "open-proposal:email:", "open-proposal:global"];
    const r = await post(application(`release-3${SMOKE_DOMAIN}`), TOKEN);
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect(r.body.test).toBe(true);
  });

  it("without the token, the reserved address is an ordinary application and is mailed", async () => {
    const email = `release-4${SMOKE_DOMAIN}`;
    const r = await post(application(email), "not-the-token-0123456789");
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect(r.body.test).toBeUndefined();
    expect(state.sent).toHaveLength(1);
    expect(await rows(email)).toBe(1);
  });
});
