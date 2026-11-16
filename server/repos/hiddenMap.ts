/**
 * Every statement the hidden map runs (0392). The decisions live in
 * server/lib/hiddenMap.ts and shared/hiddenMap.ts; this file only reads and
 * writes rows.
 *
 * NO QUERY HERE RETURNS A NAME, and the owner's id never leaves this layer
 * except as the boolean the visibility rule needs (`ownerUserId` on a
 * PinRecord, which `visiblePin` reduces to `mine`).
 */
import type { Pool } from "mysql2/promise";
import type { AccessAction, ExportState, Layer, PartnerState, PinInput, PinRecord, Precision, Stage } from "../../shared/hiddenMap";

const iso = (v: unknown): string => (v instanceof Date ? v.toISOString() : String(v ?? ""));
const day = (v: unknown): string | null => {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v).slice(0, 10);
};

function toPin(r: any, photos: Map<string, string[]>): PinRecord {
  return {
    id: String(r.id),
    ownerUserId: r.owner_user_id === null || r.owner_user_id === undefined ? null : String(r.owner_user_id),
    layer: r.layer as Layer,
    kind: String(r.kind),
    lat: Number(r.lat),
    lng: Number(r.lng),
    precision: r.shown_precision as Precision,
    title: r.title ?? null,
    whatWentIn: r.what_went_in ?? null,
    notes: r.notes ?? null,
    stage: (r.stage ?? null) as Stage | null,
    partnerState: (r.partner_state ?? null) as PartnerState | null,
    plantedOn: day(r.planted_on),
    native: Number(r.native_seed ?? 0) === 1,
    hidden: r.hidden_at !== null && r.hidden_at !== undefined,
    createdAt: iso(r.created_at),
    vouches: Number(r.vouches ?? 0),
    vouchedByMe: Number(r.vouched_by_me ?? 0) > 0,
    photoIds: photos.get(String(r.id)) ?? [],
  };
}

/**
 * The pin columns plus two counts: live vouches by anybody but the owner, and
 * whether the viewer has a live vouch on it.
 */
const PIN_SELECT = `
  SELECT p.*,
    (SELECT COUNT(*) FROM hidden_map_vouches v
       WHERE v.village_id = p.village_id AND v.pin_id = p.id AND v.withdrawn_at IS NULL
         AND (p.owner_user_id IS NULL OR v.voucher_user_id <> p.owner_user_id)) AS vouches,
    (SELECT COUNT(*) FROM hidden_map_vouches v2
       WHERE v2.village_id = p.village_id AND v2.pin_id = p.id AND v2.withdrawn_at IS NULL
         AND v2.voucher_user_id = ?) AS vouched_by_me
  FROM hidden_map_pins p`;

async function photosFor(pool: Pool, villageId: string, pinIds: string[]): Promise<Map<string, string[]>> {
  const out = new Map<string, string[]>();
  if (!pinIds.length) return out;
  const [rows] = await pool.query<any[]>(
    `SELECT id, pin_id FROM hidden_map_photos WHERE village_id = ? AND pin_id IN (?) ORDER BY created_at, id`,
    [villageId, pinIds],
  );
  for (const r of rows) {
    const list = out.get(String(r.pin_id)) ?? [];
    list.push(String(r.id));
    out.set(String(r.pin_id), list);
  }
  return out;
}

export interface PinScope {
  /** Only pins this member logged. */
  ownerOnly?: string;
  /** Plus every pin in these layers, whoever logged it. */
  alsoLayers?: readonly Layer[];
  /** Only pins awaiting a vouch: fewer than this many live vouches. */
  awaitingBelow?: number;
}

/**
 * Pins, scoped in SQL before the visibility rule runs over each one. The
 * scope is the first wall and `visiblePin` the second: a member whose map is
 * closed is never even read another member's row unless a layer is open or
 * the teaser is on.
 */
export async function listPins(pool: Pool, villageId: string, viewerId: string, scope: PinScope = {}): Promise<PinRecord[]> {
  const where: string[] = ["p.village_id = ?"];
  const params: any[] = [viewerId, villageId];
  if (scope.ownerOnly !== undefined) {
    if (scope.alsoLayers && scope.alsoLayers.length) {
      where.push("(p.owner_user_id = ? OR p.layer IN (?))");
      params.push(scope.ownerOnly, scope.alsoLayers);
    } else {
      where.push("p.owner_user_id = ?");
      params.push(scope.ownerOnly);
    }
  }
  let sql = `${PIN_SELECT} WHERE ${where.join(" AND ")} ORDER BY p.created_at DESC, p.id LIMIT 5000`;
  if (scope.awaitingBelow !== undefined) {
    sql = `SELECT * FROM (${PIN_SELECT} WHERE ${where.join(" AND ")}) q WHERE q.vouches < ? AND q.hidden_at IS NULL ORDER BY q.created_at, q.id LIMIT 500`;
    params.push(scope.awaitingBelow);
  }
  const [rows] = await pool.query<any[]>(sql, params);
  const photos = await photosFor(pool, villageId, rows.map((r) => String(r.id)));
  return rows.map((r) => toPin(r, photos));
}

export async function getPin(pool: Pool, villageId: string, viewerId: string, id: string): Promise<PinRecord | null> {
  const [rows] = await pool.query<any[]>(`${PIN_SELECT} WHERE p.village_id = ? AND p.id = ? LIMIT 1`, [viewerId, villageId, id]);
  if (!rows.length) return null;
  return toPin(rows[0], await photosFor(pool, villageId, [id]));
}

export async function pinIdByClient(pool: Pool, villageId: string, clientId: string): Promise<{ id: string; ownerUserId: string | null } | null> {
  const [rows] = await pool.query<any[]>(
    "SELECT id, owner_user_id FROM hidden_map_pins WHERE village_id = ? AND client_id = ? LIMIT 1",
    [villageId, clientId],
  );
  return rows.length ? { id: String(rows[0].id), ownerUserId: rows[0].owner_user_id ?? null } : null;
}

/** Insert a pin once. A second insert with the same client id writes nothing. */
export async function insertPin(pool: Pool, villageId: string, id: string, ownerUserId: string, pin: PinInput, now: Date): Promise<void> {
  await pool.query(
    `INSERT IGNORE INTO hidden_map_pins
       (id, village_id, client_id, owner_user_id, layer, kind, lat, lng, shown_precision, title, what_went_in, notes,
        stage, partner_state, planted_on, native_seed, created_at, changed_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id, villageId, pin.clientId, ownerUserId, pin.layer, pin.kind, pin.point.lat, pin.point.lng, pin.precision,
      pin.title, pin.whatWentIn, pin.notes, pin.layer === "planting" ? "seed" : null, pin.partnerState, pin.plantedOn,
      pin.native ? 1 : 0, now, now,
    ],
  );
}

/** Pins the member logged on the planting layer that are not hidden and hold at least `perPin` live vouches from others. */
export async function countVouchedPlantings(pool: Pool, villageId: string, userId: string, perPin: number, since: Date | null = null): Promise<number> {
  // `since`: only pins logged from the member's admission count (a village that marks one).
  const [rows] = await pool.query<any[]>(
    `SELECT COUNT(*) AS n FROM hidden_map_pins p
      WHERE p.village_id = ? AND p.owner_user_id = ? AND p.layer = 'planting' AND p.hidden_at IS NULL
        AND (? IS NULL OR p.created_at >= ?)
        AND (SELECT COUNT(*) FROM hidden_map_vouches v
              WHERE v.village_id = p.village_id AND v.pin_id = p.id AND v.withdrawn_at IS NULL
                AND v.voucher_user_id <> p.owner_user_id) >= ?`,
    [villageId, userId, since, since, Math.max(1, perPin)],
  );
  return Number(rows[0]?.n ?? 0);
}

export async function countOwnPins(pool: Pool, villageId: string, userId: string): Promise<number> {
  const [rows] = await pool.query<any[]>(
    "SELECT COUNT(*) AS n FROM hidden_map_pins WHERE village_id = ? AND owner_user_id = ?",
    [villageId, userId],
  );
  return Number(rows[0]?.n ?? 0);
}

/** How many pins the whole map holds, hidden ones aside. A number and nothing about where. */
export async function countAllPins(pool: Pool, villageId: string): Promise<number> {
  const [rows] = await pool.query<any[]>("SELECT COUNT(*) AS n FROM hidden_map_pins WHERE village_id = ? AND hidden_at IS NULL", [villageId]);
  return Number(rows[0]?.n ?? 0);
}

/** How many members have logged a pin that is still theirs. A number, no names. */
export async function countPlanters(pool: Pool, villageId: string): Promise<number> {
  const [rows] = await pool.query<any[]>(
    "SELECT COUNT(DISTINCT owner_user_id) AS n FROM hidden_map_pins WHERE village_id = ? AND owner_user_id IS NOT NULL AND hidden_at IS NULL",
    [villageId],
  );
  return Number(rows[0]?.n ?? 0);
}

/** When this member's map opened, and how many members had opened it before them. */
export async function openingOf(pool: Pool, villageId: string, userId: string): Promise<{ openedAt: string | null; openedBefore: number }> {
  const [rows] = await pool.query<any[]>("SELECT opened_at FROM hidden_map_unlocks WHERE village_id = ? AND user_id = ? LIMIT 1", [villageId, userId]);
  if (!rows.length) return { openedAt: null, openedBefore: 0 };
  const at = rows[0].opened_at;
  const [before] = await pool.query<any[]>(
    "SELECT COUNT(*) AS n FROM hidden_map_unlocks WHERE village_id = ? AND (opened_at < ? OR (opened_at = ? AND user_id < ?))",
    [villageId, at, at, userId],
  );
  return { openedAt: iso(at), openedBefore: Number(before[0]?.n ?? 0) };
}

/** Record the planting quest's claim on a pin, once. False when it already had one. */
export async function setPlantingClaim(pool: Pool, villageId: string, pinId: string, claimId: string): Promise<boolean> {
  const [r]: any = await pool.query(
    "UPDATE hidden_map_pins SET planting_claim_id = ? WHERE village_id = ? AND id = ? AND planting_claim_id IS NULL",
    [claimId, villageId, pinId],
  );
  return Number(r?.affectedRows ?? 0) > 0;
}

/**
 * A member's vouched plantings still owed a claim on the planting quest, oldest
 * first. A member holds one open claim per quest at a time (the quest board's
 * rule), so these open one after another as each claim is decided.
 */
export async function owedPlantings(pool: Pool, villageId: string, ownerId: string, perPin: number, limit = 20): Promise<string[]> {
  if (limit <= 0) return [];
  const [rows] = await pool.query<any[]>(
    `SELECT p.id FROM hidden_map_pins p
      WHERE p.village_id = ? AND p.owner_user_id = ? AND p.layer = 'planting' AND p.hidden_at IS NULL
        AND p.planting_claim_id IS NULL
        AND EXISTS (SELECT 1 FROM hidden_map_photos ph
              WHERE ph.village_id = p.village_id AND ph.pin_id = p.id AND ph.visit_id IS NULL)
        AND (SELECT COUNT(DISTINCT v.voucher_user_id) FROM hidden_map_vouches v
              WHERE v.village_id = p.village_id AND v.pin_id = p.id AND v.withdrawn_at IS NULL
                AND v.voucher_user_id <> p.owner_user_id) >= ?
      ORDER BY p.created_at, p.id LIMIT ?`,
    [villageId, ownerId, Math.max(PAID_PLANTING_MIN_VOUCHES, perPin), limit],
  );
  return rows.map((r) => String(r.id));
}

/**
 * A PAID planting needs a photo of its own and at least this many members
 * vouching, whatever `hiddenmap.vouches_per_pin` says (security audit, 16 Nov
 * 2026). That dial still decides when a map OPENS. With one vouch and no photo,
 * two members could vouch each other's invented pins and each be paid for them.
 */
export const PAID_PLANTING_MIN_VOUCHES = 2;

/**
 * How many of a member's plantings opened a claim in the last seven days, by
 * the database's own clock on both sides, for `hiddenmap.paid_plantings_per_week`.
 */
export async function plantingClaimsThisWeek(pool: Pool, villageId: string, ownerId: string): Promise<number> {
  const [rows] = await pool.query<any[]>(
    `SELECT COUNT(*) AS n FROM hidden_map_pins p JOIN quest_claims c ON c.id = p.planting_claim_id
      WHERE p.village_id = ? AND p.owner_user_id = ? AND c.claimed_at >= (NOW() - INTERVAL 7 DAY)`,
    [villageId, ownerId],
  );
  return Number(rows[0]?.n ?? 0);
}

export async function plantingClaimOf(pool: Pool, villageId: string, pinId: string): Promise<string | null> {
  const [rows] = await pool.query<any[]>("SELECT planting_claim_id FROM hidden_map_pins WHERE village_id = ? AND id = ? LIMIT 1", [villageId, pinId]);
  return rows[0]?.planting_claim_id ?? null;
}

export async function hasOpened(pool: Pool, villageId: string, userId: string): Promise<boolean> {
  const [rows] = await pool.query<any[]>(
    "SELECT 1 FROM hidden_map_unlocks WHERE village_id = ? AND user_id = ? LIMIT 1",
    [villageId, userId],
  );
  return rows.length > 0;
}

/** Record an opening once. Never undone, except by the member's own erasure. */
export async function recordOpening(pool: Pool, villageId: string, userId: string, vouchedCount: number, needed: number, now: Date): Promise<void> {
  await pool.query(
    "INSERT IGNORE INTO hidden_map_unlocks (village_id, user_id, vouched_count, needed, opened_at) VALUES (?, ?, ?, ?, ?)",
    [villageId, userId, vouchedCount, needed, now],
  );
}

/** A vouch, or a vouch withdrawn and given again. One row per member per pin. */
export async function upsertVouch(
  pool: Pool,
  villageId: string,
  pinId: string,
  voucher: string,
  basis: "open" | "keeper",
  now: Date,
  seen: string | null = null,
): Promise<void> {
  await pool.query(
    `INSERT INTO hidden_map_vouches (village_id, pin_id, voucher_user_id, basis, seen, created_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE withdrawn_at = NULL, basis = VALUES(basis), seen = VALUES(seen)`,
    [villageId, pinId, voucher, basis, seen, now],
  );
}

/** How each live vouch on a pin was seen, as counts. No voucher is named. */
export async function vouchWaysOf(pool: Pool, villageId: string, pinId: string): Promise<Record<string, number>> {
  const [rows] = await pool.query<any[]>(
    `SELECT seen, COUNT(*) AS n FROM hidden_map_vouches
      WHERE village_id = ? AND pin_id = ? AND withdrawn_at IS NULL GROUP BY seen`,
    [villageId, pinId],
  );
  const out: Record<string, number> = {};
  for (const r of rows) out[String(r.seen ?? "unsaid")] = Number(r.n);
  return out;
}

export async function withdrawVouch(pool: Pool, villageId: string, pinId: string, voucher: string, now: Date): Promise<boolean> {
  const [r]: any = await pool.query(
    "UPDATE hidden_map_vouches SET withdrawn_at = ? WHERE village_id = ? AND pin_id = ? AND voucher_user_id = ? AND withdrawn_at IS NULL",
    [now, villageId, pinId, voucher],
  );
  return Number(r?.affectedRows ?? 0) > 0;
}

export async function hidePin(pool: Pool, villageId: string, pinId: string, by: string, now: Date): Promise<boolean> {
  const [r]: any = await pool.query(
    "UPDATE hidden_map_pins SET hidden_at = ?, hidden_by = ?, changed_at = ? WHERE village_id = ? AND id = ? AND hidden_at IS NULL",
    [now, by, now, villageId, pinId],
  );
  return Number(r?.affectedRows ?? 0) > 0;
}

export async function setStage(pool: Pool, villageId: string, pinId: string, stage: Stage, now: Date): Promise<void> {
  await pool.query("UPDATE hidden_map_pins SET stage = ?, changed_at = ? WHERE village_id = ? AND id = ?", [stage, now, villageId, pinId]);
}

// ── Photos ────────────────────────────────────────────────────────────────

export interface PhotoRow {
  id: string;
  pinId: string;
  visitId: string | null;
  filename: string;
  thumbFilename: string;
}

export async function countPhotos(pool: Pool, villageId: string, pinId: string): Promise<number> {
  const [rows] = await pool.query<any[]>("SELECT COUNT(*) AS n FROM hidden_map_photos WHERE village_id = ? AND pin_id = ?", [villageId, pinId]);
  return Number(rows[0]?.n ?? 0);
}

export async function insertPhoto(
  pool: Pool,
  villageId: string,
  row: { id: string; pinId: string; visitId: string | null; uploader: string; filename: string; thumbFilename: string; width: number; height: number; bytes: number },
  now: Date,
): Promise<void> {
  await pool.query(
    `INSERT INTO hidden_map_photos (id, village_id, pin_id, visit_id, uploader_user_id, filename, thumb_filename, width, height, bytes, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [row.id, villageId, row.pinId, row.visitId, row.uploader, row.filename, row.thumbFilename, row.width, row.height, row.bytes, now],
  );
}

export async function photoById(pool: Pool, villageId: string, id: string): Promise<PhotoRow | null> {
  const [rows] = await pool.query<any[]>(
    "SELECT id, pin_id, visit_id, filename, thumb_filename FROM hidden_map_photos WHERE village_id = ? AND id = ? LIMIT 1",
    [villageId, id],
  );
  if (!rows.length) return null;
  const r = rows[0];
  return { id: String(r.id), pinId: String(r.pin_id), visitId: r.visit_id ?? null, filename: String(r.filename), thumbFilename: String(r.thumb_filename) };
}

// ── Visits ────────────────────────────────────────────────────────────────

export interface VisitRow {
  id: string;
  pinId: string;
  mine: boolean;
  stageSeen: Stage | null;
  note: string | null;
  createdAt: string;
  photoIds: string[];
}

export async function visitIdByClient(pool: Pool, villageId: string, clientId: string): Promise<{ id: string; pinId: string; visitor: string | null } | null> {
  const [rows] = await pool.query<any[]>(
    "SELECT id, pin_id, visitor_user_id FROM hidden_map_visits WHERE village_id = ? AND client_id = ? LIMIT 1",
    [villageId, clientId],
  );
  return rows.length ? { id: String(rows[0].id), pinId: String(rows[0].pin_id), visitor: rows[0].visitor_user_id ?? null } : null;
}

export async function insertVisit(
  pool: Pool,
  villageId: string,
  row: { id: string; clientId: string; pinId: string; visitor: string; stageSeen: Stage | null; note: string | null },
  now: Date,
): Promise<void> {
  await pool.query(
    `INSERT IGNORE INTO hidden_map_visits (id, village_id, client_id, pin_id, visitor_user_id, stage_seen, note, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [row.id, villageId, row.clientId, row.pinId, row.visitor, row.stageSeen, row.note, now],
  );
}

export async function setVisitClaim(pool: Pool, villageId: string, visitId: string, claimId: string): Promise<void> {
  await pool.query("UPDATE hidden_map_visits SET claim_id = ? WHERE village_id = ? AND id = ?", [claimId, villageId, visitId]);
}

/** When this member last had a visit to this pin open a claim. */
export async function lastPaidVisitAt(pool: Pool, villageId: string, visitor: string, pinId: string): Promise<Date | null> {
  const [rows] = await pool.query<any[]>(
    `SELECT MAX(created_at) AS at FROM hidden_map_visits
      WHERE village_id = ? AND visitor_user_id = ? AND pin_id = ? AND claim_id IS NOT NULL`,
    [villageId, visitor, pinId],
  );
  const at = rows[0]?.at;
  return at ? new Date(at) : null;
}

export async function visitsFor(pool: Pool, villageId: string, pinId: string, viewerId: string): Promise<VisitRow[]> {
  const [rows] = await pool.query<any[]>(
    `SELECT id, pin_id, visitor_user_id, stage_seen, note, created_at FROM hidden_map_visits
      WHERE village_id = ? AND pin_id = ? ORDER BY created_at, id LIMIT 500`,
    [villageId, pinId],
  );
  const [photos] = await pool.query<any[]>(
    "SELECT id, visit_id FROM hidden_map_photos WHERE village_id = ? AND pin_id = ? AND visit_id IS NOT NULL ORDER BY created_at, id",
    [villageId, pinId],
  );
  const byVisit = new Map<string, string[]>();
  for (const p of photos) {
    const list = byVisit.get(String(p.visit_id)) ?? [];
    list.push(String(p.id));
    byVisit.set(String(p.visit_id), list);
  }
  return rows.map((r) => ({
    id: String(r.id),
    pinId: String(r.pin_id),
    mine: r.visitor_user_id !== null && String(r.visitor_user_id) === viewerId,
    stageSeen: (r.stage_seen ?? null) as Stage | null,
    note: r.note ?? null,
    createdAt: iso(r.created_at),
    photoIds: byVisit.get(String(r.id)) ?? [],
  }));
}

/** The stage the latest visit that saw one reported, or null when none did. */
export async function latestStageSeen(pool: Pool, villageId: string, pinId: string): Promise<Stage | null> {
  const [rows] = await pool.query<any[]>(
    `SELECT stage_seen FROM hidden_map_visits WHERE village_id = ? AND pin_id = ? AND stage_seen IS NOT NULL
      ORDER BY created_at DESC, id DESC LIMIT 1`,
    [villageId, pinId],
  );
  return rows.length ? (rows[0].stage_seen as Stage) : null;
}

// ── Exports ───────────────────────────────────────────────────────────────

export interface ExportRow {
  id: string;
  requestedBy: string;
  precision: Precision;
  status: ExportState;
  decidedBy: string | null;
  expiresAt: Date;
  createdAt: string;
}

const toExport = (r: any): ExportRow => ({
  id: String(r.id),
  requestedBy: String(r.requested_by),
  precision: r.shown_precision as Precision,
  status: r.status as ExportState,
  decidedBy: r.decided_by ?? null,
  expiresAt: new Date(r.expires_at),
  createdAt: iso(r.created_at),
});

export async function insertExport(pool: Pool, villageId: string, row: { id: string; requestedBy: string; precision: Precision; expiresAt: Date }, now: Date): Promise<void> {
  await pool.query(
    `INSERT INTO hidden_map_exports (id, village_id, requested_by, shown_precision, status, expires_at, created_at)
     VALUES (?, ?, ?, ?, 'pending', ?, ?)`,
    [row.id, villageId, row.requestedBy, row.precision, row.expiresAt, now],
  );
}

export async function getExport(pool: Pool, villageId: string, id: string): Promise<ExportRow | null> {
  const [rows] = await pool.query<any[]>("SELECT * FROM hidden_map_exports WHERE village_id = ? AND id = ? LIMIT 1", [villageId, id]);
  return rows.length ? toExport(rows[0]) : null;
}

export async function listExports(pool: Pool, villageId: string, limit = 50): Promise<ExportRow[]> {
  const [rows] = await pool.query<any[]>(
    "SELECT * FROM hidden_map_exports WHERE village_id = ? ORDER BY created_at DESC, id DESC LIMIT ?",
    [villageId, limit],
  );
  return rows.map(toExport);
}

/**
 * Move an export from one state to the next, once. Two people pressing at the
 * same moment produce one decision: the second update finds nothing in `from`.
 */
export async function moveExport(
  pool: Pool,
  villageId: string,
  id: string,
  from: ExportState,
  to: ExportState,
  by: string | null,
  now: Date,
  newExpiry?: Date,
): Promise<boolean> {
  const sets = ["status = ?"];
  const params: any[] = [to];
  if (to === "approved" || to === "declined") {
    sets.push("decided_by = ?", "decided_at = ?");
    params.push(by, now);
  }
  if (to === "downloaded") {
    sets.push("downloaded_at = ?");
    params.push(now);
  }
  if (newExpiry) {
    sets.push("expires_at = ?");
    params.push(newExpiry);
  }
  params.push(villageId, id, from);
  const [r]: any = await pool.query(`UPDATE hidden_map_exports SET ${sets.join(", ")} WHERE village_id = ? AND id = ? AND status = ?`, params);
  return Number(r?.affectedRows ?? 0) > 0;
}

export async function expireExports(pool: Pool, villageId: string, now: Date): Promise<number> {
  const [r]: any = await pool.query(
    "UPDATE hidden_map_exports SET status = 'expired' WHERE village_id = ? AND status IN ('pending', 'approved') AND expires_at <= ?",
    [villageId, now],
  );
  return Number(r?.affectedRows ?? 0);
}

// ── The access log ────────────────────────────────────────────────────────

export async function logAccess(
  pool: Pool,
  villageId: string,
  userId: string | null,
  action: AccessAction,
  ref: { pinId?: string | null; exportId?: string | null } = {},
  now: Date = new Date(),
): Promise<void> {
  await pool.query(
    "INSERT INTO hidden_map_access_log (village_id, user_id, action, pin_id, export_id, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    [villageId, userId, action, ref.pinId ?? null, ref.exportId ?? null, now],
  );
}

export interface AccessRow {
  userId: string | null;
  action: AccessAction;
  pinId: string | null;
  exportId: string | null;
  at: string;
}

export async function readAccessLog(pool: Pool, villageId: string, opts: { userId?: string; limit?: number } = {}): Promise<AccessRow[]> {
  const where = ["village_id = ?"];
  const params: any[] = [villageId];
  if (opts.userId) {
    where.push("user_id = ?");
    params.push(opts.userId);
  }
  params.push(Math.max(1, Math.min(1000, opts.limit ?? 200)));
  const [rows] = await pool.query<any[]>(
    `SELECT user_id, action, pin_id, export_id, created_at FROM hidden_map_access_log WHERE ${where.join(" AND ")}
      ORDER BY created_at DESC, id DESC LIMIT ?`,
    params,
  );
  return rows.map((r) => ({
    userId: r.user_id ?? null,
    action: r.action as AccessAction,
    pinId: r.pin_id ?? null,
    exportId: r.export_id ?? null,
    at: iso(r.created_at),
  }));
}

export async function purgeAccessLog(pool: Pool, villageId: string, before: Date): Promise<number> {
  const [r]: any = await pool.query("DELETE FROM hidden_map_access_log WHERE village_id = ? AND created_at < ?", [villageId, before]);
  return Number(r?.affectedRows ?? 0);
}

// ── A member's own data: export and erasure ───────────────────────────────

export async function ownPhotos(pool: Pool, villageId: string, userId: string): Promise<Array<{ id: string; filename: string; thumbFilename: string }>> {
  const [rows] = await pool.query<any[]>(
    "SELECT id, filename, thumb_filename FROM hidden_map_photos WHERE village_id = ? AND uploader_user_id = ?",
    [villageId, userId],
  );
  return rows.map((r) => ({ id: String(r.id), filename: String(r.filename), thumbFilename: String(r.thumb_filename) }));
}

export async function ownVisits(pool: Pool, villageId: string, userId: string): Promise<Array<{ pinId: string; stageSeen: string | null; note: string | null; at: string }>> {
  const [rows] = await pool.query<any[]>(
    "SELECT pin_id, stage_seen, note, created_at FROM hidden_map_visits WHERE village_id = ? AND visitor_user_id = ? ORDER BY created_at",
    [villageId, userId],
  );
  return rows.map((r) => ({ pinId: String(r.pin_id), stageSeen: r.stage_seen ?? null, note: r.note ?? null, at: iso(r.created_at) }));
}

/**
 * Erasure (spec C2 default): the member's photos go, their vouches go, their
 * opening and access rows go, their open exports are withdrawn, and their pins
 * and visits stay on the map with nobody attached. Returns the photo files the
 * caller must delete from the disk.
 */
export async function forgetMember(pool: Pool, villageId: string, userId: string): Promise<Array<{ filename: string; thumbFilename: string }>> {
  const files = await ownPhotos(pool, villageId, userId);
  await pool.query("DELETE FROM hidden_map_photos WHERE village_id = ? AND uploader_user_id = ?", [villageId, userId]);
  await pool.query("DELETE FROM hidden_map_vouches WHERE village_id = ? AND voucher_user_id = ?", [villageId, userId]);
  await pool.query("DELETE FROM hidden_map_unlocks WHERE village_id = ? AND user_id = ?", [villageId, userId]);
  await pool.query("DELETE FROM hidden_map_access_log WHERE village_id = ? AND user_id = ?", [villageId, userId]);
  await pool.query(
    "UPDATE hidden_map_exports SET status = 'withdrawn' WHERE village_id = ? AND requested_by = ? AND status IN ('pending', 'approved')",
    [villageId, userId],
  );
  await pool.query("UPDATE hidden_map_pins SET owner_user_id = NULL WHERE village_id = ? AND owner_user_id = ?", [villageId, userId]);
  await pool.query("UPDATE hidden_map_visits SET visitor_user_id = NULL WHERE village_id = ? AND visitor_user_id = ?", [villageId, userId]);
  return files;
}
