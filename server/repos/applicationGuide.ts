/**
 * `application_guide_notes` (0417): reviewers' notes against a role's selection criteria. Every statement
 * the table runs lives here. The rules are shared/conversationGuide.ts and the work is
 * server/lib/applicantOnboarding.ts. Raw SQL only.
 *
 * NOTES ONLY: the table has no score, level or rank column. NOTHING HERE IS READ BY A COMPANION:
 * server/lib/applicationReview.refusal.test.ts scans the model-facing sources for it.
 */
import type { Pool, PoolConnection, RowDataPacket } from "mysql2/promise";

type Db = Pool | PoolConnection;

export interface StoredGuideNote {
  key: string;
  authorUserId: string;
  note: string;
}

export async function guideNotesOf(db: Db, ref: string): Promise<StoredGuideNote[]> {
  const [rows] = await db.query<RowDataPacket[]>("SELECT item_key, author_user_id, note FROM application_guide_notes WHERE application_ref = ? ORDER BY id", [ref]);
  return rows.map((r) => ({ key: String(r.item_key), authorUserId: String(r.author_user_id), note: String(r.note) }));
}

/** One reviewer's note on one line: written, replaced, or (empty) removed. */
export async function saveGuideNote(db: Db, i: { ref: string; key: string; userId: string; note: string; at: Date }): Promise<void> {
  if (!i.note) {
    await db.query("DELETE FROM application_guide_notes WHERE application_ref = ? AND item_key = ? AND author_user_id = ?", [i.ref, i.key, i.userId]);
    return;
  }
  await db.query(
    "INSERT INTO application_guide_notes (application_ref, item_key, author_user_id, note, updated_at) VALUES (?,?,?,?,?) ON DUPLICATE KEY UPDATE note = VALUES(note), updated_at = VALUES(updated_at)",
    [i.ref, i.key, i.userId, i.note, i.at],
  );
}

/** Every note on these applications, deleted with their review. */
export async function deleteGuideNotesOf(db: Db, refs: readonly string[]): Promise<void> {
  if (!refs.length) return;
  await db.query("DELETE FROM application_guide_notes WHERE application_ref IN (?)", [[...refs]]);
}

/** The notes a member wrote, deleted when they are erased. */
export async function forgetGuideNotesBy(db: Db, userId: string): Promise<void> {
  await db.query("DELETE FROM application_guide_notes WHERE author_user_id = ?", [userId]);
}
