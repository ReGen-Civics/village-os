/**
 * The review of an End of Moon line's token shares (`moon_reward_reviews`,
 * drizzle/0388_moon_reward_reviews). The contract is shared/moonRewardReview.ts.
 *
 * EVERY CHANGE TO A SHARE TAKES THE ROW LOCK SETTLING TAKES. Approving and
 * changing both run inside one transaction that reads the posting and its
 * review `FOR UPDATE` (`withRewardRows`), decides on what it locked, and writes
 * before it lets go. `settleOwedPosting` locks the same posting row and pays
 * only an `owed` one, so:
 *   - a change always moves the posting back to `awaiting`, and a changed
 *     amount can never be paid on an approval given before the change
 *     (security lane, #1349 S2 1);
 *   - who changed it is read under the lock that the approval writes under,
 *     so the second-person rule cannot be raced (S2 2).
 */
import type { Pool, PoolConnection, RowDataPacket } from "mysql2/promise";
import type { RewardReviewState } from "../../shared/moonRewardReview";

export interface RewardReviewInsert {
  idempotencyKey: string;
  invoiceId: string;
  userId: string;
  tokenSlug: string;
  unitsShared: number;
  lineKey: string;
  lineTotalMinor: number;
  cashMinor: number;
  currency: string;
}

/** Recorded beside the posting, inside the approval's own transaction. A key already recorded is left as it is. */
export async function recordRewardReviews(conn: Pool | PoolConnection, rows: readonly RewardReviewInsert[]): Promise<void> {
  for (const r of rows) {
    await conn.query(
      "INSERT INTO `moon_reward_reviews` (`idempotency_key`, `invoice_id`, `user_id`, `token_slug`, `units_shared`, `line_key`, `line_total_minor`, `cash_minor`, `currency`, `state`) " +
        "VALUES (?,?,?,?,?,?,?,?,?,'waiting') ON DUPLICATE KEY UPDATE `idempotency_key` = `idempotency_key`",
      [r.idempotencyKey, r.invoiceId.slice(0, 64), r.userId, r.tokenSlug, r.unitsShared, r.lineKey.slice(0, 120), r.lineTotalMinor, r.cashMinor, r.currency.slice(0, 8)],
    );
  }
}

export type RewardPostingState = "awaiting" | "owed" | "posted" | "refused";

/** One moon token line: the posting, with its review when it has one. */
export interface RewardLineRow {
  key: string;
  claimId: string;
  sourceRef: string;
  userId: string;
  token: string;
  units: number;
  decimals: number;
  description: string;
  postingState: RewardPostingState;
  lastError: string | null;
  createdAt: number;
  review: null | {
    state: RewardReviewState;
    invoiceId: string;
    unitsShared: number;
    lineKey: string;
    lineTotalMinor: number;
    cashMinor: number;
    currency: string;
    unitsSet: number | null;
    setReason: string | null;
    setBy: string | null;
    setAt: number | null;
    approvedBy: string | null;
    approvedAt: number | null;
    approvedAlone: boolean;
    memberReply: string | null;
    memberReplyAt: number | null;
  };
}

const SELECT =
  "SELECT p.`idempotency_key`, p.`claim_id`, p.`source_ref`, p.`to_user_id`, p.`token_slug`, p.`units`, p.`decimals`, p.`description`, p.`state`, p.`last_error`, " +
  "UNIX_TIMESTAMP(p.`created_at`) AS `created_s`, r.`idempotency_key` AS `r_key`, r.`state` AS `r_state`, r.`invoice_id`, r.`units_shared`, r.`line_key`, " +
  "r.`line_total_minor`, r.`cash_minor`, r.`currency`, r.`units_set`, r.`set_reason`, r.`set_by`, UNIX_TIMESTAMP(r.`set_at`) AS `set_s`, r.`approved_by`, " +
  "UNIX_TIMESTAMP(r.`approved_at`) AS `approved_s`, r.`approved_alone`, r.`member_reply`, UNIX_TIMESTAMP(r.`member_reply_at`) AS `reply_s` " +
  "FROM `quest_owed_postings` p LEFT JOIN `moon_reward_reviews` r ON r.`idempotency_key` = p.`idempotency_key` ";

const num = (v: unknown): number | null => (v == null ? null : Number(v));
const str = (v: unknown): string | null => (v == null ? null : String(v));

function toLine(r: RowDataPacket): RewardLineRow {
  return {
    key: String(r.idempotency_key),
    claimId: String(r.claim_id),
    sourceRef: String(r.source_ref),
    userId: String(r.to_user_id),
    token: String(r.token_slug),
    units: Number(r.units),
    decimals: Number(r.decimals),
    description: String(r.description),
    postingState: String(r.state) as RewardPostingState,
    lastError: str(r.last_error),
    createdAt: Number(r.created_s),
    review: r.r_key == null ? null : {
      state: String(r.r_state) === "approved" ? "approved" : "waiting",
      invoiceId: String(r.invoice_id),
      unitsShared: Number(r.units_shared),
      lineKey: String(r.line_key),
      lineTotalMinor: Number(r.line_total_minor),
      cashMinor: Number(r.cash_minor),
      currency: String(r.currency),
      unitsSet: num(r.units_set),
      setReason: str(r.set_reason),
      setBy: str(r.set_by),
      setAt: num(r.set_s),
      approvedBy: str(r.approved_by),
      approvedAt: num(r.approved_s),
      approvedAlone: Number(r.approved_alone) === 1,
      memberReply: str(r.member_reply),
      memberReplyAt: num(r.reply_s),
    },
  };
}

/**
 * Every moon token line recorded in [fromS, toS), seconds since the epoch, compared through
 * UNIX_TIMESTAMP so the database host's zone cannot shift a month's edge. Reads one past `limit`,
 * so the caller can say the list was cut.
 */
export async function rewardLinesBetween(pool: Pool, source: string, fromS: number, toS: number, limit: number): Promise<RewardLineRow[]> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `${SELECT}WHERE p.\`source\` = ? AND UNIX_TIMESTAMP(p.\`created_at\`) >= ? AND UNIX_TIMESTAMP(p.\`created_at\`) < ? ORDER BY p.\`created_at\`, p.\`idempotency_key\` LIMIT ?`,
    [source, fromS, toS, limit + 1],
  );
  return rows.map(toLine);
}

/** One member's moon token lines, newest first. */
export async function rewardLinesFor(pool: Pool, source: string, userId: string, limit = 100): Promise<RewardLineRow[]> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `${SELECT}WHERE p.\`source\` = ? AND p.\`to_user_id\` = ? ORDER BY p.\`created_at\` DESC, p.\`idempotency_key\` LIMIT ?`,
    [source, userId, limit],
  );
  return rows.map(toLine);
}

export async function rewardLinesByKeys(pool: Pool | PoolConnection, source: string, keys: readonly string[]): Promise<RewardLineRow[]> {
  if (keys.length === 0) return [];
  const [rows] = await pool.query<RowDataPacket[]>(`${SELECT}WHERE p.\`source\` = ? AND p.\`idempotency_key\` IN (?)`, [source, keys]);
  return rows.map(toLine);
}

/** Shares waiting with no review row yet: recorded before reviews existed (the migration moved them to `awaiting`). */
export async function awaitingWithoutReview(pool: Pool, source: string, limit = 500): Promise<RewardLineRow[]> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `${SELECT}WHERE p.\`source\` = ? AND p.\`state\` = 'awaiting' AND r.\`idempotency_key\` IS NULL ORDER BY p.\`created_at\` LIMIT ?`,
    [source, limit],
  );
  return rows.map(toLine);
}

/**
 * Run `decide` on these keys' rows, and on every other share of the same lines,
 * locked `FOR UPDATE` in key order, inside one transaction. `decide` writes
 * through the connection it is handed and answers what to return; a refusal
 * (`{ ok: false }`) rolls everything back.
 */
export async function withRewardRows<T extends { ok: boolean }>(
  pool: Pool,
  source: string,
  keys: readonly string[],
  decide: (conn: PoolConnection, rows: RewardLineRow[], lineMates: RewardLineRow[]) => Promise<T>,
): Promise<T> {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [own] = await conn.query<RowDataPacket[]>(
      `${SELECT}WHERE p.\`source\` = ? AND p.\`idempotency_key\` IN (?) ORDER BY p.\`idempotency_key\` FOR UPDATE`,
      [source, keys.length ? keys : [""]],
    );
    const rows = own.map(toLine);
    const lines = Array.from(new Set(rows.map((r) => `${r.claimId}\u0000${r.sourceRef}`)));
    let mates: RewardLineRow[] = [];
    if (lines.length) {
      const [m] = await conn.query<RowDataPacket[]>(
        `${SELECT}WHERE p.\`source\` = ? AND (p.\`claim_id\`, p.\`source_ref\`) IN (?) ORDER BY p.\`idempotency_key\` FOR UPDATE`,
        [source, lines.map((l) => l.split("\u0000"))],
      );
      mates = m.map(toLine).filter((r) => !keys.includes(r.key));
    }
    const out = await decide(conn, rows, mates);
    if (out.ok) await conn.commit();
    else await conn.rollback();
    return out;
  } catch (e) {
    await conn.rollback().catch(() => undefined);
    throw e;
  } finally {
    conn.release();
  }
}

/** A change, on the locked connection: the posting's units and state follow, and the review goes back to waiting. */
export async function writeRewardChange(conn: PoolConnection, p: { key: string; units: number; reason: string; by: string }): Promise<void> {
  await conn.query("UPDATE `quest_owed_postings` SET `units` = ?, `state` = 'awaiting' WHERE `idempotency_key` = ? AND `state` IN ('awaiting', 'owed')", [p.units, p.key]);
  await conn.query(
    "UPDATE `moon_reward_reviews` SET `state` = 'waiting', `units_set` = ?, `set_reason` = ?, `set_by` = ?, `set_at` = CURRENT_TIMESTAMP, " +
      "`approved_by` = NULL, `approved_at` = NULL, `approved_alone` = 0, `member_reply` = NULL, `member_reply_at` = NULL WHERE `idempotency_key` = ?",
    [p.units, p.reason.slice(0, 500), p.by, p.key],
  );
}

/** An approval, on the locked connection: the review reads approved and the posting becomes owed, which is what lets it pay. */
export async function writeRewardApproval(conn: PoolConnection, p: { key: string; by: string; alone: boolean }): Promise<void> {
  await conn.query(
    "UPDATE `moon_reward_reviews` SET `state` = 'approved', `approved_by` = ?, `approved_at` = CURRENT_TIMESTAMP, `approved_alone` = ? WHERE `idempotency_key` = ?",
    [p.by, p.alone ? 1 : 0, p.key],
  );
  await conn.query("UPDATE `quest_owed_postings` SET `state` = 'owed' WHERE `idempotency_key` = ? AND `state` = 'awaiting'", [p.key]);
}

/** The member's answer to a change of their own line. Answers false when the line is not theirs or was never changed. */
export async function replyToRewardChange(pool: Pool, p: { key: string; userId: string; text: string }): Promise<boolean> {
  const [res] = await pool.query<import("mysql2/promise").ResultSetHeader>(
    "UPDATE `moon_reward_reviews` SET `member_reply` = ?, `member_reply_at` = CURRENT_TIMESTAMP " +
      "WHERE `idempotency_key` = ? AND `user_id` = ? AND `units_set` IS NOT NULL",
    [p.text.slice(0, 1000), p.key, p.userId],
  );
  return res.affectedRows === 1;
}
