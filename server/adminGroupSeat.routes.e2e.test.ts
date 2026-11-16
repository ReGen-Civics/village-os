/**
 * ADMIN ACCESS IS A POWER THE SEATER MUST HOLD, against the built server.
 *
 * `POST /api/admin/roles/:id/holders` lets a holder of `proposal.decide` seat
 * somebody into a group whose every capability the decider already holds.
 * Admin access is not a capability, it is the group's own switch, so a group
 * that opens the admin panel and carries nothing else passed that check: a
 * decider who could not open the panel could hand somebody else the panel.
 * `adminAccessBeyondSeater` (server/lib/groupAdmin.ts) closes it.
 *
 * Fixture, said once: three groups written before boot so the role cache
 * loads them. `ags-deciders` carries `proposal.decide`; `ags-panel` carries
 * nothing and opens the panel; `ags-plain` carries nothing and opens nothing.
 *
 * Boots the BUILT server: run `pnpm build` first. The cases run IN ORDER.
 * Skips loudly without TEST_DATABASE_URL.
 */
import fs from "fs";
import os from "os";
import path from "path";
import type { Pool } from "mysql2/promise";
import { spawn, type ChildProcess } from "child_process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { provisionTestDb, testDbConfigured, testPool, type TestDb, waitForPortFree } from "./db/testDb";
import { waitForHealth } from "./db/e2eBoot";
import { ADMIN_ACCESS_NOT_HELD } from "./lib/groupAdmin";

const DB_CONFIGURED = testDbConfigured();
if (!DB_CONFIGURED) {
  console.warn("[adminGroupSeat.routes] TEST_DATABASE_URL not set - DB-backed tests SKIPPED.");
}

const DIST = path.resolve(process.cwd(), "dist/index.js");
// Its window is checked by scripts/check-e2e-ports.mjs, never claimed by hand here.
const PORT = 5050 + (process.pid % 10);
const BASE = `http://localhost:${PORT}`;
const ADMIN = "ags-admin";
const PASSWORD = "AdminGroupSeat123!";
const DECIDERS = "ags-deciders";
const PANEL = "ags-panel";
const PLAIN = "ags-plain";

let child: ChildProcess | undefined;
let testDb: TestDb | undefined;
let dataDir = "";
let pool: Pool;
let founderToken = "";
const people = { decider: { token: "", id: "" }, eve: { token: "", id: "" } };

async function call(
  method: string,
  route: string,
  body?: unknown,
  token = founderToken,
): Promise<{ status: number; json: any; text: string }> {
  const res = await fetch(BASE + route, { // module-review-ok: the test client dialling the built server on localhost, as every e2e suite does
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json: any = null;
  try { json = JSON.parse(text); } catch { /* non-JSON stays visible through text */ }
  return { status: res.status, json, text };
}

async function register(name: string, slug: string): Promise<{ token: string; id: string }> {
  const r = await call("POST", "/api/auth/register", {
    name, email: `${slug}-${PORT}@example.test`, password: PASSWORD, paths: ["resident"],
  }, "");
  expect(r.status, `${name} must register: ${r.text}`).toBe(200);
  return { token: String(r.json?.token ?? ""), id: String(r.json?.user?.id ?? "") };
}

const serverLogs: string[] = [];

async function bootServer(): Promise<void> {
  await waitForPortFree(PORT);
  child = spawn(process.execPath, [DIST], {
    env: {
      ...process.env,
      NODE_ENV: "production",
      PORT: String(PORT),
      SCHEDULER_ENABLED: "0",
      DATA_DIR: dataDir,
      DATABASE_URL: testDb!.url,
      ADMIN_PASSWORD: ADMIN,
      AUTH_TOKEN_SECRET: "ags-token-secret", // module-review-ok: a fixture signing secret for a throwaway server on a scratch schema, same as every e2e suite
      RESEND_API_KEY: "",
      ANTHROPIC_API_KEY: "",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  child!.stdout?.on("data", (d) => serverLogs.push(String(d)));
  child!.stderr?.on("data", (d) => serverLogs.push(String(d)));
  await waitForHealth({ base: BASE, logs: serverLogs, child });
}

const seat = (group: string, userId: string, action: "add" | "remove", token = founderToken) =>
  call("POST", `/api/admin/roles/${group}/holders`, { userId, action }, token);

beforeAll(async () => {
  if (!DB_CONFIGURED) return;
  if (!fs.existsSync(DIST)) {
    throw new Error(`${DIST} is missing. Run \`pnpm build\` before the admin group seat test.`);
  }
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "village-ags-"));
  testDb = await provisionTestDb();
  pool = testPool(testDb, { connectionLimit: 4 }); // module-review-ok: the suite's own pool onto the scratch schema it provisioned
  for (const [id, name, caps, grantsAdmin, order] of [
    [DECIDERS, "Deciders", ["proposal.decide"], 0, 90],
    [PANEL, "Panel Keys", [], 1, 91],
    [PLAIN, "Plain Keys", [], 0, 92],
  ] as const) {
    await pool.query( // module-review-ok: a fixture on the scratch schema this suite provisioned
      "INSERT INTO roles (id, name, description, capabilities, sort_order, grants_admin) VALUES (?,?,?,?,?,?)",
      [id, name, `${name}, a fixture group.`, JSON.stringify(caps), order, grantsAdmin],
    );
  }
  await bootServer();

  const boot = await call("POST", "/api/admin/bootstrap", {
    password: ADMIN, email: `founder-${PORT}@example.test`, name: "Seat Founder",
  }, "");
  const claim = decodeURIComponent(String(boot.json?.claimUrl ?? "").match(/token=([^&]+)/)?.[1] ?? "");
  const setPw = await call("POST", "/api/auth/set-password", { token: claim, password: PASSWORD }, "");
  founderToken = String(setPw.json?.token ?? "");
  expect(founderToken, "the founder must hold a session").toBeTruthy();

  people.decider = await register("Dee Marsh", "ags-dee");
  people.eve = await register("Eve Linden", "ags-eve");
  for (const who of [people.decider, people.eve]) {
    const staged = await call("PUT", `/api/admin/players/${who.id}/stage`, { stageId: "member" });
    expect(staged.status, staged.text).toBe(200);
  }
  const seated = await seat(DECIDERS, people.decider.id, "add");
  expect(seated.status, seated.text).toBe(200);
}, 300_000);

afterAll(async () => {
  child?.kill();
  await pool?.end();
  await testDb?.drop();
  if (dataDir) fs.rmSync(dataDir, { recursive: true, force: true });
});

describe.skipIf(!DB_CONFIGURED)("admin access is a power the seater must hold", () => {
  it("control: the decider cannot open the admin panel", async () => {
    expect((await call("GET", "/api/admin/players", undefined, people.decider.token)).status).not.toBe(200);
  });

  it("control: the decider seats somebody into a group that opens nothing", async () => {
    const r = await seat(PLAIN, people.eve.id, "add", people.decider.token);
    expect(r.status, r.text).toBe(200);
  });

  it("the decider is refused a group that opens the panel, and nobody gains access", async () => {
    const r = await seat(PANEL, people.eve.id, "add", people.decider.token);
    expect(r.status, r.text).toBe(403);
    expect(r.json?.code).toBe("admin_access_not_held");
    expect(r.json?.error).toBe(ADMIN_ACCESS_NOT_HELD);
    expect((await call("GET", "/api/admin/players", undefined, people.eve.token)).status, "Eve was not handed the panel").not.toBe(200);
  });

  it("the founder, who can open the panel, seats the same person into the same group", async () => {
    const r = await seat(PANEL, people.eve.id, "add");
    expect(r.status, r.text).toBe(200);
    expect((await call("GET", "/api/admin/players", undefined, people.eve.token)).status).toBe(200);
  });
});
