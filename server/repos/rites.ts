/**
 * The rites module's store (drizzle/0393_rites_and_invitations.sql). Every SQL
 * statement the module runs is here; the rules are shared/rites.ts and the
 * routes server/routes/rites.ts.
 */
import type { Pool, PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";

import type { CeremonyStatus, WitnessVia } from "../../shared/rites";

type Db = Pool | PoolConnection;

const marks = (n: number) => Array(n).fill("?").join(", ");
const iso = (v: unknown): string | null => {
  if (v == null) return null;
  const d = v instanceof Date ? v : new Date(String(v));
  return Number.isFinite(d.getTime()) ? d.toISOString() : null;
};

// ── Stamps ─────────────────────────────────────────────────────────────────

export async function stampsOf(db: Db, userId: string): Promise<Map<string, string>> {
  const [rows] = await db.query<RowDataPacket[]>("SELECT rite_id, stamped_at FROM rite_stamps WHERE user_id = ?", [userId]);
  return new Map(rows.map((r) => [String(r.rite_id), iso(r.stamped_at) ?? ""]));
}

export async function holdersOf(db: Db, riteId: string): Promise<string[]> {
  const [rows] = await db.query<RowDataPacket[]>("SELECT user_id FROM rite_stamps WHERE rite_id = ?", [riteId]);
  return rows.map((r) => String(r.user_id));
}

export async function holds(db: Db, userId: string, riteId: string): Promise<boolean> {
  const [rows] = await db.query<RowDataPacket[]>("SELECT 1 FROM rite_stamps WHERE user_id = ? AND rite_id = ? LIMIT 1", [userId, riteId]);
  return rows.length > 0;
}

export async function anyHolder(db: Db, riteId: string): Promise<boolean> {
  const [rows] = await db.query<RowDataPacket[]>("SELECT 1 FROM rite_stamps WHERE rite_id = ? LIMIT 1", [riteId]);
  return rows.length > 0;
}

/** Stamp each rite once; a stamp already held is left as it was. Returns the rites newly stamped. */
export async function stamp(db: Db, userId: string, riteIds: readonly string[], at: Date, ceremonyId: string | null, witnessId: string | null): Promise<string[]> {
  const fresh: string[] = [];
  for (const riteId of riteIds) {
    const [r] = await db.query<ResultSetHeader>(
      "INSERT IGNORE INTO rite_stamps (user_id, rite_id, stamped_at, ceremony_id, witness_user_id) VALUES (?, ?, ?, ?, ?)",
      [userId, riteId, at, ceremonyId, witnessId],
    );
    if (r.affectedRows > 0) fresh.push(riteId);
  }
  return fresh;
}

// ── Ceremonies ─────────────────────────────────────────────────────────────

export interface CeremonyRow {
  id: string;
  riteId: string;
  candidateUserId: string;
  openedBy: string;
  openedAt: string | null;
  place: string | null;
  lines: string[];
  answer: string | null;
  markNeeded: boolean;
  witnessesNeeded: number;
  spoken: number;
  status: CeremonyStatus;
  closedAt: string | null;
}

function ceremonyOf(r: RowDataPacket): CeremonyRow {
  let lines: string[] = [];
  try {
    const v = JSON.parse(String(r.lines_json ?? "[]"));
    if (Array.isArray(v)) lines = v.map(String);
  } catch {
    lines = [];
  }
  return {
    id: String(r.id),
    riteId: String(r.rite_id),
    candidateUserId: String(r.candidate_user_id),
    openedBy: String(r.opened_by),
    openedAt: iso(r.opened_at),
    place: r.place == null ? null : String(r.place),
    lines,
    answer: r.answer == null ? null : String(r.answer),
    markNeeded: Number(r.mark_needed) === 1,
    witnessesNeeded: Number(r.witnesses_needed),
    spoken: Number(r.spoken),
    status: String(r.status) as CeremonyStatus,
    closedAt: iso(r.closed_at),
  };
}

const CEREMONY_COLUMNS = "id, rite_id, candidate_user_id, opened_by, opened_at, place, lines_json, answer, mark_needed, witnesses_needed, spoken, status, closed_at";

export async function ceremonyById(db: Db, id: string, forUpdate = false): Promise<CeremonyRow | null> {
  const [rows] = await db.query<RowDataPacket[]>(`SELECT ${CEREMONY_COLUMNS} FROM rite_ceremonies WHERE id = ?${forUpdate ? " FOR UPDATE" : ""}`, [id]);
  return rows[0] ? ceremonyOf(rows[0]) : null;
}

export async function openCeremonyFor(db: Db, candidateUserId: string, riteId: string): Promise<CeremonyRow | null> {
  const [rows] = await db.query<RowDataPacket[]>(`SELECT ${CEREMONY_COLUMNS} FROM rite_ceremonies WHERE open_key = ?`, [`${candidateUserId}|${riteId}`]);
  return rows[0] ? ceremonyOf(rows[0]) : null;
}

/** Open a ceremony, or answer the one already open for this candidate and rite. */
export async function openCeremony(
  db: Db,
  input: { id: string; riteId: string; candidateUserId: string; openedBy: string; at: Date; place: string | null; lines: string[]; answer: string | null; markNeeded: boolean; witnessesNeeded: number },
): Promise<CeremonyRow> {
  try {
    await db.query(
      "INSERT INTO rite_ceremonies (id, rite_id, candidate_user_id, opened_by, opened_at, place, lines_json, answer, mark_needed, witnesses_needed, spoken, status, open_key) " +
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 'open', ?)",
      [input.id, input.riteId, input.candidateUserId, input.openedBy, input.at, input.place, JSON.stringify(input.lines), input.answer, input.markNeeded ? 1 : 0, input.witnessesNeeded, `${input.candidateUserId}|${input.riteId}`],
    );
  } catch (e: any) {
    if (e?.code !== "ER_DUP_ENTRY") throw e;
    const open = await openCeremonyFor(db, input.candidateUserId, input.riteId);
    if (open) return open;
    throw e;
  }
  return (await ceremonyById(db, input.id)) as CeremonyRow;
}

export async function setSpoken(db: Db, id: string, spoken: number): Promise<void> {
  await db.query("UPDATE rite_ceremonies SET spoken = GREATEST(spoken, ?) WHERE id = ? AND status = 'open'", [spoken, id]);
}

export async function closeCeremony(db: Db, id: string, status: Exclude<CeremonyStatus, "open">, at: Date): Promise<boolean> {
  const [r] = await db.query<ResultSetHeader>("UPDATE rite_ceremonies SET status = ?, closed_at = ?, open_key = NULL WHERE id = ? AND status = 'open'", [status, at, id]);
  return r.affectedRows > 0;
}

/** Every open ceremony, newest first: the list a member who may witness reads. */
export async function openCeremonies(db: Db, limit = 30): Promise<CeremonyRow[]> {
  const [rows] = await db.query<RowDataPacket[]>(`SELECT ${CEREMONY_COLUMNS} FROM rite_ceremonies WHERE status = 'open' ORDER BY opened_at DESC LIMIT ?`, [limit]);
  return rows.map(ceremonyOf);
}

export async function ceremoniesOfCandidate(db: Db, userId: string): Promise<CeremonyRow[]> {
  const [rows] = await db.query<RowDataPacket[]>(`SELECT ${CEREMONY_COLUMNS} FROM rite_ceremonies WHERE candidate_user_id = ? ORDER BY opened_at DESC LIMIT 20`, [userId]);
  return rows.map(ceremonyOf);
}

// ── Witnesses ──────────────────────────────────────────────────────────────

export interface WitnessRow {
  userId: string;
  via: WitnessVia;
  joinedAt: string | null;
  confirmedAt: string | null;
}

export async function witnessesOf(db: Db, ceremonyId: string): Promise<WitnessRow[]> {
  const [rows] = await db.query<RowDataPacket[]>(
    "SELECT witness_user_id, via, joined_at, confirmed_at FROM rite_witnesses WHERE ceremony_id = ? ORDER BY joined_at, witness_user_id",
    [ceremonyId],
  );
  return rows.map((r) => ({ userId: String(r.witness_user_id), via: r.via === "call" ? "call" : "present", joinedAt: iso(r.joined_at), confirmedAt: iso(r.confirmed_at) }));
}

/** Join, or change how you are there. A confirmation already given stands. */
export async function joinAsWitness(db: Db, ceremonyId: string, userId: string, via: WitnessVia, at: Date): Promise<void> {
  await db.query(
    "INSERT INTO rite_witnesses (ceremony_id, witness_user_id, via, joined_at) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE via = VALUES(via)",
    [ceremonyId, userId, via, at],
  );
}

export async function confirmWitness(db: Db, ceremonyId: string, userId: string, at: Date): Promise<void> {
  await db.query("UPDATE rite_witnesses SET confirmed_at = COALESCE(confirmed_at, ?) WHERE ceremony_id = ? AND witness_user_id = ?", [at, ceremonyId, userId]);
}

// ── Marks ──────────────────────────────────────────────────────────────────

export async function markOf(db: Db, userId: string): Promise<{ path: string; fixed: boolean } | null> {
  const [rows] = await db.query<RowDataPacket[]>("SELECT path, fixed_at FROM member_marks WHERE user_id = ?", [userId]);
  return rows[0] ? { path: String(rows[0].path), fixed: rows[0].fixed_at != null } : null;
}

/** Draw or redraw a mark. A fixed mark is never changed; answers false then. */
export async function setMark(db: Db, userId: string, path: string, at: Date): Promise<boolean> {
  const [r] = await db.query<ResultSetHeader>(
    "INSERT INTO member_marks (user_id, path, made_at) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE path = IF(fixed_at IS NULL, VALUES(path), path), made_at = IF(fixed_at IS NULL, VALUES(made_at), made_at)",
    [userId, path, at],
  );
  if (r.affectedRows > 0) return (await markOf(db, userId))?.path === path;
  return false;
}

export async function fixMark(db: Db, userId: string, at: Date): Promise<void> {
  await db.query("UPDATE member_marks SET fixed_at = COALESCE(fixed_at, ?) WHERE user_id = ?", [at, userId]);
}

export async function marksOf(db: Db, userIds: readonly string[]): Promise<Map<string, string>> {
  if (userIds.length === 0) return new Map();
  const [rows] = await db.query<RowDataPacket[]>(`SELECT user_id, path FROM member_marks WHERE user_id IN (${marks(userIds.length)})`, [...userIds]);
  return new Map(rows.map((r) => [String(r.user_id), String(r.path)]));
}

// ── Buddies ────────────────────────────────────────────────────────────────

export interface BuddyRow {
  newcomerUserId: string;
  buddyUserId: string;
  pairedBy: string;
  pairedAt: string | null;
  greeting: string | null;
}

const buddyOfRow = (r: RowDataPacket): BuddyRow => ({
  newcomerUserId: String(r.newcomer_user_id),
  buddyUserId: String(r.buddy_user_id),
  pairedBy: String(r.paired_by),
  pairedAt: iso(r.paired_at),
  greeting: r.greeting == null ? null : String(r.greeting),
});

export async function buddyOf(db: Db, newcomerUserId: string): Promise<BuddyRow | null> {
  const [rows] = await db.query<RowDataPacket[]>("SELECT * FROM rite_buddies WHERE newcomer_user_id = ?", [newcomerUserId]);
  return rows[0] ? buddyOfRow(rows[0]) : null;
}

export async function newcomersOf(db: Db, buddyUserId: string): Promise<BuddyRow[]> {
  const [rows] = await db.query<RowDataPacket[]>("SELECT * FROM rite_buddies WHERE buddy_user_id = ? ORDER BY paired_at DESC", [buddyUserId]);
  return rows.map(buddyOfRow);
}

/** Pair, or re-pair. A new buddy starts with no greeting. Answers false when the pair was already this. */
export async function pairBuddy(db: Db, newcomerUserId: string, buddyUserId: string, pairedBy: string, at: Date, onlyIfUnpaired = false): Promise<boolean> {
  if (onlyIfUnpaired) {
    const [r] = await db.query<ResultSetHeader>(
      "INSERT IGNORE INTO rite_buddies (newcomer_user_id, buddy_user_id, paired_by, paired_at) VALUES (?, ?, ?, ?)",
      [newcomerUserId, buddyUserId, pairedBy, at],
    );
    return r.affectedRows > 0;
  }
  const [r] = await db.query<ResultSetHeader>(
    "INSERT INTO rite_buddies (newcomer_user_id, buddy_user_id, paired_by, paired_at) VALUES (?, ?, ?, ?) " +
      "ON DUPLICATE KEY UPDATE greeting = IF(buddy_user_id = VALUES(buddy_user_id), greeting, NULL), paired_by = IF(buddy_user_id = VALUES(buddy_user_id), paired_by, VALUES(paired_by)), " +
      "paired_at = IF(buddy_user_id = VALUES(buddy_user_id), paired_at, VALUES(paired_at)), buddy_user_id = VALUES(buddy_user_id)",
    [newcomerUserId, buddyUserId, pairedBy, at],
  );
  return r.affectedRows > 0;
}

export async function setGreeting(db: Db, newcomerUserId: string, buddyUserId: string, greeting: string): Promise<boolean> {
  const [r] = await db.query<ResultSetHeader>("UPDATE rite_buddies SET greeting = ? WHERE newcomer_user_id = ? AND buddy_user_id = ?", [greeting, newcomerUserId, buddyUserId]);
  return r.affectedRows > 0;
}

// ── Arrival ────────────────────────────────────────────────────────────────

export async function aboardOf(db: Db, userId: string): Promise<{ doorId: string | null; why: string | null } | null> {
  const [rows] = await db.query<RowDataPacket[]>("SELECT door_id, why FROM rite_aboard WHERE user_id = ?", [userId]);
  return rows[0] ? { doorId: rows[0].door_id == null ? null : String(rows[0].door_id), why: rows[0].why == null ? null : String(rows[0].why) } : null;
}

export async function setAboard(db: Db, userId: string, doorId: string | null, why: string | null, at: Date): Promise<void> {
  await db.query(
    "INSERT INTO rite_aboard (user_id, door_id, why, updated_at) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE door_id = VALUES(door_id), why = VALUES(why), updated_at = VALUES(updated_at)",
    [userId, doorId, why, at],
  );
}

// ── Door codes ─────────────────────────────────────────────────────────────

export async function liveCodeOf(db: Db, userId: string): Promise<string | null> {
  const [rows] = await db.query<RowDataPacket[]>("SELECT code FROM rite_door_codes WHERE user_id = ? AND ended_at IS NULL ORDER BY made_at DESC LIMIT 1", [userId]);
  return rows[0] ? String(rows[0].code) : null;
}

export async function codeOwner(db: Db, code: string): Promise<string | null> {
  const [rows] = await db.query<RowDataPacket[]>("SELECT user_id FROM rite_door_codes WHERE code = ? AND ended_at IS NULL", [code]);
  return rows[0] ? String(rows[0].user_id) : null;
}

/** End every live code of the member, then keep this one. */
export async function replaceCode(db: Db, userId: string, code: string, at: Date): Promise<void> {
  await db.query("UPDATE rite_door_codes SET ended_at = ? WHERE user_id = ? AND ended_at IS NULL", [at, userId]);
  await db.query("INSERT INTO rite_door_codes (code, user_id, made_at) VALUES (?, ?, ?)", [code, userId, at]);
}

export async function endCodesOf(db: Db, userId: string, at: Date): Promise<number> {
  const [r] = await db.query<ResultSetHeader>("UPDATE rite_door_codes SET ended_at = ? WHERE user_id = ? AND ended_at IS NULL", [at, userId]);
  return r.affectedRows;
}

// ── Letters ────────────────────────────────────────────────────────────────

export async function letterLine(db: Db, inviteId: string): Promise<string | null> {
  const [rows] = await db.query<RowDataPacket[]>("SELECT line FROM invite_letters WHERE invite_id = ?", [inviteId]);
  return rows[0] ? String(rows[0].line) : null;
}

export async function setLetterLine(db: Db, inviteId: string, line: string, at: Date): Promise<void> {
  await db.query("INSERT INTO invite_letters (invite_id, line, written_at) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE line = VALUES(line), written_at = VALUES(written_at)", [inviteId, line, at]);
}

export async function lettersFor(db: Db, inviteIds: readonly string[]): Promise<Map<string, string>> {
  if (inviteIds.length === 0) return new Map();
  const [rows] = await db.query<RowDataPacket[]>(`SELECT invite_id, line FROM invite_letters WHERE invite_id IN (${marks(inviteIds.length)})`, [...inviteIds]);
  return new Map(rows.map((r) => [String(r.invite_id), String(r.line)]));
}

// ── Interest ───────────────────────────────────────────────────────────────

export async function leaveInterest(db: Db, row: { id: string; doorId: string; name: string; email: string; at: Date }): Promise<void> {
  await db.query("INSERT INTO rite_interest (id, door_id, name, email, left_at) VALUES (?, ?, ?, ?, ?)", [row.id, row.doorId, row.name, row.email, row.at]);
}

export async function interestList(db: Db, limit = 500): Promise<Array<{ id: string; doorId: string; name: string; email: string; leftAt: string | null }>> {
  const [rows] = await db.query<RowDataPacket[]>("SELECT id, door_id, name, email, left_at FROM rite_interest ORDER BY left_at DESC LIMIT ?", [limit]);
  return rows.map((r) => ({ id: String(r.id), doorId: String(r.door_id), name: String(r.name), email: String(r.email), leftAt: iso(r.left_at) }));
}

export async function interestAlready(db: Db, doorId: string, email: string): Promise<boolean> {
  const [rows] = await db.query<RowDataPacket[]>("SELECT 1 FROM rite_interest WHERE door_id = ? AND email = ? LIMIT 1", [doorId, email]);
  return rows.length > 0;
}

// ── Reads from other modules' tables, names and counts only ────────────────

export interface PersonRow {
  id: string;
  name: string;
  handle: string | null;
  avatar: string | null;
  admitted: boolean;
}

export async function people(db: Db, ids: readonly string[]): Promise<Map<string, PersonRow>> {
  const uniq = Array.from(new Set(ids)).filter(Boolean);
  if (uniq.length === 0) return new Map();
  const [rows] = await db.query<RowDataPacket[]>( // module-review-ok: names and avatars of members a signed-in member's rite names
    `SELECT id, name, handle, avatar, membership_granted FROM users WHERE id IN (${marks(uniq.length)}) AND is_example = 0`,
    uniq,
  );
  return new Map(
    rows.map((r) => [String(r.id), { id: String(r.id), name: String(r.name ?? ""), handle: r.handle == null ? null : String(r.handle), avatar: r.avatar == null ? null : String(r.avatar), admitted: Number(r.membership_granted) === 1 }]),
  );
}

/** Counts a village may show to anybody: a number with nothing attached. */
export async function publicCounts(db: Db, admittingRiteId: string | null): Promise<{ sworn: number; circles: number; quests: number }> {
  const sworn = admittingRiteId
    ? Number(((await db.query<RowDataPacket[]>("SELECT COUNT(*) AS n FROM rite_stamps s JOIN users u ON u.id = s.user_id AND u.is_example = 0 WHERE s.rite_id = ?", [admittingRiteId]))[0][0] as RowDataPacket).n) // module-review-ok: a count, no member named
    : Number(((await db.query<RowDataPacket[]>("SELECT COUNT(*) AS n FROM users WHERE membership_granted = 1 AND is_example = 0"))[0][0] as RowDataPacket).n); // module-review-ok: a count, no member named
  const circles = Number(((await db.query<RowDataPacket[]>("SELECT COUNT(*) AS n FROM circles WHERE status = 'active' AND is_example = 0"))[0][0] as RowDataPacket).n); // module-review-ok: a count of the village's circles
  const quests = Number(((await db.query<RowDataPacket[]>("SELECT COUNT(*) AS n FROM quest_claims c JOIN users u ON u.id = c.user_id AND u.is_example = 0 WHERE c.status = 'consented'"))[0][0] as RowDataPacket).n); // module-review-ok: a count, no quest or member named
  return { sworn, circles, quests };
}

/** One token's balance for many members' accounts (`mem:<id>`). */
export async function balancesOfMany(db: Db, userIds: readonly string[], token: string): Promise<Map<string, number>> {
  if (userIds.length === 0 || !token) return new Map();
  const accounts = userIds.map((id) => `mem:${id}`);
  const [rows] = await db.query<RowDataPacket[]>( // module-review-ok: the cached balances a member's card shows as bare numbers
    `SELECT account_id, balance FROM token_balances WHERE token_type = ? AND account_id IN (${marks(accounts.length)})`,
    [token, ...accounts],
  );
  return new Map(rows.map((r) => [String(r.account_id).slice(4), Number(r.balance)]));
}

/** Members who left and hold a balance of `token`: their Voice rests. */
export async function formerHolders(db: Db, token: string, limit = 50): Promise<string[]> {
  if (!token) return [];
  const [rows] = await db.query<RowDataPacket[]>( // module-review-ok: who holds a balance, for the resting line
    "SELECT SUBSTRING(b.account_id, 5) AS uid FROM token_balances b JOIN users u ON u.id = SUBSTRING(b.account_id, 5) AND u.is_example = 0 " +
      "WHERE b.token_type = ? AND b.balance > 0 AND b.account_id LIKE 'mem:%' AND u.membership_granted = 0 ORDER BY b.balance DESC LIMIT ?",
    [token, limit],
  );
  return rows.map((r) => String(r.uid));
}

// ── Erasure ────────────────────────────────────────────────────────────────

/**
 * A member asked to be forgotten: their own stamps, mark, ceremonies as the
 * candidate, buddy pairings either side, arrival words, door codes and their
 * invitation lines go. Where they witnessed somebody else's rite, the witness
 * row goes and the stamp it made stays, with no name on it.
 */
export async function forgetMemberRites(db: Db, userId: string): Promise<void> {
  await db.query("DELETE FROM rite_stamps WHERE user_id = ?", [userId]);
  await db.query("UPDATE rite_stamps SET witness_user_id = NULL WHERE witness_user_id = ?", [userId]);
  await db.query("DELETE FROM member_marks WHERE user_id = ?", [userId]);
  const [cer] = await db.query<RowDataPacket[]>("SELECT id FROM rite_ceremonies WHERE candidate_user_id = ?", [userId]);
  const ids = cer.map((r) => String(r.id));
  if (ids.length) await db.query(`DELETE FROM rite_witnesses WHERE ceremony_id IN (${marks(ids.length)})`, ids);
  await db.query("DELETE FROM rite_ceremonies WHERE candidate_user_id = ?", [userId]);
  await db.query("DELETE FROM rite_witnesses WHERE witness_user_id = ?", [userId]);
  await db.query("UPDATE rite_ceremonies SET opened_by = '' WHERE opened_by = ?", [userId]);
  await db.query("DELETE FROM rite_buddies WHERE newcomer_user_id = ? OR buddy_user_id = ?", [userId, userId]);
  await db.query("UPDATE rite_buddies SET paired_by = '' WHERE paired_by = ?", [userId]);
  await db.query("DELETE FROM rite_aboard WHERE user_id = ?", [userId]);
  await db.query("DELETE FROM rite_door_codes WHERE user_id = ?", [userId]);
  await db.query( // module-review-ok: the lines this member wrote on their own invitations
    "DELETE l FROM invite_letters l JOIN member_invites i ON i.id = l.invite_id WHERE i.inviter_user_id = ?",
    [userId],
  );
}
