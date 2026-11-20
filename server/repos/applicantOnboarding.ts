/**
 * `application_references` (0412): the references a shortlisted applicant gave,
 * each with its follow-up owner and notes. Every statement the table runs lives
 * here, so its readers and writers stay enumerable. The rules are
 * shared/applicantOnboarding.ts and the work is server/lib/applicantOnboarding.ts.
 * Raw SQL only.
 *
 * NOTHING HERE IS READ BY A COMPANION. A reference's contact details are read
 * by the people `mayReadReference` names, and no tool the guide or a companion
 * holds reads this table: server/lib/applicationReview.refusal.test.ts scans
 * for it.
 */
import type { Pool, PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import type { GivenReference } from "../../shared/applicantOnboarding";

type Db = Pool | PoolConnection;

const fromSeconds = (v: unknown): Date | null => (v === null || v === undefined ? null : new Date(Number(v) * 1000));

export interface StoredReference {
  id: number;
  ref: string;
  position: number;
  name: string;
  contact: string;
  how: string;
  ally: string;
  ownerRoleId: string;
  ownerUserId: string | null;
  notes: string | null;
  notesBy: string | null;
  notesAt: Date | null;
  followedUpAt: Date | null;
  addedAt: Date;
}

const COLUMNS =
  "id, application_ref, position, name, contact, how_known, why_ally, owner_role_id, owner_user_id, notes, notes_by, " +
  "UNIX_TIMESTAMP(notes_at) AS notes_s, UNIX_TIMESTAMP(followed_up_at) AS followed_s, UNIX_TIMESTAMP(added_at) AS added_s";

const rowOf = (r: any): StoredReference => ({
  id: Number(r.id),
  ref: String(r.application_ref),
  position: Number(r.position),
  name: String(r.name ?? ""),
  contact: String(r.contact ?? ""),
  how: String(r.how_known ?? ""),
  ally: String(r.why_ally ?? ""),
  ownerRoleId: String(r.owner_role_id ?? ""),
  ownerUserId: r.owner_user_id ?? null,
  notes: r.notes ?? null,
  notesBy: r.notes_by ?? null,
  notesAt: fromSeconds(r.notes_s),
  followedUpAt: fromSeconds(r.followed_s),
  addedAt: fromSeconds(r.added_s) as Date,
});

/** Write the applicant's list, in order, each owned by `ownerRoleId` ('' for none). Idempotent on (ref, position). How many rows this call wrote. */
export async function insertReferences(db: Db, ref: string, list: readonly GivenReference[], ownerRoleId: string, at: Date): Promise<number> {
  let n = 0;
  for (let i = 0; i < list.length; i++) {
    const r = list[i];
    const [res] = await db.query<ResultSetHeader>(
      "INSERT IGNORE INTO application_references (application_ref, position, name, contact, how_known, why_ally, owner_role_id, owner_user_id, added_at) VALUES (?,?,?,?,?,?,?,?,?)",
      [ref, i + 1, r.name, r.contact, r.how, r.ally ?? "", ownerRoleId ?? "", null, at],
    );
    n += Number(res.affectedRows ?? 0);
  }
  return n;
}

export async function referencesOf(db: Db, ref: string): Promise<StoredReference[]> {
  const [rows] = await db.query<RowDataPacket[]>(`SELECT ${COLUMNS} FROM application_references WHERE application_ref = ? ORDER BY position`, [ref]);
  return rows.map(rowOf);
}

export async function referenceById(db: Db, ref: string, id: number): Promise<StoredReference | null> {
  const [rows] = await db.query<RowDataPacket[]>(`SELECT ${COLUMNS} FROM application_references WHERE application_ref = ? AND id = ? LIMIT 1`, [ref, id]);
  return rows[0] ? rowOf(rows[0]) : null;
}

/** Each application's references with whether each is followed up, for the stage list. No contact, no name, no note. */
export async function followUpsOf(db: Db, refs: readonly string[]): Promise<Map<string, Array<{ followedUp: boolean }>>> {
  const out = new Map<string, Array<{ followedUp: boolean }>>();
  if (!refs.length) return out;
  const [rows] = await db.query<RowDataPacket[]>("SELECT application_ref, followed_up_at IS NOT NULL AS done FROM application_references WHERE application_ref IN (?) ORDER BY application_ref, position", [[...refs]]);
  for (const r of rows as any[]) {
    const list = out.get(String(r.application_ref)) ?? [];
    list.push({ followedUp: Number(r.done) === 1 });
    out.set(String(r.application_ref), list);
  }
  return out;
}

/** Give a reference to a role, or to a member (the role stays as it was beside them). True when it changed. */
export async function setOwner(db: Db, ref: string, id: number, owner: { roleId: string; userId: string | null }): Promise<boolean> {
  const [r] = await db.query<ResultSetHeader>(
    "UPDATE application_references SET owner_role_id = ?, owner_user_id = ? WHERE application_ref = ? AND id = ?",
    [owner.roleId, owner.userId, ref, id],
  );
  return Number(r.changedRows ?? r.affectedRows ?? 0) > 0;
}

/** The owner's notes, and whether the follow-up is done. */
export async function saveNotes(db: Db, ref: string, id: number, p: { notes: string; by: string; followedUp: boolean; at: Date }): Promise<boolean> {
  const [r] = await db.query<ResultSetHeader>(
    "UPDATE application_references SET notes = ?, notes_by = ?, notes_at = ?, followed_up_at = IF(?, COALESCE(followed_up_at, ?), NULL) WHERE application_ref = ? AND id = ?",
    [p.notes, p.by, p.at, p.followedUp ? 1 : 0, p.at, ref, id],
  );
  return Number(r.affectedRows ?? 0) === 1;
}

/** The reference ids a member owns by name, across applications. */
export async function ownedByMember(db: Db, userId: string): Promise<Array<{ ref: string; id: number }>> {
  const [rows] = await db.query<RowDataPacket[]>("SELECT application_ref, id FROM application_references WHERE owner_user_id = ?", [userId]);
  return rows.map((r: any) => ({ ref: String(r.application_ref), id: Number(r.id) }));
}

// ── Retention and erasure ───────────────────────────────────────────────────

/** Delete every reference of these applications: the contact details, the notes, all of it. How many rows went. */
/**
 * A MEMBER'S OWN APPLICATION (`sa-` ref) whose references are due to go: decided (adopted, not adopted or withdrawn)
 * before `before`, the 90 days after the decision the open proposals keep (the lead, 19 Nov 2026), so the form's
 * "deleted with your application" holds. Erasing the member deletes them at once (`forgetMemberReview`).
 */
export async function memberReferencesDecidedBefore(db: Db, before: Date): Promise<string[]> {
  const [rows] = await db.query<RowDataPacket[]>(
    "SELECT DISTINCT r.application_ref FROM application_references r JOIN seat_applications a ON a.id = r.application_ref " +
      "WHERE a.status IN ('adopted','not-adopted','withdrawn') AND a.decided_at IS NOT NULL AND a.decided_at < ? LIMIT 500",
    [before],
  );
  return rows.map((r: any) => String(r.application_ref));
}

export async function deleteReferencesOf(db: Db, refs: readonly string[]): Promise<number> {
  if (!refs.length) return 0;
  const [r] = await db.query<ResultSetHeader>("DELETE FROM application_references WHERE application_ref IN (?)", [[...refs]]);
  return Number(r.affectedRows ?? 0);
}

/**
 * A member is erased: their name leaves every reference they owned or wrote
 * notes on, and the notes they wrote go, the way the scorecards they wrote go
 * (`forgetMemberReview`). The reference stays with the application, owned by
 * its role again.
 */
export async function forgetMemberReferences(db: Db, userId: string): Promise<void> {
  await db.query("UPDATE application_references SET notes = NULL, notes_at = NULL, followed_up_at = NULL, notes_by = NULL WHERE notes_by = ?", [userId]);
  await db.query("UPDATE application_references SET owner_user_id = NULL WHERE owner_user_id = ?", [userId]);
}
