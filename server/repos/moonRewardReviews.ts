/**
 * The review of an End of Moon line's token shares (`moon_reward_reviews`,
 * drizzle/9999_moon_reward_reviews). The contract is shared/moonRewardReview.ts.
 *
 * A changed amount is written to the review row and to the owed posting's own
 * `units` in one transaction, and only while the posting is still owed, so a
 * posting that has issued can never be changed after the fact.
 */
import type { Pool, PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import type { RewardReviewState } from "../../shared/moonRewardReview";

export interface RewardReviewInsert {
  idempotencyKey: string;
  invoiceId: string;
  userId: string;
  tokenSlug: string;
  unitsShared: number;
  lineTotalMinor: number;
  currency: string;
}

/** Recorded inside the approval's own transaction, beside the owed posting. A key already recorded is left as it is. */
export async function recordRewardReviews(conn: PoolConnection, rows: readonly RewardReviewInsert[]): Promise<void> {
  for (const r of rows) {
    await conn.query(
      "INSERT INTO `moon_reward_reviews` (`idempotency_key`, `invoice_id`, `user_id`, `token_slug`, `units_shared`, `line_total_minor`, `currency`, `state`) " +
        "VALUES (?,?,?,?,?,?,?,'waiting') ON DUPLICATE KEY UPDATE `idempotency_key` = `idempotency_key`",
      [r.idempotencyKey, r.invoiceId.slice(0, 64), r.userId, r.tokenSlug, r.unitsShared, r.lineTotalMinor, r.currency.slice(0, 8)],
    );
  }
}

/** One moon token line: the owed posting, with its review when it has one. */
export interface RewardLineRow {
  key: string;
  claimId: string;
  userId: string;
  token: string;
  units: number;
  decimals: number;
  description: string;
  postingState: "owed" | "posted" | "refused";
  lastError: string | null;
  createdAt: number;
  review: null | {
    state: RewardReviewState;
    invoiceId: string;
    unitsShared: number;
    lineTotalMinor: number;
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
  "SELECT p.`idempotency_key`, p.`claim_id`, p.`to_user_id`, p.`token_slug`, p.`units`, p.`decimals`, p.`description`, p.`state`, p.`last_error`, " +
  "UNIX_TIMESTAMP(p.`created_at`) AS `created_s`, r.`idempotency_key` AS `r_key`, r.`state` AS `r_state`, r.`invoice_id`, r.`units_shared`, " +
  "r.`line_total_minor`, r.`currency`, r.`units_set`, r.`set_reason`, r.`set_by`, UNIX_TIMESTAMP(r.`set_at`) AS `set_s`, r.`approved_by`, " +
  "UNIX_TIMESTAMP(r.`approved_at`) AS `approved_s`, r.`approved_alone`, r.`member_reply`, UNIX_TIMESTAMP(r.`member_reply_at`) AS `reply_s` " +
  "FROM `quest_owed_postings` p LEFT JOIN `moon_reward_reviews` r ON r.`idempotency_key` = p.`idempotency_key` ";

const num = (v: unknown): number | null => (v == null ? null : Number(v));

function toLine(r: RowDataPacket): RewardLineRow {
  return {
    key: String(r.idempotency_key),
    claimId: String(r.claim_id),
    userId: String(r.to_user_id),
    token: String(r.token_slug),
    units: Number(r.units),
    decimals: Number(r.decimals),
    description: String(r.description),
    postingState: String(r.state) as RewardLineRow["postingState"],
    lastError: r.last_error == null ? null : String(r.last_error),
    createdAt: Number(r.created_s),
    review: r.r_key == null ? null : {
      state: String(r.r_state) === "approved" ? "approved" : "waiting",
      invoiceId: String(r.invoice_id),
      unitsShared: Number(r.units_shared),
      lineTotalMinor: Number(r.line_total_minor),
      currency: String(r.currency),
      unitsSet: num(r.units_set),
      setReason: r.set_reason == null ? null : String(r.set_reason),
      setBy: r.set_by == null ? null : String(r.set_by),
      setAt: num(r.set_s),
      approvedBy: r.approved_by == null ? null : String(r.approved_by),
      approvedAt: num(r.approved_s),
      approvedAlone: Number(r.approved_alone) === 1,
      memberReply: r.member_reply == null ? null : String(r.member_reply),
      memberReplyAt: num(r.reply_s),
    },
  };
}

/** Every moon token line recorded in [from, to), oldest first. */
export async function rewardLinesBetween(pool: Pool, source: string, from: Date, to: Date): Promise<RewardLineRow[]> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `${SELECT}WHERE p.\`source\` = ? AND p.\`created_at\` >= ? AND p.\`created_at\` < ? ORDER BY p.\`created_at\`, p.\`idempotency_key\` LIMIT 2000`,
    [source, from, to],
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

/**
 * The moon token lines still owed that may issue: approved, or recorded before
 * reviews existed. Oldest first.
 */
export async function issuableRewardKeys(pool: Pool, source: string, claimId?: string): Promise<string[]> {
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT p.`idempotency_key` FROM `quest_owed_postings` p LEFT JOIN `moon_reward_reviews` r ON r.`idempotency_key` = p.`idempotency_key` " +
      "WHERE p.`source` = ? AND p.`state` = 'owed' AND (r.`idempotency_key` IS NULL OR r.`state` = 'approved')" +
      (claimId ? " AND p.`claim_id` = ?" : "") +
      " ORDER BY p.`created_at`, p.`idempotency_key`",
    claimId ? [source, claimId] : [source],
  );
  return rows.map((r) => String(r.idempotency_key));
}

/**
 * Change a line's amount, while its posting is still owed. The review goes
 * back to waiting, any earlier approval and answer are cleared, and the
 * posting's own units follow, in one transaction. Answers false when the
 * posting was no longer owed, and nothing changed.
 */
export async function setRewardUnits(pool: Pool, p: { key: string; units: number; reason: string; by: string }): Promise<boolean> {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [posting] = await conn.query<ResultSetHeader>(
      "UPDATE `quest_owed_postings` SET `units` = ? WHERE `idempotency_key` = ? AND `state` = 'owed'",
      [p.units, p.key],
    );
    const [review] = await conn.query<ResultSetHeader>(
      "UPDATE `moon_reward_reviews` SET `state` = 'waiting', `units_set` = ?, `set_reason` = ?, `set_by` = ?, `set_at` = CURRENT_TIMESTAMP, " +
        "`approved_by` = NULL, `approved_at` = NULL, `approved_alone` = 0, `member_reply` = NULL, `member_reply_at` = NULL WHERE `idempotency_key` = ?",
      [p.units, p.reason.slice(0, 500), p.by, p.key],
    );
    if (posting.affectedRows !== 1 || review.affectedRows !== 1) {
      await conn.rollback();
      return false;
    }
    await conn.commit();
    return true;
  } catch (e) {
    await conn.rollback().catch(() => undefined);
    throw e;
  } finally {
    conn.release();
  }
}

/** Approve a waiting line. Answers false when it was not waiting (approved already, or raced). */
export async function approveRewardReview(pool: Pool, p: { key: string; by: string; alone: boolean }): Promise<boolean> {
  const [res] = await pool.query<ResultSetHeader>(
    "UPDATE `moon_reward_reviews` SET `state` = 'approved', `approved_by` = ?, `approved_at` = CURRENT_TIMESTAMP, `approved_alone` = ? " +
      "WHERE `idempotency_key` = ? AND `state` = 'waiting'",
    [p.by, p.alone ? 1 : 0, p.key],
  );
  return res.affectedRows === 1;
}

/** The member's answer to a change of their own line. Answers false when the line is not theirs or was never changed. */
export async function replyToRewardChange(pool: Pool, p: { key: string; userId: string; text: string }): Promise<boolean> {
  const [res] = await pool.query<ResultSetHeader>(
    "UPDATE `moon_reward_reviews` SET `member_reply` = ?, `member_reply_at` = CURRENT_TIMESTAMP " +
      "WHERE `idempotency_key` = ? AND `user_id` = ? AND `units_set` IS NOT NULL",
    [p.text.slice(0, 1000), p.key, p.userId],
  );
  return res.affectedRows === 1;
}
