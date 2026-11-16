/**
 * `token.mint` THROUGH THE REAL GATE, against the built server (Rye,
 * 2026-11-15: "Founders and Treasurers can mint tokens from after launch ...
 * later we'll pass this power to the village.").
 *
 * Two boots of the same village, because the hand-over is a boot step for a
 * village migration 0112 recorded as started (server/lib/tokenMintHandover.ts):
 *
 *   1. Before the hand-over nobody holds the key, so the admin's hand mint
 *      works as it always has.
 *   2. Between the boots this file writes the state such a village is in: a
 *      steward role with a holder, a Treasury holder, and a game-start row
 *      with no ballot. The second boot moves `token.mint` to them, and then a
 *      bare admin is refused, the steward and the Treasurer mint, a grant to
 *      yourself waits for a second signer, and the reason is required.
 *
 * Fixture, said once: the steward role and both holdings are hand-written
 * rows on the scratch schema, standing in for the launch closer.
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
import { TOKEN_MINT_0112_MARKER } from "./lib/tokenMintHandover";

const DB_CONFIGURED = testDbConfigured();
if (!DB_CONFIGURED) {
  console.warn("[tokenMint.routes] TEST_DATABASE_URL not set - DB-backed tests SKIPPED.");
}

const DIST = path.resolve(process.cwd(), "dist/index.js");
// Its window is checked by scripts/check-e2e-ports.mjs, never claimed by hand here.
const PORT = 6560 + (process.pid % 5);
const BASE = `http://localhost:${PORT}`;
const ADMIN = "tm-admin";
const PASSWORD = "TokenMint123!";
const SLUG = "tm-probe";

let child: ChildProcess | undefined;
let testDb: TestDb | undefined;
let dataDir = "";
let pool: Pool;
let founderToken = "";
/** Wallet amounts are in the token's minor units; this is one whole token, read off the first mint. */
let UNIT = 0;
const people = { sam: { token: "", id: "" }, tara: { token: "", id: "" }, ora: { token: "", id: "" } };

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
      AUTH_TOKEN_SECRET: "tm-token-secret", // module-review-ok: a fixture signing secret for a throwaway server on a scratch schema, same as every e2e suite
      RESEND_API_KEY: "",
      ANTHROPIC_API_KEY: "",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  child!.stdout?.on("data", (d) => serverLogs.push(String(d)));
  child!.stderr?.on("data", (d) => serverLogs.push(String(d)));
  await waitForHealth({ base: BASE, logs: serverLogs, child });
}

async function stopServer(): Promise<void> {
  if (!child) return;
  const exited = new Promise<void>((resolve) => child!.once("exit", () => resolve()));
  child.kill();
  await exited;
  child = undefined;
}

const mint = (toUserId: string, amount: number, reason: string | undefined, token: string) =>
  call("POST", `/api/admin/tokens/${SLUG}/mint`, { toUserId, amount, ...(reason === undefined ? {} : { reason }) }, token);

async function heldBy(token: string): Promise<number> {
  const w = await call("GET", "/api/wallet", undefined, token);
  return Number(w.json?.ledger?.[SLUG] ?? 0);
}

beforeAll(async () => {
  if (!DB_CONFIGURED) return;
  if (!fs.existsSync(DIST)) {
    throw new Error(`${DIST} is missing. Run \`pnpm build\` before the token.mint route test.`);
  }
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "village-tm-"));
  testDb = await provisionTestDb();
  pool = testPool(testDb, { connectionLimit: 4 }); // module-review-ok: the suite's own pool onto the scratch schema it provisioned
  await bootServer();

  const boot = await call("POST", "/api/admin/bootstrap", {
    password: ADMIN, email: `founder-${PORT}@example.test`, name: "Mint Founder",
  }, "");
  const claim = decodeURIComponent(String(boot.json?.claimUrl ?? "").match(/token=([^&]+)/)?.[1] ?? "");
  const setPw = await call("POST", "/api/auth/set-password", { token: claim, password: PASSWORD }, "");
  founderToken = String(setPw.json?.token ?? "");
  expect(founderToken, "the founder must hold a session").toBeTruthy();

  people.sam = await register("Sam Steward", "tm-sam");
  people.tara = await register("Tara Treasurer", "tm-tara");
  people.ora = await register("Ora Member", "tm-ora");
  // Treasury asks for the member rung, so the two holders are admitted first.
  for (const who of [people.sam, people.tara]) {
    const staged = await call("PUT", `/api/admin/players/${who.id}/stage`, { stageId: "member" });
    expect(staged.status, staged.text).toBe(200);
  }
  const made = await call("POST", "/api/admin/tokens", { slug: SLUG, name: "Mint Probe", kind: "credit" });
  expect(made.status, made.text).toBe(200);
}, 300_000);

afterAll(async () => {
  await stopServer().catch(() => undefined);
  await pool?.end();
  await testDb?.drop();
  if (dataDir) fs.rmSync(dataDir, { recursive: true, force: true });
});

describe.skipIf(!DB_CONFIGURED)("token.mint: before the hand-over", () => {
  it("the admin hand mints as today, with a reason", async () => {
    const r = await mint(people.ora.id, 5, "before the hand-over", founderToken);
    expect(r.status, r.text).toBe(200);
    UNIT = (await heldBy(people.ora.token)) / 5;
    expect(UNIT, "five whole tokens arrived").toBeGreaterThan(0);
  });

  it("the reason is required", async () => {
    const r = await mint(people.ora.id, 5, "   ", founderToken);
    expect(r.status, r.text).toBe(400);
    expect(String(r.json?.error)).toContain("A reason is required");
  });
});

describe.skipIf(!DB_CONFIGURED)("token.mint: a village migration 0112 recorded as started, on its next boot", () => {
  beforeAll(async () => {
    if (!DB_CONFIGURED) return;
    await stopServer();
    // Fixture rows on the scratch schema this suite provisioned, standing in for the launch closer.
    await pool.query("INSERT INTO roles (id, name, description, capabilities, sort_order) VALUES ('steward', 'Village Steward', 'Holds the village in trust.', '[]', 0)"); // module-review-ok: fixture SQL against the S5 scratch schema, never a production table
    await pool.query( // module-review-ok: the same fixture
      "INSERT INTO role_holders (id, role_id, user_id, granted_by) VALUES ('tm-h-sam', 'steward', ?, 'fixture'), ('tm-h-tara', 'treasury', ?, 'fixture')",
      [people.sam.id, people.tara.id],
    );
    await pool.query( // module-review-ok: the same fixture: a Game started before the launch ballot existed
      "UPDATE app_config SET value = ? WHERE config_key = 'game-start'",
      [JSON.stringify({ startedAt: new Date().toISOString(), ballotId: null, startedBy: null, note: "Recorded as started by migration 0112." })],
    );
    await bootServer();
  }, 300_000);

  it("the boot step moved token.mint to the steward role and gave it to the Treasury role, once", async () => {
    const [held] = await pool.query<any[]>("SELECT holder_role_id FROM capability_holding WHERE capability = 'token.mint'"); // module-review-ok: fixture SQL against the S5 scratch schema, never a production table
    expect(held.map((r: any) => String(r.holder_role_id))).toEqual(["steward"]);
    const [roles] = await pool.query<any[]>("SELECT id, capabilities FROM roles WHERE id IN ('steward', 'treasury') ORDER BY id"); // module-review-ok: fixture SQL against the S5 scratch schema, never a production table
    for (const r of roles) {
      const caps = typeof r.capabilities === "string" ? JSON.parse(r.capabilities) : r.capabilities;
      expect(caps, String(r.id)).toContain("token.mint");
    }
    const [marker] = await pool.query<any[]>("SELECT value FROM app_config WHERE config_key = 'data-migrations'"); // module-review-ok: fixture SQL against the S5 scratch schema, never a production table
    const doc = marker[0]?.value;
    expect(typeof doc === "string" ? doc : JSON.stringify(doc)).toContain(TOKEN_MINT_0112_MARKER);
  });

  it("a bare admin is refused, and nothing moves", async () => {
    const before = await heldBy(people.ora.token);
    const r = await mint(people.ora.id, 5, "an admin after the hand-over", founderToken);
    expect(r.status, r.text).toBe(409);
    expect(await heldBy(people.ora.token)).toBe(before);
  });

  it("the steward mints, and the Treasurer mints", async () => {
    const before = await heldBy(people.ora.token);
    const bySam = await mint(people.ora.id, 5, "a pay request, signed by the steward", people.sam.token);
    expect(bySam.status, bySam.text).toBe(200);
    const byTara = await mint(people.ora.id, 5, "a bonus, from the Treasury", people.tara.token);
    expect(byTara.status, byTara.text).toBe(200);
    expect(await heldBy(people.ora.token)).toBe(before + 10 * UNIT);
  });

  it("every mint is logged with its actor", async () => {
    const audit = await call("GET", "/api/admin/audit");
    const rows = (audit.json ?? []).filter((r: any) => String(r.action) === `mint:5:${SLUG}`);
    expect(rows.map((r: any) => r.actorUserId)).toEqual(expect.arrayContaining([people.sam.id, people.tara.id]));
  });

  it("the reason is still required", async () => {
    const r = await mint(people.ora.id, 5, undefined, people.tara.token);
    expect(r.status, r.text).toBe(400);
    expect(String(r.json?.error)).toContain("A reason is required");
  });

  it("an ordinary member is refused", async () => {
    const r = await mint(people.ora.id, 5, "a member tries", people.ora.token);
    expect(r.status, r.text).toBe(401);
  });

  it("a grant to yourself waits for a second signer, who must be somebody else", async () => {
    const before = await heldBy(people.sam.token);
    const asked = await mint(people.sam.id, 5, "my own pay request", people.sam.token);
    expect(asked.status, asked.text).toBe(202);
    expect(asked.json?.pending).toBe(true);
    expect(asked.json?.toSelf).toBe(true);
    expect(await heldBy(people.sam.token), "nothing moved yet").toBe(before);
    const id = String(asked.json?.requestId);

    const ownSignature = await call("POST", `/api/admin/mint-requests/${id}/approve`, {}, people.sam.token);
    expect(ownSignature.status, ownSignature.text).toBe(409);
    expect(ownSignature.json?.code).toBe("second_steward_required");
    const bareAdmin = await call("POST", `/api/admin/mint-requests/${id}/approve`, {}, founderToken);
    expect(bareAdmin.status, "a bare admin cannot be the second signer").toBe(409);

    const signed = await call("POST", `/api/admin/mint-requests/${id}/approve`, {}, people.tara.token);
    expect(signed.status, signed.text).toBe(200);
    expect(await heldBy(people.sam.token)).toBe(before + 5 * UNIT);
  });
});
