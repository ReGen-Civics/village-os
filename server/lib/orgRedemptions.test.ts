/**
 * A VENTURE REDEEMS ITS CREDITS (0420, credits lane 2), against a scratch
 * schema, and the pure decisions with no database at all.
 *
 * What this file holds the ledger to:
 *
 *   1. The door ships shut, and only the people seated in the venture's role
 *      can ask.
 *   2. Asking moves the credits from the venture to the hold in the same
 *      transaction as the row, priced at the peg, with the rate written down.
 *   3. Confirming burns from the hold to `sys:redeemed`; nobody who runs the
 *      venture or asked can confirm; a reference is required; a second
 *      decision is refused.
 *   4. Refusing and cancelling return the credits, once.
 *   5. The per-cycle cap is counted across every venture, waiting plus
 *      confirmed, and 0 means zero; two ventures racing cannot both pass it.
 *   6. A venture's payout is never "paid by the village" for the person who ran it.
 *
 * Every database case ends on `checkLedgerInvariants` (sum-zero per token,
 * cache equals recomputation, no non-faucet account negative) and on the hold
 * reconciling with the waiting rows.
 */
import mysql from "mysql2/promise";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { testPool, provisionTestDb, testDbConfigured, type TestDb } from "../db/testDb";
import {
  CYCLE_POOL_FAUCET,
  balanceOf,
  checkLedgerInvariants,
  contributionTokens,
  hasBeenPaidByVillage,
  loadTokenRegistry,
  memberAccount,
  postTransfer,
} from "./ledger";
import { toLedgerUnits } from "./economy";
import { setVariable } from "./variables";
import { openOrgAccount, orgBalance } from "./orgAccounts";
import { REDEEMED } from "./redemption";
import { decideOrgRedemption, orgHoldReconciliation, orgRedemptionTerms, requestOrgRedemption, redeemedMoney } from "./orgRedemptions";
import {
  ORG_REDEMPTION_CAP_KEY,
  ORG_REDEMPTION_CURRENCIES_KEY,
  ORG_REDEMPTION_HOLD,
  ORG_REDEMPTION_OPEN_KEY,
  orgDecideRefusal,
  orgRedemptionMoveRefusal,
  parseOrgRedemptionCurrencies,
  quoteOrgRedemption,
} from "../../shared/orgRedemptions";

describe("the pure decisions", () => {
  it("prices at the peg, and converts through the daily table with the rate kept", () => {
    const usd = quoteOrgRedemption({ wholeCredits: 25, currency: "USD", pegCurrency: "USD", pegRate: 1, rates: {}, asOf: null });
    expect(usd).toMatchObject({ rateMinor: 100, grossMinor: 2500, fxRate: null, fxAsOf: null });
    // EUR-based table: 1 EUR = 1.1 USD = 550 CRC, so 1 USD = 500 CRC.
    const crc = quoteOrgRedemption({ wholeCredits: 3, currency: "CRC", pegCurrency: "USD", pegRate: 1, rates: { USD: 1.1, CRC: 550 }, asOf: "2026-11-23" });
    expect(crc?.fxRate).toBeCloseTo(500, 6);
    expect(crc?.fxAsOf).toBe("2026-11-23");
    expect(crc?.grossMinor).toBe(3 * (crc?.rateMinor ?? 0));
    expect(quoteOrgRedemption({ wholeCredits: 3, currency: "CRC", pegCurrency: "USD", pegRate: 1, rates: {}, asOf: null }), "no daily rate, no price").toBeNull();
    expect(quoteOrgRedemption({ wholeCredits: 3, currency: "USD", pegCurrency: "USD", pegRate: 0, rates: {}, asOf: null }), "a rate of 0 is no rate").toBeNull();
  });

  it("reads the currency list, never empty", () => {
    expect(parseOrgRedemptionCurrencies("usd, crc,USD")).toEqual(["USD", "CRC"]);
    expect(parseOrgRedemptionCurrencies("")).toEqual(["USD"]);
  });

  it("refuses a confirmer who runs the venture or asked, and one with no reference", () => {
    const base = { to: "confirmed" as const, actorRunsIt: false, actorAsked: false, paymentRef: "TX-1", note: "" };
    expect(orgDecideRefusal(base)).toBeNull();
    expect(orgDecideRefusal({ ...base, actorRunsIt: true })).toMatch(/You run this venture/);
    expect(orgDecideRefusal({ ...base, actorAsked: true })).toMatch(/You asked for this redemption/);
    expect(orgDecideRefusal({ ...base, paymentRef: " " })).toMatch(/reference/);
    expect(orgDecideRefusal({ ...base, to: "refused", note: "" })).toMatch(/Say why/);
  });

  it("never moves a settled redemption", () => {
    expect(orgRedemptionMoveRefusal("confirmed", "refused")).toMatch(/gone/);
    expect(orgRedemptionMoveRefusal("cancelled", "confirmed")).toMatch(/already cancelled/);
    expect(orgRedemptionMoveRefusal("requested", "confirmed")).toBeNull();
  });
});

const configured = testDbConfigured();
if (!configured) {
  // eslint-disable-next-line no-console
  console.warn("[orgRedemptions.test] TEST_DATABASE_URL not set. Venture redemption is UNCHECKED here.");
}

const TOKEN = "credits";
const units = (human: number) => toLedgerUnits(TOKEN, human);
const FX = { rates: {} as Record<string, number>, asOf: null };
const since = () => new Date(Date.now() - 24 * 60 * 60 * 1000);

describe.skipIf(!configured)("a venture redeems its credits", () => {
  let db: TestDb;
  let pool: mysql.Pool;
  let n = 0;

  const conserves = async () => {
    const inv = await checkLedgerInvariants(pool);
    expect(inv.problems).toEqual([]);
    for (const r of await orgHoldReconciliation(pool)) expect(r.driftUnits, `hold drift for ${r.token}`).toBe(0);
  };
  const member = async (id: string) => {
    await pool.query("INSERT INTO users (id, name, email, password_hash) VALUES (?,?,?,?)", [id, `Name ${id}`, `${id}@example.test`, "h"]); // module-review-ok: fixture SQL against the S5 scratch schema, never a production table
  };
  const role = async (id: string) => {
    await pool.query("INSERT INTO org_roles (id, name, active, is_example) VALUES (?,?,1,0)", [id, `Role ${id}`]); // module-review-ok: fixture SQL against the S5 scratch schema
  };
  const seat = async (roleId: string, userId: string) => {
    await pool.query( // module-review-ok: fixture SQL against the S5 scratch schema
      "INSERT INTO org_role_assignments (id, org_role_id, holder_kind, user_id, holder_key, is_example) VALUES (?,?,?,?,?,0)",
      [`as-${roleId}-${userId}-${++n}`, roleId, "member", userId, `mem:${userId}`],
    );
  };
  /** Give a venture credits the way the village does: a member pays it, here straight from the pool faucet. */
  const fund = async (roleId: string, credits: number) => {
    const r = await postTransfer(pool, { from: CYCLE_POOL_FAUCET, to: `org:${roleId}`, tokenType: TOKEN, amount: units(credits), source: "org_send", idempotencyKey: `fund:${roleId}:${++n}` });
    expect(r.ok, r.error).toBe(true);
  };
  const ask = (userId: string, orgRoleId: string, amount: number, extra: Partial<{ currency: string; payTo: string }> = {}) =>
    requestOrgRedemption(pool, { userId, orgRoleId, tokenSlug: TOKEN, amount, currency: extra.currency ?? "USD", payTo: extra.payTo ?? "Bank account 123", cycleStart: since(), fx: FX });

  beforeAll(async () => {
    db = await provisionTestDb();
    pool = testPool(db, { connectionLimit: 8 }); // module-review-ok: the S5 scratch-schema harness pool
    await loadTokenRegistry(pool);
    for (const id of ["runner", "runner2", "treasurer", "other"]) await member(id);
    await role("cafe");
    await role("bakery");
    await seat("cafe", "runner");
    await seat("bakery", "runner2");
    for (const r of ["cafe", "bakery"]) expect((await openOrgAccount(pool, { orgRoleId: r, openedBy: null })).ok).toBe(true);
    await fund("cafe", 80);
    await fund("bakery", 80);
  }, 180_000);

  afterAll(async () => {
    for (const k of [ORG_REDEMPTION_OPEN_KEY, ORG_REDEMPTION_CAP_KEY, ORG_REDEMPTION_CURRENCIES_KEY]) await setVariable(pool, k, "").catch(() => undefined);
    await pool?.end();
    await db?.drop();
  });

  it("is shut when a village is born, and open only to the venture's own people", async () => {
    const shut = await ask("runner", "cafe", 10);
    expect(shut).toMatchObject({ ok: false, status: 403 });
    if (!shut.ok) expect(shut.error).toMatch(/cannot redeem credits in this village yet/);
    await setVariable(pool, ORG_REDEMPTION_OPEN_KEY, "true");
    expect(await ask("other", "cafe", 10)).toMatchObject({ ok: false, status: 403 });
    expect(await ask("runner", "bakery", 10), "running one venture opens no other").toMatchObject({ ok: false, status: 403 });
    expect(await ask("runner", "nowhere", 10)).toMatchObject({ ok: false, status: 404 });
    expect(await orgBalance(pool, "cafe", TOKEN)).toBe(units(80));
  });

  it("holds the credits with the row, priced at the peg, and refuses what it cannot price", async () => {
    expect(await ask("runner", "cafe", 10, { payTo: " " })).toMatchObject({ ok: false, status: 409 });
    expect(await ask("runner", "cafe", 500)).toMatchObject({ ok: false, status: 409 });
    expect(await ask("runner", "cafe", 10, { currency: "EUR" }), "a currency the village does not offer").toMatchObject({ ok: false, status: 409 });
    await setVariable(pool, ORG_REDEMPTION_CURRENCIES_KEY, "USD,CRC");
    const noRate = await ask("runner", "cafe", 10, { currency: "CRC" });
    expect(noRate.ok).toBe(false);
    if (!noRate.ok) expect(noRate.error).toMatch(/no daily rate for CRC/);

    const r = await ask("runner", "cafe", 30);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.row).toMatchObject({ state: "requested", currency: "USD", pegCurrency: "USD", rateMinor: 100, grossMinor: 3000, amountUnits: units(30), requestedBy: "runner" });
    expect(await orgBalance(pool, "cafe", TOKEN)).toBe(units(50));
    expect(await balanceOf(pool, ORG_REDEMPTION_HOLD, TOKEN)).toBe(units(30));
    await conserves();
  });

  it("refuses a confirmation by anyone who runs the venture, and burns on a Treasury confirm", async () => {
    const r = await ask("runner", "cafe", 5);
    if (!r.ok) throw new Error(r.error);
    // A second person seated in the venture, who did not ask, is still refused.
    await seat("cafe", "other");
    const own = await decideOrgRedemption(pool, { id: r.row.id, to: "confirmed", actorUserId: "other", paymentRef: "TX-own" });
    expect(own).toMatchObject({ ok: false, status: 409 });
    if (!own.ok) expect(own.error).toMatch(/You run this venture/);
    const asker = await decideOrgRedemption(pool, { id: r.row.id, to: "confirmed", actorUserId: "runner", paymentRef: "TX-own" });
    expect(asker).toMatchObject({ ok: false, status: 409 });
    expect(await decideOrgRedemption(pool, { id: r.row.id, to: "confirmed", actorUserId: "treasurer", paymentRef: "" })).toMatchObject({ ok: false, status: 409 });

    const retiredBefore = await balanceOf(pool, REDEEMED, TOKEN);
    const ok = await decideOrgRedemption(pool, { id: r.row.id, to: "confirmed", actorUserId: "treasurer", paymentRef: "TX-555" });
    expect(ok.ok).toBe(true);
    if (ok.ok) expect(ok.row).toMatchObject({ state: "confirmed", decidedBy: "treasurer", paymentRef: "TX-555" });
    expect(await balanceOf(pool, REDEEMED, TOKEN)).toBe(retiredBefore + units(5));
    const again = await decideOrgRedemption(pool, { id: r.row.id, to: "refused", actorUserId: "treasurer", note: "changed my mind" });
    expect(again).toMatchObject({ ok: false, status: 409 });
    expect(await redeemedMoney(pool, "cafe")).toEqual([{ currency: "USD", minor: 500, text: expect.any(String) }]);
    await conserves();
  });

  it("gives the credits back on a refusal or a cancel, once", async () => {
    const before = await orgBalance(pool, "cafe", TOKEN);
    const a = await ask("runner", "cafe", 4);
    const b = await ask("runner", "cafe", 6);
    if (!a.ok || !b.ok) throw new Error("asks failed");
    expect(await decideOrgRedemption(pool, { id: a.row.id, to: "refused", actorUserId: "treasurer", note: "" })).toMatchObject({ ok: false });
    expect((await decideOrgRedemption(pool, { id: a.row.id, to: "refused", actorUserId: "treasurer", note: "Not this moon" })).ok).toBe(true);
    expect(await decideOrgRedemption(pool, { id: b.row.id, to: "cancelled", actorUserId: "treasurer" }), "only the venture cancels").toMatchObject({ ok: false, status: 403 });
    expect((await decideOrgRedemption(pool, { id: b.row.id, to: "cancelled", actorUserId: "runner" })).ok).toBe(true);
    expect(await decideOrgRedemption(pool, { id: b.row.id, to: "cancelled", actorUserId: "runner" })).toMatchObject({ ok: false, status: 409 });
    expect(await orgBalance(pool, "cafe", TOKEN)).toBe(before);
    await conserves();
  });

  it("counts the cycle cap across every venture, waiting plus confirmed, and 0 means zero", async () => {
    // So far this cycle: 30 waiting + 5 confirmed for the cafe = 35. Refused and cancelled count nothing.
    const terms = await orgRedemptionTerms(pool, since(), FX);
    expect(terms.usedCredits).toBe(35);
    await setVariable(pool, ORG_REDEMPTION_CAP_KEY, "40");
    const over = await ask("runner2", "bakery", 6);
    expect(over.ok).toBe(false);
    if (!over.ok) expect(over.error).toMatch(/redeem 5 more/);
    expect((await ask("runner2", "bakery", 5)).ok).toBe(true);
    await setVariable(pool, ORG_REDEMPTION_CAP_KEY, "0");
    const zero = await ask("runner2", "bakery", 1);
    expect(zero.ok).toBe(false);
    if (!zero.ok) expect(zero.error).toMatch(/not redeeming any credits this moon/);
    await conserves();
  });

  it("lets only one of two ventures racing for the last of the cap through", async () => {
    await setVariable(pool, ORG_REDEMPTION_CAP_KEY, "50"); // 40 spoken for, 10 left
    const [x, y] = await Promise.all([ask("runner", "cafe", 10), ask("runner2", "bakery", 10)]);
    expect([x.ok, y.ok].filter(Boolean)).toHaveLength(1);
    expect((await orgRedemptionTerms(pool, since(), FX)).usedCredits).toBe(50);
    await conserves();
  });

  it("never counts a venture's payout as the village paying the person who runs it", async () => {
    expect(await hasBeenPaidByVillage(pool, "runner", contributionTokens())).toBe(false);
    expect(await balanceOf(pool, memberAccount("runner"), TOKEN)).toBe(0);
  });
});
