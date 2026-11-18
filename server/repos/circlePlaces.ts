/**
 * CIRCLE PLACES AT A GATHERING, THE SQL (drizzle/0409). The rules are
 * shared/circlePlaces.ts.
 *
 * Every write that can change how many circles are going runs inside
 * `withGatheringLock`, which takes the gathering's events row FOR UPDATE: the
 * same lock `rsvp` takes (server/lib/gatherings.ts), in the same order (the
 * events row first), so the two can never deadlock against each other.
 */
import crypto from "node:crypto";
import type { Pool, PoolConnection, RowDataPacket } from "mysql2/promise";
import { goingOrWaiting, NO_CIRCLES, type CirclePlaceStatus, type CircleSettings } from "../../shared/circlePlaces";

type Q = Pool | PoolConnection;

export interface StoredCirclePlace {
  id: string;
  eventId: string;
  circleId: string;
  status: CirclePlaceStatus;
  answeredBy: string | null;
  queuedAt: string;
  placedAt: string | null;
}

const iso = (v: unknown): string | null => (v == null ? null : v instanceof Date ? v.toISOString() : String(v));
const COLS = "id, event_id, circle_id, status, answered_by, queued_at, placed_at";

function rowToPlace(r: any): StoredCirclePlace {
  const status = String(r.status);
  return {
    id: String(r.id),
    eventId: String(r.event_id),
    circleId: String(r.circle_id),
    status: status === "going" || status === "waiting" ? status : "left",
    answeredBy: r.answered_by ?? null,
    queuedAt: iso(r.queued_at) ?? "",
    placedAt: iso(r.placed_at),
  };
}

export async function circleSettingsOf(db: Q, eventId: string): Promise<CircleSettings> {
  const [rows] = await db.query<RowDataPacket[]>(
    "SELECT takes_circles, circle_cap, needs_season_place FROM event_circle_settings WHERE event_id = ?",
    [eventId],
  );
  const r = rows[0];
  if (!r) return { ...NO_CIRCLES };
  return { takesCircles: Number(r.takes_circles) === 1, circleCap: r.circle_cap == null ? null : Number(r.circle_cap), needsSeasonPlace: Number(r.needs_season_place) === 1 };
}

export async function saveCircleSettings(db: Q, eventId: string, s: CircleSettings, by: string): Promise<void> {
  await db.query(
    `INSERT INTO event_circle_settings (event_id, takes_circles, circle_cap, needs_season_place, updated_by) VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE takes_circles = VALUES(takes_circles), circle_cap = VALUES(circle_cap),
       needs_season_place = VALUES(needs_season_place), updated_by = VALUES(updated_by), updated_at = NOW()`,
    [eventId, s.takesCircles ? 1 : 0, s.circleCap, s.needsSeasonPlace ? 1 : 0, by],
  );
}

/** Going first, then the waitlist in order. Circles that left are not listed. */
export async function listCirclePlaces(db: Q, eventId: string): Promise<StoredCirclePlace[]> {
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT ${COLS} FROM event_circle_places WHERE event_id = ? AND status IN ('going', 'waiting')
      ORDER BY FIELD(status, 'going', 'waiting'), queued_at, id`,
    [eventId],
  );
  return rows.map(rowToPlace);
}

/** Run `fn` holding the gathering's events row. Null when there is no such gathering. */
export async function withGatheringLock<T>(pool: Pool, eventId: string, fn: (conn: PoolConnection) => Promise<T>): Promise<T | null> {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [[event]] = await conn.query<RowDataPacket[]>("SELECT id FROM events WHERE id = ? AND removed_at IS NULL FOR UPDATE", [eventId]);
    if (!event) { await conn.rollback(); return null; }
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

async function goingCount(conn: Q, eventId: string): Promise<number> {
  const [[r]] = await conn.query<RowDataPacket[]>("SELECT COUNT(*) AS n FROM event_circle_places WHERE event_id = ? AND status = 'going'", [eventId]);
  return Number(r?.n ?? 0);
}

export async function waitingPosition(conn: Q, eventId: string, circleId: string): Promise<number> {
  const [[r]] = await conn.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS ahead FROM event_circle_places w JOIN event_circle_places me ON me.event_id = ? AND me.circle_id = ?
      WHERE w.event_id = ? AND w.status = 'waiting' AND (w.queued_at < me.queued_at OR (w.queued_at = me.queued_at AND w.id < me.id))`,
    [eventId, circleId, eventId],
  );
  return Number(r?.ahead ?? 0) + 1;
}

/**
 * Sign a circle up. MUST run inside `withGatheringLock`. A circle already
 * going or waiting keeps its place in line and answers `duplicate`.
 */
export async function signUpOn(
  conn: PoolConnection,
  eventId: string,
  circleId: string,
  by: string,
  cap: number | null,
): Promise<{ status: "going" | "waiting"; duplicate: boolean; position: number | null }> {
  const [[prior]] = await conn.query<RowDataPacket[]>("SELECT id, status FROM event_circle_places WHERE event_id = ? AND circle_id = ?", [eventId, circleId]);
  if (prior && (prior.status === "going" || prior.status === "waiting")) {
    const status = prior.status as "going" | "waiting";
    return { status, duplicate: true, position: status === "waiting" ? await waitingPosition(conn, eventId, circleId) : null };
  }
  const status = goingOrWaiting(await goingCount(conn, eventId), cap);
  if (prior) {
    await conn.query(
      `UPDATE event_circle_places SET status = ?, answered_by = ?, queued_at = NOW(3), placed_at = ${status === "going" ? "NOW()" : "NULL"}, left_at = NULL WHERE id = ?`,
      [status, by, prior.id],
    );
  } else {
    await conn.query(
      `INSERT INTO event_circle_places (id, event_id, circle_id, status, answered_by, queued_at, placed_at) VALUES (?, ?, ?, ?, ?, NOW(3), ${status === "going" ? "NOW()" : "NULL"})`,
      [`cp-${Date.now().toString(36)}${crypto.randomBytes(4).toString("hex")}`, eventId, circleId, status, by],
    );
  }
  return { status, duplicate: false, position: status === "waiting" ? await waitingPosition(conn, eventId, circleId) : null };
}

/** Take a circle out. MUST run inside `withGatheringLock`. True when it was going or waiting. */
export async function leaveOn(conn: PoolConnection, eventId: string, circleId: string, by: string): Promise<{ left: boolean; wasGoing: boolean }> {
  const [[prior]] = await conn.query<RowDataPacket[]>("SELECT id, status FROM event_circle_places WHERE event_id = ? AND circle_id = ? FOR UPDATE", [eventId, circleId]);
  if (!prior || (prior.status !== "going" && prior.status !== "waiting")) return { left: false, wasGoing: false };
  await conn.query("UPDATE event_circle_places SET status = 'left', answered_by = ?, left_at = NOW() WHERE id = ?", [by, prior.id]);
  return { left: true, wasGoing: prior.status === "going" };
}

/** Fill free places from the waitlist, first in line first. MUST run inside `withGatheringLock`. */
export async function promoteCirclesOn(conn: PoolConnection, eventId: string, cap: number | null): Promise<string[]> {
  const going = await goingCount(conn, eventId);
  const room = cap === null ? Number.MAX_SAFE_INTEGER : Math.max(0, cap - going);
  if (room <= 0) return [];
  const [rows] = await conn.query<RowDataPacket[]>(
    "SELECT id, circle_id FROM event_circle_places WHERE event_id = ? AND status = 'waiting' ORDER BY queued_at, id LIMIT ?",
    [eventId, Math.min(room, 1000)],
  );
  const out: string[] = [];
  for (const r of rows) {
    const [res]: any = await conn.query("UPDATE event_circle_places SET status = 'going', placed_at = NOW() WHERE id = ? AND status = 'waiting'", [r.id]);
    if (Number(res?.affectedRows ?? 0) === 1) out.push(String(r.circle_id));
  }
  return out;
}

/** Upcoming gatherings that take circles, soonest first: id, title, start and cap. */
export async function gatheringsTakingCircles(db: Q, limit = 20): Promise<Array<{ id: string; title: string; startsAt: string; circleCap: number | null }>> {
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT e.id, e.title, e.starts_at, s.circle_cap FROM event_circle_settings s JOIN events e ON e.id = s.event_id
      WHERE s.takes_circles = 1 AND e.removed_at IS NULL AND e.status IN ('scheduled', 'postponed') AND e.starts_at >= (NOW() - INTERVAL 1 DAY)
      ORDER BY e.starts_at, e.id LIMIT ?`,
    [limit],
  );
  return rows.map((r) => ({ id: String(r.id), title: String(r.title), startsAt: iso(r.starts_at) ?? "", circleCap: r.circle_cap == null ? null : Number(r.circle_cap) }));
}

/** Whether a circle holds a place in a season, for a gathering that asks for one. */
export async function holdsSeasonPlace(db: Q, seasonId: string, circleId: string): Promise<boolean> {
  const [[r]] = await db.query<RowDataPacket[]>(
    "SELECT 1 AS ok FROM season_places WHERE season_id = ? AND subject_kind = 'circle' AND subject_id = ? AND status = 'taking_part'",
    [seasonId, circleId],
  );
  return Boolean(r);
}

/** ERASURE: a departing member's name comes off every answer they gave for a circle. */
export async function forgetCircleAnswersBy(db: Q, userId: string): Promise<number> {
  const [res]: any = await db.query("UPDATE event_circle_places SET answered_by = NULL WHERE answered_by = ?", [userId]);
  return Number(res?.affectedRows ?? 0);
}
