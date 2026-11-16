/**
 * The protocols module's store (drizzle/0389). Every SQL statement the module
 * runs is here; the rules are in shared/protocols.ts and the routes in
 * server/routes/protocols.ts.
 *
 * Idempotency is by primary key: a run and a tick carry ids the member's phone
 * made, so `INSERT IGNORE` makes a repeat of either a no-op, which is what lets
 * the offline queue send the same request twice safely.
 */
import type { Pool, PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import type { ProtocolDraft, ProtocolStatus, ProtocolStep, ProtocolView, RunStatus, TickEvent } from "../../shared/protocols";

type Db = Pool | PoolConnection;

function iso(v: unknown): string {
  if (v instanceof Date) return v.toISOString();
  const d = new Date(String(v));
  return Number.isFinite(d.getTime()) ? d.toISOString() : new Date(0).toISOString();
}

function steps(raw: unknown): ProtocolStep[] {
  try {
    const v = JSON.parse(String(raw ?? "[]"));
    return Array.isArray(v) ? (v as ProtocolStep[]) : [];
  } catch {
    return [];
  }
}

// ── Protocols ────────────────────────────────────────────────────────────────

export async function listProtocols(pool: Pool, opts: { includeArchived?: boolean } = {}): Promise<ProtocolView[]> {
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT p.`id`, p.`status`, p.`current_version`, p.`updated_at`, v.`title`, v.`summary`, v.`steps`, v.`image_url`, v.`quest_id` " +
      "FROM `protocols` p JOIN `protocol_versions` v ON v.`protocol_id` = p.`id` AND v.`version` = p.`current_version` " +
      (opts.includeArchived ? "" : "WHERE p.`status` = 'active' ") +
      "ORDER BY p.`sort_order`, v.`title`",
  );
  return rows.map((r) => ({
    id: String(r.id),
    title: String(r.title),
    summary: String(r.summary ?? ""),
    image: r.image_url ? String(r.image_url) : "",
    questId: r.quest_id ? String(r.quest_id) : "",
    questTitle: "",
    steps: steps(r.steps),
    version: Number(r.current_version),
    status: (r.status === "archived" ? "archived" : "active") as ProtocolStatus,
    updatedAt: iso(r.updated_at),
  }));
}

export interface VersionRow {
  title: string;
  image: string;
  questId: string;
  steps: ProtocolStep[];
}

export async function getVersion(
  db: Db,
  protocolId: string,
  version: number,
): Promise<VersionRow | null> {
  const [rows] = await db.query<RowDataPacket[]>(
    "SELECT `title`, `steps`, `image_url`, `quest_id` FROM `protocol_versions` WHERE `protocol_id` = ? AND `version` = ?",
    [protocolId, version],
  );
  const r = rows[0];
  return r
    ? { title: String(r.title), image: r.image_url ? String(r.image_url) : "", questId: r.quest_id ? String(r.quest_id) : "", steps: steps(r.steps) }
    : null;
}

export async function protocolStatus(db: Db, protocolId: string): Promise<{ status: ProtocolStatus; version: number } | null> {
  const [rows] = await db.query<RowDataPacket[]>("SELECT `status`, `current_version` FROM `protocols` WHERE `id` = ?", [protocolId]);
  const r = rows[0];
  return r ? { status: r.status === "archived" ? "archived" : "active", version: Number(r.current_version) } : null;
}

/**
 * Save a draft as the protocol's next version. A draft identical to the
 * current version saves nothing, so re-importing the same file is harmless.
 * Returns the version that is now current and whether a new one was written.
 */
export async function saveProtocol(
  pool: Pool,
  draft: ProtocolDraft,
  by: string,
  now: Date,
): Promise<{ version: number; created: boolean; changed: boolean }> {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.query<RowDataPacket[]>(
      "SELECT `current_version` FROM `protocols` WHERE `id` = ? FOR UPDATE",
      [draft.id],
    );
    const body = JSON.stringify(draft.steps);
    if (!rows[0]) {
      const [[{ n }]] = (await conn.query<RowDataPacket[]>("SELECT COUNT(*) AS n FROM `protocols`")) as unknown as [[{ n: number }]];
      await conn.query(
        "INSERT INTO `protocols` (`id`, `title`, `summary`, `current_version`, `status`, `sort_order`, `created_by`, `created_at`, `updated_at`) VALUES (?, ?, ?, 1, 'active', ?, ?, ?, ?)",
        [draft.id, draft.title, draft.summary, Number(n ?? 0), by, now, now],
      );
      await conn.query(
        "INSERT INTO `protocol_versions` (`protocol_id`, `version`, `title`, `summary`, `steps`, `image_url`, `quest_id`, `created_by`, `created_at`) VALUES (?, 1, ?, ?, ?, ?, ?, ?, ?)",
        [draft.id, draft.title, draft.summary, body, draft.image || null, draft.questId || null, by, now],
      );
      await conn.commit();
      return { version: 1, created: true, changed: true };
    }
    const current = Number(rows[0].current_version);
    const [cur] = await conn.query<RowDataPacket[]>(
      "SELECT `title`, `summary`, `steps`, `image_url`, `quest_id` FROM `protocol_versions` WHERE `protocol_id` = ? AND `version` = ?",
      [draft.id, current],
    );
    const same =
      cur[0] &&
      String(cur[0].title) === draft.title &&
      String(cur[0].summary ?? "") === draft.summary &&
      String(cur[0].steps) === body &&
      String(cur[0].image_url ?? "") === draft.image &&
      String(cur[0].quest_id ?? "") === draft.questId;
    if (same) {
      await conn.commit();
      return { version: current, created: false, changed: false };
    }
    const next = current + 1;
    await conn.query(
      "INSERT INTO `protocol_versions` (`protocol_id`, `version`, `title`, `summary`, `steps`, `image_url`, `quest_id`, `created_by`, `created_at`) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [draft.id, next, draft.title, draft.summary, body, draft.image || null, draft.questId || null, by, now],
    );
    await conn.query(
      "UPDATE `protocols` SET `title` = ?, `summary` = ?, `current_version` = ?, `updated_at` = ? WHERE `id` = ?",
      [draft.title, draft.summary, next, now, draft.id],
    );
    await conn.commit();
    return { version: next, created: false, changed: true };
  } catch (err) {
    await conn.rollback().catch(() => {});
    throw err;
  } finally {
    conn.release();
  }
}

export async function setProtocolStatus(pool: Pool, id: string, status: ProtocolStatus, now: Date): Promise<boolean> {
  const [res] = await pool.query<ResultSetHeader>(
    "UPDATE `protocols` SET `status` = ?, `updated_at` = ? WHERE `id` = ?",
    [status, now, id],
  );
  return Number(res.affectedRows ?? 0) > 0;
}

// ── Runs ─────────────────────────────────────────────────────────────────────

export interface RunRow {
  id: string;
  protocolId: string;
  version: number;
  startedBy: string;
  startedAt: string;
  status: RunStatus;
  endedAt: string | null;
  endedBy: string | null;
  questClaimId: string | null;
}

function toRun(r: RowDataPacket): RunRow {
  const status = r.status === "complete" ? "complete" : r.status === "set-aside" ? "set-aside" : "open";
  return {
    id: String(r.id),
    protocolId: String(r.protocol_id),
    version: Number(r.version),
    startedBy: String(r.started_by),
    startedAt: iso(r.started_at),
    status,
    endedAt: r.ended_at ? iso(r.ended_at) : null,
    endedBy: r.ended_by ? String(r.ended_by) : null,
    questClaimId: r.quest_claim_id ? String(r.quest_claim_id) : null,
  };
}

const RUN_COLS = "`id`, `protocol_id`, `version`, `started_by`, `started_at`, `status`, `ended_at`, `ended_by`, `quest_claim_id`";

/** Start a run. A repeat of the same id is a no-op; returns whether this call made it. */
export async function insertRun(
  pool: Pool,
  run: { id: string; protocolId: string; version: number; startedBy: string; startedAt: Date },
  now: Date,
): Promise<boolean> {
  const [res] = await pool.query<ResultSetHeader>(
    "INSERT IGNORE INTO `protocol_runs` (`id`, `protocol_id`, `version`, `started_by`, `started_at`, `received_at`, `status`) VALUES (?, ?, ?, ?, ?, ?, 'open')",
    [run.id, run.protocolId, run.version, run.startedBy, run.startedAt, now],
  );
  return Number(res.affectedRows ?? 0) > 0;
}

export async function getRun(db: Db, id: string): Promise<RunRow | null> {
  const [rows] = await db.query<RowDataPacket[]>(`SELECT ${RUN_COLS} FROM \`protocol_runs\` WHERE \`id\` = ?`, [id]);
  return rows[0] ? toRun(rows[0]) : null;
}

/** Open runs, and the most recent ended ones, newest first. */
export async function listRuns(pool: Pool, opts: { recentLimit: number }): Promise<RunRow[]> {
  const [open] = await pool.query<RowDataPacket[]>(
    `SELECT ${RUN_COLS} FROM \`protocol_runs\` WHERE \`status\` = 'open' ORDER BY \`started_at\` DESC LIMIT 100`,
  );
  const [ended] = await pool.query<RowDataPacket[]>(
    `SELECT ${RUN_COLS} FROM \`protocol_runs\` WHERE \`status\` <> 'open' ORDER BY \`ended_at\` DESC LIMIT ?`,
    [opts.recentLimit],
  );
  return [...open, ...ended].map(toRun);
}

/** End an open run. Ending one already ended changes nothing; returns whether this call ended it. */
export async function endRun(pool: Pool, id: string, status: Exclude<RunStatus, "open">, by: string, at: Date): Promise<boolean> {
  const [res] = await pool.query<ResultSetHeader>(
    "UPDATE `protocol_runs` SET `status` = ?, `ended_at` = ?, `ended_by` = ? WHERE `id` = ? AND `status` = 'open'",
    [status, at, by, id],
  );
  return Number(res.affectedRows ?? 0) > 0;
}

/** Record the claim completing a run opened. Once: a run that already names one keeps it. */
export async function setRunQuestClaim(pool: Pool, runId: string, claimId: string): Promise<boolean> {
  const [res] = await pool.query<ResultSetHeader>(
    "UPDATE `protocol_runs` SET `quest_claim_id` = ? WHERE `id` = ? AND `quest_claim_id` IS NULL",
    [claimId, runId],
  );
  return Number(res.affectedRows ?? 0) > 0;
}

// ── Ticks ────────────────────────────────────────────────────────────────────

export async function insertTick(
  pool: Pool,
  t: { id: string; runId: string; stepId: string; done: boolean; by: string; at: Date },
  now: Date,
): Promise<boolean> {
  const [res] = await pool.query<ResultSetHeader>(
    "INSERT IGNORE INTO `protocol_run_ticks` (`id`, `run_id`, `step_id`, `done`, `ticked_by`, `ticked_at`, `received_at`) VALUES (?, ?, ?, ?, ?, ?, ?)",
    [t.id, t.runId, t.stepId, t.done ? 1 : 0, t.by, t.at, now],
  );
  return Number(res.affectedRows ?? 0) > 0;
}

/** A tick already recorded under this id, to tell a repeat from a clash. */
export async function getTick(pool: Pool, id: string): Promise<{ runId: string; by: string } | null> {
  const [rows] = await pool.query<RowDataPacket[]>("SELECT `run_id`, `ticked_by` FROM `protocol_run_ticks` WHERE `id` = ?", [id]);
  return rows[0] ? { runId: String(rows[0].run_id), by: String(rows[0].ticked_by) } : null;
}

/** Every tick on these runs, oldest first. `byName` is filled by `memberNames`. */
export async function ticksFor(pool: Pool, runIds: readonly string[]): Promise<Map<string, TickEvent[]>> {
  const out = new Map<string, TickEvent[]>();
  if (runIds.length === 0) return out;
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT `id`, `run_id`, `step_id`, `done`, `ticked_by`, `ticked_at` FROM `protocol_run_ticks` WHERE `run_id` IN (?) ORDER BY `ticked_at`, `id`",
    [runIds],
  );
  for (const r of rows) {
    const runId = String(r.run_id);
    const list = out.get(runId) ?? [];
    list.push({ clientId: String(r.id), stepId: String(r.step_id), done: !!r.done, by: String(r.ticked_by), byName: "", at: iso(r.ticked_at) });
    out.set(runId, list);
  }
  return out;
}

/** Display names for member ids. */
export async function memberNames(pool: Pool, ids: readonly string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const unique = Array.from(new Set(ids)).filter(Boolean);
  if (unique.length === 0) return out;
  const [rows] = await pool.query<RowDataPacket[]>("SELECT `id`, `name` FROM `users` WHERE `id` IN (?)", [unique]);
  for (const r of rows) out.set(String(r.id), String(r.name ?? ""));
  return out;
}
