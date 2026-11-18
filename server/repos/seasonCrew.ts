/**
 * SEASON CREW, THE SQL (drizzle/0406). The rules are shared/seasonCrew.ts.
 *
 * A pick runs inside `withSeasonLock` (server/repos/seasonPlaces.ts), the
 * season's one lock row, so two circles cannot pick the same person and a
 * circle cannot pick past its berths.
 */
import crypto from "node:crypto";
import type { Pool, PoolConnection, RowDataPacket } from "mysql2/promise";
import type { CrewStatus } from "../../shared/seasonCrew";

type Q = Pool | PoolConnection;

export interface CrewApplication {
  id: string;
  seasonId: string;
  userId: string;
  wantsCircleId: string | null;
  words: string | null;
  status: CrewStatus;
  pickedCircleId: string | null;
  pickedBy: string | null;
}

const COLS = "id, season_id, user_id, wants_circle_id, words, status, picked_circle_id, picked_by";
export const CREW_APPLICATION_ID = /^sc-[a-z0-9]{6,32}$/;

function rowTo(r: any): CrewApplication {
  const s = String(r.status);
  return {
    id: String(r.id),
    seasonId: String(r.season_id),
    userId: String(r.user_id),
    wantsCircleId: r.wants_circle_id ?? null,
    words: r.words ?? null,
    status: s === "picked" || s === "withdrawn" ? s : "applied",
    pickedCircleId: r.picked_circle_id ?? null,
    pickedBy: r.picked_by ?? null,
  };
}

export async function readCrewApplication(db: Q, id: string): Promise<CrewApplication | null> {
  const [rows] = await db.query<RowDataPacket[]>(`SELECT ${COLS} FROM season_crew_applications WHERE id = ?`, [id]);
  return rows[0] ? rowTo(rows[0]) : null;
}

export async function applicationOf(db: Q, seasonId: string, userId: string): Promise<CrewApplication | null> {
  const [rows] = await db.query<RowDataPacket[]>(`SELECT ${COLS} FROM season_crew_applications WHERE season_id = ? AND user_id = ?`, [seasonId, userId]);
  return rows[0] ? rowTo(rows[0]) : null;
}

/** Every live application of a season, oldest first. */
export async function seasonPool(db: Q, seasonId: string): Promise<CrewApplication[]> {
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT ${COLS} FROM season_crew_applications WHERE season_id = ? AND status IN ('applied', 'picked') ORDER BY created_at, id`,
    [seasonId],
  );
  return rows.map(rowTo);
}

/**
 * Apply, or apply again after withdrawing. A live application is updated in
 * place (the circle wanted, the words) and keeps its pick if it has one.
 */
export async function upsertApplication(db: Q, a: { seasonId: string; userId: string; wantsCircleId: string | null; words: string | null }): Promise<{ id: string; created: boolean }> {
  const prior = await applicationOf(db, a.seasonId, a.userId);
  if (prior) {
    await db.query(
      `UPDATE season_crew_applications SET wants_circle_id = ?, words = ?,
         status = IF(status = 'withdrawn', 'applied', status), updated_at = NOW() WHERE id = ?`,
      [a.wantsCircleId, a.words, prior.id],
    );
    return { id: prior.id, created: prior.status === "withdrawn" };
  }
  const id = `sc-${Date.now().toString(36)}${crypto.randomBytes(4).toString("hex")}`;
  await db.query(
    "INSERT INTO season_crew_applications (id, season_id, user_id, wants_circle_id, words, status) VALUES (?, ?, ?, ?, ?, 'applied')",
    [id, a.seasonId, a.userId, a.wantsCircleId, a.words],
  );
  return { id, created: true };
}

export async function pickedCount(db: Q, seasonId: string, circleId: string): Promise<number> {
  const [[r]] = await db.query<RowDataPacket[]>(
    "SELECT COUNT(*) AS n FROM season_crew_applications WHERE season_id = ? AND picked_circle_id = ? AND status = 'picked'",
    [seasonId, circleId],
  );
  return Number(r?.n ?? 0);
}

/** Pick one applicant for a circle. MUST run inside the season's lock. False when they were already picked or withdrew. */
export async function pickOn(conn: PoolConnection, id: string, circleId: string, by: string): Promise<boolean> {
  const [res]: any = await conn.query(
    `UPDATE season_crew_applications SET status = 'picked', picked_circle_id = ?, picked_by = ?, picked_at = NOW(), updated_at = NOW()
      WHERE id = ? AND status = 'applied'`,
    [circleId, by, id],
  );
  return Number(res?.affectedRows ?? 0) === 1;
}

/** Hand a picked applicant back to the pool. Only the circle that picked them can. */
export async function releaseOn(db: Q, id: string, circleId: string): Promise<boolean> {
  const [res]: any = await db.query(
    `UPDATE season_crew_applications SET status = 'applied', picked_circle_id = NULL, picked_by = NULL, picked_at = NULL, updated_at = NOW()
      WHERE id = ? AND status = 'picked' AND picked_circle_id = ?`,
    [id, circleId],
  );
  return Number(res?.affectedRows ?? 0) === 1;
}

export async function withdrawApplication(db: Q, id: string, userId: string): Promise<boolean> {
  const [res]: any = await db.query(
    `UPDATE season_crew_applications SET status = 'withdrawn', picked_circle_id = NULL, picked_by = NULL, picked_at = NULL, updated_at = NOW()
      WHERE id = ? AND user_id = ? AND status IN ('applied', 'picked')`,
    [id, userId],
  );
  return Number(res?.affectedRows ?? 0) === 1;
}

export async function berthsOf(db: Q, seasonId: string): Promise<Map<string, number | null>> {
  const [rows] = await db.query<RowDataPacket[]>("SELECT circle_id, berths FROM season_crew_berths WHERE season_id = ?", [seasonId]);
  return new Map(rows.map((r) => [String(r.circle_id), r.berths == null ? null : Number(r.berths)]));
}

export async function setBerths(db: Q, seasonId: string, circleId: string, berths: number | null, by: string): Promise<void> {
  await db.query(
    `INSERT INTO season_crew_berths (season_id, circle_id, berths, set_by) VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE berths = VALUES(berths), set_by = VALUES(set_by), updated_at = NOW()`,
    [seasonId, circleId, berths, by],
  );
}

/** Circles taking part in a season (0404), for a village that asks a circle to hold a place before it picks. */
export async function circlesTakingPart(db: Q, seasonId: string): Promise<string[]> {
  const [rows] = await db.query<RowDataPacket[]>(
    "SELECT subject_id FROM season_places WHERE season_id = ? AND subject_kind = 'circle' AND status = 'taking_part'",
    [seasonId],
  );
  return rows.map((r) => String(r.subject_id));
}

/** ERASURE: a departing member's applications go, and their name comes off every pick they made. */
export async function forgetMemberCrew(db: Q, userId: string): Promise<number> {
  const [gone]: any = await db.query("DELETE FROM season_crew_applications WHERE user_id = ?", [userId]);
  const [cleared]: any = await db.query("UPDATE season_crew_applications SET picked_by = NULL WHERE picked_by = ?", [userId]);
  const [berths]: any = await db.query("UPDATE season_crew_berths SET set_by = NULL WHERE set_by = ?", [userId]);
  return Number(gone?.affectedRows ?? 0) + Number(cleared?.affectedRows ?? 0) + Number(berths?.affectedRows ?? 0);
}
