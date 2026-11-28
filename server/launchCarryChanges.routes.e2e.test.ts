/**
 * `GET /api/admin/launch/carry-changes`, read off the built server, and then
 * HELD TO ITS WORD.
 *
 * A list of what a launch will change is only worth reading if the launch then
 * does what it said. So this suite reads the list before the vote, carries the
 * vote, and tries the doors:
 *
 *   an admin the list named as losing "turning a module on" is refused it;
 *   the founder the list named as keeping it, by accepting the steward role,
 *     turns the same module on; and
 *   the list itself then says the launch has carried and nothing is left.
 *
 * It also holds the three things the brief asked of the route by name:
 *
 *   it is READ-ONLY (the ballots, the roles, the powers and every stored
 *     document are byte for byte the same after reading it, in both languages);
 *   it NAMES the administrators who would lose a door; and
 *   it SURFACES a founder account that reads as a test account, with the fact
 *     that its answer counts toward the launch.
 *
 * THE CASES RUN IN ORDER. Run the whole file, never a `-t` slice. Boots the
 * BUILT `dist/index.js` against a throwaway schema, so run `pnpm build` first.
 * Skips loudly without TEST_DATABASE_URL.
 */
import fs from "fs";
import os from "os";
import path from "path";
import mysql from "mysql2/promise";
import { spawn, type ChildProcess } from "child_process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { testPool, provisionTestDb, testDbConfigured, type TestDb, waitForPortFree } from "./db/testDb";
import { waitForHealth } from "./db/e2eBoot";
import { clearTheJourney, makeFounders } from "./db/launchGovernanceFixture";

const DB_CONFIGURED = testDbConfigured();
if (!DB_CONFIGURED) {
  console.warn("[launchCarryChanges.routes] TEST_DATABASE_URL not set - DB-backed tests SKIPPED.");
}

const DIST = path.resolve(process.cwd(), "dist/index.js");

/** This suite's port window. `scripts/check-e2e-ports.mjs` holds it apart from every other file's. */
const PORT = 12700 + (process.pid % 100); // 12700-12799: narrowed at composition (train 149), since the permission matrix suite holds 12800-12999
const BASE = `http://localhost:${PORT}`;
const ADMIN = "launchcarry-admin";
const PASSWORD = "LaunchCarryTest123!";
const ROUTE = "/api/admin/launch/carry-changes";

let child: ChildProcess | undefined;
let testDb: TestDb | undefined;
let dataDir = "";
let pool: mysql.Pool;
const logs: string[] = [];

let founderToken = "";
let founderId = "";
let wrenToken = "";
let wrenId = "";
/** A founder account made to exercise the product, the way the first village has one. */
let qaToken = "";
let qaId = "";
/** An admin by account role, who is no founder and is on no steward list. */
let anaToken = "";
let anaId = "";
/** An ordinary member. */
let tamToken = "";
let launchBallot = "";

interface Answer { status: number; json: any }

async function call(
  method: string,
  route: string,
  opts: { body?: unknown; token?: string | null } = {},
): Promise<Answer> {
  const token = opts.token === undefined ? founderToken : opts.token;
  const res = await fetch(BASE + route, { // module-review-ok: the test client dialling the built server on localhost, as every e2e suite does
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  });
  return { status: res.status, json: await res.json().catch(() => null) };
}

async function register(name: string, slug: string): Promise<{ token: string; id: string }> {
  const r = await call("POST", "/api/auth/register", {
    token: "",
    body: { name, email: `${slug}-${PORT}@example.test`, password: PASSWORD, paths: ["resident"] },
  });
  expect(r.status, `${name} must register`).toBe(200);
  return { token: String(r.json?.token ?? ""), id: String(r.json?.user?.id ?? "") };
}

const vote = (ballotId: string, token: string, body: Record<string, unknown>) =>
  call("POST", `/api/governance/ballots/${ballotId}/vote`, { token, body });

const change = (json: any, id: string) => (json?.changes ?? []).find((c: any) => c.id === id);
const ids = (people: Array<{ id: string }> | undefined) => (people ?? []).map((p) => p.id).sort();

/**
 * Everything a read could have changed if it were not one: every ballot and
 * vote, every role holding, every power the village holds, and every stored
 * document, as one string.
 */
async function fingerprint(): Promise<string> {
  const parts: string[] = [];
  for (const sql of [
    "SELECT id, status, closes_at FROM ballots ORDER BY id",
    "SELECT * FROM ballot_votes ORDER BY ballot_id, user_id",
    "SELECT id, role_id, user_id, term_ends_at, season_id FROM role_holders ORDER BY id",
    "SELECT * FROM capability_holding ORDER BY capability",
    "SELECT config_key, value FROM app_config ORDER BY config_key",
    "SELECT id, role FROM users ORDER BY id",
  ]) {
    const [rows] = await pool.query<any[]>(sql); // module-review-ok: fixture SQL against the S5 scratch schema, never a production table
    parts.push(JSON.stringify(rows));
  }
  return parts.join("\n");
}

beforeAll(async () => {
  if (!DB_CONFIGURED) return;
  if (!fs.existsSync(DIST)) {
    throw new Error(`${DIST} is missing. Run \`pnpm build\` before the launch carry changes route test.`);
  }
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "village-launchcarry-"));
  testDb = await provisionTestDb({ gameStarted: false });
  pool = testPool(testDb, { connectionLimit: 4 }); // module-review-ok: the suite's own pool onto the scratch schema it provisioned

  await waitForPortFree(PORT);
  child = spawn(process.execPath, [DIST], {
    env: {
      ...process.env,
      NODE_ENV: "production",
      PORT: String(PORT),
      // No background scheduler: the jobs are not this suite's subject, and a read-only proof wants nothing else writing.
      SCHEDULER_ENABLED: "0",
      DATA_DIR: dataDir,
      DATABASE_URL: testDb.url,
      ADMIN_PASSWORD: ADMIN,
      AUTH_TOKEN_SECRET: "launchcarry-token-secret", // module-review-ok: a fixture signing secret for a throwaway server on a scratch schema, same as every e2e suite
      FRONTEND_URL: BASE,
      VILLAGE_SECRETS_KEY: "4a".repeat(32), // module-review-ok: fixture sealing key, same as every e2e suite
      RESEND_API_KEY: "",
      ANTHROPIC_API_KEY: "",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout?.on("data", (d) => logs.push(String(d)));
  child.stderr?.on("data", (d) => logs.push(String(d)));
  await waitForHealth({ base: BASE, logs, child });

  const boot = await call("POST", "/api/admin/bootstrap", {
    token: "",
    body: { password: ADMIN, email: `founder-${PORT}@example.test`, name: "Mara Fenn" },
  });
  const claim = decodeURIComponent(String(boot.json?.claimUrl ?? "").match(/token=([^&]+)/)?.[1] ?? "");
  const setPw = await call("POST", "/api/auth/set-password", { token: "", body: { token: claim, password: PASSWORD } });
  founderToken = String(setPw.json?.token ?? "");
  founderId = String(setPw.json?.user?.id ?? "");
  expect(founderToken, "founder must hold a session").toBeTruthy();

  await clearTheJourney(call, { name: "Wealden" });

  const wren = await register("Wren Ashby", "wren");
  wrenToken = wren.token; wrenId = wren.id;
  const qa = await register("Integration QA", "integration-qa");
  qaToken = qa.token; qaId = qa.id;
  const ana = await register("Ana Ruiz", "ana");
  anaToken = ana.token; anaId = ana.id;
  const tam = await register("Tam Reyes", "tam");
  tamToken = tam.token;
  for (const id of [founderId, wrenId, qaId, anaId, tam.id]) {
    const r = await call("PUT", `/api/admin/players/${id}/stage`, { body: { stageId: "member" } });
    expect(r.status, `${id} reaches member`).toBe(200);
  }
  // Three founders, one of them the test account. Ana is an admin by account role.
  await makeFounders(call, [wrenId, qaId]);
  const adminRole = await call("PUT", `/api/admin/users/${anaId}/role`, { body: { role: "admin", addressUnprovedOk: true } });
  expect(adminRole.status, JSON.stringify(adminRole.json)).toBe(200);
}, 240_000);

afterAll(async () => {
  child?.kill();
  await pool?.end();
  if (dataDir && fs.existsSync(dataDir)) fs.rmSync(dataDir, { recursive: true, force: true });
  await testDb?.drop();
});

describe.skipIf(!DB_CONFIGURED)("who may read the list", () => {
  it("nobody signed out, and no ordinary member", async () => {
    expect((await call("GET", ROUTE, { token: null })).status).toBe(401);
    expect((await call("GET", ROUTE, { token: tamToken })).status).toBe(401);
  });

  it("an admin and a founder", async () => {
    expect((await call("GET", ROUTE)).status).toBe(200);
    expect((await call("GET", ROUTE, { token: anaToken })).status).toBe(200);
  });
});

describe.skipIf(!DB_CONFIGURED)("before the vote is opened", () => {
  it("IS READ-ONLY: reading it, in both languages, changes nothing stored", async () => {
    const before = await fingerprint();
    for (let i = 0; i < 3; i++) {
      expect((await call("GET", ROUTE)).status).toBe(200);
      expect((await call("GET", `${ROUTE}?lang=es`)).status).toBe(200);
    }
    expect(await fingerprint()).toBe(before);
  });

  it("says this village has not started its Game, and lists every door", async () => {
    const out = (await call("GET", ROUTE)).json;
    expect(out?.kind).toBe("first");
    expect(out?.launchedAt).toBeNull();
    expect(out?.changes.map((c: any) => c.id)).toEqual([
      "issuance", "founder-powers", "vote-rules", "stewards", "season", "moon-one", "module-switch", "org-publish",
      "pay", "budget-sources", "token-mint", "handover", "keystone", "currency", "checklist",
    ]);
    expect(change(out, "issuance")).toMatchObject({ standing: "flips", today: "Nothing can be issued to anybody." });
    expect(change(out, "stewards").today).toBe("Nobody holds the steward role.");
    // The season this village's own calendar would begin, and the term a steward would get on it.
    expect(change(out, "season").standing).toBe("flips");
    expect(change(out, "stewards").after).toMatch(/until \d{4}-\d{2}-\d{2}\. The founder who opens the vote picks the names from the launch roll\.$/);
  });

  it("NAMES EVERY ADMIN WHO WOULD LOSE A DOOR: nobody holds the power yet, so all four", async () => {
    const out = (await call("GET", ROUTE)).json;
    expect(ids(out?.admins)).toEqual([anaId, founderId, qaId, wrenId].sort());
    expect(out?.admins.find((a: any) => a.id === anaId)).toMatchObject({ name: "Ana Ruiz", role: "admin", viaRole: true, loses: ["module-switch", "org-publish"] });
    expect(ids(change(out, "module-switch").loses)).toEqual([anaId, founderId, qaId, wrenId].sort());
    expect(ids(change(out, "org-publish").loses)).toEqual([anaId, founderId, qaId, wrenId].sort());
    // The pay doors wait for a steward, and nobody is known to be seated.
    expect(change(out, "pay")).toMatchObject({ standing: "nothing", loses: [] });
    expect(out?.attention.find((a: any) => a.id === "admins-lose")?.accounts).toHaveLength(4);
  });

  it("SURFACES THE TEST ACCOUNT AMONG THE FOUNDERS, and only that one", async () => {
    const out = (await call("GET", ROUTE)).json;
    const flagged = out?.attention.filter((a: any) => a.id === "test-founder");
    expect(flagged).toHaveLength(1);
    expect(flagged[0].accounts).toEqual([{ id: qaId, name: "Integration QA" }]);
    expect(flagged[0].text).toBe(
      "Integration QA holds the founder role and reads as a test account: its name carries a test word. It is on the launch roll, so its answer counts toward the 3 yeses the launch needs.",
    );
  });

  it("answers in Spanish when asked", async () => {
    const es = (await call("GET", `${ROUTE}?lang=es`)).json;
    expect(change(es, "module-switch")).toMatchObject({ title: "Activar un módulo", today: "Cualquier administración activa un módulo." });
    expect(es?.attention.find((a: any) => a.id === "test-founder")?.text).toContain("parece una cuenta de prueba");
  });
});

describe.skipIf(!DB_CONFIGURED)("with the vote open", () => {
  it("names who the vote put forward, and nobody keeps a door until somebody accepts", async () => {
    const asked = await call("POST", "/api/admin/launch/propose", { body: { slate: [founderId] } });
    expect(asked.status, JSON.stringify(asked.json)).toBe(200);
    const [rows] = await pool.query<any[]>("SELECT id FROM ballots WHERE subject_type = 'village_launch' AND status = 'open'"); // module-review-ok: fixture SQL against the S5 scratch schema, never a production table
    launchBallot = String(rows[0]?.id ?? "");
    expect(launchBallot).toBeTruthy();

    const out = (await call("GET", ROUTE)).json;
    expect(change(out, "stewards").after).toContain("Named: Mara Fenn. Accepted so far: nobody.");
    expect(change(out, "stewards").holds).toEqual([]);
    expect(out?.attention.find((a: any) => a.id === "nobody-accepted")?.accounts).toEqual([{ id: founderId, name: "Mara Fenn" }]);
    // The list names one founder. The other three set pay today as admins, and the read says so by name (Rye, 2026-11-28).
    expect(ids(out?.attention.find((a: any) => a.id === "pay-left-out")?.accounts)).toEqual([anaId, qaId, wrenId].sort());
  });

  it("once the named founder accepts, they keep every door and the other three admins are named as losing them", async () => {
    const yes = await vote(launchBallot, founderToken, { choice: "yes", standsForSteward: true });
    expect(yes.status, JSON.stringify(yes.json)).toBe(200);
    expect(yes.json?.carried).toBe(false);

    const before = await fingerprint();
    const out = (await call("GET", ROUTE)).json;
    expect(await fingerprint(), "reading it with a vote open changes nothing either").toBe(before);

    expect(change(out, "stewards").holds).toEqual([{ id: founderId, name: "Mara Fenn" }]);
    expect(change(out, "stewards").after).toContain("Accepted so far: Mara Fenn.");
    expect(ids(change(out, "module-switch").holds)).toEqual([founderId]);
    expect(ids(change(out, "module-switch").loses)).toEqual([anaId, qaId, wrenId].sort());
    // Somebody will be seated, so the pay doors and hand minting now flip for the admins who pass them today.
    expect(change(out, "pay").standing).toBe("flips");
    expect(ids(change(out, "pay").loses)).toEqual([anaId, qaId, wrenId].sort());
    expect(change(out, "token-mint").standing).toBe("flips");
    expect(out?.admins.find((a: any) => a.id === founderId)?.loses).toEqual([]);
    expect(out?.admins.find((a: any) => a.id === anaId)?.loses).toEqual(expect.arrayContaining(["module-switch", "org-publish", "pay", "token-mint"]));
    expect(out?.attention.some((a: any) => a.id === "nobody-accepted")).toBe(false);
  });
});

describe.skipIf(!DB_CONFIGURED)("the vote carries, and the list is held to its word", () => {
  it("carries on the third founder's yes, the test account's among them", async () => {
    expect((await vote(launchBallot, wrenToken, { choice: "yes" })).json?.carried).toBe(false);
    // The account the list flagged is on the roll, and its yes is the third.
    const third = await vote(launchBallot, qaToken, { choice: "yes" });
    expect(third.status, JSON.stringify(third.json)).toBe(200);
    expect(third.json?.carried).toBe(true);
  });

  it("the admin it named as losing the door is refused it", async () => {
    const refused = await call("PUT", "/api/admin/modules/events/lifecycle", { token: anaToken, body: { lifecycle: "members", examples: false } });
    expect(refused.status, JSON.stringify(refused.json)).toBe(403);
    expect(refused.json?.proposeInstead).toBe(true);
  });

  it("the founder it named as keeping the door, by accepting the steward role, passes it", async () => {
    const passed = await call("PUT", "/api/admin/modules/events/lifecycle", { body: { lifecycle: "members", examples: false } });
    expect(passed.status, JSON.stringify(passed.json)).toBe(200);
  });

  it("and the list now says the launch has carried, with nothing left to change", async () => {
    const out = (await call("GET", ROUTE)).json;
    expect(out?.kind).toBe("carried");
    expect(String(out?.launchedAt)).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(out?.changes).toEqual([]);
    expect(out?.attention).toEqual([]);
    expect(out?.summary).toMatch(/^The launch carried on \d{4}-\d{2}-\d{2}\. Nothing is left to change\.$/);
    expect(out?.admins.every((a: any) => a.loses.length === 0)).toBe(true);
  });
});
