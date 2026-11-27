/**
 * `application_conversation_notes` (0442): each conversation's private notes and files. Every statement the table runs
 * lives here. The rules are shared/conversationNotes.ts and the work is server/lib/applicantOnboarding.ts. Raw SQL only.
 *
 * NOTES ONLY: the table has no score, level or rank column. NOTHING HERE IS READ BY A COMPANION:
 * server/lib/applicationReview.refusal.test.ts scans the model-facing sources for it.
 *
 * FILES FOLLOW THEIR ROWS. A file sits in the private notes folder (server/lib/conversationNoteFiles.ts), outside the
 * public uploads volume. Whenever rows go, their files go with them, through `removeNoteFiles`.
 */
import type { Pool, PoolConnection, RowDataPacket } from "mysql2/promise";
import type { ConversationNoteKind } from "../../shared/conversationNotes";
import { removeNoteFiles } from "../lib/conversationNoteFiles";

type Db = Pool | PoolConnection;

export interface StoredConversationNote {
  id: number;
  ref: string;
  interviewId: number;
  authorUserId: string;
  kind: ConversationNoteKind;
  body: string | null;
  fileName: string | null;
  originalName: string | null;
  createdAt: Date;
}

const COLUMNS = "id, application_ref, interview_id, author_user_id, kind, body, file_name, original_name, created_at";

function rowOf(r: RowDataPacket): StoredConversationNote {
  return {
    id: Number(r.id),
    ref: String(r.application_ref),
    interviewId: Number(r.interview_id),
    authorUserId: String(r.author_user_id),
    kind: String(r.kind) as ConversationNoteKind,
    body: r.body == null ? null : String(r.body),
    fileName: r.file_name == null ? null : String(r.file_name),
    originalName: r.original_name == null ? null : String(r.original_name),
    createdAt: r.created_at instanceof Date ? r.created_at : new Date(r.created_at),
  };
}

/** Every note on one application, oldest first. */
export async function conversationNotesOf(db: Db, ref: string): Promise<StoredConversationNote[]> {
  const [rows] = await db.query<RowDataPacket[]>(`SELECT ${COLUMNS} FROM application_conversation_notes WHERE application_ref = ? ORDER BY id`, [ref]);
  return rows.map(rowOf);
}

/** One note, on one application. */
export async function conversationNoteById(db: Db, ref: string, id: number): Promise<StoredConversationNote | null> {
  const [rows] = await db.query<RowDataPacket[]>(`SELECT ${COLUMNS} FROM application_conversation_notes WHERE application_ref = ? AND id = ?`, [ref, id]);
  return rows.length ? rowOf(rows[0]) : null;
}

/** A written note or a file's row. The file is written to its folder before this row, so a row never names a missing file. */
export async function addConversationNote(
  db: Db,
  n: { ref: string; interviewId: number; authorUserId: string; kind: ConversationNoteKind; body: string | null; fileName: string | null; originalName: string | null; at: Date },
): Promise<number> {
  const [out]: any = await db.query(
    "INSERT INTO application_conversation_notes (application_ref, interview_id, author_user_id, kind, body, file_name, original_name, created_at) VALUES (?,?,?,?,?,?,?,?)",
    [n.ref, n.interviewId, n.authorUserId, n.kind, n.body, n.fileName, n.originalName, n.at],
  );
  return Number(out.insertId);
}

/** The author takes one note off; its file goes too. Whether a row went. */
export async function removeConversationNote(db: Db, ref: string, id: number, authorUserId: string): Promise<boolean> {
  const note = await conversationNoteById(db, ref, id);
  if (!note || note.authorUserId !== authorUserId) return false;
  const [out]: any = await db.query("DELETE FROM application_conversation_notes WHERE application_ref = ? AND id = ? AND author_user_id = ?", [ref, id, authorUserId]);
  if (Number(out.affectedRows) > 0) {
    await removeNoteFiles(note.fileName ? [note.fileName] : []);
    return true;
  }
  return false;
}

/** Every note on these applications, deleted with their review, files and all. */
export async function deleteConversationNotesOf(db: Db, refs: readonly string[]): Promise<void> {
  if (!refs.length) return;
  const [rows] = await db.query<RowDataPacket[]>("SELECT file_name FROM application_conversation_notes WHERE application_ref IN (?) AND file_name IS NOT NULL", [[...refs]]);
  await db.query("DELETE FROM application_conversation_notes WHERE application_ref IN (?)", [[...refs]]);
  await removeNoteFiles(rows.map((r) => String(r.file_name)));
}

/** The notes a member wrote, deleted when they are erased, files and all. */
export async function forgetConversationNotesBy(db: Db, userId: string): Promise<void> {
  const [rows] = await db.query<RowDataPacket[]>("SELECT file_name FROM application_conversation_notes WHERE author_user_id = ? AND file_name IS NOT NULL", [userId]);
  await db.query("DELETE FROM application_conversation_notes WHERE author_user_id = ?", [userId]);
  await removeNoteFiles(rows.map((r) => String(r.file_name)));
}
