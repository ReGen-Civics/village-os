/**
 * THE SQL FOR THE PORTAL'S ENTRIES (migration 0425; the contract is shared/entrance.ts).
 * Written by the entrance and read only by the admin list and its CSV (server/routes/entrance.ts).
 */
import type { Pool, RowDataPacket } from "mysql2/promise";
import { isInterest, isUpdatesAnswer, type Interest, type PortalEntry, type PortalView, type UpdatesAnswer, type VisitorJourney } from "../../shared/entrance";

export interface NewPortalEntry {
  id: string;
  name: string;
  email: string;
  emailKey: string;
  whatsapp: string | null;
  link: string | null;
  consentWords: string;
  nextPath: string | null;
  locale: string | null;
  human: string;
  isTest: boolean;
  at: Date;
  interest: Interest | null;
  /** 1 when the visitor has a short look and then needs the code (0428). */
  codeRequired?: boolean;
  /** An entry made already verified (Google). */
  verifiedAt?: Date | null;
}

export async function insertPortalEntry(db: Pool, e: NewPortalEntry): Promise<void> {
  await db.query(
    "INSERT INTO portal_entries (id, name, email, email_key, whatsapp, link, consent_words, next_path, locale, human, is_test, created_at, interest, code_required, verified_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    [e.id, e.name, e.email, e.emailKey, e.whatsapp, e.link, e.consentWords, e.nextPath, e.locale, e.human, e.isTest ? 1 : 0, e.at, e.interest, e.codeRequired ? 1 : 0, e.verifiedAt ?? null],
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
  updates: isUpdatesAnswer(r.updates) ? r.updates : null,
  nextPath: r.next_path == null ? null : String(r.next_path),
  locale: r.locale == null ? null : String(r.locale),
  human: String(r.human),
  at: new Date(r.created_at).toISOString(),
  interest: isInterest(r.interest) ? r.interest : null,
  syncedAt: r.synced_at == null ? null : new Date(r.synced_at).toISOString(),
  syncError: r.sync_error == null ? null : String(r.sync_error),
  verifiedAt: r.verified_at == null ? null : new Date(r.verified_at).toISOString(),
  codeRequired: Number(r.code_required) === 1,
});

const LIST_COLUMNS = "id, name, email, whatsapp, link, updates, next_path, locale, human, created_at, interest, synced_at, sync_error, verified_at, code_required";

/** The newest entries first, tests left out. `updatesOnly` is the list of people who asked for updates; `interest` narrows to one answer. */
export async function listPortalEntries(db: Pool, opts: { limit: number; updatesOnly?: boolean; interest?: Interest | null }): Promise<PortalEntry[]> {
  const where = ["is_test = 0"];
  const args: unknown[] = [];
  if (opts.updatesOnly) where.push("updates = 'yes'");
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

/**
 * Opted-in, real entries that have not reached the email list yet, oldest first. Only a confirmed
 * address goes (the code or Google), or an entry made while the village could send no code at all.
 */
export async function unsyncedOptedIn(db: Pool, limit: number): Promise<PortalEntry[]> {
  const [rows] = await db.query<RowDataPacket[]>(`SELECT ${LIST_COLUMNS} FROM portal_entries WHERE is_test = 0 AND updates = 'yes' AND synced_at IS NULL AND (verified_at IS NOT NULL OR code_required = 0) ORDER BY created_at ASC LIMIT ?`, [limit]);
  return rows.map(rowOf);
}

/**
 * The keep-in-touch answer, on its own step after the entry. The latest answer stands, so a visitor
 * who says yes and then no is off the list; the words they answered are kept with it.
 */
export async function setUpdatesAnswer(db: Pool, id: string, answer: UpdatesAnswer, words: string): Promise<void> {
  await db.query("UPDATE portal_entries SET updates = ?, updates_words = ? WHERE id = ?", [answer, words, id]);
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
  const [users] = await db.query<RowDataPacket[]>("SELECT LOWER(TRIM(email)) AS k, id, joined_at, membership_granted, email_verified_at FROM users WHERE LOWER(TRIM(email)) IN (?) AND is_example = 0", [keys]);
  for (const r of users) {
    const j = out.get(String(r.k));
    if (j) j.account = { id: String(r.id), joined: new Date(r.joined_at).toISOString(), member: Number(r.membership_granted) === 1, verified: r.email_verified_at != null };
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
  await db.query("DELETE v FROM portal_views v JOIN portal_entries e ON e.id = v.entry_id WHERE e.email_key = ?", [emailKey]);
  const [r] = await db.query("DELETE FROM portal_entries WHERE email_key = ?", [emailKey]);
  return Number((r as { affectedRows?: number }).affectedRows ?? 0);
}

// ── The pages an entered visitor opens (portal_views) ──────────────────────

/** One page view, first-party. The caller has already checked the entry cookie and refused members. */
export async function insertPortalView(db: Pool, v: { id: string; entryId: string; path: string; roleSlug: string | null; at: Date }): Promise<void> {
  await db.query("INSERT INTO portal_views (id, entry_id, path, role_slug, at) VALUES (?, ?, ?, ?, ?)", [v.id, v.entryId, v.path, v.roleSlug, v.at]);
}

/** The pages each entry opened, newest first, capped per entry so one busy visitor cannot swell the list. */
export async function viewsFor(db: Pool, entryIds: string[], perEntry = 50): Promise<Map<string, PortalView[]>> {
  const ids = Array.from(new Set(entryIds.filter(Boolean)));
  const out = new Map<string, PortalView[]>();
  if (!ids.length) return out;
  const [rows] = await db.query<RowDataPacket[]>("SELECT entry_id, path, role_slug, at FROM portal_views WHERE entry_id IN (?) ORDER BY at DESC", [ids]);
  for (const r of rows) {
    const k = String(r.entry_id);
    const list = out.get(k) ?? [];
    if (list.length >= perEntry) continue;
    list.push({ path: String(r.path), roleSlug: r.role_slug == null ? null : String(r.role_slug), at: new Date(r.at).toISOString() });
    out.set(k, list);
  }
  return out;
}

/** Page views older than the cutoff go, oldest first in batches. Answers how many went. */
export async function sweepPortalViews(db: Pool, olderThan: Date, batch = 5000): Promise<number> {
  let total = 0;
  for (;;) {
    const [r] = await db.query("DELETE FROM portal_views WHERE at < ? ORDER BY at LIMIT ?", [olderThan, batch]);
    const n = Number((r as { affectedRows?: number }).affectedRows ?? 0);
    total += n;
    if (n < batch) return total;
  }
}

// ── The short look and the code (0428) ──────────────────────────────────────

export interface EntryLook {
  email: string;
  emailKey: string;
  name: string;
  locale: string | null;
  isTest: boolean;
  codeRequired: boolean;
  verified: boolean;
  createdAt: number;
  views: number;
  userId: string | null;
}

/** What the gate and the code routes need to know about one entry, or null when it is gone. */
export async function entryLook(db: Pool, id: string): Promise<EntryLook | null> {
  const [rows] = await db.query<RowDataPacket[]>(
    "SELECT email, email_key, name, locale, is_test, code_required, verified_at, created_at, user_id, (SELECT COUNT(*) FROM portal_views v WHERE v.entry_id = e.id) AS views FROM portal_entries e WHERE id = ? LIMIT 1",
    [id],
  );
  const r = rows[0];
  if (!r) return null;
  return {
    email: String(r.email),
    emailKey: String(r.email_key),
    name: String(r.name),
    locale: r.locale == null ? null : String(r.locale),
    isTest: Number(r.is_test) === 1,
    codeRequired: Number(r.code_required) === 1,
    verified: r.verified_at != null,
    createdAt: new Date(r.created_at).getTime(),
    views: Number(r.views),
    userId: r.user_id == null ? null : String(r.user_id),
  };
}

/** The address is proved: the time, and the account it already had, if any. */
export async function markEntryVerified(db: Pool, id: string, at: Date, userId: string | null): Promise<void> {
  await db.query("UPDATE portal_entries SET verified_at = COALESCE(verified_at, ?), user_id = COALESCE(?, user_id) WHERE id = ?", [at, userId, id]);
}
