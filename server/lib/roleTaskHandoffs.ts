/**
 * HAND A TASK TO A ROLE: the rules. The contract and every sentence is
 * shared/roleTaskHandoff.ts; the statements are server/repos/roleTaskHandoffs.ts;
 * the doors are server/routes/roleTaskHandoffs.ts.
 *
 *   sendToRole        a member sends a task; whoever it waits on hears once
 *   respondToHandoff  a holder accepts it, suggests a change, or declines it
 *   withdrawHandoff   the sender takes it back while it waits
 *   waitingFor        what waits on one reader, for Waiting on you
 *   sentFrom          what one member sent, with its status, for their profile
 *   noticeDone        the sender hears when the accepted copy is marked done
 *   afterStewardClose the admin panel's role queue closed one: the sender hears
 *
 * WHO IT WAITS ON is worked out on every read (`audienceOf`): the role's live
 * holders, else the live holders of its circle's lead role, else the
 * stewards. The sender is never one of them, so nobody accepts their own.
 *
 * ONE HOLDER ACCEPTING TAKES IT FOR THE ROLE. The close is one guarded UPDATE
 * (`status = 'waiting'` in its WHERE), so of two holders pressing at once the
 * second is told someone answered first, and only one copy is ever made.
 *
 * Nothing here accepts on its own. A job only tells the sender a copy was
 * marked done; it never moves a handoff.
 */
import type { Pool } from "mysql2/promise";
import {
  HANDOFF_EVENT,
  HANDOFF_NOTICES,
  HANDOFF_REFUSALS,
  handoffDedupeKey,
  parseHandoffResponse,
  sentStatusOf,
  type HandoffNoticeEvent,
  type HandoffVia,
  type HandoffWords,
  type SentHandoff,
  type SentStatus,
  type WaitingHandoff,
} from "../../shared/roleTaskHandoff";
import { TASK_BOARD_PATH } from "../../shared/sessionTasks";
import { civilDateKey } from "../../shared/lunar";
import { liveHoldings } from "../repos/roleTensions";
import { insertTask } from "../repos/memberTasks";
import * as store from "../repos/roleTaskHandoffs";
import type { HandoffRow, HandoffStep } from "../repos/roleTaskHandoffs";
import type { NotifyInput } from "./notify";

/**
 * The notification type of each notice, written out here so the catalogue's
 * scanner (shared/notificationKinds.test.ts) finds every one this file sends.
 */
const NOTICE_TYPE: Record<HandoffNoticeEvent, string> = {
  handed: "role_task_handed",
  accepted: "role_task_accepted",
  edited: "role_task_edited",
  declined: "role_task_declined",
  done: "role_task_done",
};

export type Outcome<T> = { ok: true; value: T } | { ok: false; status: number; error: string };
const refuse = (status: number, error: string): { ok: false; status: number; error: string } => ({ ok: false, status, error });

export interface HandoffDeps {
  notify(input: NotifyInput): Promise<unknown>;
  /** The village's day, YYYY-MM-DD. */
  today(): string;
  /** The village's IANA zone. */
  timeZone(): string;
}

export interface HandoffViewer {
  userId: string;
  isAdmin: boolean;
}

export interface Audience {
  via: HandoffVia;
  /** Empty for `steward`: any admin may answer. */
  userIds: string[];
}

type Roles = Map<string, { name: string; circle: string | null; leadRoleId: string | null }>;

/** Who each of these handoffs waits on now, and the roles they name. */
async function audiences(pool: Pool, rows: readonly Pick<HandoffRow, "id" | "roleId" | "fromUserId">[]): Promise<{ byId: Map<string, Audience>; roles: Roles }> {
  const roleIds = Array.from(new Set(rows.map((r) => r.roleId)));
  const roles = await store.rolesFor(pool, roleIds);
  const leadIds = Array.from(new Set(roleIds.map((r) => roles.get(r)?.leadRoleId).filter((x): x is string => !!x)));
  const holders = new Map<string, string[]>();
  for (const h of await liveHoldings(pool, { roleIds: Array.from(new Set([...roleIds, ...leadIds])) })) {
    const list = holders.get(h.roleId) ?? [];
    if (!list.includes(h.userId)) list.push(h.userId);
    holders.set(h.roleId, list);
  }
  const byId = new Map<string, Audience>();
  for (const r of rows) {
    const others = (roleId: string) => (holders.get(roleId) ?? []).filter((u) => u !== r.fromUserId);
    const own = others(r.roleId);
    const lead = roles.get(r.roleId)?.leadRoleId ?? null;
    const leads = lead && lead !== r.roleId ? others(lead) : [];
    byId.set(r.id, own.length ? { via: "holder", userIds: own } : leads.length ? { via: "lead", userIds: leads } : { via: "steward", userIds: [] });
  }
  return { byId, roles };
}

/** Who one handoff waits on now. */
export async function audienceOf(pool: Pool, row: Pick<HandoffRow, "id" | "roleId" | "fromUserId">): Promise<Audience> {
  return (await audiences(pool, [row])).byId.get(row.id) ?? { via: "steward", userIds: [] };
}

/** The one rule every answer asks: never the sender, and only someone it waits on. */
export function mayAnswer(viewer: HandoffViewer, sender: string | null, a: Audience): boolean {
  if (sender !== null && viewer.userId === sender) return false;
  return a.via === "steward" ? viewer.isAdmin : a.userIds.includes(viewer.userId);
}

/** The words as they stand: the title on the row, the note and day from the latest sent or edit step. */
function wordsOf(row: HandoffRow, steps: readonly HandoffStep[]): HandoffWords & { edited: boolean } {
  let note: string | null = null;
  let dueOn: string | null = null;
  let edited = false;
  for (const s of steps) {
    if (s.kind !== HANDOFF_EVENT.sent && s.kind !== HANDOFF_EVENT.edit) continue;
    note = typeof s.detail.note === "string" ? s.detail.note : null;
    dueOn = typeof s.detail.dueOn === "string" ? s.detail.dueOn : null;
    if (s.kind === HANDOFF_EVENT.edit) edited = true;
  }
  return { title: row.title, note, dueOn, edited };
}

const dayOf = (d: Date, tz: string): string => civilDateKey(d, tz || "UTC");

// ── Send ────────────────────────────────────────────────────────────────────

/**
 * A member sends a task to a role. The caller has checked the role is live,
 * the words parse and the rate. Everyone it waits on hears once; when it falls
 * to the stewards, the admin panel's role queue is where they see it.
 */
export async function sendToRole(
  pool: Pool, deps: HandoffDeps, s: { senderId: string; roleId: string; words: HandoffWords; feedbackId?: string | null },
): Promise<string> {
  const id = await store.insertHandoff(pool, { roleId: s.roleId, fromUserId: s.senderId, words: s.words, feedbackId: s.feedbackId ?? null });
  const { byId, roles } = await audiences(pool, [{ id, roleId: s.roleId, fromUserId: s.senderId }]);
  const role = roles.get(s.roleId)?.name || s.roleId;
  for (const userId of byId.get(id)?.userIds ?? []) {
    await deps.notify({
      userId,
      type: NOTICE_TYPE.handed,
      title: HANDOFF_NOTICES.handed(role, s.words.title).slice(0, 255),
      body: HANDOFF_NOTICES.handedBody,
      link: TASK_BOARD_PATH,
      actorUserId: null,
      dedupeKey: handoffDedupeKey(id, "handed", userId),
    });
  }
  return id;
}

// ── Answer ──────────────────────────────────────────────────────────────────

const toSender = async (deps: HandoffDeps, row: HandoffRow, event: "accepted" | "edited" | "declined" | "done", title: string, role: string, extra?: number) => {
  if (!row.fromUserId) return;
  await deps.notify({
    userId: row.fromUserId,
    type: NOTICE_TYPE[event],
    title: HANDOFF_NOTICES[event](role, title).slice(0, 255),
    body: null,
    link: TASK_BOARD_PATH,
    actorUserId: null,
    dedupeKey: handoffDedupeKey(row.id, event, extra),
  });
};

/** A holder (or whoever it falls to) accepts it, suggests a change, or declines it. */
export async function respondToHandoff(
  pool: Pool, deps: HandoffDeps, viewer: HandoffViewer, id: string, body: unknown,
): Promise<Outcome<{ status: "accepted" | "waiting" | "declined"; taskId: string | null }>> {
  const row = await store.handoffById(pool, id);
  if (!row) return refuse(404, HANDOFF_REFUSALS.notFound);
  if (row.fromUserId !== null && row.fromUserId === viewer.userId) return refuse(403, HANDOFF_REFUSALS.ownTask);
  const { byId, roles } = await audiences(pool, [row]);
  // A stranger learns nothing more about it, not even whether it still waits.
  if (!mayAnswer(viewer, row.fromUserId, byId.get(row.id) ?? { via: "steward", userIds: [] })) return refuse(403, HANDOFF_REFUSALS.notYours);
  if (row.status !== "waiting") return refuse(409, HANDOFF_REFUSALS.taken);
  const current = wordsOf(row, (await store.stepsFor(pool, [row.id])).get(row.id) ?? []);
  const parsed = parseHandoffResponse(body, current, deps.today());
  if (!parsed.ok) return refuse(400, parsed.error);
  const role = roles.get(row.roleId)?.name || row.roleId;
  const sender = row.fromUserId ?? viewer.userId;
  const r = parsed.value;

  if (r.action === "accept") {
    if (!(await store.closeHandoff(pool, row.id, "taken", viewer.userId))) return refuse(409, HANDOFF_REFUSALS.taken);
    let taskId: string;
    try {
      taskId = await insertTask(pool, viewer.userId, {
        title: current.title, tier: "priority", dueOn: current.dueOn, horizon: null, minutes: null, privateDetail: null,
        source: "redirect", externalId: row.id, createdOn: deps.today(),
      }, row.fromUserId);
    } catch (e) {
      // The unique key on (user, source, external id): a copy is already there, which is the answer.
      if ((e as { code?: string })?.code !== "ER_DUP_ENTRY") throw e;
      taskId = "";
    }
    if (taskId) {
      const from = row.fromUserId ? (await store.firstNames(pool, [row.fromUserId])).get(row.fromUserId) || null : null;
      await store.tagAcceptedCopy(pool, taskId, viewer.userId, row.roleId, from);
    }
    await store.recordStep(pool, row.id, sender, HANDOFF_EVENT.accept, { taskId: taskId || null }, viewer.userId);
    await toSender(deps, row, "accepted", current.title, role);
    return { ok: true, value: { status: "accepted", taskId: taskId || null } };
  }

  if (r.action === "suggest") {
    if (!(await store.retitleHandoff(pool, row.id, r.words.title))) return refuse(409, HANDOFF_REFUSALS.taken);
    const step = await store.recordStep(pool, row.id, sender, HANDOFF_EVENT.edit, { title: r.words.title, note: r.words.note, dueOn: r.words.dueOn }, viewer.userId);
    await toSender(deps, row, "edited", r.words.title, role, step);
    return { ok: true, value: { status: "waiting", taskId: null } };
  }

  if (!(await store.closeHandoff(pool, row.id, "dismissed", viewer.userId))) return refuse(409, HANDOFF_REFUSALS.taken);
  await store.recordStep(pool, row.id, sender, HANDOFF_EVENT.decline, { reason: r.reason }, viewer.userId);
  await toSender(deps, row, "declined", current.title, role);
  return { ok: true, value: { status: "declined", taskId: null } };
}

/** The sender takes it back while it waits. Nobody else can. */
export async function withdrawHandoff(pool: Pool, senderId: string, id: string): Promise<Outcome<null>> {
  const row = await store.handoffById(pool, id);
  if (!row) return refuse(404, HANDOFF_REFUSALS.notFound);
  if (row.fromUserId !== senderId) return refuse(403, HANDOFF_REFUSALS.notSender);
  if (!(await store.closeHandoff(pool, row.id, "dismissed", null))) return refuse(409, HANDOFF_REFUSALS.taken);
  await store.recordStep(pool, row.id, senderId, HANDOFF_EVENT.withdraw, null, senderId);
  return { ok: true, value: null };
}

/**
 * The admin panel's role queue closed one (POST /api/admin/member-tasks/role-queue/:id).
 * The sender hears either way: taken reads as accepted, dismissed as declined.
 */
export async function afterStewardClose(pool: Pool, deps: HandoffDeps, id: string, status: "taken" | "dismissed", stewardId: string | null): Promise<void> {
  const row = await store.handoffById(pool, id);
  if (!row || !row.fromUserId) return;
  const role = (await store.rolesFor(pool, [row.roleId])).get(row.roleId)?.name || row.roleId;
  if (status === "taken") {
    await store.recordStep(pool, row.id, row.fromUserId, HANDOFF_EVENT.accept, { taskId: null, steward: true }, stewardId);
    await toSender(deps, row, "accepted", row.title, role);
  } else {
    await store.recordStep(pool, row.id, row.fromUserId, HANDOFF_EVENT.decline, { reason: null, steward: true }, stewardId);
    await toSender(deps, row, "declined", row.title, role);
  }
}

// ── Reads ───────────────────────────────────────────────────────────────────

/** What waits on this reader, oldest first. */
export async function waitingFor(pool: Pool, viewer: HandoffViewer, timeZone: string): Promise<WaitingHandoff[]> {
  const rows = (await store.waitingHandoffs(pool)).filter((r) => r.fromUserId !== viewer.userId);
  if (!rows.length) return [];
  const { byId, roles } = await audiences(pool, rows);
  const mine = rows.filter((r) => mayAnswer(viewer, r.fromUserId, byId.get(r.id) ?? { via: "steward", userIds: [] }));
  if (!mine.length) return [];
  const steps = await store.stepsFor(pool, mine.map((r) => r.id));
  const names = await store.firstNames(pool, Array.from(new Set(mine.map((r) => r.fromUserId).filter((x): x is string => !!x))));
  return mine.map((r) => {
    const w = wordsOf(r, steps.get(r.id) ?? []);
    const role = roles.get(r.roleId);
    return {
      id: r.id,
      roleId: r.roleId,
      role: role?.name || r.roleId,
      circle: role?.circle ?? null,
      title: w.title,
      note: w.note,
      dueOn: w.dueOn,
      from: (r.fromUserId && names.get(r.fromUserId)) || "",
      sentOn: dayOf(r.createdAt, timeZone),
      via: byId.get(r.id)?.via ?? "steward",
      edited: w.edited,
    };
  });
}

/** What this member sent, newest first, each with the status they see. */
export async function sentFrom(pool: Pool, userId: string, timeZone: string): Promise<SentHandoff[]> {
  const rows = await store.sentBy(pool, userId);
  if (!rows.length) return [];
  const ids = rows.map((r) => r.id);
  const [steps, copies, roles] = await Promise.all([
    store.stepsFor(pool, ids),
    store.acceptedCopies(pool, ids),
    store.rolesFor(pool, Array.from(new Set(rows.map((r) => r.roleId)))),
  ]);
  return rows.map((r) => {
    const list = steps.get(r.id) ?? [];
    const w = wordsOf(r, list);
    const decline = [...list].reverse().find((s) => s.kind === HANDOFF_EVENT.decline || s.kind === HANDOFF_EVENT.withdraw);
    const declined = decline?.kind === HANDOFF_EVENT.decline;
    const copy = copies.get(r.id);
    const status: SentStatus = sentStatusOf({ status: r.status, declined, acceptedDone: !!copy && copy.userId === r.takenByUserId && copy.done });
    return {
      id: r.id,
      roleId: r.roleId,
      role: roles.get(r.roleId)?.name || r.roleId,
      title: w.title,
      note: w.note,
      dueOn: w.dueOn,
      status,
      reason: status === "declined" && typeof decline?.detail.reason === "string" ? decline.detail.reason : null,
      edited: w.edited,
      sentOn: dayOf(r.createdAt, timeZone),
    };
  });
}

/** The sender hears once when the copy someone accepted is marked done. Safe to run as often as you like. */
export async function noticeDone(pool: Pool, deps: Pick<HandoffDeps, "notify">): Promise<number> {
  const done = await store.recentlyDone(pool);
  if (!done.length) return 0;
  const roles = await store.rolesFor(pool, Array.from(new Set(done.map((d) => d.roleId))));
  for (const d of done) {
    await deps.notify({
      userId: d.fromUserId,
      type: NOTICE_TYPE.done,
      title: HANDOFF_NOTICES.done(roles.get(d.roleId)?.name || d.roleId, d.title).slice(0, 255),
      body: null,
      link: TASK_BOARD_PATH,
      actorUserId: null,
      dedupeKey: handoffDedupeKey(d.id, "done"),
    });
  }
  return done.length;
}
