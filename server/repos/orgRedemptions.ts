/**
 * `org_redemptions` (0420): every statement against a venture's redemption
 * requests lives here, so its readers stay enumerable.
 *
 * Nothing here posts or touches a balance. The hold, the burn and the release
 * are ledger postings made by server/lib/orgRedemptions.ts through
 * `postTransferOn`, inside the same transaction as the row they belong to.
 */
import type { Pool, PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";

export interface OrgRedemptionRow {
  id: string;
  orgRoleId: string;
  accountId: string;
  requestedBy: string;
  tokenSlug: string;
  /** MINOR units of the token. */
  amountUnits: number;
  currency: string;
  pegCurrency: string;
  pegRate: number;
  fxRate: number | null;
  fxAsOf: string | null;
  rateMinor: number;
  grossMinor: number;
  payTo: string;
  state: string;
  holdKey: string;
  burnKey: string;
  releaseKey: string;
  decidedBy: string | null;
  decidedAt: string | null;
  paymentRef: string | null;
  decisionNote: string | null;
  createdAt: string;
}

const iso = (v: unknown): string => (v instanceof Date ? v.toISOString() : new Date(String(v)).toISOString());

function toRow(r: RowDataPacket): OrgRedemptionRow {
  return {
    id: String(r.id),
    orgRoleId: String(r.org_role_id),
    accountId: String(r.account_id),
    requestedBy: String(r.requested_by),
    tokenSlug: String(r.token_slug),
    amountUnits: Number(r.amount),
    currency: String(r.currency),
    pegCurrency: String(r.peg_currency),
    pegRate: Number(r.peg_rate),
    fxRate: r.fx_rate == null ? null : Number(r.fx_rate),
    fxAsOf: r.fx_as_of == null ? null : String(r.fx_as_of),
    rateMinor: Number(r.rate_minor),
    grossMinor: Number(r.gross_minor),
    payTo: String(r.pay_to),
    state: String(r.state),
    holdKey: String(r.hold_key),
    burnKey: String(r.burn_key),
    releaseKey: String(r.release_key),
    decidedBy: r.decided_by == null ? null : String(r.decided_by),
    decidedAt: r.decided_at == null ? null : iso(r.decided_at),
    paymentRef: r.payment_ref == null ? null : String(r.payment_ref),
    decisionNote: r.decision_note == null ? null : String(r.decision_note),
    createdAt: iso(r.created_at),
  };
}

export async function insertOrgRedemption(
  conn: PoolConnection,
  row: Omit<OrgRedemptionRow, "state" | "decidedBy" | "decidedAt" | "paymentRef" | "decisionNote" | "createdAt">,
): Promise<void> {
  await conn.query(
    "INSERT INTO `org_redemptions` (`id`, `org_role_id`, `account_id`, `requested_by`, `token_slug`, `amount`, " +
      "`currency`, `peg_currency`, `peg_rate`, `fx_rate`, `fx_as_of`, `rate_minor`, `gross_minor`, `pay_to`, " +
      "`state`, `hold_key`, `burn_key`, `release_key`) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,'requested',?,?,?)",
    [
      row.id, row.orgRoleId, row.accountId, row.requestedBy, row.tokenSlug, row.amountUnits,
      row.currency, row.pegCurrency, row.pegRate, row.fxRate, row.fxAsOf, row.rateMinor, row.grossMinor, row.payTo,
      row.holdKey, row.burnKey, row.releaseKey,
    ],
  );
}

export async function orgRedemptionRow(pool: Pool | PoolConnection, id: string): Promise<OrgRedemptionRow | null> {
  const [rows] = await pool.query<RowDataPacket[]>("SELECT * FROM `org_redemptions` WHERE `id` = ?", [id]);
  return rows[0] ? toRow(rows[0]) : null;
}

/**
 * MINOR units per token spoken for since a moment, across every venture: the
 * requests still waiting and the confirmed ones. A refused or cancelled one
 * gave its credits back, so it spends none of the cap.
 */
export async function usedSinceRows(pool: Pool | PoolConnection, since: Date): Promise<Array<{ token: string; units: number }>> {
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT `token_slug`, SUM(`amount`) AS total FROM `org_redemptions` " +
      "WHERE `created_at` >= ? AND `state` IN ('requested','confirmed') GROUP BY `token_slug`",
    [since],
  );
  return rows.map((r) => ({ token: String(r.token_slug), units: Number(r.total ?? 0) }));
}

/** Move a row out of `requested`, once. Only the caller whose update changed the row may post. */
export async function claimOrgRedemption(
  conn: PoolConnection,
  claim: { id: string; to: string; decidedBy: string | null; paymentRef: string | null; note: string | null },
): Promise<boolean> {
  const [upd] = await conn.query<ResultSetHeader>(
    "UPDATE `org_redemptions` SET `state` = ?, `decided_by` = ?, `decided_at` = CURRENT_TIMESTAMP, " +
      "`payment_ref` = ?, `decision_note` = ? WHERE `id` = ? AND `state` = 'requested'",
    [claim.to, claim.decidedBy, claim.paymentRef, claim.note, claim.id],
  );
  return Number(upd.affectedRows) === 1;
}

/** One venture's redemptions, newest first. */
export async function orgRedemptionsFor(pool: Pool, orgRoleId: string, limit = 20): Promise<OrgRedemptionRow[]> {
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT * FROM `org_redemptions` WHERE `org_role_id` = ? ORDER BY `created_at` DESC, `id` DESC LIMIT ?",
    [orgRoleId, Math.max(1, Math.min(100, limit))],
  );
  return rows.map(toRow);
}

/** Everything waiting on the Treasury, oldest first so nothing rots. */
export async function waitingOrgRedemptions(pool: Pool, limit = 200): Promise<OrgRedemptionRow[]> {
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT * FROM `org_redemptions` WHERE `state` = 'requested' ORDER BY `created_at`, `id` LIMIT ?",
    [Math.max(1, Math.min(500, limit))],
  );
  return rows.map(toRow);
}

/** The most recent decided ones, for the record a Treasury holder checks against. */
export async function decidedOrgRedemptions(pool: Pool, limit = 20): Promise<OrgRedemptionRow[]> {
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT * FROM `org_redemptions` WHERE `state` <> 'requested' ORDER BY `decided_at` DESC, `id` DESC LIMIT ?",
    [Math.max(1, Math.min(100, limit))],
  );
  return rows.map(toRow);
}

/** MINOR units per token the waiting rows say the hold account holds. */
export async function owedToHoldRows(pool: Pool): Promise<Array<{ token: string; units: number; n: number }>> {
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT `token_slug`, SUM(`amount`) AS total, COUNT(*) AS n FROM `org_redemptions` " +
      "WHERE `state` = 'requested' GROUP BY `token_slug`",
  );
  return rows.map((r) => ({ token: String(r.token_slug), units: Number(r.total ?? 0), n: Number(r.n ?? 0) }));
}

/**
 * MONEY A VENTURE HAS BEEN PAID THROUGH REDEMPTION, per currency, minor units.
 * Counted here and only here: it is the venture's cash, and no "paid by the
 * village" figure for a person reads this table.
 */
export async function redeemedMoneyRows(pool: Pool, orgRoleId: string): Promise<Array<{ currency: string; minor: number }>> {
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT `currency`, SUM(`gross_minor`) AS total FROM `org_redemptions` " +
      "WHERE `org_role_id` = ? AND `state` = 'confirmed' GROUP BY `currency` ORDER BY `currency`",
    [orgRoleId],
  );
  return rows.map((r) => ({ currency: String(r.currency), minor: Number(r.total ?? 0) }));
}
