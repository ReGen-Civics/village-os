/**
 * `content_translations` (9999_content_translations.sql): every statement that
 * reads or writes a translation of village content. The rules (what may be
 * translated, how long, which text a machine may not draft) are in
 * shared/contentTranslation.ts; this file only keeps the rows.
 *
 * TWO RULES LIVE IN THE STATEMENTS, because a caller cannot be trusted to
 * remember them:
 *   - A machine draft never replaces an approved translation of the same
 *     English. A person's words beat a machine's until the English changes.
 *   - Approving only approves the draft the approver saw: same English (hash)
 *     and still a draft. A draft replaced or made stale meanwhile is not
 *     approved behind their back.
 */
import { createHash } from "node:crypto";
import type { Pool, PoolConnection, RowDataPacket, ResultSetHeader } from "mysql2/promise";
import type { ContentKind, TranslationStatus } from "../../shared/contentTranslation";

type Queryable = Pool | PoolConnection;

export interface ContentTranslationRow {
  kind: ContentKind;
  refKey: string;
  field: string;
  locale: string;
  text: string;
  sourceHash: string;
  status: TranslationStatus;
  createdBy: string | null;
  approvedBy: string | null;
  updatedAt: string;
}

/** The hash a translation keeps of the English it was made from. */
export function sourceHash(english: string): string {
  return createHash("sha256").update(english.trim(), "utf8").digest("hex");
}

const COLS = "`kind`, `ref_key`, `field`, `locale`, `text`, `source_hash`, `status`, `created_by`, `approved_by`, `updated_at`";

function toRow(r: RowDataPacket): ContentTranslationRow {
  return {
    kind: r.kind,
    refKey: r.ref_key,
    field: r.field,
    locale: r.locale,
    text: r.text,
    sourceHash: r.source_hash,
    status: r.status,
    createdBy: r.created_by ?? null,
    approvedBy: r.approved_by ?? null,
    updatedAt: r.updated_at instanceof Date ? r.updated_at.toISOString() : String(r.updated_at),
  };
}

/** Every translation into one locale for these refs of one kind, in one round trip. */
export async function translationsFor(db: Queryable, kind: ContentKind, refKeys: readonly string[], locale: string): Promise<ContentTranslationRow[]> {
  if (!refKeys.length) return [];
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT ${COLS} FROM \`content_translations\` WHERE \`kind\` = ? AND \`locale\` = ? AND \`ref_key\` IN (${refKeys.map(() => "?").join(",")})`,
    [kind, locale, ...refKeys],
  );
  return rows.map(toRow);
}

export interface TranslationWrite {
  kind: ContentKind;
  refKey: string;
  field: string;
  locale: string;
  /** Already validated by contentTranslationProblem. */
  text: string;
  sourceHash: string;
  status: TranslationStatus;
  /** The member who wrote or approved it; null for a machine draft. */
  by: string | null;
}

export type WriteOutcome = "written" | "kept-approved";

/**
 * Store a translation. An approved write always lands. A machine draft lands
 * unless an approved translation of the same English is already there.
 */
export async function writeTranslation(pool: Pool, w: TranslationWrite): Promise<WriteOutcome> {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [have] = await conn.query<RowDataPacket[]>(
      "SELECT `status`, `source_hash` FROM `content_translations` WHERE `kind` = ? AND `ref_key` = ? AND `field` = ? AND `locale` = ? FOR UPDATE",
      [w.kind, w.refKey, w.field, w.locale],
    );
    const old = have[0];
    if (w.status === "ai_draft" && old && old.status === "approved" && old.source_hash === w.sourceHash) {
      await conn.commit();
      return "kept-approved";
    }
    const approvedBy = w.status === "approved" ? w.by : null;
    await conn.query(
      "INSERT INTO `content_translations` (`kind`, `ref_key`, `field`, `locale`, `text`, `source_hash`, `status`, `created_by`, `approved_by`) " +
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE " +
        "`text` = VALUES(`text`), `source_hash` = VALUES(`source_hash`), `status` = VALUES(`status`), " +
        "`created_by` = VALUES(`created_by`), `approved_by` = VALUES(`approved_by`), `updated_at` = CURRENT_TIMESTAMP",
      [w.kind, w.refKey, w.field, w.locale, w.text, w.sourceHash, w.status, w.by, approvedBy],
    );
    await conn.commit();
    return "written";
  } catch (e) {
    await conn.rollback().catch(() => {});
    throw e;
  } finally {
    conn.release();
  }
}

/** Approve the draft the approver saw. False when it is gone, already approved, or of other English. */
export async function approveDraft(
  db: Queryable,
  key: { kind: ContentKind; refKey: string; field: string; locale: string },
  seenHash: string,
  by: string,
): Promise<boolean> {
  const [res] = await db.query<ResultSetHeader>(
    "UPDATE `content_translations` SET `status` = 'approved', `approved_by` = ?, `updated_at` = CURRENT_TIMESTAMP " +
      "WHERE `kind` = ? AND `ref_key` = ? AND `field` = ? AND `locale` = ? AND `status` = 'ai_draft' AND `source_hash` = ?",
    [by, key.kind, key.refKey, key.field, key.locale, seenHash],
  );
  return res.affectedRows === 1;
}

/** Remove one translation; the reader falls back to the English. */
export async function removeTranslation(db: Queryable, key: { kind: ContentKind; refKey: string; field: string; locale: string }): Promise<boolean> {
  const [res] = await db.query<ResultSetHeader>(
    "DELETE FROM `content_translations` WHERE `kind` = ? AND `ref_key` = ? AND `field` = ? AND `locale` = ?",
    [key.kind, key.refKey, key.field, key.locale],
  );
  return res.affectedRows > 0;
}
