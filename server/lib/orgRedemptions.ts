/**
 * A VENTURE REDEEMS ITS CREDITS (0420, credits lane 2), the half that moves value.
 *
 * The sequence, which is the member redemption's sequence (server/lib/redemption.ts)
 * with a venture in the member's place:
 *
 *   1. ASK. A person seated in the venture's role asks to redeem N credits the
 *      venture's account `org:<orgRoleId>` holds, in a currency the village
 *      offers, and says where the money should go. The credits move from the
 *      venture to `sys:org-redemption-hold` at once.
 *   2. PAY, outside the platform. A redemption key holder (`redemption.confirm`,
 *      the Treasury role) sends the money.
 *   3. CONFIRM, with the payment's reference. The held credits move on to
 *      `sys:redeemed`, the sink that only ever receives, and are gone.
 *      Or REFUSE (a key holder, with a reason) or CANCEL (the venture), and the
 *      held credits go back to the venture's account.
 *
 * WHAT IS REUSED AND WHAT IS NOT. The key (`redemption.confirm`, through the
 * one gate), the retiring sink, the hold-then-burn shape, the snapshot law (a
 * row says what it was worth the day it was asked for) and the daily rate
 * table are the member module's. The table and the hold account are this
 * module's own, for the reasons 0420 gives: a venture's request is not a
 * member's, and must not block the asker's exit or spend their member caps.
 *
 * ── ONE TRANSACTION PER MOVE, AND WHY THIS IS STRICTER THAN THE MEMBER PATH ─
 *
 * The member path commits its row and then posts the hold in a second
 * transaction, and carries a page of care for the gap between them. This path
 * has no gap: `postTransferOn` posts on the caller's connection, so the row and
 * its hold commit together, and a decision's state change and its burn or
 * release commit together. Every waiting row has its hold behind it, and the
 * hold account's balance per token equals the waiting rows by construction
 * (`orgHoldReconciliation` still reads both, so a drift would be seen).
 *
 * ── THE LOCK THAT MAKES THE CAP REAL ────────────────────────────────────────
 *
 * Every move locks the hold account's row first (`lockLedgerAccounts`), so
 * every ask, confirmation, refusal and cancel in the village is serialised on
 * one row. Two ventures asking at the same instant therefore cannot both read
 * the same cycle total and both pass the cap: the second waits for the first
 * to commit and then counts it. The lock is taken BEFORE the first plain read,
 * for the snapshot-isolation reason `lockLedgerAccounts` documents.
 *
 * ── HOW A MOON IS COUNTED ───────────────────────────────────────────────────
 *
 * `cycleWindow()`, the village's own cycle clock (the lunar cycle unless the
 * village set another), so the cap renews when every other per-cycle count
 * does. A redemption counts against the cycle it was ASKED in, while it waits
 * and once it is confirmed; a refused or cancelled one gave its credits back
 * and counts for nothing. Credits are summed in whole credits across every
 * venture and every credit token, because the lead's peg prices all of them
 * the same.
 *
 * UNITS: MINOR in the ledger and in `org_redemptions`.`amount`; whole credits
 * only in the cap, the refusal sentences and the payloads.
 */
import type { Pool, PoolConnection } from "mysql2/promise";
import {
  ORG_REDEMPTION_BURN_SOURCE,
  ORG_REDEMPTION_CAP_KEY,
  ORG_REDEMPTION_CURRENCIES_KEY,
  ORG_REDEMPTION_HOLD,
  ORG_REDEMPTION_HOLD_SOURCE,
  ORG_REDEMPTION_OPEN_KEY,
  ORG_REDEMPTION_RATE_KEY,
  ORG_REDEMPTION_RELEASE_SOURCE,
  PAY_TO_MAX,
  PAYMENT_REF_MAX,
  orgDecideRefusal,
  orgRedeemRefusal,
  orgRedemptionMoveRefusal,
  parseOrgRedemptionCurrencies,
  quoteOrgRedemption,
  type OrgRedemptionState,
  type OrgRedemptionTerms,
  type OrgRedemptionView,
} from "../../shared/orgRedemptions";
import { finerThanScale } from "../../shared/tokenScale";
import { formatMoney } from "../../shared/money";
import { balanceOf, lockLedgerAccounts, postTransferOn, tokenDef } from "./ledger";
import { decimalsFor, fromLedgerUnits, keys, toLedgerUnits, villageId } from "./economy";
import { isPriceableToken, MODULE_VOUCHERS } from "./spending";
import { REDEEMED } from "./redemption";
import { boolVar, numberVar, stringVar } from "./variables";
import { lostConcurrencyRace } from "../db/concurrency";
import { accountBalanceRows } from "../repos/tokenBalances";
import { orgAccountRow } from "../repos/orgAccounts";
import {
  claimOrgRedemption,
  insertOrgRedemption,
  orgRedemptionRow,
  owedToHoldRows,
  redeemedMoneyRows,
  usedSinceRows,
  type OrgRedemptionRow,
} from "../repos/orgRedemptions";
import { operatesOrg } from "./orgAccounts";

// ── The dials ───────────────────────────────────────────────────────────────

export function orgRedemptionOpen(): boolean {
  return boolVar(ORG_REDEMPTION_OPEN_KEY);
}

/** Whole credits per cycle across every venture. A broken value is 0: fail closed. */
export function orgRedemptionCapCredits(): number {
  const n = numberVar(ORG_REDEMPTION_CAP_KEY);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function orgRedemptionCurrencies(): string[] {
  return parseOrgRedemptionCurrencies(stringVar(ORG_REDEMPTION_CURRENCIES_KEY));
}

export function orgRedemptionPegRate(): number {
  const n = numberVar(ORG_REDEMPTION_RATE_KEY);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/**
 * A token a venture may redeem: a village credit (platform governed, active,
 * real, kind credit) that is not a module voucher. A stay or library voucher
 * buys one thing from the village, and that thing is what it is worth.
 */
export function ventureRedeemableToken(slug: string): boolean {
  return isPriceableToken(slug) && !MODULE_VOUCHERS.has(slug);
}

/** Whole credits every venture together has spoken for since `since`. */
export async function usedCreditsSince(pool: Pool | PoolConnection, since: Date): Promise<number> {
  let whole = 0;
  for (const r of await usedSinceRows(pool, since)) whole += fromLedgerUnits(r.token, r.units);
  return whole;
}

export type DailyRates = { rates: Record<string, number>; asOf: string | null };

/** What a venture's card reads before it asks. */
export async function orgRedemptionTerms(pool: Pool, cycleStart: Date, fx: DailyRates): Promise<OrgRedemptionTerms> {
  const currencies = orgRedemptionCurrencies();
  const pegRate = orgRedemptionPegRate();
  const capCredits = orgRedemptionCapCredits();
  const usedCredits = await usedCreditsSince(pool, cycleStart);
  const rateMinor: Record<string, number | null> = {};
  for (const c of currencies) {
    rateMinor[c] =
      quoteOrgRedemption({ wholeCredits: 1, currency: c, pegCurrency: currencies[0], pegRate, rates: fx.rates, asOf: fx.asOf })?.rateMinor ?? null;
  }
  return {
    open: orgRedemptionOpen(),
    currencies,
    pegCurrency: currencies[0],
    pegRate,
    capCredits,
    usedCredits,
    leftCredits: Math.max(0, capCredits - usedCredits),
    rateMinor,
  };
}

// ── Asking ──────────────────────────────────────────────────────────────────

export interface OrgRedeemInput {
  userId: string;
  orgRoleId: string;
  tokenSlug: string;
  /** HUMAN, as typed. Converted once, here. */
  amount: number;
  currency: string;
  payTo: string;
  cycleStart: Date;
  fx: DailyRates;
}

export type OrgRedeemOutcome = { ok: true; row: OrgRedemptionRow } | { ok: false; status: number; error: string };

const newId = () => `ordm-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

/**
 * Ask to redeem. Every refusal is decided by `orgRedeemRefusal`, twice: once
 * on the pool to say the nearest true thing cheaply, and once inside the lock,
 * where the balance and the cycle total cannot move under it, which is the one
 * that decides what happens.
 */
export async function requestOrgRedemption(pool: Pool, input: OrgRedeemInput): Promise<OrgRedeemOutcome> {
  const slug = String(input.tokenSlug ?? "").trim().toLowerCase();
  const orgRoleId = String(input.orgRoleId ?? "").trim();
  const def = tokenDef(slug);
  const decimals = decimalsFor(slug);
  const amount = Number(input.amount);
  const units = Number.isFinite(amount) ? toLedgerUnits(slug, amount) : 0;
  const account = orgRoleId ? await orgAccountRow(pool, orgRoleId) : null;
  const currencies = orgRedemptionCurrencies();
  const currency = String(input.currency ?? "").trim().toUpperCase() || currencies[0];
  const payTo = String(input.payTo ?? "").trim().slice(0, PAY_TO_MAX);
  const quote = quoteOrgRedemption({
    wholeCredits: fromLedgerUnits(slug, units),
    currency,
    pegCurrency: currencies[0],
    pegRate: orgRedemptionPegRate(),
    rates: input.fx.rates,
    asOf: input.fx.asOf,
  });
  const runsIt = !!account && (await operatesOrg(pool, input.userId, orgRoleId));
  const askWith = (heldUnits: number, usedCredits: number) =>
    orgRedeemRefusal({
      open: orgRedemptionOpen(),
      runsIt,
      ventureHasAccount: !!account,
      tokenName: def?.name ?? slug,
      tokenRedeemable: !!def && ventureRedeemableToken(slug),
      wholeCredits: fromLedgerUnits(slug, units),
      decimals,
      tooFine: !Number.isFinite(amount) || finerThanScale(amount, decimals),
      heldCredits: fromLedgerUnits(slug, heldUnits),
      currencies,
      currency,
      priced: !!quote,
      payTo,
      capCredits: orgRedemptionCapCredits(),
      usedCredits,
    });
  // The door, the account and who is asking come before any number, with their own statuses.
  if (!orgRedemptionOpen() || !account || !runsIt) {
    return { ok: false, status: orgRedemptionOpen() && !account ? 404 : 403, error: askWith(0, 0) ?? "Refused" };
  }
  const pre = askWith(await balanceOf(pool, account.accountId, slug), await usedCreditsSince(pool, input.cycleStart));
  if (pre) return { ok: false, status: 409, error: pre };

  const id = newId();
  for (let attempt = 1; ; attempt++) {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      // THE LOCK FIRST: the hold row serialises every venture's ask, so the cap is counted once.
      await lockLedgerAccounts(conn, account.accountId, ORG_REDEMPTION_HOLD);
      const heldUnits = await balanceOf(conn, account.accountId, slug);
      const used = await usedCreditsSince(conn, input.cycleStart);
      const refusal = askWith(heldUnits, used);
      if (refusal || !quote) {
        await conn.rollback();
        return { ok: false, status: 409, error: refusal ?? "This redemption could not be priced" };
      }
      await insertOrgRedemption(conn, {
        id,
        orgRoleId,
        accountId: account.accountId,
        requestedBy: input.userId,
        tokenSlug: slug,
        amountUnits: units,
        currency: quote.currency,
        pegCurrency: quote.pegCurrency,
        pegRate: quote.pegRate,
        fxRate: quote.fxRate,
        fxAsOf: quote.fxAsOf,
        rateMinor: quote.rateMinor,
        grossMinor: quote.grossMinor,
        payTo,
        holdKey: keys.orgRedemptionHold(villageId(), id),
        burnKey: keys.orgRedemptionBurn(villageId(), id),
        releaseKey: keys.orgRedemptionRelease(villageId(), id),
      });
      const held = await postTransferOn(conn, {
        from: account.accountId,
        to: ORG_REDEMPTION_HOLD,
        tokenType: slug,
        // ALREADY MINOR, converted once above.
        amount: units,
        source: ORG_REDEMPTION_HOLD_SOURCE,
        sourceRef: id,
        description: "Held against a venture redemption",
        idempotencyKey: keys.orgRedemptionHold(villageId(), id),
      });
      if (!held.ok) {
        await conn.rollback();
        return { ok: false, status: 409, error: held.error ?? "The ledger refused the hold" };
      }
      await conn.commit();
      break;
    } catch (e) {
      try { await conn.rollback(); } catch { /* already rolled back */ }
      if (!lostConcurrencyRace(e) || attempt >= 3) throw e;
      await new Promise((r) => setTimeout(r, 25 * attempt + Math.floor(Math.random() * 25)));
    } finally {
      conn.release();
    }
  }
  const row = await orgRedemptionRow(pool, id);
  if (!row) return { ok: false, status: 500, error: "The redemption was written and could not be read back" };
  return { ok: true, row };
}

// ── Deciding ────────────────────────────────────────────────────────────────

export interface OrgDecideInput {
  id: string;
  to: Exclude<OrgRedemptionState, "requested">;
  actorUserId: string;
  paymentRef?: string | null;
  note?: string | null;
}

export type OrgDecideOutcome = { ok: true; row: OrgRedemptionRow } | { ok: false; status: number; error: string };

/**
 * Confirm, refuse or cancel. The CAPABILITY is the route's to ask, through the
 * one gate (confirm and refuse need `redemption.confirm`); everything about
 * WHO this person is relative to the venture is asked here, so no other caller
 * can skip it.
 *
 *   confirmed  a key holder who does not run the venture and did not ask,
 *              with the payment's reference. The held credits burn.
 *   refused    the same person, with a reason. The held credits go back.
 *   cancelled  somebody who runs the venture, or who asked. They go back.
 *
 * The state moves first, as a compare-and-set, in the same transaction as the
 * posting, so exactly one of the burn or the release can ever be written.
 */
export async function decideOrgRedemption(pool: Pool, input: OrgDecideInput): Promise<OrgDecideOutcome> {
  const row = await orgRedemptionRow(pool, input.id);
  if (!row) return { ok: false, status: 404, error: "No such redemption" };
  const moved = orgRedemptionMoveRefusal(row.state as OrgRedemptionState, input.to);
  if (moved) return { ok: false, status: 409, error: moved };
  const runsIt = await operatesOrg(pool, input.actorUserId, row.orgRoleId);
  const asked = row.requestedBy === input.actorUserId;
  const paymentRef = String(input.paymentRef ?? "").trim().slice(0, PAYMENT_REF_MAX);
  const note = String(input.note ?? "").trim().slice(0, 500);
  if (input.to === "cancelled") {
    if (!runsIt && !asked) return { ok: false, status: 403, error: "Only the people who run this venture can cancel its redemption" };
  } else {
    const refusal = orgDecideRefusal({ to: input.to, actorRunsIt: runsIt, actorAsked: asked, paymentRef, note });
    if (refusal) return { ok: false, status: 409, error: refusal };
  }

  const burns = input.to === "confirmed";
  for (let attempt = 1; ; attempt++) {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      await lockLedgerAccounts(conn, ORG_REDEMPTION_HOLD, burns ? REDEEMED : row.accountId);
      const won = await claimOrgRedemption(conn, {
        id: row.id,
        to: input.to,
        decidedBy: input.actorUserId,
        paymentRef: burns ? paymentRef : null,
        note: note || (input.to === "cancelled" ? "Cancelled by the venture" : null),
      });
      if (!won) {
        await conn.rollback();
        return { ok: false, status: 409, error: "This redemption has just been decided by somebody else" };
      }
      const posted = burns
        ? await postTransferOn(conn, {
            from: ORG_REDEMPTION_HOLD,
            to: REDEEMED,
            tokenType: row.tokenSlug,
            // ALREADY MINOR: `org_redemptions`.`amount`, written once at the ask.
            amount: row.amountUnits,
            source: ORG_REDEMPTION_BURN_SOURCE,
            sourceRef: row.id,
            description: `Redeemed by a venture and retired: ${row.id}`,
            idempotencyKey: keys.orgRedemptionBurn(villageId(), row.id),
          })
        : await postTransferOn(conn, {
            from: ORG_REDEMPTION_HOLD,
            to: row.accountId,
            tokenType: row.tokenSlug,
            amount: row.amountUnits,
            source: ORG_REDEMPTION_RELEASE_SOURCE,
            sourceRef: row.id,
            description: `Redemption ${input.to}, credits back: ${row.id}`,
            idempotencyKey: keys.orgRedemptionRelease(villageId(), row.id),
          });
      if (!posted.ok) {
        await conn.rollback();
        return { ok: false, status: 500, error: `Nothing moved: ${posted.error ?? "the ledger refused"}` };
      }
      await conn.commit();
      break;
    } catch (e) {
      try { await conn.rollback(); } catch { /* already rolled back */ }
      if (!lostConcurrencyRace(e) || attempt >= 3) throw e;
      await new Promise((r) => setTimeout(r, 25 * attempt + Math.floor(Math.random() * 25)));
    } finally {
      conn.release();
    }
  }
  const after = await orgRedemptionRow(pool, row.id);
  return after ? { ok: true, row: after } : { ok: false, status: 500, error: "The decision was written and could not be read back" };
}

// ── Reading ─────────────────────────────────────────────────────────────────

/** One row as people read it. `nameOf` resolves member ids; `labelOf` venture labels. */
export async function orgRedemptionView(
  row: OrgRedemptionRow,
  nameOf: (userId: string) => Promise<string | null>,
  labelOf: (orgRoleId: string) => Promise<string | null>,
): Promise<OrgRedemptionView> {
  const def = tokenDef(row.tokenSlug);
  return {
    id: row.id,
    orgRoleId: row.orgRoleId,
    ventureLabel: (await labelOf(row.orgRoleId)) ?? row.orgRoleId,
    token: row.tokenSlug,
    tokenName: def?.name ?? row.tokenSlug,
    credits: fromLedgerUnits(row.tokenSlug, row.amountUnits),
    currency: row.currency,
    pegCurrency: row.pegCurrency,
    pegRate: row.pegRate,
    fxRate: row.fxRate,
    fxAsOf: row.fxAsOf,
    rateMinor: row.rateMinor,
    grossMinor: row.grossMinor,
    grossText: formatMoney(row.grossMinor, row.currency),
    rateText: formatMoney(row.rateMinor, row.currency),
    payTo: row.payTo,
    state: row.state as OrgRedemptionState,
    requestedBy: row.requestedBy,
    requestedByName: await nameOf(row.requestedBy),
    paymentRef: row.paymentRef,
    decisionNote: row.decisionNote,
    decidedByName: row.decidedBy ? await nameOf(row.decidedBy) : null,
    decidedAt: row.decidedAt,
    createdAt: row.createdAt,
  };
}

/**
 * The hold account against the waiting rows, per token, MINOR units. Equal by
 * construction (each move is one transaction); read so that a drift would be
 * seen, the way every escrow in this codebase is read.
 */
export async function orgHoldReconciliation(
  pool: Pool,
): Promise<Array<{ token: string; heldUnits: number; owedUnits: number; driftUnits: number; openCount: number }>> {
  const balances = await accountBalanceRows(pool, ORG_REDEMPTION_HOLD);
  const owed = await owedToHoldRows(pool);
  const tokens = new Set<string>([...balances.map((b) => String(b.token_type)), ...owed.map((o) => o.token)]);
  return Array.from(tokens)
    .sort()
    .map((token) => {
      const heldUnits = Number(balances.find((b) => String(b.token_type) === token)?.balance ?? 0);
      const o = owed.find((x) => x.token === token) ?? { units: 0, n: 0 };
      return { token, heldUnits, owedUnits: o.units, driftUnits: heldUnits - o.units, openCount: o.n };
    });
}

/** Cash this venture has been paid through redemption, per currency, as words. Its own figure. */
export async function redeemedMoney(pool: Pool, orgRoleId: string): Promise<Array<{ currency: string; minor: number; text: string }>> {
  return (await redeemedMoneyRows(pool, orgRoleId)).map((r) => ({ ...r, text: formatMoney(r.minor, r.currency) }));
}
