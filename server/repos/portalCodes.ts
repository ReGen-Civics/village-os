/**
 * THE SQL FOR THE PORTAL'S CODES (migration 0428; the contract is shared/entrance.ts, the hashing is
 * server/lib/entranceCode.ts). Read and written only by the entrance's own routes.
 */
import type { Pool, RowDataPacket } from "mysql2/promise";

export interface PortalCode {
  id: string;
  entryId: string;
  userId: string | null;
  codeHash: string;
  expiresAt: number;
  attempts: number;
  usedAt: number | null;
  createdAt: number;
}

const rowOf = (r: RowDataPacket): PortalCode => ({
  id: String(r.id),
  entryId: String(r.entry_id),
  userId: r.user_id == null ? null : String(r.user_id),
  codeHash: String(r.code_hash),
  expiresAt: new Date(r.expires_at).getTime(),
  attempts: Number(r.attempts),
  usedAt: r.used_at == null ? null : new Date(r.used_at).getTime(),
  createdAt: new Date(r.created_at).getTime(),
});

export async function insertPortalCode(db: Pool, c: { id: string; entryId: string; userId: string | null; emailKey: string; codeHash: string; expiresAt: Date; at: Date }): Promise<void> {
  await db.query("INSERT INTO portal_codes (id, entry_id, user_id, email_key, code_hash, expires_at, attempts, created_at) VALUES (?, ?, ?, ?, ?, ?, 0, ?)", [
    c.id,
    c.entryId,
    c.userId,
    c.emailKey,
    c.codeHash,
    c.expiresAt,
    c.at,
  ]);
}

/** The newest code sent for an entry, used or not, or null. */
export async function latestPortalCode(db: Pool, entryId: string): Promise<PortalCode | null> {
  const [rows] = await db.query<RowDataPacket[]>("SELECT * FROM portal_codes WHERE entry_id = ? ORDER BY created_at DESC, id DESC LIMIT 1", [entryId]);
  return rows[0] ? rowOf(rows[0]) : null;
}

/** One more wrong try, counted in the database so two tabs cannot each have five. Answers the new count. */
export async function countWrongTry(db: Pool, id: string): Promise<number> {
  await db.query("UPDATE portal_codes SET attempts = attempts + 1 WHERE id = ?", [id]);
  const [rows] = await db.query<RowDataPacket[]>("SELECT attempts FROM portal_codes WHERE id = ?", [id]);
  return Number(rows[0]?.attempts ?? 0);
}

/** Take a code: only an unused one, so two correct submissions take it once. Answers whether this one did. */
export async function takePortalCode(db: Pool, id: string, at: Date): Promise<boolean> {
  const [r] = await db.query("UPDATE portal_codes SET used_at = ? WHERE id = ? AND used_at IS NULL", [at, id]);
  return Number((r as { affectedRows?: number }).affectedRows ?? 0) === 1;
}

/** Codes sent to one address since a moment, for the per-address limit. */
export async function codesSentTo(db: Pool, emailKey: string, since: Date): Promise<number> {
  const [rows] = await db.query<RowDataPacket[]>("SELECT COUNT(*) AS n FROM portal_codes WHERE email_key = ? AND created_at >= ?", [emailKey, since]);
  return Number(rows[0]?.n ?? 0);
}

/** A forgotten person's codes go with their entries. */
export async function deletePortalCodesFor(db: Pool, emailKey: string): Promise<void> {
  await db.query("DELETE FROM portal_codes WHERE email_key = ?", [emailKey]);
}
