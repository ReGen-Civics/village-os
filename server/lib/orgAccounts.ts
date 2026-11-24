/**
 * A VENTURE HOLDS ITS OWN CREDITS (0419, the lead's decision of 23 Nov 2026).
 *
 *   "Amora credits are spent by members and redeemed only by ventures."
 *
 * So a venture needs a place on the ledger to receive what members spend with
 * it. This file is that place and the reads around it. It is credits lane 1 of
 * four; redemption (lane 2), the pay page (lane 3) and the floating button
 * (lane 4) build on the seams named at the bottom.
 *
 * ── THE ACCOUNT ─────────────────────────────────────────────────────────────
 *
 * `org:<orgRoleId>` in `ledger_accounts`, kind 'org', FAUCET 0. A venture is a
 * role in the org chart (`org_roles`), and the people seated in that role are
 * the people who run it. That is the whole of "who operates an org": nothing
 * here keeps a second list of operators to drift from the chart.
 *
 * Three properties fall out of the ledger and are not rebuilt here:
 *
 *   - NEVER NEGATIVE. Faucet 0, and nothing here passes `allowNegative`, so
 *     `postTransferOn` recomputes the sender's balance under its lock and
 *     refuses an overdraft. A venture can only ever pay out what it was paid.
 *   - SUM-ZERO HOLDS. Every movement is one `postTransfer`, a single
 *     double-entry row, so conservation per token is untouched by construction.
 *   - RECOMPUTE, NEVER INCREMENT. The balance this file reports is
 *     `token_balances`, which only the ledger writes, from `SUM(transfers)`.
 *
 * ── WHAT A VENTURE ACCOUNT RECEIVES, AND WHAT IT CANNOT ─────────────────────
 *
 * Two doors in, both behind dials that ship OFF:
 *
 *   1. A member pays it (`sendToOrg`, source `org_send`), while
 *      `ledger.org_accounts_open` is on.
 *   2. A seat fee for a gathering the venture runs is kept by it instead of the
 *      treasury (`seatFeeDestination`, called by `settleFinishedSeats`), while
 *      `ledger.org_service_routing` is on.
 *
 * Nothing mints into a venture account. A faucet posting here would be issuance
 * to a venture, which nobody decided, and the issuance decision (h) is that the
 * pay pool is the one source, with hand mints shown apart.
 *
 * ── THE ONE REFUSAL THAT IS A JUDGEMENT, SAID OUT LOUD ──────────────────────
 *
 * A member who runs a venture cannot pay that venture's account with their own
 * credits, and a seat fee they pay to their own venture's gathering goes to the
 * treasury as before. Decision (a) is that members never cash out. A venture
 * redeems, so a member able to move their own credits into a venture they run
 * would be a member cashing out with one extra step. Raised as an open
 * question with the lane's report, and this is the conservative answer until
 * the lead rules.
 */
import type { Pool } from "mysql2/promise";
import {
  ORG_ACCOUNTS_OPEN_KEY,
  ORG_SEND_SOURCE,
  ORG_SERVICE_ROUTING_KEY,
  orgAccountId,
  orgAccountIdProblem,
  type OrgAccountEntry,
  type OrgAccountView,
  type OrgPayee,
  type OrgServiceKind,
  type OrgServiceLink,
} from "../../shared/orgAccounts";
import { balanceOf, balancesFor, postTransfer, refusalForMember, tokenDef, type TransferResult } from "./ledger";
import { sendRefusal } from "./spending";
import { fromLedgerUnits } from "./economy";
import { boolVar } from "./variables";
import { accountEntryRows } from "../repos/tokenLedger";
import {
  deleteOrgService,
  eventTitleRow,
  insertOrgAccount,
  liveSeatedRoleIds,
  orgAccountRow,
  orgAccountRows,
  orgRoleFacts,
  orgServiceRows,
  serviceOwnerRow,
  updateOrgAccountLabel,
  upsertOrgService,
  type OrgAccountRow,
} from "../repos/orgAccounts";

// ── The dials ───────────────────────────────────────────────────────────────

/** Members may pay venture accounts, and operators see them. Off when a village is born. */
export function orgAccountsOpen(): boolean {
  return boolVar(ORG_ACCOUNTS_OPEN_KEY);
}

/** Seat fees for a venture's gatherings go to the venture. Off when a village is born. */
export function orgServiceRoutingOn(): boolean {
  return boolVar(ORG_SERVICE_ROUTING_KEY);
}

// ── Opening one ─────────────────────────────────────────────────────────────

export type OpenResult = { ok: true; account: OrgAccountRow; existed: boolean } | { ok: false; status: number; error: string };

/**
 * Open a venture's account, once. A second open answers the account the first
 * one made and changes nothing, so a double-clicked button opens one account.
 *
 * The role must exist, be live, and be real: a standing example is a
 * demonstration, and an account opened for one would hold real credits in a
 * row the example sweep deletes.
 */
export async function openOrgAccount(
  pool: Pool,
  input: { orgRoleId: string; label?: string | null; openedBy: string | null },
): Promise<OpenResult> {
  const orgRoleId = String(input.orgRoleId ?? "").trim();
  const idProblem = orgAccountIdProblem(orgRoleId);
  if (idProblem) return { ok: false, status: 400, error: idProblem };
  const role = await orgRoleFacts(pool, orgRoleId);
  if (!role) return { ok: false, status: 404, error: "There is no role with that id in the org chart." };
  if (role.isExample) return { ok: false, status: 409, error: "That role is a standing example. Open an account for a real venture role." };
  if (!role.active) return { ok: false, status: 409, error: `${role.name} is retired. Bring the role back before it holds credits.` };

  const before = await orgAccountRow(pool, orgRoleId);
  if (before) return { ok: true, account: before, existed: true };

  const label = String(input.label ?? "").trim().slice(0, 120) || role.name;
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await insertOrgAccount(conn, { orgRoleId, accountId: orgAccountId(orgRoleId), label, openedBy: input.openedBy });
    await conn.commit();
  } catch (e) {
    await conn.rollback().catch(() => undefined);
    throw e;
  } finally {
    conn.release();
  }
  const account = await orgAccountRow(pool, orgRoleId);
  if (!account) return { ok: false, status: 500, error: "The account was written and could not be read back." };
  return { ok: true, account, existed: false };
}

/** Rename what the village reads. Answers false when the venture has no account. */
export async function renameOrgAccount(pool: Pool, orgRoleId: string, label: string): Promise<boolean> {
  const clean = String(label ?? "").trim();
  if (!clean) return false;
  return updateOrgAccountLabel(pool, orgRoleId, clean);
}

// ── Reading one ─────────────────────────────────────────────────────────────

/**
 * SEAM: what one venture holds, MINOR units per token slug. Lane 2's
 * redemption reads this to weigh a request against the balance; the ledger's
 * own overdraft check is still the enforcement.
 */
export async function orgBalances(pool: Pool, orgRoleId: string): Promise<Record<string, number>> {
  return balancesFor(pool, orgAccountId(orgRoleId));
}

/** SEAM: one token's balance in MINOR units, zero when the venture never held it. */
export async function orgBalance(pool: Pool, orgRoleId: string, tokenType: string): Promise<number> {
  return balanceOf(pool, orgAccountId(orgRoleId), tokenType);
}

async function viewOf(pool: Pool, row: OrgAccountRow): Promise<OrgAccountView> {
  const balances = await balancesFor(pool, row.accountId);
  const slugs = Object.keys(balances);
  return {
    orgRoleId: row.orgRoleId,
    accountId: row.accountId,
    label: row.label,
    roleName: row.roleName,
    openedAt: row.openedAt,
    balances,
    decimals: Object.fromEntries(slugs.map((s) => [s, tokenDef(s)?.decimals ?? 0])),
    tokenNames: Object.fromEntries(slugs.map((s) => [s, tokenDef(s)?.name ?? s])),
  };
}

/** Every venture account with what it holds. For an admin or an `operator.config` holder. */
export async function listOrgAccountViews(pool: Pool): Promise<OrgAccountView[]> {
  const rows = await orgAccountRows(pool);
  return Promise.all(rows.map((r) => viewOf(pool, r)));
}

/** One venture account with what it holds, or null when the venture has none. */
export async function orgAccountView(pool: Pool, orgRoleId: string): Promise<OrgAccountView | null> {
  const row = await orgAccountRow(pool, orgRoleId);
  return row ? viewOf(pool, row) : null;
}

/**
 * The venture's movements, newest first, signed from the venture's side.
 * `nameOf` resolves a member id to a name for the line that has one, and is
 * passed so this file reads no member store of its own.
 */
export async function orgHistory(
  pool: Pool,
  orgRoleId: string,
  nameOf: (userId: string) => Promise<string | null>,
  limit = 200,
): Promise<OrgAccountEntry[]> {
  const acct = orgAccountId(orgRoleId);
  const rows = (await accountEntryRows(pool, acct)).slice(0, Math.max(1, limit));
  const names = new Map<string, string | null>();
  const out: OrgAccountEntry[] = [];
  for (const r of rows) {
    const incoming = String(r.to_account) === acct;
    const other = incoming ? String(r.from_account) : String(r.to_account);
    let withName: string | null = null;
    if (other.startsWith("mem:")) {
      const id = other.slice(4);
      if (!names.has(id)) names.set(id, await nameOf(id));
      withName = names.get(id) ?? null;
    }
    const slug = String(r.token_type);
    out.push({
      id: String(r.id),
      tokenType: slug,
      tokenName: tokenDef(slug)?.name ?? slug,
      decimals: tokenDef(slug)?.decimals ?? 0,
      amount: incoming ? Number(r.amount) : -Number(r.amount),
      source: String(r.source),
      description: r.description == null ? null : String(r.description),
      at: r.at instanceof Date ? r.at.toISOString() : String(r.at),
      withName,
    });
  }
  return out;
}

// ── Who runs one ────────────────────────────────────────────────────────────

/**
 * SEAM: the venture accounts this member runs, by being seated in the
 * venture's role right now. Lanes 2 to 4 ask this to decide what to show a
 * member and whose redemption they may ask for. It reads the org chart and
 * writes nothing; it grants no capability, and the capability gate stays the
 * only gate.
 */
export async function orgsOperatedBy(pool: Pool, userId: string): Promise<OrgAccountRow[]> {
  if (!userId) return [];
  const seated = new Set(await liveSeatedRoleIds(pool, userId));
  if (!seated.size) return [];
  return (await orgAccountRows(pool)).filter((a) => seated.has(a.orgRoleId));
}

/** SEAM: whether this member runs this venture right now. */
export async function operatesOrg(pool: Pool, userId: string, orgRoleId: string): Promise<boolean> {
  if (!userId || !orgRoleId) return false;
  return (await liveSeatedRoleIds(pool, userId)).includes(orgRoleId);
}

/** SEAM for the pay page: the ventures a member may pay, names only, nothing they hold. */
export async function orgPayees(pool: Pool): Promise<OrgPayee[]> {
  return (await orgAccountRows(pool)).map((a) => ({ orgRoleId: a.orgRoleId, label: a.label }));
}

// ── A member pays a venture ─────────────────────────────────────────────────

export type SendToOrgResult =
  | { ok: true; duplicate: boolean; sent: number; tokenName: string; to: string; balance: number; balanceDecimals: number }
  | { ok: false; status: number; error: string };

/**
 * ONE `postTransfer`, member to venture, the same shape the member-to-member
 * send writes. `amountMinor` is already MINOR: the send card converts beside
 * the input that shows the scale, as it does for a member send.
 *
 * The idempotency key is the caller's nonce, so a retried tap pays once. The
 * dial is asked here and not only at the route, so no other caller can open a
 * door the village left shut.
 */
export async function sendToOrg(
  pool: Pool,
  input: { fromUserId: string; orgRoleId: string; tokenType: string; amountMinor: number; note?: string | null; nonce: string },
): Promise<SendToOrgResult> {
  if (!orgAccountsOpen()) {
    return { ok: false, status: 403, error: "Paying a venture's account is not open in this village yet." };
  }
  const slug = String(input.tokenType ?? "").trim();
  const refusal = sendRefusal(slug);
  if (refusal) return { ok: false, status: 400, error: refusal };
  const n = Math.trunc(Number(input.amountMinor) || 0);
  if (n <= 0) return { ok: false, status: 400, error: "How much are you sending?" };

  const orgRoleId = String(input.orgRoleId ?? "").trim();
  const account = orgRoleId && !orgAccountIdProblem(orgRoleId) ? await orgAccountRow(pool, orgRoleId) : null;
  if (!account) return { ok: false, status: 404, error: "That venture has no account here." };
  if (await operatesOrg(pool, input.fromUserId, orgRoleId)) {
    return {
      ok: false,
      status: 409,
      error: `You run ${account.label}, so your own credits cannot go into its account. Members pay a venture, and the venture redeems.`,
    };
  }

  const from = `mem:${input.fromUserId}`;
  const nonce = String(input.nonce ?? "").trim().slice(0, 64) || `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const r: TransferResult = await postTransfer(pool, {
    from,
    to: account.accountId,
    tokenType: slug,
    amount: n,
    source: ORG_SEND_SOURCE,
    sourceRef: orgRoleId,
    description: String(input.note ?? "").trim().slice(0, 180) || undefined,
    idempotencyKey: `org-send:${input.fromUserId}:${nonce}`,
  });
  const tokenName = tokenDef(slug)?.name ?? slug;
  if (!r.ok) {
    const holds = fromLedgerUnits(slug, await balanceOf(pool, from, slug));
    return {
      ok: false,
      status: 409,
      error: refusalForMember(r.error, { accountIds: [from, account.accountId], holds: String(holds), tokenName }),
    };
  }
  return {
    ok: true,
    duplicate: r.duplicate,
    sent: n,
    tokenName,
    to: account.label,
    balance: await balanceOf(pool, from, slug),
    balanceDecimals: tokenDef(slug)?.decimals ?? 0,
  };
}

// ── Priced services a venture runs ──────────────────────────────────────────

/** Say a venture runs this service. Refuses an unknown service or a venture with no account. */
export async function linkOrgService(
  pool: Pool,
  input: { orgRoleId: string; kind: OrgServiceKind; id: string; setBy: string | null },
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const account = await orgAccountRow(pool, input.orgRoleId);
  if (!account) return { ok: false, status: 404, error: "That venture has no account yet. Open one first." };
  const id = String(input.id ?? "").trim();
  if (!id) return { ok: false, status: 400, error: "Choose the gathering this venture runs." };
  if (input.kind === "event" && !(await eventTitleRow(pool, id))) {
    return { ok: false, status: 404, error: "There is no gathering with that id on the calendar." };
  }
  await upsertOrgService(pool, { kind: input.kind, id, orgRoleId: input.orgRoleId, setBy: input.setBy });
  return { ok: true };
}

export async function unlinkOrgService(pool: Pool, input: { orgRoleId: string; kind: OrgServiceKind; id: string }): Promise<boolean> {
  return deleteOrgService(pool, input);
}

/** The services one venture runs, with their titles. */
export async function orgServices(pool: Pool, orgRoleId: string): Promise<OrgServiceLink[]> {
  const rows = await orgServiceRows(pool, orgRoleId);
  const out: OrgServiceLink[] = [];
  for (const r of rows) {
    if (r.kind !== "event") continue;
    out.push({ kind: "event", id: r.id, orgRoleId: r.orgRoleId, title: await eventTitleRow(pool, r.id) });
  }
  return out;
}

/**
 * WHERE A KEPT SEAT FEE GOES. The village treasury, unless every one of these
 * holds, in which case the venture that runs the gathering:
 *
 *   - `ledger.org_service_routing` is on,
 *   - the gathering is linked to a venture, and that venture has an account,
 *   - the member who paid is not seated in that venture's role (see the header).
 *
 * Returns the account to credit and the venture's role id, or null for the
 * treasury. Read at the moment the fee is kept, so a link made after a member
 * paid still routes that fee, and a link removed first sends it to the treasury.
 */
export async function seatFeeDestination(
  pool: Pool,
  input: { eventId: string; payerUserId: string | null },
): Promise<{ accountId: string; orgRoleId: string } | null> {
  if (!orgServiceRoutingOn()) return null;
  const owner = await serviceOwnerRow(pool, "event", input.eventId);
  if (!owner) return null;
  const account = await orgAccountRow(pool, owner);
  if (!account) return null;
  if (input.payerUserId && (await operatesOrg(pool, input.payerUserId, owner))) return null;
  return { accountId: account.accountId, orgRoleId: owner };
}
