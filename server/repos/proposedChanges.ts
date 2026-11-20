/**
 * The proposed-changes store (0379): batches and the changes in them.
 *
 *   proposed_change_batches   a titled group reviewed together
 *   proposed_changes          one change: what was proposed, the person's draft, what was accepted, and the lesson
 *
 * Nothing here moves anything live. The routes in server/routes/proposedChanges.ts
 * accept a change through its own route and then record the outcome here.
 * Erased with the member (`forgetAgentForMember`, server/repos/memberAgent.ts).
 */
import { randomBytes } from "node:crypto";
import type { Pool, RowDataPacket } from "mysql2/promise";
import { batchCodeOf, changeCodeOf, type ProposalKind, type ProposalStatus } from "../../shared/proposedChanges";
import type { KeptBefore } from "../../shared/proposalPutBack";

export interface StoredBatch {
  id: string;
  /** The short code, B-27 (0416); null on a batch filed before the code existed and not yet numbered. */
  code: string | null;
  title: string;
  proposedBy: string;
  proposedByKind: "agent" | "person";
  createdAt: string;
}

export interface StoredChange {
  id: string;
  /** The short code, B-27.2 (0416): its batch's code and its place in the batch. */
  code: string | null;
  batchId: string;
  position: number;
  kind: ProposalKind;
  target: Record<string, unknown>;
  targetLabel: string;
  routeMethod: string;
  routePath: string;
  summary: string;
  body: Record<string, unknown>;
  draft: Record<string, unknown> | null;
  draftBy: string | null;
  draftAt: string | null;
  status: ProposalStatus;
  proposedBy: string;
  proposedByKind: "agent" | "person";
  createdAt: string;
  decidedBy: string | null;
  decidedAt: string | null;
  accepted: Record<string, unknown> | null;
  lessons: unknown[] | null;
  approvedBy: string | null;
  approvalNote: string | null;
  error: string | null;
  /** What was live just before the accept (0400), or null when nothing was kept. */
  before: KeptBefore;
  /** On a proposal that puts an earlier change back, that change's id (0400). */
  reverts: string | null;
}

const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : v === null || v === undefined ? null : String(v));
const json = <T>(v: unknown, fallback: T): T => {
  if (v === null || v === undefined) return fallback;
  try {
    return JSON.parse(String(v)) as T;
  } catch {
    return fallback;
  }
};

function toChange(r: RowDataPacket): StoredChange {
  return {
    id: String(r.id),
    code: r.code === null || r.code === undefined ? null : String(r.code),
    batchId: String(r.batch_id),
    position: Number(r.position ?? 0),
    kind: String(r.kind) as ProposalKind,
    target: json(r.target_json, {}),
    targetLabel: String(r.target_label ?? ""),
    routeMethod: String(r.route_method),
    routePath: String(r.route_path),
    summary: String(r.summary ?? ""),
    body: json(r.body_json, {}),
    draft: json(r.draft_json, null),
    draftBy: r.draft_by === null ? null : String(r.draft_by),
    draftAt: iso(r.draft_at),
    // A row a stopped server left `applying` reads as `unknown` (listOpen only returns those once ten minutes old).
    status: (String(r.status) === "applying" ? "unknown" : String(r.status)) as ProposalStatus,
    proposedBy: String(r.proposed_by),
    proposedByKind: r.proposed_by_kind === "person" ? "person" : "agent",
    createdAt: iso(r.created_at) ?? "",
    decidedBy: r.decided_by === null ? null : String(r.decided_by),
    decidedAt: iso(r.decided_at),
    accepted: json(r.accepted_json, null),
    lessons: json(r.lessons_json, null),
    approvedBy: r.approved_by === null ? null : String(r.approved_by),
    approvalNote: r.approval_note === null ? null : String(r.approval_note),
    error: r.error_text === null ? null : String(r.error_text),
    // SQL NULL is "never kept"; the JSON text null is "read, and nothing could be read then". A row the parser cannot read is never kept.
    before: keptBefore(r.before_json),
    reverts: r.reverts_id === null || r.reverts_id === undefined ? null : String(r.reverts_id),
  };
}

function keptBefore(v: unknown): KeptBefore {
  if (v === null || v === undefined) return null;
  try {
    return { value: JSON.parse(String(v)) };
  } catch {
    return null;
  }
}

function toBatch(r: RowDataPacket): StoredBatch {
  return {
    id: String(r.id),
    code: r.code === null || r.code === undefined ? null : String(r.code),
    title: String(r.title),
    proposedBy: String(r.proposed_by),
    proposedByKind: r.proposed_by_kind === "person" ? "person" : "agent",
    createdAt: iso(r.created_at) ?? "",
  };
}

const newId = (prefix: string) => `${prefix}_${randomBytes(9).toString("hex")}`;

export async function batchById(pool: Pool, id: string): Promise<StoredBatch | null> {
  const [rows] = await pool.query<RowDataPacket[]>("SELECT * FROM `proposed_change_batches` WHERE `id` = ?", [id]);
  return rows[0] ? toBatch(rows[0]) : null;
}

/** One writer at a time takes the next batch number, so two filings never share a code. */
const CODE_LOCK = "village_proposal_codes";

async function withCodeLock<T>(pool: Pool, run: () => Promise<T>): Promise<T> {
  const conn = await pool.getConnection();
  try {
    const [got] = await conn.query<RowDataPacket[]>("SELECT GET_LOCK(?, 10) AS ok", [CODE_LOCK]);
    if (Number(got[0]?.ok ?? 0) !== 1) throw new Error("The proposal codes are being numbered by another request. Try again.");
    try {
      return await run();
    } finally {
      await conn.query("SELECT RELEASE_LOCK(?)", [CODE_LOCK]).catch(() => undefined);
    }
  } finally {
    conn.release();
  }
}

async function nextBatchNo(pool: Pool): Promise<number> {
  const [rows] = await pool.query<RowDataPacket[]>("SELECT COALESCE(MAX(`code_no`), 0) + 1 AS n FROM `proposed_change_batches`");
  return Number(rows[0]?.n ?? 1);
}

/**
 * THE BACKFILL (0416): number every batch that has no code, in filing order (created_at, then id), and give every
 * change its batch's code and its place. Idempotent by its WHERE: a row that has a code is never touched, so a second
 * call, or two at once, changes nothing. Batches filed by the previous release during a rolling deploy come out the
 * same way on the next call. Cheap when there is nothing to do: two counts on tables of a few hundred rows.
 */
export async function ensureCodes(pool: Pool): Promise<void> {
  const [lone] = await pool.query<RowDataPacket[]>(
    "SELECT (SELECT COUNT(*) FROM `proposed_change_batches` WHERE `code_no` IS NULL) AS b, (SELECT COUNT(*) FROM `proposed_changes` c JOIN `proposed_change_batches` b ON b.`id` = c.`batch_id` WHERE c.`code` IS NULL AND b.`code` IS NOT NULL) AS c",
  );
  if (Number(lone[0]?.b ?? 0) === 0 && Number(lone[0]?.c ?? 0) === 0) return;
  await withCodeLock(pool, async () => {
    const [todo] = await pool.query<RowDataPacket[]>("SELECT `id` FROM `proposed_change_batches` WHERE `code_no` IS NULL ORDER BY `created_at`, `id`");
    let n = todo.length ? await nextBatchNo(pool) : 0;
    for (const r of todo) {
      await pool.query("UPDATE `proposed_change_batches` SET `code_no` = ?, `code` = ? WHERE `id` = ? AND `code_no` IS NULL", [n, batchCodeOf(n), String(r.id)]);
      n++;
    }
    await pool.query(
      "UPDATE `proposed_changes` c JOIN `proposed_change_batches` b ON b.`id` = c.`batch_id` SET c.`code` = CONCAT(b.`code`, '.', c.`position` + 1) WHERE c.`code` IS NULL AND b.`code` IS NOT NULL",
    );
  });
}

export async function addBatch(pool: Pool, b: { title: string; proposedBy: string; proposedByKind: "agent" | "person" }): Promise<string> {
  await ensureCodes(pool);
  const id = newId("pcb");
  await withCodeLock(pool, async () => {
    const n = await nextBatchNo(pool);
    await pool.query("INSERT INTO `proposed_change_batches` (`id`, `title`, `proposed_by`, `proposed_by_kind`, `code_no`, `code`) VALUES (?,?,?,?,?,?)", [id, b.title.slice(0, 200), b.proposedBy, b.proposedByKind, n, batchCodeOf(n)]);
  });
  return id;
}

export async function nextPosition(pool: Pool, batchId: string): Promise<number> {
  const [rows] = await pool.query<RowDataPacket[]>("SELECT COALESCE(MAX(`position`), -1) + 1 AS n FROM `proposed_changes` WHERE `batch_id` = ?", [batchId]);
  return Number(rows[0]?.n ?? 0);
}

export async function addChange(
  pool: Pool,
  c: { batchId: string; position: number; kind: ProposalKind; target: Record<string, unknown>; targetLabel: string; routeMethod: string; routePath: string; summary: string; body: Record<string, unknown>; proposedBy: string; proposedByKind: "agent" | "person"; reverts?: string | null },
): Promise<string> {
  const id = newId("pc");
  const batch = await batchById(pool, c.batchId);
  const code = batch?.code ? changeCodeOf(batch.code, c.position) : null;
  await pool.query(
    "INSERT INTO `proposed_changes` (`code`, `id`, `batch_id`, `position`, `kind`, `target_json`, `target_label`, `route_method`, `route_path`, `summary`, `body_json`, `proposed_by`, `proposed_by_kind`, `reverts_id`) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
    [code, id, c.batchId, c.position, c.kind, JSON.stringify(c.target), c.targetLabel.slice(0, 200), c.routeMethod, c.routePath.slice(0, 400), c.summary.slice(0, 400), JSON.stringify(c.body), c.proposedBy, c.proposedByKind, c.reverts ?? null],
  );
  return id;
}

export async function changeById(pool: Pool, id: string): Promise<StoredChange | null> {
  const [rows] = await pool.query<RowDataPacket[]>("SELECT * FROM `proposed_changes` WHERE `id` = ?", [id]);
  return rows[0] ? toChange(rows[0]) : null;
}

/** What waits (proposed or failed), oldest batch first, in each batch's own order. */
export async function listOpen(pool: Pool): Promise<{ batches: StoredBatch[]; changes: StoredChange[] }> {
  const [rows] = await pool.query<RowDataPacket[]>(
    // An `unknown` change, and one left `applying` by a server that stopped, wait too: a person checks its page first.
    "SELECT * FROM `proposed_changes` WHERE `status` IN ('proposed','failed','unknown') OR (`status` = 'applying' AND `decided_at` < CURRENT_TIMESTAMP(3) - INTERVAL 10 MINUTE) ORDER BY `created_at`, `batch_id`, `position` LIMIT 500",
  );
  const changes = rows.map(toChange);
  const ids = Array.from(new Set(changes.map((c) => c.batchId)));
  if (!ids.length) return { batches: [], changes };
  const [b] = await pool.query<RowDataPacket[]>(`SELECT * FROM \`proposed_change_batches\` WHERE \`id\` IN (${ids.map(() => "?").join(",")}) ORDER BY \`created_at\``, ids);
  return {
    batches: b.map(toBatch),
    changes,
  };
}

/** How many wait, for the count on Admin. */
export async function openCount(pool: Pool): Promise<number> {
  const [rows] = await pool.query<RowDataPacket[]>("SELECT COUNT(*) AS n FROM `proposed_changes` WHERE `status` IN ('proposed','failed','unknown') OR (`status` = 'applying' AND `decided_at` < CURRENT_TIMESTAMP(3) - INTERVAL 10 MINUTE)");
  return Number(rows[0]?.n ?? 0);
}

/** Recently decided, newest first, for the page's record and for the lessons. */
export async function listDecided(pool: Pool, limit: number, onlyAccepted = false): Promise<StoredChange[]> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT * FROM \`proposed_changes\` WHERE \`status\` IN (${onlyAccepted ? "'accepted'" : "'accepted','discarded'"}) AND \`decided_at\` IS NOT NULL ORDER BY \`decided_at\` DESC LIMIT ?`,
    [Math.max(1, Math.min(500, limit))],
  );
  return rows.map(toChange);
}

/**
 * Accepted changes decided after `since`, oldest accept first: what may have moved under a change proposed then
 * (shared/proposalConflicts.ts, `staleAgainst`). Capped, as the page's history is.
 */
export async function acceptedSince(pool: Pool, since: Date, limit = 500): Promise<StoredChange[]> {
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT * FROM `proposed_changes` WHERE `status` = 'accepted' AND `decided_at` > ? ORDER BY `decided_at` LIMIT ?",
    [since, Math.max(1, Math.min(1000, limit))],
  );
  return rows.map(toChange);
}

export async function saveDraft(pool: Pool, id: string, draft: Record<string, unknown> | null, by: string): Promise<boolean> {
  const [r] = await pool.query<any>(
    "UPDATE `proposed_changes` SET `draft_json` = ?, `draft_by` = ?, `draft_at` = CURRENT_TIMESTAMP(3) WHERE `id` = ? AND `status` IN ('proposed','failed')",
    [draft === null ? null : JSON.stringify(draft), by, id],
  );
  return Number(r?.affectedRows ?? 0) > 0;
}

/**
 * Take one change for applying, atomically (audit, 15 Nov 2026): two accepts racing for the same row used to both
 * read it as proposed and both apply it. Only the caller whose UPDATE changed the row goes on.
 *
 * A change whose apply threw (`unknown`), or one left `applying` by a server that stopped, may have reached its page
 * before the answer was lost: a loopback that timed out AFTER its route committed. Applying it again could make the
 * thing twice, so it is taken only when the person says they checked the page (`checked`).
 */
export async function claimForApplying(pool: Pool, id: string, by: string, checked = false): Promise<boolean> {
  const [r] = await pool.query<any>(
    "UPDATE `proposed_changes` SET `status` = 'applying', `decided_by` = ?, `decided_at` = CURRENT_TIMESTAMP(3) WHERE `id` = ? AND (`status` IN ('proposed','failed')" +
      (checked ? " OR `status` = 'unknown' OR (`status` = 'applying' AND `decided_at` < CURRENT_TIMESTAMP(3) - INTERVAL 10 MINUTE)" : "") +
      ")",
    [by, id],
  );
  return Number(r?.affectedRows ?? 0) === 1;
}

/** Whether this change waits on a person checking its page first: its apply threw, or a server stopped mid-apply. */
export function needsACheck(c: Pick<StoredChange, "status">): boolean {
  return c.status === "unknown";
}

/** The apply threw: whether the change reached its page is not known. Never retried by a plain accept. */
export async function markUnknown(pool: Pool, id: string, by: string, error: string): Promise<void> {
  await pool.query(
    "UPDATE `proposed_changes` SET `status` = 'unknown', `decided_by` = ?, `decided_at` = CURRENT_TIMESTAMP(3), `error_text` = ? WHERE `id` = ? AND `status` = 'applying'",
    [by, error.slice(0, 1000), id],
  );
}

/** The largest value kept as "what was live before". A larger one is not kept, and the page says nothing was kept. */
export const BEFORE_MAX_BYTES = 1_000_000;

/**
 * Keep what was live just before this change is applied (0400), on the row that is being applied. Never throws:
 * a value too large to keep, or a write that fails, leaves the column as it was and the accept goes on.
 */
export async function saveBefore(pool: Pool, id: string, before: unknown): Promise<boolean> {
  try {
    const text = JSON.stringify(before === undefined ? null : before);
    if (text.length > BEFORE_MAX_BYTES) return false;
    const [r] = await pool.query<any>("UPDATE `proposed_changes` SET `before_json` = ? WHERE `id` = ? AND `status` = 'applying'", [text, id]);
    return Number(r?.affectedRows ?? 0) > 0;
  } catch {
    return false;
  }
}

/** A proposal that puts this change back and still waits, if there is one. */
export async function waitingPutBack(pool: Pool, revertsId: string): Promise<string | null> {
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT `id` FROM `proposed_changes` WHERE `reverts_id` = ? AND (`status` IN ('proposed','failed','unknown','applying')) LIMIT 1",
    [revertsId],
  );
  return rows[0] ? String(rows[0].id) : null;
}

export async function markAccepted(pool: Pool, id: string, a: { by: string; accepted: Record<string, unknown>; lessons: unknown[]; approvedBy: string; approvalNote: string }): Promise<boolean> {
  const [r] = await pool.query<any>(
    "UPDATE `proposed_changes` SET `status` = 'accepted', `decided_by` = ?, `decided_at` = CURRENT_TIMESTAMP(3), `accepted_json` = ?, `lessons_json` = ?, `approved_by` = ?, `approval_note` = ?, `error_text` = NULL WHERE `id` = ? AND `status` IN ('proposed','failed','applying')",
    [a.by, JSON.stringify(a.accepted), JSON.stringify(a.lessons), a.approvedBy.slice(0, 120), a.approvalNote.slice(0, 400), id],
  );
  return Number(r?.affectedRows ?? 0) > 0;
}

export async function markFailed(pool: Pool, id: string, by: string, error: string): Promise<void> {
  await pool.query(
    "UPDATE `proposed_changes` SET `status` = 'failed', `decided_by` = ?, `decided_at` = CURRENT_TIMESTAMP(3), `error_text` = ? WHERE `id` = ? AND `status` IN ('proposed','failed','applying')",
    [by, error.slice(0, 1000), id],
  );
}

export async function markDiscarded(pool: Pool, id: string, by: string): Promise<boolean> {
  const [r] = await pool.query<any>(
    "UPDATE `proposed_changes` SET `status` = 'discarded', `decided_by` = ?, `decided_at` = CURRENT_TIMESTAMP(3) WHERE `id` = ? AND (`status` IN ('proposed','failed','unknown') OR (`status` = 'applying' AND `decided_at` < CURRENT_TIMESTAMP(3) - INTERVAL 10 MINUTE))",
    [by, id],
  );
  return Number(r?.affectedRows ?? 0) > 0;
}

/**
 * An agent puts aside a change IT filed (the lead, 19 Nov 2026): only one filed through the connector or by an agent
 * account (`proposed_by_kind` 'agent') by this same account, and only while it waits or failed. One whose outcome is
 * unknown may have landed, so a person checks its page; one being applied, or decided, is not the agent's to touch.
 */
export async function markDiscardedByFiler(pool: Pool, id: string, by: string): Promise<boolean> {
  const [r] = await pool.query<any>(
    "UPDATE `proposed_changes` SET `status` = 'discarded', `decided_by` = ?, `decided_at` = CURRENT_TIMESTAMP(3) WHERE `id` = ? AND `proposed_by` = ? AND `proposed_by_kind` = 'agent' AND `status` IN ('proposed','failed')",
    [by, id, by],
  );
  return Number(r?.affectedRows ?? 0) > 0;
}

/** Member erasure: what they proposed goes; their name comes off what they decided. */
export async function forgetProposedChanges(pool: Pool, userId: string): Promise<void> {
  await pool.query("DELETE FROM `proposed_changes` WHERE `proposed_by` = ?", [userId]);
  await pool.query("DELETE FROM `proposed_change_batches` WHERE `proposed_by` = ?", [userId]);
  await pool.query("UPDATE `proposed_changes` SET `decided_by` = NULL, `approved_by` = NULL WHERE `decided_by` = ?", [userId]);
  await pool.query("UPDATE `proposed_changes` SET `draft_by` = NULL WHERE `draft_by` = ?", [userId]);
}
