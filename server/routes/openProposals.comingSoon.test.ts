/**
 * COMING SOON AT THE NO-ACCOUNT DOOR (Rye, 16 Nov 2026: "list all the
 * regenerative circle roles but say they're 'coming soon'"), over real HTTP and
 * the scratch schema.
 *
 * What is pinned: the open form offers no coming-soon role, a proposal naming
 * one is refused with a plain sentence that names the role (never "no role by
 * that id"), and clearing the mark opens the door again.
 */
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import express from "express";
import type mysql from "mysql2/promise";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { OutgoingEmail, PostResult } from "../../shared/comms/contracts";
import { checkConsentVersion } from "../../shared/proposalAbout";
import { COMING_SOON_WORDS } from "../../shared/roleListing";
import { provisionTestDb, testDbConfigured, type TestDb, testPool } from "../db/testDb";
import { escapeHtml } from "../lib/comms/mailer";
import { createOrgRole } from "../lib/orgChart";
import { usersRepo } from "../repos/users";
import { register } from "./openProposals";

const configured = testDbConfigured();
if (!configured) console.warn("[openProposals.comingSoon] TEST_DATABASE_URL not set - DB cases SKIPPED. A skip is not a pass.");

const ORIGIN = "https://village.example.test";
const NEXT = { id: "s-next", name: "Season of Roots", startsOn: "2099-01-01", endsOn: "2099-03-20", goals: [] };
const NOW_SEASON = { id: "s-now", name: "Season of Seeds", startsOn: "2000-01-01", endsOn: "2098-12-31" };


describe.skipIf(!configured)("a coming-soon role at the no-account door, on a real schema", () => {
  let db: TestDb;
  let pool: mysql.Pool;
  let server: http.Server;
  let base = "";
  let gate = "";
  let dir = "";
  const state = { sent: [] as OutgoingEmail[], answer: { status: "sent", messageId: "m-1" } as PostResult };
  const q = (sql: string, args: unknown[] = []) => pool.query<any[]>(sql, args).then(([rows]) => rows); // module-review-ok: fixture SQL on the scratch schema this suite provisioned

  beforeAll(async () => {
    db = await provisionTestDb();
    pool = testPool(db, { connectionLimit: 4 });
    dir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "proposal-soon-"));
    await q("INSERT INTO circles (id, name, aliases, is_example) VALUES ('c-land', 'Land Circle', '[]', 0)");
    gate = await createOrgRole(pool, { id: "ops-role-soon", name: "Gate Keeper", seats: 2, circleId: "c-land", aim: "Open the gate at dawn." });
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
      deploymentOrigin: () => ORIGIN,
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
      proposalFileDir: dir,
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
    if (dir) await fs.promises.rm(dir, { recursive: true, force: true });
  });

  beforeEach(() => {
    state.sent.length = 0;
    state.answer = { status: "sent", messageId: "m-1" };
  });

  let n = 0;
  const proposal = (over: Record<string, unknown> = {}) => ({
    name: "Rowan Field",
    email: `rowan${++n}@example.test`,
    roles: [{ roleId: gate, note: "I open gates for a living." }],
    why: "I live up the road and the gate is always shut.",
    aim: "The gate opens at dawn every day.",
    ...over,
  });

  const postJson = async (body: unknown) => {
    const res = await fetch(`${base}/api/open-proposals`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }); // module-review-ok: a test calling its own local server
    return { status: res.status, body: (await res.json()) as any };
  };

  const consent = () => ({ given: true, version: checkConsentVersion() });
  const form = async () => (await fetch(`${base}/api/open-proposals/form`)).json() as Promise<any>; // module-review-ok: a test calling its own local server

  it("offers no coming-soon role on the form, refuses one in a sentence, and opens again once the mark is cleared", async () => {
    // CONTROL first: the role is offered and taken while it is not coming soon.
    expect((await form()).roles.map((r: any) => r.id)).toContain(gate);
    expect((await postJson(proposal({ checkConsent: consent() }))).status).toBe(200);

    await q("UPDATE org_roles SET coming_soon = 1 WHERE id = ?", [gate]);
    try {
      expect((await form()).roles.map((r: any) => r.id)).not.toContain(gate);
      state.sent.length = 0;
      const refused = await postJson(proposal({ checkConsent: consent() }));
      expect(refused).toEqual({ status: 409, body: { error: COMING_SOON_WORDS.refused("Gate Keeper"), field: "roles", code: "coming_soon" } });
      expect(refused.body.error).toBe("Gate Keeper is coming soon. It does not take applications yet.");
      expect(state.sent).toHaveLength(0);
    } finally {
      await q("UPDATE org_roles SET coming_soon = 0 WHERE id = ?", [gate]);
    }
    expect((await postJson(proposal({ checkConsent: consent() }))).status).toBe(200);
  });
});
