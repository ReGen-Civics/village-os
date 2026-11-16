/**
 * Every statement a task handed to a role needs (shared/roleTaskHandoff.ts).
 *
 * A handoff is a `member_task_role_queue` row (drizzle/0312); its words and
 * steps are `handoff_*` rows in `member_task_events` (drizzle/0310), written
 * under the SENDER's user id so their erasure clears them. No new table.
 */
import { randomUUID } from "node:crypto";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { HANDOFF_EVENT, type HandoffEventKind, type HandoffWords } from "../../shared/roleTaskHandoff";
import type { Queryable } from "./memberTasks";

export interface HandoffRow {
  id: string;
  roleId: string;
  title: string;
  fromUserId: string | null;
  status: "waiting" | "taken" | "dismissed";
  takenByUserId: string | null;
  createdAt: Date;
}

const ROW_COLUMNS = "`id`, `role_id`, `title`, `from_user_id`, `status`, `taken_by_user_id`, `created_at`";

function toRow(r: RowDataPacket): HandoffRow {
  return {
    id: String(r.id),
    roleId: String(r.role_id),
    title: String(r.title ?? ""),
    fromUserId: r.from_user_id == null ? null : String(r.from_user_id),
    status: String(r.status) as HandoffRow["status"],
    takenByUserId: r.taken_by_user_id == null ? null : String(r.taken_by_user_id),
    createdAt: r.created_at instanceof Date ? r.created_at : new Date(String(r.created_at)),
  };
}

/** A new handoff, with its first step. Returns its id. */
export async function insertHandoff(db: Queryable, h: { roleId: string; fromUserId: string; words: HandoffWords; feedbackId?: string | null }): Promise<string> {
  const id = `rq-${randomUUID()}`;
  await db.query(
    "INSERT INTO `member_task_role_queue` (`id`, `role_id`, `title`, `from_user_id`, `feedback_id`) VALUES (?,?,?,?,?)",
    [id, h.roleId, h.words.title, h.fromUserId, h.feedbackId ?? null],
  );
  await recordStep(db, id, h.fromUserId, HANDOFF_EVENT.sent, { note: h.words.note, dueOn: h.words.dueOn }, h.fromUserId);
  return id;
}

export async function handoffById(db: Queryable, id: string): Promise<HandoffRow | null> {
  const [rows] = await db.query<RowDataPacket[]>(`SELECT ${ROW_COLUMNS} FROM \`member_task_role_queue\` WHERE \`id\` = ?`, [id]);
  return rows.length ? toRow(rows[0]) : null;
}

/** Every handoff still waiting, oldest first. */
export async function waitingHandoffs(db: Queryable, limit = 300): Promise<HandoffRow[]> {
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT ${ROW_COLUMNS} FROM \`member_task_role_queue\` WHERE \`status\` = 'waiting' ORDER BY \`created_at\`, \`id\` LIMIT ?`,
    [limit],
  );
  return rows.map(toRow);
}

/** What one member sent: every one still waiting, and the rest from the last 30 days, newest first. */
export async function sentBy(db: Queryable, userId: string, limit = 50): Promise<HandoffRow[]> {
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT ${ROW_COLUMNS} FROM \`member_task_role_queue\` WHERE \`from_user_id\` = ? AND (\`status\` = 'waiting' OR \`created_at\` > NOW() - INTERVAL 30 DAY) ORDER BY \`created_at\` DESC, \`id\` DESC LIMIT ?`,
    [userId, limit],
  );
  return rows.map(toRow);
}

/** Close a waiting handoff, once. False when it was not waiting (somebody answered first). */
export async function closeHandoff(db: Queryable, id: string, status: "taken" | "dismissed", byUserId: string | null): Promise<boolean> {
  const [res] = await db.query<ResultSetHeader>(
    "UPDATE `member_task_role_queue` SET `status` = ?, `taken_by_user_id` = ? WHERE `id` = ? AND `status` = 'waiting'",
    [status, byUserId, id],
  );
  return res.affectedRows === 1;
}

/** A suggested change to a waiting handoff's words. False when it stopped waiting. */
export async function retitleHandoff(db: Queryable, id: string, title: string): Promise<boolean> {
  const [res] = await db.query<ResultSetHeader>(
    "UPDATE `member_task_role_queue` SET `title` = ? WHERE `id` = ? AND `status` = 'waiting'",
    [title, id],
  );
  return res.affectedRows === 1;
}

/** One step, under the sender. Returns its id, for a notice key per step. */
export async function recordStep(
  db: Queryable, handoffId: string, senderId: string, kind: HandoffEventKind, detail: Record<string, unknown> | null, byUserId: string | null,
): Promise<number> {
  const [res] = await db.query<ResultSetHeader>(
    "INSERT INTO `member_task_events` (`task_id`, `user_id`, `kind`, `detail`, `by_user_id`) VALUES (?,?,?,?,?)",
    [handoffId, senderId, kind, detail ? JSON.stringify(detail) : null, byUserId],
  );
  return Number(res.insertId);
}

export interface HandoffStep {
  id: number;
  kind: string;
  detail: Record<string, unknown>;
}

/** Every step of these handoffs, oldest first. */
export async function stepsFor(db: Queryable, ids: readonly string[]): Promise<Map<string, HandoffStep[]>> {
  const out = new Map<string, HandoffStep[]>();
  if (!ids.length) return out;
  const [rows] = await db.query<RowDataPacket[]>(
    "SELECT `id`, `task_id`, `kind`, `detail` FROM `member_task_events` WHERE `task_id` IN (?) AND `kind` IN (?) ORDER BY `id`",
    [ids, Object.values(HANDOFF_EVENT)],
  );
  for (const r of rows) {
    let detail: Record<string, unknown> = {};
    try {
      const parsed = r.detail ? JSON.parse(String(r.detail)) : {};
      detail = parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      detail = {};
    }
    const list = out.get(String(r.task_id)) ?? [];
    list.push({ id: Number(r.id), kind: String(r.kind), detail });
    out.set(String(r.task_id), list);
  }
  return out;
}

/** The copies accepted from these handoffs: handoff id to whether it is done. */
export async function acceptedCopies(db: Queryable, ids: readonly string[]): Promise<Map<string, { userId: string; done: boolean }>> {
  const out = new Map<string, { userId: string; done: boolean }>();
  if (!ids.length) return out;
  const [rows] = await db.query<RowDataPacket[]>(
    "SELECT `external_id`, `user_id`, `status` FROM `member_tasks` WHERE `source` = 'redirect' AND `external_id` IN (?)",
    [ids],
  );
  for (const r of rows) out.set(String(r.external_id), { userId: String(r.user_id), done: String(r.status) === "done" });
  return out;
}

/** Copies of handoffs marked done in the last week, for the sender's notice. */
export async function recentlyDone(db: Queryable): Promise<Array<{ id: string; roleId: string; title: string; fromUserId: string }>> {
  const [rows] = await db.query<RowDataPacket[]>(
    "SELECT q.`id`, q.`role_id`, t.`title`, q.`from_user_id` FROM `member_task_role_queue` q " +
      "JOIN `member_tasks` t ON t.`source` = 'redirect' AND t.`external_id` = q.`id` AND t.`user_id` = q.`taken_by_user_id` " +
      "WHERE q.`status` = 'taken' AND q.`from_user_id` IS NOT NULL AND t.`status` = 'done' AND t.`done_at` > NOW() - INTERVAL 7 DAY LIMIT 500",
  );
  return rows.map((r) => ({ id: String(r.id), roleId: String(r.role_id), title: String(r.title ?? ""), fromUserId: String(r.from_user_id) }));
}

/** The accepted copy's role tag and who asked, so the moon recap counts it under the role. */
export async function tagAcceptedCopy(db: Queryable, taskId: string, userId: string, roleId: string, requestedBy: string | null): Promise<void> {
  await db.query("UPDATE `member_tasks` SET `role_id` = ?, `requested_by` = ? WHERE `id` = ? AND `user_id` = ?", [roleId, requestedBy, taskId, userId]);
}

/** Role names and their circle, with the circle's lead role. */
export async function rolesFor(db: Queryable, roleIds: readonly string[]): Promise<Map<string, { name: string; circle: string | null; leadRoleId: string | null }>> {
  const out = new Map<string, { name: string; circle: string | null; leadRoleId: string | null }>();
  if (!roleIds.length) return out;
  const [rows] = await db.query<RowDataPacket[]>(
    "SELECT r.`id`, r.`name`, c.`name` AS `circle_name`, c.`lead_role_id` FROM `org_roles` r LEFT JOIN `circles` c ON c.`id` = r.`circle_id` WHERE r.`id` IN (?)",
    [roleIds],
  );
  for (const r of rows) {
    out.set(String(r.id), {
      name: String(r.name ?? ""),
      circle: r.circle_name == null ? null : String(r.circle_name),
      leadRoleId: r.lead_role_id == null ? null : String(r.lead_role_id),
    });
  }
  return out;
}

/** First names for these members. */
export async function firstNames(db: Queryable, userIds: readonly string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (!userIds.length) return out;
  const [rows] = await db.query<RowDataPacket[]>("SELECT `id`, `name` FROM `users` WHERE `id` IN (?)", [userIds]);
  for (const r of rows) out.set(String(r.id), String(r.name ?? "").trim().split(/\s+/)[0] ?? "");
  return out;
}
