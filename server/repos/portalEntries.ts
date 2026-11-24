/**
 * THE SQL FOR THE PORTAL'S ENTRIES (migration 0425; the contract is shared/entrance.ts).
 * Written by the entrance and read only by the admin list and its CSV (server/routes/entrance.ts).
 */
import type { Pool, RowDataPacket } from "mysql2/promise";
import { isInterest, type Interest, type PortalEntry, type VisitorJourney } from "../../shared/entrance";

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
  interest: Interest | null;
}

export async function insertPortalEntry(db: Pool, e: NewPortalEntry): Promise<void> {
  await db.query(
    "INSERT INTO portal_entries (id, name, email, email_key, whatsapp, link, updates, consent_words, next_path, locale, human, is_test, created_at, interest) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    [e.id, e.name, e.email, e.emailKey, e.whatsapp, e.link, e.updates ? 1 : 0, e.consentWords, e.nextPath, e.locale, e.human, e.isTest ? 1 : 0, e.at, e.interest],
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
  interest: isInterest(r.interest) ? r.interest : null,
  syncedAt: r.synced_at == null ? null : new Date(r.synced_at).toISOString(),
  syncError: r.sync_error == null ? null : String(r.sync_error),
});

const LIST_COLUMNS = "id, name, email, whatsapp, link, updates, next_path, locale, human, created_at, interest, synced_at, sync_error";

/** The newest entries first, tests left out. `updatesOnly` is the list of people who asked for updates; `interest` narrows to one answer. */
export async function listPortalEntries(db: Pool, opts: { limit: number; updatesOnly?: boolean; interest?: Interest | null }): Promise<PortalEntry[]> {
  const where = ["is_test = 0"];
  const args: unknown[] = [];
  if (opts.updatesOnly) where.push("updates = 1");
  if (opts.interest) {
    where.push("interest = ?");
    args.push(opts.interest);
  }
  const [rows] = await db.query<RowDataPacket[]>(`SELECT ${LIST_COLUMNS} FROM portal_entries WHERE ${where.join(" AND ")} ORDER BY created_at DESC LIMIT ?`, [...args, opts.limit]);
  return rows.map(rowOf);
}

/** One entry by id, tests included (the sync needs the smoke's own row to skip it). */
export async function portalEntryById(db: Pool, id: string): Promise<(PortalEntry & { isTest: boolean }) | null> {
  const [rows] = await db.query<RowDataPacket[]>(`SELECT ${LIST_COLUMNS}, is_test FROM portal_entries WHERE id = ? LIMIT 1`, [id]);
  return rows[0] ? { ...rowOf(rows[0]), isTest: Number(rows[0].is_test) === 1 } : null;
}

/** Opted-in, real entries that have not reached the email list yet, oldest first. */
export async function unsyncedOptedIn(db: Pool, limit: number): Promise<PortalEntry[]> {
  const [rows] = await db.query<RowDataPacket[]>(`SELECT ${LIST_COLUMNS} FROM portal_entries WHERE is_test = 0 AND updates = 1 AND synced_at IS NULL ORDER BY created_at ASC LIMIT ?`, [limit]);
  return rows.map(rowOf);
}

/** Record how a sync went: a time on success, a short reason on failure. */
export async function markPortalSync(db: Pool, id: string, outcome: { at: Date } | { error: string }): Promise<void> {
  if ("at" in outcome) await db.query("UPDATE portal_entries SET synced_at = ?, sync_error = NULL WHERE id = ?", [outcome.at, id]);
  else await db.query("UPDATE portal_entries SET sync_error = ? WHERE id = ?", [outcome.error.slice(0, 300), id]);
}

/** The addresses kept for one person, so a forget can also take them off the email list. */
export async function portalEmailsFor(db: Pool, emailKey: string): Promise<string[]> {
  const [rows] = await db.query<RowDataPacket[]>("SELECT DISTINCT email FROM portal_entries WHERE email_key = ? AND synced_at IS NOT NULL", [emailKey]);
  return rows.map((r) => String(r.email));
}

/**
 * What each address has done since, read across the tables that already hold it: role applications
 * (`open_role_proposals`), an account (`users`), and forms sent to the village (`submissions`, whose
 * address lives in the form's own JSON). Read-only. Matched on the trimmed, lowercased address.
 */
export async function journeysFor(db: Pool, emailKeys: string[]): Promise<Map<string, VisitorJourney>> {
  const keys = Array.from(new Set(emailKeys.filter(Boolean)));
  const out = new Map<string, VisitorJourney>();
  if (!keys.length) return out;
  for (const k of keys) out.set(k, { applications: [], account: null, forms: [] });
  const [apps] = await db.query<RowDataPacket[]>(
    "SELECT email_key, status, UNIX_TIMESTAMP(created_at) AS at_s FROM open_role_proposals WHERE email_key IN (?) AND status <> 'unconfirmed' ORDER BY created_at",
    [keys],
  );
  for (const r of apps) out.get(String(r.email_key))?.applications.push({ status: String(r.status), at: new Date(Number(r.at_s) * 1000).toISOString() });
  const [users] = await db.query<RowDataPacket[]>("SELECT LOWER(TRIM(email)) AS k, joined_at FROM users WHERE LOWER(TRIM(email)) IN (?) AND is_example = 0", [keys]);
  for (const r of users) {
    const j = out.get(String(r.k));
    if (j) j.account = { joined: new Date(r.joined_at).toISOString() };
  }
  const [forms] = await db.query<RowDataPacket[]>(
    "SELECT LOWER(TRIM(JSON_UNQUOTE(JSON_EXTRACT(data, '$.email')))) AS k, type, submitted_at FROM submissions WHERE LOWER(TRIM(JSON_UNQUOTE(JSON_EXTRACT(data, '$.email')))) IN (?) ORDER BY submitted_at",
    [keys],
  );
  for (const r of forms) out.get(String(r.k))?.forms.push({ type: String(r.type), at: new Date(r.submitted_at).toISOString() });
  return out;
}

/** Every row for one address goes, on that person's request. Answers how many went. */
export async function deletePortalEntriesFor(db: Pool, emailKey: string): Promise<number> {
  const [r] = await db.query("DELETE FROM portal_entries WHERE email_key = ?", [emailKey]);
  return Number((r as { affectedRows?: number }).affectedRows ?? 0);
}
