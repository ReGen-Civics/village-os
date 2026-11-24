/**
 * THE SQL FOR THE PORTAL'S ENTRIES (migration 0425; the contract is shared/entrance.ts).
 * Written by the entrance and read only by the admin list and its CSV (server/routes/entrance.ts).
 */
import type { Pool, RowDataPacket } from "mysql2/promise";
import type { PortalEntry } from "../../shared/entrance";

export interface NewPortalEntry {
  id: string;
  name: string;
  email: string;
  emailKey: string;
  whatsapp: string | null;
  link: string | null;
  updates: boolean;
  consentWords: string;
  nextPath: string | null;
  locale: string | null;
  human: string;
  isTest: boolean;
  at: Date;
}

export async function insertPortalEntry(db: Pool, e: NewPortalEntry): Promise<void> {
  await db.query(
    "INSERT INTO portal_entries (id, name, email, email_key, whatsapp, link, updates, consent_words, next_path, locale, human, is_test, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    [e.id, e.name, e.email, e.emailKey, e.whatsapp, e.link, e.updates ? 1 : 0, e.consentWords, e.nextPath, e.locale, e.human, e.isTest ? 1 : 0, e.at],
  );
}

/** Whether an entry id is on record and not a test. The cookie's signature proves we wrote it; this proves it was not erased. */
export async function portalEntryExists(db: Pool, id: string): Promise<boolean> {
  const [rows] = await db.query<RowDataPacket[]>("SELECT 1 FROM portal_entries WHERE id = ? LIMIT 1", [id]);
  return rows.length > 0;
}

const rowOf = (r: RowDataPacket): PortalEntry => ({
  id: String(r.id),
  name: String(r.name),
  email: String(r.email),
  whatsapp: r.whatsapp == null ? null : String(r.whatsapp),
  link: r.link == null ? null : String(r.link),
  updates: Number(r.updates) === 1,
  nextPath: r.next_path == null ? null : String(r.next_path),
  locale: r.locale == null ? null : String(r.locale),
  human: String(r.human),
  at: new Date(r.created_at).toISOString(),
});

/** The newest entries first, tests left out. `updatesOnly` is the list of people who asked for updates. */
export async function listPortalEntries(db: Pool, opts: { limit: number; updatesOnly?: boolean }): Promise<PortalEntry[]> {
  const where = opts.updatesOnly ? "WHERE is_test = 0 AND updates = 1" : "WHERE is_test = 0";
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT id, name, email, whatsapp, link, updates, next_path, locale, human, created_at FROM portal_entries ${where} ORDER BY created_at DESC LIMIT ?`,
    [opts.limit],
  );
  return rows.map(rowOf);
}

/** Every row for one address goes, on that person's request. Answers how many went. */
export async function deletePortalEntriesFor(db: Pool, emailKey: string): Promise<number> {
  const [r] = await db.query("DELETE FROM portal_entries WHERE email_key = ?", [emailKey]);
  return Number((r as { affectedRows?: number }).affectedRows ?? 0);
}
