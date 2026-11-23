/**
 * A VENTURE HOLDS ITS OWN CREDITS (0419, credits lane 1), against a scratch
 * schema.
 *
 * What this file holds the ledger to, in order:
 *
 *   1. Opening an account writes a NON-faucet `org:` row once, and refuses a
 *      missing, retired or standing-example role.
 *   2. A member paying a venture is one `postTransfer`: refused while the dial
 *      is off, refused for a member who runs that venture, refused on an
 *      overdraft, idempotent on the nonce, and conservation holds after each.
 *   3. A venture account can never go negative: nothing can post out of it
 *      past what it holds.
 *   4. Who runs a venture is who is seated in its role, live, as a member:
 *      ended seatings, documented holders and examples do not count.
 *   5. A kept seat fee goes to the venture only with the routing dial on, a
 *      link and an account, and never when the payer runs the venture.
 *
 * Every case ends on `checkLedgerInvariants`, which proves sum-zero per token,
 * cache equal to recomputation, and no non-faucet account negative.
 */
import mysql from "mysql2/promise";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { testPool, provisionTestDb, testDbConfigured, type TestDb } from "../db/testDb";
import {
  CYCLE_POOL_FAUCET,
  TREASURY,
  balanceOf,
  checkLedgerInvariants,
  loadTokenRegistry,
  memberAccount,
  postTransfer,
} from "./ledger";
import { toLedgerUnits } from "./economy";
import { setVariable } from "./variables";
import { chargeForPlace, settleFinishedSeats } from "./eventSeats";
import {
  linkOrgService,
  openOrgAccount,
  operatesOrg,
  orgBalance,
  orgBalances,
  orgHistory,
  orgsOperatedBy,
  seatFeeDestination,
  sendToOrg,
} from "./orgAccounts";
import { ledgerAccountKind } from "../repos/orgAccounts";
import { ORG_ACCOUNTS_OPEN_KEY, ORG_SERVICE_ROUTING_KEY, orgAccountId, orgRoleIdFromAccount } from "../../shared/orgAccounts";

const configured = testDbConfigured();
if (!configured) {
  // eslint-disable-next-line no-console
  console.warn("[orgAccounts.test] TEST_DATABASE_URL not set. Venture accounts are UNCHECKED here.");
}

const TOKEN = "credits";
const units = (human: number) => toLedgerUnits(TOKEN, human);
const VENTURE = "venture-trial";

describe("the account's one spelling", () => {
  it("is org: and the role id, both ways", () => {
    expect(orgAccountId("cafe")).toBe("org:cafe");
    expect(orgRoleIdFromAccount("org:cafe")).toBe("cafe");
    expect(orgRoleIdFromAccount("mem:cafe")).toBeNull();
    expect(orgRoleIdFromAccount("org:")).toBeNull();
    expect(() => orgAccountId("x".repeat(80))).toThrow();
    expect(() => orgAccountId("  ")).toThrow();
  });
});

describe.skipIf(!configured)("a venture's credit account", () => {
  let db: TestDb;
  let pool: mysql.Pool;
  let n = 0;
  const nonce = () => `n-${++n}`;

  const conserves = async () => {
    const inv = await checkLedgerInvariants(pool);
    expect(inv.problems).toEqual([]);
  };

  const member = async (id: string, credits: number) => {
    await pool.query("INSERT INTO users (id, name, email, password_hash) VALUES (?,?,?,?)", [id, `Name ${id}`, `${id}@example.test`, "h"]); // module-review-ok: fixture SQL against the S5 scratch schema, never a production table
    if (credits > 0) {
      const r = await postTransfer(pool, {
        from: CYCLE_POOL_FAUCET, to: memberAccount(id), tokenType: TOKEN, amount: units(credits),
        source: "gratitude_pool", idempotencyKey: `seed:${id}`,
      });
      expect(r.ok, r.error).toBe(true);
    }
  };

  const role = async (id: string, opts: { active?: boolean; example?: boolean } = {}) => {
    await pool.query( // module-review-ok: fixture SQL against the S5 scratch schema, never a production table
      "INSERT INTO org_roles (id, name, active, is_example) VALUES (?,?,?,?)",
      [id, `Role ${id}`, opts.active === false ? 0 : 1, opts.example ? 1 : 0],
    );
  };

  const seat = async (roleId: string, userId: string | null, opts: { ended?: boolean; documented?: boolean; example?: boolean } = {}) => {
    await pool.query( // module-review-ok: fixture SQL against the S5 scratch schema, never a production table
      "INSERT INTO org_role_assignments (id, org_role_id, holder_kind, user_id, display_name, holder_key, ended_at, is_example) VALUES (?,?,?,?,?,?,?,?)",
      [
        `as-${roleId}-${userId ?? "doc"}-${++n}`, roleId, opts.documented ? "documented" : "member",
        opts.documented ? null : userId, opts.documented ? "A Documented Person" : null,
        opts.documented ? `doc:${n}` : `mem:${userId}`, opts.ended ? new Date() : null, opts.example ? 1 : 0,
      ],
    );
  };

  beforeAll(async () => {
    db = await provisionTestDb();
    pool = testPool(db, { connectionLimit: 6 }); // module-review-ok: the S5 scratch-schema harness pool, the eventSeats.test.ts shape
    await pool.query("UPDATE tokens SET transferable = 1 WHERE slug = ?", [TOKEN]); // module-review-ok: fixture SQL: the village's own switch that lets members send credits
    await loadTokenRegistry(pool);
    await role(VENTURE);
    await role("retired", { active: false });
    await role("demo", { example: true });
    await member("payer", 100);
    await member("operator", 50);
    await member("bystander", 0);
    await seat(VENTURE, "operator");
  }, 180_000);

  afterAll(async () => {
    await setVariable(pool, ORG_ACCOUNTS_OPEN_KEY, "false").catch(() => undefined);
    await setVariable(pool, ORG_SERVICE_ROUTING_KEY, "false").catch(() => undefined);
    await pool?.end();
    await db?.drop();
  });

  // ── 1. Opening ─────────────────────────────────────────────────────────────

  it("opens a non-faucet org account once, named after the role", async () => {
    const first = await openOrgAccount(pool, { orgRoleId: VENTURE, openedBy: "admin-1" });
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.existed).toBe(false);
    expect(first.account.accountId).toBe(`org:${VENTURE}`);
    expect(first.account.label).toBe(`Role ${VENTURE}`);
    expect(await ledgerAccountKind(pool, `org:${VENTURE}`)).toEqual({ kind: "org", faucet: false });

    const again = await openOrgAccount(pool, { orgRoleId: VENTURE, label: "Another name", openedBy: "admin-2" });
    expect(again.ok && again.existed).toBe(true);
    if (again.ok) expect(again.account.label, "a second open changes nothing").toBe(`Role ${VENTURE}`);
    await conserves();
  });

  it("refuses a missing, retired or standing-example role", async () => {
    expect(await openOrgAccount(pool, { orgRoleId: "nope", openedBy: null })).toMatchObject({ ok: false, status: 404 });
    expect(await openOrgAccount(pool, { orgRoleId: "retired", openedBy: null })).toMatchObject({ ok: false, status: 409 });
    expect(await openOrgAccount(pool, { orgRoleId: "demo", openedBy: null })).toMatchObject({ ok: false, status: 409 });
    expect(await openOrgAccount(pool, { orgRoleId: "", openedBy: null })).toMatchObject({ ok: false, status: 400 });
    expect(await ledgerAccountKind(pool, "org:demo")).toBeNull();
  });

  // ── 2. A member pays a venture ─────────────────────────────────────────────

  it("refuses a payment while the village has not opened the door", async () => {
    await setVariable(pool, ORG_ACCOUNTS_OPEN_KEY, "false");
    const r = await sendToOrg(pool, { fromUserId: "payer", orgRoleId: VENTURE, tokenType: TOKEN, amountMinor: units(5), nonce: nonce() });
    expect(r).toMatchObject({ ok: false, status: 403 });
    expect(await orgBalance(pool, VENTURE, TOKEN)).toBe(0);
  });

  it("moves a member's credits into the venture, once per nonce, and conserves", async () => {
    await setVariable(pool, ORG_ACCOUNTS_OPEN_KEY, "true");
    const tap = nonce();
    const r = await sendToOrg(pool, { fromUserId: "payer", orgRoleId: VENTURE, tokenType: TOKEN, amountMinor: units(30), note: "two coffees", nonce: tap });
    expect(r.ok, r.ok ? "" : r.error).toBe(true);
    const retry = await sendToOrg(pool, { fromUserId: "payer", orgRoleId: VENTURE, tokenType: TOKEN, amountMinor: units(30), nonce: tap });
    expect(retry).toMatchObject({ ok: true, duplicate: true });
    expect(await orgBalance(pool, VENTURE, TOKEN)).toBe(units(30));
    expect(await orgBalances(pool, VENTURE)).toEqual({ [TOKEN]: units(30) });
    expect(await balanceOf(pool, memberAccount("payer"), TOKEN)).toBe(units(70));

    const history = await orgHistory(pool, VENTURE, async (id) => `Name ${id}`);
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({ amount: units(30), source: "org_send", withName: "Name payer", description: "two coffees" });
    await conserves();
  });

  it("refuses an overdraft, a zero, a recognition token and a venture with no account", async () => {
    const over = await sendToOrg(pool, { fromUserId: "bystander", orgRoleId: VENTURE, tokenType: TOKEN, amountMinor: units(1), nonce: nonce() });
    expect(over.ok).toBe(false);
    if (!over.ok) {
      expect(over.status).toBe(409);
      expect(over.error, "the member reads their own units, never an account id").not.toContain("mem:");
    }
    expect(await sendToOrg(pool, { fromUserId: "payer", orgRoleId: VENTURE, tokenType: TOKEN, amountMinor: 0, nonce: nonce() })).toMatchObject({ ok: false, status: 400 });
    expect(await sendToOrg(pool, { fromUserId: "payer", orgRoleId: VENTURE, tokenType: "gratitude", amountMinor: 1, nonce: nonce() })).toMatchObject({ ok: false, status: 400 });
    expect(await sendToOrg(pool, { fromUserId: "payer", orgRoleId: "retired", tokenType: TOKEN, amountMinor: 1, nonce: nonce() })).toMatchObject({ ok: false, status: 404 });
    expect(await orgBalance(pool, VENTURE, TOKEN)).toBe(units(30));
    await conserves();
  });

  it("refuses a member paying a venture they run, because members never cash out", async () => {
    const r = await sendToOrg(pool, { fromUserId: "operator", orgRoleId: VENTURE, tokenType: TOKEN, amountMinor: units(5), nonce: nonce() });
    expect(r).toMatchObject({ ok: false, status: 409 });
    expect(await balanceOf(pool, memberAccount("operator"), TOKEN)).toBe(units(50));
    await conserves();
  });

  // ── 3. Never negative ──────────────────────────────────────────────────────

  it("cannot pay out more than it holds: a venture account is not a faucet", async () => {
    const r = await postTransfer(pool, {
      from: orgAccountId(VENTURE), to: TREASURY, tokenType: TOKEN, amount: units(31),
      source: "org_probe", idempotencyKey: "probe:over",
    });
    expect(r.ok).toBe(false);
    expect(String(r.error)).toContain("insufficient");
    // allowNegative is refused for any source outside ALLOW_NEGATIVE_SOURCES.
    const forced = await postTransfer(pool, {
      from: orgAccountId(VENTURE), to: TREASURY, tokenType: TOKEN, amount: units(31),
      source: "org_probe", idempotencyKey: "probe:forced", allowNegative: true,
    } as any);
    expect(forced.ok).toBe(false);
    expect(await orgBalance(pool, VENTURE, TOKEN)).toBe(units(30));
    await conserves();
  });

  // ── 4. Who runs a venture ──────────────────────────────────────────────────

  it("is whoever is seated in its role now, as a member", async () => {
    await member("ended", 0);
    await member("demo-holder", 0);
    await seat(VENTURE, "ended", { ended: true });
    await seat(VENTURE, "demo-holder", { example: true });
    await seat(VENTURE, null, { documented: true });
    expect(await operatesOrg(pool, "operator", VENTURE)).toBe(true);
    expect(await operatesOrg(pool, "ended", VENTURE)).toBe(false);
    expect(await operatesOrg(pool, "demo-holder", VENTURE)).toBe(false);
    expect(await operatesOrg(pool, "payer", VENTURE)).toBe(false);
    expect((await orgsOperatedBy(pool, "operator")).map((a) => a.orgRoleId)).toEqual([VENTURE]);
    expect(await orgsOperatedBy(pool, "payer")).toEqual([]);
  });

  // ── 5. A venture's own gathering ───────────────────────────────────────────

  it("keeps a seat fee for the venture only with the dial on, a link and an account", async () => {
    const past = new Date(Date.now() - 5 * 86_400_000);
    const iso = (d: Date) => d.toISOString().slice(0, 19).replace("T", " ");
    for (const id of ["ev-venture", "ev-own"]) {
      await pool.query( // module-review-ok: fixture SQL against the S5 scratch schema, never a production table
        "INSERT INTO events (id, title, starts_at, ends_at, status, kind, layer, seat_price, seat_token) VALUES (?,?,?,?, 'scheduled', 'gathering', 'village', 4, ?)",
        [id, `Gathering ${id}`, iso(past), iso(past), TOKEN],
      );
    }
    expect(await linkOrgService(pool, { orgRoleId: VENTURE, kind: "event", id: "ev-venture", setBy: null })).toEqual({ ok: true });
    expect(await linkOrgService(pool, { orgRoleId: VENTURE, kind: "event", id: "ev-own", setBy: null })).toEqual({ ok: true });
    expect(await linkOrgService(pool, { orgRoleId: VENTURE, kind: "event", id: "ev-missing", setBy: null })).toMatchObject({ ok: false, status: 404 });
    expect(await linkOrgService(pool, { orgRoleId: "retired", kind: "event", id: "ev-venture", setBy: null })).toMatchObject({ ok: false, status: 404 });

    await setVariable(pool, ORG_SERVICE_ROUTING_KEY, "false");
    expect(await seatFeeDestination(pool, { eventId: "ev-venture", payerUserId: "payer" }), "dial off: the treasury").toBeNull();
    await setVariable(pool, ORG_SERVICE_ROUTING_KEY, "true");
    expect(await seatFeeDestination(pool, { eventId: "ev-venture", payerUserId: "payer" })).toEqual({ accountId: `org:${VENTURE}`, orgRoleId: VENTURE });
    expect(await seatFeeDestination(pool, { eventId: "ev-venture", payerUserId: "operator" }), "an operator's own fee: the treasury").toBeNull();

    const treasuryBefore = await balanceOf(pool, TREASURY, TOKEN);
    expect((await chargeForPlace(pool, "ev-venture", "payer", "", "seat")).ok).toBe(true);
    expect((await chargeForPlace(pool, "ev-own", "operator", "", "seat")).ok).toBe(true);
    await settleFinishedSeats(pool);
    expect(await orgBalance(pool, VENTURE, TOKEN), "the payer's fee went to the venture").toBe(units(34));
    expect(await balanceOf(pool, TREASURY, TOKEN), "the operator's fee went to the treasury").toBe(treasuryBefore + units(4));
    await conserves();
  }, 60_000);
});
