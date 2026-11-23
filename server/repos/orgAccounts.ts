/**
 * `org_accounts` and `org_account_services` (0419), and the two reads of the
 * org chart a venture account needs.
 *
 * Every statement against the two 0419 tables lives here, so their readers stay
 * enumerable. No statement here touches a balance: what a venture holds is the
 * ledger's, read through `balancesFor` in server/lib/ledger.ts, and
 * `token_balances` is written only by the ledger's own recompute.
 *
 * The one write to `ledger_accounts` is the account row itself, written the way
 * `postTransferOn` writes a member's and `ensureTreasuryAccount` writes a
 * circle's: `INSERT IGNORE`, faucet 0. A venture account holds tokens somebody
 * else issued and can never issue any, which is also what keeps it inside the
 * ledger's overdraft rule.
 */
import type { Pool, PoolConnection, RowDataPacket } from "mysql2/promise";
import { ORG_ACCOUNT_KIND, type OrgServiceKind } from "../../shared/orgAccounts";

export interface OrgAccountRow {
  orgRoleId: string;
  accountId: string;
  label: string;
  openedBy: string | null;
  openedAt: string;
  /** Joined from `org_roles`; null when the role row is gone. */
  roleName: string | null;
}

const toAccount = (r: RowDataPacket): OrgAccountRow => ({
  orgRoleId: String(r.org_role_id),
  accountId: String(r.account_id),
  label: String(r.label),
  openedBy: r.opened_by == null ? null : String(r.opened_by),
  openedAt: r.opened_at instanceof Date ? r.opened_at.toISOString() : String(r.opened_at),
  roleName: r.role_name == null ? null : String(r.role_name),
});

const ACCOUNT_SELECT =
  "SELECT a.org_role_id, a.account_id, a.label, a.opened_by, a.opened_at, r.name AS role_name " +
  "FROM org_accounts a LEFT JOIN org_roles r ON r.id = a.org_role_id";

/** Every venture account, in the order the village reads its names. */
export async function orgAccountRows(pool: Pool | PoolConnection): Promise<OrgAccountRow[]> {
  const [rows] = await pool.query<RowDataPacket[]>(`${ACCOUNT_SELECT} ORDER BY a.label, a.org_role_id`);
  return rows.map(toAccount);
}

/** One venture's account, or null when it has none. */
export async function orgAccountRow(pool: Pool | PoolConnection, orgRoleId: string): Promise<OrgAccountRow | null> {
  const [rows] = await pool.query<RowDataPacket[]>(`${ACCOUNT_SELECT} WHERE a.org_role_id = ?`, [orgRoleId]);
  return rows[0] ? toAccount(rows[0]) : null;
}

/**
 * Write the ledger account and the venture's row, both `INSERT IGNORE`, so a
 * second open finds what the first one made. The caller passes a connection
 * inside a transaction so the two rows land together.
 */
export async function insertOrgAccount(
  conn: PoolConnection,
  row: { orgRoleId: string; accountId: string; label: string; openedBy: string | null },
): Promise<void> {
  await conn.query( // module-review-ok: the ledger's own INSERT IGNORE for an account row, the shape postTransferOn and ensureTreasuryAccount write; faucet 0 keeps the account inside the overdraft rule
    "INSERT IGNORE INTO ledger_accounts (id, kind, user_id, label, faucet) VALUES (?,?,?,?,0)",
    [row.accountId, ORG_ACCOUNT_KIND, null, row.label.slice(0, 120)],
  );
  await conn.query(
    "INSERT IGNORE INTO org_accounts (org_role_id, account_id, label, opened_by) VALUES (?,?,?,?)",
    [row.orgRoleId, row.accountId, row.label.slice(0, 120), row.openedBy],
  );
}

/** Rename what the village reads. The ledger row keeps the label it was opened with. */
export async function updateOrgAccountLabel(pool: Pool, orgRoleId: string, label: string): Promise<boolean> {
  const [r] = await pool.query<any>("UPDATE org_accounts SET label = ? WHERE org_role_id = ?", [label.slice(0, 120), orgRoleId]);
  return Number(r?.affectedRows ?? 0) > 0;
}

/** Whether the ledger holds the account row. Read to prove the open landed. */
export async function ledgerAccountKind(pool: Pool | PoolConnection, accountId: string): Promise<{ kind: string; faucet: boolean } | null> {
  const [rows] = await pool.query<RowDataPacket[]>("SELECT kind, faucet FROM ledger_accounts WHERE id = ?", [accountId]);
  return rows[0] ? { kind: String(rows[0].kind), faucet: !!rows[0].faucet } : null;
}

// ── The org chart, read ─────────────────────────────────────────────────────

export interface OrgRoleFacts {
  id: string;
  name: string;
  active: boolean;
  isExample: boolean;
}

/** The facts about a role that opening an account weighs. */
export async function orgRoleFacts(pool: Pool | PoolConnection, orgRoleId: string): Promise<OrgRoleFacts | null> {
  const [rows] = await pool.query<RowDataPacket[]>("SELECT id, name, active, is_example FROM org_roles WHERE id = ?", [orgRoleId]);
  const r = rows[0];
  return r ? { id: String(r.id), name: String(r.name), active: r.active == null ? true : !!r.active, isExample: !!r.is_example } : null;
}

/**
 * The roles this member is seated in right now: a live seating that names
 * their account. A documented holder or an agent has no account and is never
 * an operator. A standing-example seating is a demonstration and never counts.
 * A lapsed term still counts, because the person is still acting
 * (docs/ARCHITECTURE.md, the org chart's "Terms end, and nothing is revoked").
 */
export async function liveSeatedRoleIds(pool: Pool | PoolConnection, userId: string): Promise<string[]> {
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT DISTINCT org_role_id FROM org_role_assignments " +
      "WHERE user_id = ? AND holder_kind = 'member' AND ended_at IS NULL AND is_example = 0",
    [userId],
  );
  return rows.map((r) => String(r.org_role_id));
}

/** The members seated in this role right now, by the same rule as `liveSeatedRoleIds`. */
export async function liveSeatedUserIds(pool: Pool | PoolConnection, orgRoleId: string): Promise<string[]> {
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT DISTINCT user_id FROM org_role_assignments " +
      "WHERE org_role_id = ? AND holder_kind = 'member' AND user_id IS NOT NULL AND ended_at IS NULL AND is_example = 0",
    [orgRoleId],
  );
  return rows.map((r) => String(r.user_id));
}

// ── Priced services a venture runs ──────────────────────────────────────────

export interface OrgServiceRow {
  kind: string;
  id: string;
  orgRoleId: string;
  setBy: string | null;
  setAt: string;
}

const toService = (r: RowDataPacket): OrgServiceRow => ({
  kind: String(r.service_kind),
  id: String(r.service_id),
  orgRoleId: String(r.org_role_id),
  setBy: r.set_by == null ? null : String(r.set_by),
  setAt: r.set_at instanceof Date ? r.set_at.toISOString() : String(r.set_at),
});

/** Say a venture runs this service. A service belongs to one venture, so a second link moves it. */
export async function upsertOrgService(
  pool: Pool,
  row: { kind: OrgServiceKind; id: string; orgRoleId: string; setBy: string | null },
): Promise<void> {
  await pool.query(
    "INSERT INTO org_account_services (service_kind, service_id, org_role_id, set_by) VALUES (?,?,?,?) " +
      "ON DUPLICATE KEY UPDATE org_role_id = VALUES(org_role_id), set_by = VALUES(set_by), set_at = CURRENT_TIMESTAMP",
    [row.kind, row.id, row.orgRoleId, row.setBy],
  );
}

/** Take a service off a venture. Scoped to the venture, so a stale id moves nothing. */
export async function deleteOrgService(pool: Pool, row: { kind: OrgServiceKind; id: string; orgRoleId: string }): Promise<boolean> {
  const [r] = await pool.query<any>(
    "DELETE FROM org_account_services WHERE service_kind = ? AND service_id = ? AND org_role_id = ?",
    [row.kind, row.id, row.orgRoleId],
  );
  return Number(r?.affectedRows ?? 0) > 0;
}

/** Every service one venture runs. */
export async function orgServiceRows(pool: Pool | PoolConnection, orgRoleId: string): Promise<OrgServiceRow[]> {
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT service_kind, service_id, org_role_id, set_by, set_at FROM org_account_services WHERE org_role_id = ? ORDER BY set_at, service_id",
    [orgRoleId],
  );
  return rows.map(toService);
}

/** The venture that runs this service, or null. */
export async function serviceOwnerRow(pool: Pool | PoolConnection, kind: OrgServiceKind, id: string): Promise<string | null> {
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT org_role_id FROM org_account_services WHERE service_kind = ? AND service_id = ?",
    [kind, id],
  );
  return rows[0] ? String(rows[0].org_role_id) : null;
}

/** A gathering's title, or null when it is gone. The one service kind there is today. */
export async function eventTitleRow(pool: Pool | PoolConnection, eventId: string): Promise<string | null> {
  const [rows] = await pool.query<RowDataPacket[]>("SELECT title FROM events WHERE id = ? AND removed_at IS NULL", [eventId]);
  return rows[0] ? String(rows[0].title) : null;
}

/** Gatherings that ask a seat fee, newest first: the ones a venture could run for credits. */
export async function pricedGatheringRows(pool: Pool | PoolConnection, limit = 200): Promise<Array<{ id: string; title: string }>> {
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT id, title FROM events WHERE removed_at IS NULL AND seat_price > 0 AND seat_token IS NOT NULL ORDER BY starts_at DESC LIMIT ?",
    [Math.max(1, Math.min(500, limit))],
  );
  return rows.map((r) => ({ id: String(r.id), title: String(r.title) }));
}
