/**
 * THE SQL FOR SAVED, UNSENT APPLICATIONS (migration 0423; the contract is shared/applicationDrafts.ts).
 * Read and written only by server/routes/applicationDrafts.ts. Nothing here is ever listed to the team.
 */
import type { Pool, PoolConnection, RowDataPacket } from "mysql2/promise";
import type { DraftFileRef } from "../../shared/applicationDrafts";

type Db = Pool | PoolConnection;

/** A kept file as stored: the page's reference plus what the bytes are checked against. */
export interface StoredDraftFile extends DraftFileRef {
  kind: string;
  sha256: string;
}

export interface StoredDraft {
  id: string;
  roleId: string;
  link: string | null;
  email: string | null;
  emailedTo: string | null;
  body: Record<string, unknown>;
  files: StoredDraftFile[];
  step: number;
  createdAt: Date;
  updatedAt: Date;
}

const json = <T>(v: unknown, fallback: T): T => {
  try {
    const x = typeof v === "string" ? JSON.parse(v) : v;
    return x && typeof x === "object" ? (x as T) : fallback;
  } catch {
    return fallback;
  }
};

const rowOf = (r: RowDataPacket): StoredDraft => ({
  id: String(r.id),
  roleId: String(r.role_id),
  link: r.link == null ? null : String(r.link),
  email: r.email == null ? null : String(r.email),
  emailedTo: r.emailed_to == null ? null : String(r.emailed_to),
  body: json<Record<string, unknown>>(r.body, {}),
  files: json<StoredDraftFile[]>(r.files, []).filter((f) => f && typeof f.id === "string"),
  step: Number(r.step) || 0,
  createdAt: new Date(r.created_at),
  updatedAt: new Date(r.updated_at),
});

const COLUMNS = "id, role_id, link, email, emailed_to, body, files, step, created_at, updated_at";

export async function insertDraft(db: Db, d: { id: string; tokenHash: string; roleId: string; link: string | null; email: string | null; body: Record<string, unknown>; files: StoredDraftFile[]; step: number; at: Date }): Promise<void> {
  await db.query(
    "INSERT INTO application_drafts (id, token_hash, role_id, link, email, emailed_to, body, files, step, created_at, updated_at) VALUES (?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?)",
    [d.id, d.tokenHash, d.roleId, d.link, d.email, JSON.stringify(d.body), JSON.stringify(d.files), d.step, d.at, d.at],
  );
}

export async function updateDraft(db: Db, id: string, d: { roleId: string; email: string | null; body: Record<string, unknown>; files: StoredDraftFile[]; step: number; at: Date }): Promise<void> {
  await db.query("UPDATE application_drafts SET role_id = ?, email = ?, body = ?, files = ?, step = ?, updated_at = ? WHERE id = ?", [d.roleId, d.email, JSON.stringify(d.body), JSON.stringify(d.files), d.step, d.at, id]);
}

/** Where the resume link was last emailed, so the same address is not written to on every save. */
export async function markEmailed(db: Db, id: string, emailedTo: string): Promise<void> {
  await db.query("UPDATE application_drafts SET emailed_to = ? WHERE id = ?", [emailedTo, id]);
}

/** One draft by its token's hash, or null. */
export async function draftByTokenHash(db: Db, tokenHash: string): Promise<StoredDraft | null> {
  const [rows] = await db.query<RowDataPacket[]>(`SELECT ${COLUMNS} FROM application_drafts WHERE token_hash = ? LIMIT 1`, [tokenHash]);
  return rows[0] ? rowOf(rows[0]) : null;
}

/** The ids of drafts last saved before `cutoff`, oldest first. */
export async function draftsSavedBefore(db: Db, cutoff: Date, limit = 500): Promise<string[]> {
  const [rows] = await db.query<RowDataPacket[]>("SELECT id FROM application_drafts WHERE updated_at < ? ORDER BY updated_at LIMIT ?", [cutoff, limit]);
  return rows.map((r) => String(r.id));
}

/** Which of these ids are still drafts. */
export async function draftIdsKept(db: Db, ids: readonly string[]): Promise<Set<string>> {
  if (!ids.length) return new Set();
  const [rows] = await db.query<RowDataPacket[]>("SELECT id FROM application_drafts WHERE id IN (?)", [ids]);
  return new Set(rows.map((r) => String(r.id)));
}

export async function deleteDraft(db: Db, id: string): Promise<boolean> {
  const [res]: any = await db.query("DELETE FROM application_drafts WHERE id = ?", [id]);
  return Number(res?.affectedRows ?? 0) > 0;
}
