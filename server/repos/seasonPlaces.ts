/**
 * SEASON PLACES, THE SQL (drizzle/0395). The rules are shared/seasonPlaces.ts
 * and the orchestration is server/lib/seasonPlaces.ts.
 *
 * ── THE CAP IS HELD BY A LOCK ROW ───────────────────────────────────────────
 *
 * "Count the places, then take one" is check-then-act: two adoptions at the
 * same moment both read 43 of 44 and both take the last place. Every write
 * that can change how many places are taken runs inside `withSeasonLock`,
 * which locks the season's one row in `season_place_locks` first. That is the
 * smallest lock that makes the cap true, the same shape `rsvp` takes with the
 * events row (server/lib/gatherings.ts).
 */
import crypto from "node:crypto";
import type { Pool, PoolConnection, RowDataPacket } from "mysql2/promise";
import { LIVE_STATUSES, placeOrQueue, freePlaces, type PlaceStatus, type Road, type SubjectKind } from "../../shared/seasonPlaces";

type Q = Pool | PoolConnection;

export interface StoredPlace {
  id: string;
  seasonId: string;
  subjectKind: SubjectKind;
  subjectId: string;
  status: PlaceStatus;
  road: Road;
  words: string | null;
  proposedBy: string;
  decidedBy: string | null;
  queuedAt: string | null;
  placedAt: string | null;
  decidedAt: string | null;
  createdAt: string;
}

const COLS =
  "id, season_id, subject_kind, subject_id, status, road, words, proposed_by, decided_by, queued_at, placed_at, decided_at, created_at";

const iso = (v: unknown): string | null => (v == null ? null : v instanceof Date ? v.toISOString() : String(v));

function rowToPlace(r: any): StoredPlace {
  return {
    id: String(r.id),
    seasonId: String(r.season_id),
    subjectKind: r.subject_kind === "member" ? "member" : "circle",
    subjectId: String(r.subject_id),
    status: String(r.status) as PlaceStatus,
    road: r.road === "served" ? "served" : "proposal",
    words: r.words ?? null,
    proposedBy: String(r.proposed_by),
    decidedBy: r.decided_by ?? null,
    queuedAt: iso(r.queued_at),
    placedAt: iso(r.placed_at),
    decidedAt: iso(r.decided_at),
    createdAt: iso(r.created_at) ?? "",
  };
}

export const PLACE_ID = /^sp-[a-z0-9]{6,32}$/;
const newId = () => `sp-${Date.now().toString(36)}${crypto.randomBytes(4).toString("hex")}`;

export async function readPlace(db: Q, id: string): Promise<StoredPlace | null> {
  const [rows] = await db.query<RowDataPacket[]>(`SELECT ${COLS} FROM season_places WHERE id = ?`, [id]);
  return rows[0] ? rowToPlace(rows[0]) : null;
}

export async function placeOf(db: Q, seasonId: string, kind: SubjectKind, subjectId: string): Promise<StoredPlace | null> {
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT ${COLS} FROM season_places WHERE season_id = ? AND subject_kind = ? AND subject_id = ?`,
    [seasonId, kind, subjectId],
  );
  return rows[0] ? rowToPlace(rows[0]) : null;
}

/** Every row of one season, places first, then the waitlist in order, then the rest. */
export async function listSeason(db: Q, seasonId: string): Promise<StoredPlace[]> {
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT ${COLS} FROM season_places WHERE season_id = ?
      ORDER BY FIELD(status, 'taking_part', 'waitlisted', 'voting', 'proposed', 'declined', 'withdrawn'), queued_at, created_at, id`,
    [seasonId],
  );
  return rows.map(rowToPlace);
}

/** A subject's rows in every season, for the seasons-served count. */
export async function historyOf(db: Q, kind: SubjectKind, subjectId: string): Promise<Array<{ seasonId: string; status: PlaceStatus }>> {
  const [rows] = await db.query<RowDataPacket[]>(
    "SELECT season_id, status FROM season_places WHERE subject_kind = ? AND subject_id = ?",
    [kind, subjectId],
  );
  return rows.map((r) => ({ seasonId: String(r.season_id), status: String(r.status) as PlaceStatus }));
}

/** The same, for many subjects at once. */
export async function historiesOf(db: Q, kind: SubjectKind, ids: readonly string[]): Promise<Map<string, Array<{ seasonId: string; status: PlaceStatus }>>> {
  const out = new Map<string, Array<{ seasonId: string; status: PlaceStatus }>>();
  if (ids.length === 0) return out;
  const [rows] = await db.query<RowDataPacket[]>(
    "SELECT subject_id, season_id, status FROM season_places WHERE subject_kind = ? AND subject_id IN (?)",
    [kind, ids],
  );
  for (const r of rows) {
    const list = out.get(String(r.subject_id)) ?? [];
    list.push({ seasonId: String(r.season_id), status: String(r.status) as PlaceStatus });
    out.set(String(r.subject_id), list);
  }
  return out;
}

/**
 * Run `fn` holding the season's lock row. The row is made on first use, and
 * every caller locks it before reading a count, so the count it reads is the
 * count it writes against.
 */
export async function withSeasonLock<T>(pool: Pool, seasonId: string, fn: (conn: PoolConnection) => Promise<T>): Promise<T> {
  /*
   * THE ROW IS MADE BEFORE THE TRANSACTION, on its own autocommit statement.
   * Made inside it, two first users of a season each took a gap lock on the
   * missing key and then waited on the other's insert: a deadlock, which the
   * concurrency test in server/routes/seasonPlaces.test.ts found. Outside,
   * the insert either lands or is ignored at once, and every caller then
   * locks one row that exists.
   */
  await pool.query("INSERT IGNORE INTO season_place_locks (season_id) VALUES (?)", [seasonId]);
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query("SELECT season_id FROM season_place_locks WHERE season_id = ? FOR UPDATE", [seasonId]);
    const out = await fn(conn);
    await conn.commit();
    return out;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

export async function countTaken(conn: Q, seasonId: string): Promise<number> {
  const [[row]] = await conn.query<RowDataPacket[]>(
    "SELECT COUNT(*) AS n FROM season_places WHERE season_id = ? AND status = 'taking_part'",
    [seasonId],
  );
  return Number(row?.n ?? 0);
}

export async function countWaiting(conn: Q, seasonId: string): Promise<number> {
  const [[row]] = await conn.query<RowDataPacket[]>(
    "SELECT COUNT(*) AS n FROM season_places WHERE season_id = ? AND status = 'waitlisted'",
    [seasonId],
  );
  return Number(row?.n ?? 0);
}

/** A waiting row's place in line, 1 for the first. */
export async function positionOf(conn: Q, place: Pick<StoredPlace, "id" | "seasonId">): Promise<number> {
  const [[row]] = await conn.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS ahead FROM season_places w
       JOIN season_places me ON me.id = ?
      WHERE w.season_id = ? AND w.status = 'waitlisted'
        AND (w.queued_at < me.queued_at OR (w.queued_at = me.queued_at AND w.id < me.id))`,
    [place.id, place.seasonId],
  );
  return Number(row?.ahead ?? 0) + 1;
}

export interface NewPlace {
  seasonId: string;
  subjectKind: SubjectKind;
  subjectId: string;
  road: Road;
  words: string | null;
  proposedBy: string;
  status: Extract<PlaceStatus, "proposed" | "voting">;
}

/**
 * Write a proposal, or a served subject's join (status `proposed` until it is
 * placed). A subject already live this season answers `exists`; one that was
 * declined or withdrew is written again on its own row.
 */
export async function writePlace(conn: PoolConnection, p: NewPlace): Promise<{ ok: true; id: string } | { ok: false; reason: "exists"; place: StoredPlace }> {
  const prior = await placeOf(conn, p.seasonId, p.subjectKind, p.subjectId);
  if (prior && (LIVE_STATUSES as readonly string[]).includes(prior.status)) return { ok: false, reason: "exists", place: prior };
  if (prior) {
    await conn.query(
      `UPDATE season_places SET status = ?, road = ?, words = ?, proposed_by = ?, decided_by = NULL,
              queued_at = NULL, placed_at = NULL, decided_at = NULL, created_at = NOW(), updated_at = NOW()
        WHERE id = ?`,
      [p.status, p.road, p.words, p.proposedBy, prior.id],
    );
    return { ok: true, id: prior.id };
  }
  const id = newId();
  await conn.query(
    `INSERT INTO season_places (id, season_id, subject_kind, subject_id, status, road, words, proposed_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, p.seasonId, p.subjectKind, p.subjectId, p.status, p.road, p.words, p.proposedBy],
  );
  return { ok: true, id };
}

/** Move a row only from one of the statuses named. False when it had already moved. */
export async function setStatus(
  db: Q,
  id: string,
  from: readonly PlaceStatus[],
  to: PlaceStatus,
  opts: { decidedBy?: string | null; decided?: boolean } = {},
): Promise<boolean> {
  const sets = ["status = ?", "updated_at = NOW()"];
  const args: unknown[] = [to];
  if (opts.decidedBy !== undefined) { sets.push("decided_by = ?"); args.push(opts.decidedBy); }
  if (opts.decided) sets.push("decided_at = NOW()");
  const [res]: any = await db.query(
    `UPDATE season_places SET ${sets.join(", ")} WHERE id = ? AND status IN (?)`,
    [...args, id, from],
  );
  return Number(res?.affectedRows ?? 0) === 1;
}

/**
 * Give an eligible row a place, or put it on the waitlist. MUST run inside
 * `withSeasonLock` for the row's season. `from` names the statuses the row may
 * move out of, so a row that moved meanwhile is left alone.
 */
export async function placeOrQueueOn(
  conn: PoolConnection,
  place: Pick<StoredPlace, "id" | "seasonId">,
  cap: number | null,
  from: readonly PlaceStatus[],
  decidedBy: string | null,
): Promise<"taking_part" | "waitlisted" | "moved"> {
  const taken = await countTaken(conn, place.seasonId);
  const to = placeOrQueue(taken, cap);
  const [res]: any = await conn.query(
    `UPDATE season_places
        SET status = ?, decided_by = COALESCE(?, decided_by), decided_at = COALESCE(decided_at, NOW()),
            queued_at = NOW(3), placed_at = ${to === "taking_part" ? "NOW()" : "NULL"}, updated_at = NOW()
      WHERE id = ? AND status IN (?)`,
    [to, decidedBy, place.id, from],
  );
  return Number(res?.affectedRows ?? 0) === 1 ? to : "moved";
}

/**
 * Fill free places from the waitlist, first in line first. MUST run inside
 * `withSeasonLock`. Returns the rows that took a place, for the notices.
 */
export async function promoteOn(conn: PoolConnection, seasonId: string, cap: number | null): Promise<StoredPlace[]> {
  const taken = await countTaken(conn, seasonId);
  const waiting = await countWaiting(conn, seasonId);
  const n = freePlaces(taken, cap, waiting);
  if (n <= 0) return [];
  const [rows] = await conn.query<RowDataPacket[]>(
    `SELECT ${COLS} FROM season_places WHERE season_id = ? AND status = 'waitlisted' ORDER BY queued_at, id LIMIT ?`,
    [seasonId, n],
  );
  const promoted: StoredPlace[] = [];
  for (const r of rows) {
    const [res]: any = await conn.query(
      "UPDATE season_places SET status = 'taking_part', placed_at = NOW(), updated_at = NOW() WHERE id = ? AND status = 'waitlisted'",
      [r.id],
    );
    if (Number(res?.affectedRows ?? 0) === 1) promoted.push({ ...rowToPlace(r), status: "taking_part" });
  }
  return promoted;
}

/** Circle names by id. A circle that is gone reads as its id at the caller. */
export async function circleNames(db: Q, ids: readonly string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (ids.length === 0) return out;
  const [rows] = await db.query<RowDataPacket[]>("SELECT id, name FROM circles WHERE id IN (?)", [ids]);
  for (const r of rows) out.set(String(r.id), String(r.name));
  return out;
}

/** Members' full names by id, for a member subject's first name on the members' page. */
export async function memberNames(db: Q, ids: readonly string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (ids.length === 0) return out;
  const [rows] = await db.query<RowDataPacket[]>("SELECT id, name FROM users WHERE id IN (?)", [ids]);
  for (const r of rows) if (r.name) out.set(String(r.id), String(r.name));
  return out;
}

/** Seasons with somebody waiting, for the hourly fill. */
export async function seasonsWithWaiting(db: Q): Promise<string[]> {
  const [rows] = await db.query<RowDataPacket[]>("SELECT DISTINCT season_id FROM season_places WHERE status = 'waitlisted'");
  return rows.map((r) => String(r.season_id));
}

/**
 * ERASURE. A departing member's words come off every row they proposed, and
 * their own rows as a member subject go. Returns the rows touched.
 */
export async function forgetMemberPlaces(db: Q, userId: string): Promise<number> {
  const [cleared]: any = await db.query("UPDATE season_places SET words = NULL WHERE proposed_by = ? AND words IS NOT NULL", [userId]);
  const [gone]: any = await db.query("DELETE FROM season_places WHERE subject_kind = 'member' AND subject_id = ?", [userId]);
  return Number(cleared?.affectedRows ?? 0) + Number(gone?.affectedRows ?? 0);
}
