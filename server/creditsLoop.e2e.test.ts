/**
 * THE CREDITS LOOP, ISSUANCE TO A VENTURE'S ACCOUNT, against the built server
 * (the lead, 23 Nov 2026: "run and test the whole issuance-to-redemption
 * process end to end").
 *
 *   1. A village token of kind credit, sendable between members.
 *   2. Minted by hand to a member, inside the village's per-moon cap, and a
 *      mint past that cap refused.
 *   3. A venture role in the org chart, a member seated in it, and an account
 *      opened for it by data, never by a constant.
 *   4. The member pays the venture through the ordinary send; a retried tap
 *      pays once; the person who runs the venture cannot pay it.
 *   5. The person who runs it sees the balance and the payment; the admin
 *      sees the same; the ledger still sums to zero.
 *   6. The venture redeems (credits lane 2): the person who runs it asks, the
 *      credits are held, a Treasury holder who does not run it confirms with
 *      the payment's reference after paying outside the platform, and the held
 *      credits burn to `sys:redeemed`. A Treasury holder who also runs the
 *      venture is refused; the per-moon cap is counted and 0 means zero.
 *
 * `scripts/rehearse-credits-loop.mjs` drives the same steps over HTTP against
 * a scratch or staging village, for an admin to run by hand.
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

const DB_CONFIGURED = testDbConfigured();
if (!DB_CONFIGURED) {
  console.warn("[creditsLoop.e2e] TEST_DATABASE_URL not set - DB-backed tests SKIPPED.");
}

const DIST = path.resolve(process.cwd(), "dist/index.js");
// Its window is checked by scripts/check-e2e-ports.mjs, never claimed by hand here.
const PORT = 6670 + (process.pid % 9);
const BASE = `http://localhost:${PORT}`;
const ADMIN = "cl-admin";
const PASSWORD = "CreditsLoop123!";
const SLUG = "cl-credit";

let child: ChildProcess | undefined;
let testDb: TestDb | undefined;
let dataDir = "";
let pool: Pool;
let founderToken = "";
let roleId = "";
/** One whole token in minor units, read off the wallet's own scale. */
let UNIT = 0;
const people = { payer: { token: "", id: "" }, runner: { token: "", id: "" } };
const serverLogs: string[] = [];

async function call(method: string, route: string, body?: unknown, token = founderToken): Promise<{ status: number; json: any; text: string }> {
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
  const r = await call("POST", "/api/auth/register", { name, email: `${slug}-${PORT}@example.test`, password: PASSWORD, paths: ["resident"] }, "");
  expect(r.status, `${name} must register: ${r.text}`).toBe(200);
  return { token: String(r.json?.token ?? ""), id: String(r.json?.user?.id ?? "") };
}

async function dial(key: string, value: string): Promise<void> {
  const r = await call("PUT", `/api/admin/variables/${key}`, { value });
  expect(r.status, `${key} = ${value}: ${r.text}`).toBe(200);
}

async function held(token: string): Promise<number> {
  const w = await call("GET", "/api/wallet", undefined, token);
  return Number(w.json?.ledger?.[SLUG] ?? 0);
}

beforeAll(async () => {
  if (!DB_CONFIGURED) return;
  if (!fs.existsSync(DIST)) throw new Error(`${DIST} is missing. Run \`pnpm build\` before the credits loop test.`);
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "village-cl-"));
  testDb = await provisionTestDb();
  pool = testPool(testDb, { connectionLimit: 4 }); // module-review-ok: the suite's own pool onto the scratch schema it provisioned
  await waitForPortFree(PORT);
  child = spawn(process.execPath, [DIST], {
    env: {
      ...process.env,
      NODE_ENV: "production",
      PORT: String(PORT),
      SCHEDULER_ENABLED: "0",
      DATA_DIR: dataDir,
      DATABASE_URL: testDb.url,
      ADMIN_PASSWORD: ADMIN,
      AUTH_TOKEN_SECRET: "cl-token-secret", // module-review-ok: a fixture signing secret for a throwaway server on a scratch schema, same as every e2e suite
      RESEND_API_KEY: "",
      ANTHROPIC_API_KEY: "",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout?.on("data", (d) => serverLogs.push(String(d)));
  child.stderr?.on("data", (d) => serverLogs.push(String(d)));
  await waitForHealth({ base: BASE, logs: serverLogs, child });

  const boot = await call("POST", "/api/admin/bootstrap", { password: ADMIN, email: `founder-${PORT}@example.test`, name: "Loop Founder" }, "");
  const claim = decodeURIComponent(String(boot.json?.claimUrl ?? "").match(/token=([^&]+)/)?.[1] ?? "");
  const setPw = await call("POST", "/api/auth/set-password", { token: claim, password: PASSWORD }, "");
  founderToken = String(setPw.json?.token ?? "");
  expect(founderToken, "the founder must hold a session").toBeTruthy();
  people.payer = await register("Pat Payer", "cl-payer");
  people.runner = await register("Rae Runner", "cl-runner");
}, 300_000);

afterAll(async () => {
  if (child) {
    const exited = new Promise<void>((resolve) => child!.once("exit", () => resolve()));
    child.kill();
    await exited;
  }
  await pool?.end();
  await testDb?.drop();
  if (dataDir) fs.rmSync(dataDir, { recursive: true, force: true });
});

describe.skipIf(!DB_CONFIGURED)("the credits loop, issuance to a venture's account", () => {
  it("1. a credit token members may send, and the village's dials", async () => {
    const made = await call("POST", "/api/admin/tokens", { slug: SLUG, name: "Loop Credit", kind: "credit", transferable: true });
    expect(made.status, made.text).toBe(200);
    // The issuance cap is the village's own (`ledger.admin_mint_cycle_cap`); once the Game has started only a vote moves it, so this reads it.
    // Both venture dials ship off: the door is shut until the village opens it.
    const shut = await call("GET", "/api/org-accounts", undefined, people.payer.token);
    expect(shut.json).toEqual({ open: false, payees: [] });
  });

  it("2. mints inside the per-moon cap, and refuses past it", async () => {
    const ok = await call("POST", `/api/admin/tokens/${SLUG}/mint`, { toUserId: people.payer.id, amount: 60, reason: "pay pool trial" });
    expect(ok.status, ok.text).toBe(200);
    UNIT = (await held(people.payer.token)) / 60;
    expect(UNIT, "sixty whole tokens arrived").toBeGreaterThan(0);
    const cap = Number(ok.json?.cap ?? 0);
    expect(cap, "the mint answers the cap it counted against").toBeGreaterThan(60);
    const over = await call("POST", `/api/admin/tokens/${SLUG}/mint`, { toUserId: people.payer.id, amount: cap, reason: "past the cap" });
    expect(over.status, over.text).toBe(409);
    expect(await held(people.payer.token)).toBe(60 * UNIT);
  });

  it("3. a venture role, someone seated in it, and an account opened for it", async () => {
    const role = await call("POST", "/api/admin/org/roles", { name: "Trial Venture", circleId: null, aim: "Runs a small venture for the village", seats: 1 });
    expect(role.status, role.text).toBe(200);
    roleId = String(role.json?.id ?? "");
    const seated = await call("POST", `/api/admin/org/roles/${roleId}/holders`, { userId: people.runner.id, holderKind: "member" });
    expect(seated.status, seated.text).toBe(200);

    const before = await call("GET", "/api/admin/org-accounts");
    expect(before.status, before.text).toBe(200);
    expect(before.json.roles.map((r: any) => r.id)).toContain(roleId);
    expect(before.json.open).toBe(false);

    const opened = await call("POST", "/api/admin/org-accounts", { orgRoleId: roleId, label: "Trial Venture account" });
    expect(opened.status, opened.text).toBe(200);
    expect(opened.json.account).toMatchObject({ orgRoleId: roleId, accountId: `org:${roleId}`, label: "Trial Venture account", balances: {} });
    const twice = await call("POST", "/api/admin/org-accounts", { orgRoleId: roleId });
    expect(twice.json.existed, "a second open finds the first").toBe(true);

    // A member is refused the admin door.
    const denied = await call("GET", "/api/admin/org-accounts", undefined, people.payer.token);
    expect(denied.status).toBeGreaterThanOrEqual(401);
  });

  it("4. the member pays the venture through the ordinary send, once per tap", async () => {
    const shut = await call("POST", "/api/wallet/send", { toOrg: roleId, tokenType: SLUG, amount: 5 * UNIT, clientNonce: "cl-shut" }, people.payer.token);
    expect(shut.status, "the door is shut while the dial is off").toBe(403);

    await dial("ledger.org_accounts_open", "true");
    const payees = await call("GET", "/api/org-accounts", undefined, people.payer.token);
    expect(payees.json.payees).toEqual([{ orgRoleId: roleId, label: "Trial Venture account" }]);
    const runnersList = await call("GET", "/api/org-accounts", undefined, people.runner.token);
    expect(runnersList.json.payees, "the person who runs it is not offered it").toEqual([]);

    const paid = await call("POST", "/api/wallet/send", { toOrg: roleId, tokenType: SLUG, amount: 25 * UNIT, note: "lunch", clientNonce: "cl-tap-1" }, people.payer.token);
    expect(paid.status, paid.text).toBe(200);
    expect(paid.json).toMatchObject({ success: true, duplicate: false, to: "Trial Venture account", sent: 25 * UNIT });
    const retry = await call("POST", "/api/wallet/send", { toOrg: roleId, tokenType: SLUG, amount: 25 * UNIT, note: "lunch", clientNonce: "cl-tap-1" }, people.payer.token);
    expect(retry.json?.duplicate, "a retried tap pays once").toBe(true);
    expect(await held(people.payer.token)).toBe(35 * UNIT);

    await call("POST", `/api/admin/tokens/${SLUG}/mint`, { toUserId: people.runner.id, amount: 10, reason: "runner's own pay" });
    const own = await call("POST", "/api/wallet/send", { toOrg: roleId, tokenType: SLUG, amount: 5 * UNIT, clientNonce: "cl-own" }, people.runner.token);
    expect(own.status, "a member never moves their own credits into a venture they run").toBe(409);
  });

  it("5. the person who runs it sees the balance and the payment, and the ledger sums to zero", async () => {
    const mine = await call("GET", "/api/org-accounts/mine", undefined, people.runner.token);
    expect(mine.status, mine.text).toBe(200);
    expect(mine.json.accounts).toHaveLength(1);
    expect(mine.json.accounts[0].account.balances[SLUG]).toBe(25 * UNIT);
    expect(mine.json.accounts[0].history[0]).toMatchObject({ amount: 25 * UNIT, source: "org_send", withName: "Pat Payer", description: "lunch" });
    const payerSees = await call("GET", "/api/org-accounts/mine", undefined, people.payer.token);
    expect(payerSees.json.accounts, "a member who runs nothing sees nothing").toEqual([]);

    const detail = await call("GET", `/api/admin/org-accounts/${roleId}`);
    expect(detail.status, detail.text).toBe(200);
    expect(detail.json.operators).toEqual(["Rae Runner"]);
    expect(detail.json.history).toHaveLength(1);

    const [sums] = await pool.query<any[]>("SELECT token_type, SUM(balance) AS total FROM token_balances GROUP BY token_type"); // module-review-ok: a read of the scratch schema this suite provisioned
    for (const s of sums) expect(Number(s.total), `sum-zero for ${s.token_type}`).toBe(0);
    const [neg] = await pool.query<any[]>( // module-review-ok: a read of the scratch schema this suite provisioned
      "SELECT b.account_id FROM token_balances b JOIN ledger_accounts a ON a.id = b.account_id WHERE a.faucet = 0 AND b.balance < 0",
    );
    expect(neg).toEqual([]);
    const [acct] = await pool.query<any[]>("SELECT kind, faucet FROM ledger_accounts WHERE id = ?", [`org:${roleId}`]); // module-review-ok: a read of the scratch schema this suite provisioned
    expect(acct[0]).toMatchObject({ kind: "org", faucet: 0 });
  });

  it("6. the venture redeems, the Treasury confirms after paying, the credits burn, and the ledger still sums to zero", async () => {
    const ask = (amount: number, token = people.runner.token) =>
      call("POST", "/api/org-redemptions", { orgRoleId: roleId, token: SLUG, amount, currency: "USD", payTo: "Bank account 0001, Rae Runner" }, token);

    // Shut when a village is born.
    const shut = await ask(5);
    expect(shut.status, shut.text).toBe(403);
    await dial("ledger.org_redemption_open", "true");

    // Two Treasury holders, admitted and seated in the seeded Treasury power group. One of them
    // also runs the venture, which is the person the lead's rule refuses.
    const tess = await register("Tess Treasurer", "cl-tess");
    const oli = await register("Oli Operator", "cl-oli");
    for (const p of [tess, oli]) {
      const admitted = await call("PUT", `/api/admin/players/${p.id}/stage`, { stageId: "member" });
      expect(admitted.status, admitted.text).toBe(200);
      const seated = await call("POST", "/api/admin/roles/treasury/holders", { userId: p.id, action: "add" });
      expect(seated.status, seated.text).toBe(200);
    }
    const alsoRuns = await call("POST", `/api/admin/org/roles/${roleId}/holders`, { userId: oli.id, holderKind: "member" });
    expect(alsoRuns.status, alsoRuns.text).toBe(200);

    // A member who runs nothing cannot redeem a venture's credits.
    expect((await ask(5, people.payer.token)).status).toBe(403);

    // The person who runs it asks. The credits are held at once, priced at the peg.
    const asked = await ask(10);
    expect(asked.status, asked.text).toBe(201);
    const id = String(asked.json.redemption.id);
    expect(asked.json.redemption).toMatchObject({ state: "requested", credits: 10, currency: "USD", rateMinor: 100, grossMinor: 1000, payTo: "Bank account 0001, Rae Runner" });
    const mine = await call("GET", "/api/org-accounts/mine", undefined, people.runner.token);
    expect(mine.json.accounts[0].account.balances[SLUG]).toBe(15 * UNIT);

    // The queue is the key holders': the runner is refused it, Tess sees the request.
    const runnerQueue = await call("GET", "/api/admin/org-redemptions", undefined, people.runner.token);
    expect(runnerQueue.status).toBeGreaterThanOrEqual(401);
    const queue = await call("GET", "/api/admin/org-redemptions", undefined, tess.token);
    expect(queue.status, queue.text).toBe(200);
    expect(queue.json.waiting.map((w: any) => w.id)).toEqual([id]);
    const hint = await call("GET", "/api/org-redemptions/mine", undefined, tess.token);
    expect(hint.json.mayConfirm, "the card is told to ask for the queue").toBe(true);
    const [told] = await pool.query<any[]>("SELECT user_id FROM notifications WHERE dedupe_key LIKE ?", [`org-redemption:${id}:asked:%`]); // module-review-ok: a read of the scratch schema this suite provisioned
    expect(told.map((r: any) => String(r.user_id)), "the Treasury hears, never the venture's own people").toEqual([tess.id]);

    // Nobody who runs the venture confirms it, even holding the key. A confirmation needs a reference.
    const self = await call("POST", `/api/admin/org-redemptions/${id}/confirm`, { paymentRef: "TX-SELF" }, oli.token);
    expect(self.status, self.text).toBe(409);
    expect(String(self.json?.error)).toMatch(/You run this venture/);
    const noRef = await call("POST", `/api/admin/org-redemptions/${id}/confirm`, { paymentRef: "" }, tess.token);
    expect(noRef.status).toBe(409);

    // Tess paid outside the platform, and confirms. The held credits burn to the retiring sink.
    const confirmed = await call("POST", `/api/admin/org-redemptions/${id}/confirm`, { paymentRef: "TX-0001" }, tess.token);
    expect(confirmed.status, confirmed.text).toBe(200);
    expect(confirmed.json.redemption).toMatchObject({ state: "confirmed", paymentRef: "TX-0001", decidedByName: "Tess Treasurer" });
    const twice = await call("POST", `/api/admin/org-redemptions/${id}/confirm`, { paymentRef: "TX-0001" }, tess.token);
    expect(twice.status, "one burn per redemption").toBe(409);
    const [burn] = await pool.query<any[]>("SELECT from_account, to_account, amount FROM token_ledger WHERE source = 'org_redemption_burn'"); // module-review-ok: a read of the scratch schema this suite provisioned
    expect(burn).toEqual([{ from_account: "sys:org-redemption-hold", to_account: "sys:redeemed", amount: 10 * UNIT }]);
    const [runnersTold] = await pool.query<any[]>("SELECT user_id FROM notifications WHERE dedupe_key LIKE ?", [`org-redemption:${id}:confirmed:%`]); // module-review-ok: a read of the scratch schema this suite provisioned
    expect(runnersTold.map((r: any) => String(r.user_id)).sort()).toEqual([people.runner.id, oli.id].sort());

    // The per-moon cap, counted across ventures: 10 spoken for, so a cap of 15 leaves 5.
    await dial("ledger.org_redemption_moon_cap", "15");
    const over = await ask(6);
    expect(over.status, over.text).toBe(409);
    expect(String(over.json?.error)).toMatch(/5 more/);
    const fits = await ask(5);
    expect(fits.status, fits.text).toBe(201);
    const cancelled = await call("POST", `/api/org-redemptions/${fits.json.redemption.id}/cancel`, {}, people.runner.token);
    expect(cancelled.status, cancelled.text).toBe(200);
    await dial("ledger.org_redemption_moon_cap", "0");
    expect((await ask(1)).status, "0 means zero").toBe(409);

    // What is left: 15 in the venture, nothing held, 10 retired, and sum-zero for every token.
    const after = await call("GET", "/api/org-accounts/mine", undefined, people.runner.token);
    expect(after.json.accounts[0].account.balances[SLUG]).toBe(15 * UNIT);
    const [bal] = await pool.query<any[]>("SELECT account_id, balance FROM token_balances WHERE token_type = ? AND account_id IN ('sys:org-redemption-hold','sys:redeemed')", [SLUG]); // module-review-ok: a read of the scratch schema this suite provisioned
    const by = Object.fromEntries(bal.map((r: any) => [r.account_id, Number(r.balance)]));
    expect(by["sys:org-redemption-hold"] ?? 0).toBe(0);
    expect(by["sys:redeemed"]).toBe(10 * UNIT);
    const [sums] = await pool.query<any[]>("SELECT token_type, SUM(balance) AS total FROM token_balances GROUP BY token_type"); // module-review-ok: a read of the scratch schema this suite provisioned
    for (const s of sums) expect(Number(s.total), `sum-zero for ${s.token_type}`).toBe(0);
    const myRecord = await call("GET", "/api/org-redemptions/mine", undefined, people.runner.token);
    expect(myRecord.json.ventures[0].redeemed).toEqual([{ currency: "USD", minor: 1000, text: expect.any(String) }]);
  });
});
