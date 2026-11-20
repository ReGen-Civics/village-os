/**
 * THE SQL FOR THE COMING-SOON WAITLIST (migration 0414; the contract is
 * shared/roleWaitlist.ts). Private: written by anybody through the rate-limited
 * route, read by admins only, deleted with the member who signed up.
 */
import { randomUUID } from "node:crypto";
import type { Pool, PoolConnection, RowDataPacket } from "mysql2/promise";
import type { WaitlistSignUp } from "../../shared/roleWaitlist";

type Db = Pool | PoolConnection;

export interface StoredWaitlistRow {
  id: string;
  emailKey: string;
  whatsapp: string | null;
  roleIds: string[];
  userId: string | null;
  createdAt: string;
}

const idsOf = (v: unknown): string[] => {
  try {
    const x = typeof v === "string" ? JSON.parse(v) : v;
    return Array.isArray(x) ? x.filter((s): s is string => typeof s === "string") : [];
  } catch {
    return [];
  }
};

/** One sign-up, kept. Answers its id. */
export async function addWaitlistSignUp(db: Db, s: WaitlistSignUp, userId: string | null, at: Date): Promise<string> {
  const id = `wl-${randomUUID()}`.slice(0, 36);
  await db.query("INSERT INTO role_waitlist (id, email_key, whatsapp, role_ids, user_id, created_at) VALUES (?, ?, ?, ?, ?, ?)", [id, s.emailKey, s.whatsapp, JSON.stringify(s.roleIds), userId, at]);
  return id;
}

/** Every sign-up, newest first, for the admin list. */
export async function listWaitlist(db: Db, limit = 500): Promise<StoredWaitlistRow[]> {
  const [rows] = await db.query<RowDataPacket[]>("SELECT id, email_key, whatsapp, role_ids, user_id, created_at FROM role_waitlist ORDER BY created_at DESC LIMIT ?", [limit]);
  return rows.map((r) => ({
    id: String(r.id),
    emailKey: String(r.email_key),
    whatsapp: r.whatsapp == null ? null : String(r.whatsapp),
    roleIds: idsOf(r.role_ids),
    userId: r.user_id == null ? null : String(r.user_id),
    createdAt: new Date(r.created_at).toISOString(),
  }));
}

/** One sign-up removed by an admin (asked by the person, or a duplicate). */
export async function removeWaitlistRow(db: Db, id: string): Promise<boolean> {
  const [res]: any = await db.query("DELETE FROM role_waitlist WHERE id = ?", [id]);
  return Number(res?.affectedRows ?? 0) > 0;
}

/** The member's sign-ups, by their account and by their address, deleted: the erasure step. */
export async function forgetWaitlistOf(db: Db, who: { userId?: string | null; emailKeys?: readonly string[] }): Promise<void> {
  if (who.userId) await db.query("DELETE FROM role_waitlist WHERE user_id = ?", [who.userId]);
  const keys = (who.emailKeys ?? []).filter(Boolean);
  if (keys.length) await db.query("DELETE FROM role_waitlist WHERE email_key IN (?)", [keys]);
}
