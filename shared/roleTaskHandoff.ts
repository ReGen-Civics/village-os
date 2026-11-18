/**
 * HAND A TASK TO A ROLE: the contract (Operations lead, team call: "create and
 * have tasks in our profile that we can pass off to other roles and then those
 * roles can accept them and edit them, and then you're getting notifications on
 * your side").
 *
 * A member sends a task to a role from their profile: a new one, or one of
 * their own. It waits on the role's live holders under Waiting on you. A holder
 * accepts it (it joins their own list, where they edit it like any task),
 * suggests a change (words, note, by-when), or declines it with a reason. One
 * holder accepting takes it for the role. Nothing accepts on its own: Sera may
 * suggest, a person always presses Accept.
 *
 * WHO IT WAITS ON, read live every time, so a member who takes the role later
 * sees what is waiting for it (`audienceOf`, server/lib/roleTaskHandoffs.ts):
 *
 *   1. the role's live holders, other than the sender;
 *   2. when there are none, the live holders of the lead role of the role's
 *      circle, other than the sender;
 *   3. when there are none of those either, the village's stewards (admins),
 *      who also see it in the admin panel's role queue as before.
 *
 * The sender hears on accept, on a suggested change, on decline, and when the
 * person who accepted marks it done. Each notice has one stable key per task
 * and event, so a retry writes nothing twice.
 *
 * STORAGE. No new table. A handoff is a row in `member_task_role_queue`
 * (drizzle/0312): `waiting`, `taken` (accepted) or `dismissed` (declined, or
 * the sender took it back). Its note and by-when, each suggested change, the
 * decline reason and who accepted are `handoff_*` rows in the append-only
 * `member_task_events` (drizzle/0310), keyed by the handoff's id under the
 * sender's user id, so erasure of the sender clears them with the rest of
 * their task events. The accepted copy is an ordinary `member_tasks` row with
 * source `redirect` and the handoff's id as its external id, which the unique
 * key on (user, source, external id) holds to one copy per person.
 *
 * Doors (server/routes/roleTaskHandoffs.ts):
 *
 *   POST /api/member-tasks/handoffs              { roleId, title, note?, dueOn? }   a new task for a role
 *   POST /api/member-tasks/me/:id/redirect       { ..., toRoleId, handoffNote?, handoffDueOn? } one of your own
 *   GET  /api/member-tasks/handoffs/sent         { sent: SentHandoff[] }
 *   GET  /api/member-tasks/handoffs/waiting      { waiting: WaitingHandoff[] }
 *   POST /api/member-tasks/handoffs/:id/respond  { action, title?, note?, dueOn?, reason? }
 *   POST /api/member-tasks/handoffs/:id/withdraw the sender takes it back while it waits
 */
import { cleanLine, cleanText } from "./sessions";
import { isDayKey } from "./memberTasks";

export const HANDOFFS_URL = "/api/member-tasks/handoffs";
export const HANDOFFS_SENT_URL = `${HANDOFFS_URL}/sent`;
export const HANDOFFS_WAITING_URL = `${HANDOFFS_URL}/waiting`;
export const handoffRespondUrl = (id: string): string => `${HANDOFFS_URL}/${encodeURIComponent(id)}/respond`;
export const handoffWithdrawUrl = (id: string): string => `${HANDOFFS_URL}/${encodeURIComponent(id)}/withdraw`;

export const HANDOFF_LIMITS = {
  title: 200,
  note: 500,
  reason: 300,
  /** Handoffs one member may send in an hour. */
  sendsPerHour: 30,
  /** Answers one member may give in an hour. */
  respondsPerHour: 60,
} as const;

/** The role-queue row id: `rq-` and a UUID (server/repos/memberTaskFeedback.ts `queueForRole`). */
export const HANDOFF_ID = /^rq-[0-9a-f-]{36}$/;

export const HANDOFF_ACTIONS = ["accept", "suggest", "decline"] as const;
export type HandoffAction = (typeof HANDOFF_ACTIONS)[number];

/** What the sender sees. */
export const SENT_STATUSES = ["waiting", "accepted", "declined", "done", "withdrawn"] as const;
export type SentStatus = (typeof SENT_STATUSES)[number];

/** Why this reader is asked: they hold the role, they hold the circle's lead role, or nobody does and they are a steward. */
export const HANDOFF_VIA = ["holder", "lead", "steward"] as const;
export type HandoffVia = (typeof HANDOFF_VIA)[number];

/** The `member_task_events.kind` of each step. All fit the column's 24 characters. */
export const HANDOFF_EVENT = {
  sent: "handoff_sent",
  edit: "handoff_edit",
  accept: "handoff_accept",
  decline: "handoff_decline",
  withdraw: "handoff_withdraw",
} as const;
export type HandoffEventKind = (typeof HANDOFF_EVENT)[keyof typeof HANDOFF_EVENT];

/** One handoff waiting on the reader. Names the sender by first name only. */
export interface WaitingHandoff {
  id: string;
  roleId: string;
  role: string;
  circle: string | null;
  title: string;
  note: string | null;
  dueOn: string | null;
  from: string;
  sentOn: string;
  via: HandoffVia;
  /** A holder suggested a change since it was sent. */
  edited: boolean;
}

/** One handoff the reader sent. */
export interface SentHandoff {
  id: string;
  roleId: string;
  role: string;
  title: string;
  note: string | null;
  dueOn: string | null;
  status: SentStatus;
  /** The reason given on a decline. */
  reason: string | null;
  edited: boolean;
  sentOn: string;
}

export interface HandoffWords {
  title: string;
  note: string | null;
  dueOn: string | null;
}

export type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };

export const HANDOFF_REFUSALS = {
  noTitle: "Say what the task is.",
  badDay: "Pick a day from today on.",
  noRole: "Pick a role from the list.",
  badAction: "Accept it, suggest a change, or decline it.",
  noChange: "Change the words, the note or the day first.",
  noReason: "Say why, in a line.",
  notFound: "That task is not waiting any more.",
  notYours: "This one waits on a role you don't hold.",
  ownTask: "You sent this one. Someone in the role accepts it.",
  taken: "Someone in the role answered it already.",
  notSender: "Only the person who sent it can take it back.",
  listOff: "Your task list is off. A steward can turn it on.",
} as const;

function day(raw: unknown, today: string): Parsed<string | null> {
  if (raw === undefined || raw === null || raw === "") return { ok: true, value: null };
  if (!isDayKey(raw) || raw < today) return { ok: false, error: HANDOFF_REFUSALS.badDay };
  return { ok: true, value: raw };
}

/** The words of a new handoff. `today` is the village's day. */
export function parseHandoffWords(body: unknown, today: string): Parsed<HandoffWords> {
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const title = cleanLine(b.title, HANDOFF_LIMITS.title);
  if (!title) return { ok: false, error: HANDOFF_REFUSALS.noTitle };
  const due = day(b.dueOn, today);
  if (!due.ok) return due;
  return { ok: true, value: { title, note: cleanText(b.note, HANDOFF_LIMITS.note), dueOn: due.value } };
}

export type HandoffResponse =
  | { action: "accept" }
  | { action: "suggest"; words: HandoffWords }
  | { action: "decline"; reason: string };

/** A holder's answer. A suggestion must change something against `current`. */
export function parseHandoffResponse(body: unknown, current: HandoffWords, today: string): Parsed<HandoffResponse> {
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  if (b.action === "accept") return { ok: true, value: { action: "accept" } };
  if (b.action === "decline") {
    const reason = cleanLine(b.reason, HANDOFF_LIMITS.reason);
    return reason ? { ok: true, value: { action: "decline", reason } } : { ok: false, error: HANDOFF_REFUSALS.noReason };
  }
  if (b.action !== "suggest") return { ok: false, error: HANDOFF_REFUSALS.badAction };
  const title = "title" in b ? cleanLine(b.title, HANDOFF_LIMITS.title) : current.title;
  if (!title) return { ok: false, error: HANDOFF_REFUSALS.noTitle };
  const note = "note" in b ? cleanText(b.note, HANDOFF_LIMITS.note) : current.note;
  let dueOn = current.dueOn;
  if ("dueOn" in b && b.dueOn !== current.dueOn) {
    const due = day(b.dueOn, today);
    if (!due.ok) return due;
    dueOn = due.value;
  }
  if (title === current.title && note === current.note && dueOn === current.dueOn) return { ok: false, error: HANDOFF_REFUSALS.noChange };
  return { ok: true, value: { action: "suggest", words: { title, note, dueOn } } };
}

/**
 * The sender's status, from the queue row's status, the latest step and the
 * accepted copy. A dismissed row with no decline step was taken back: by the
 * sender, or by an undo of the hand-off on their list.
 */
export function sentStatusOf(row: { status: string; declined: boolean; acceptedDone: boolean }): SentStatus {
  if (row.status === "waiting") return "waiting";
  if (row.status === "taken") return row.acceptedDone ? "done" : "accepted";
  return row.declined ? "declined" : "withdrawn";
}

/** The sender's notices. In the bell only; each title carries the role and the task, nothing private. */
export const HANDOFF_NOTICES = {
  handed: (role: string, title: string): string => `For ${role}: ${title}`,
  handedBody: "It waits under Waiting on you on your profile. Accept it, suggest a change, or decline it.",
  accepted: (role: string, title: string): string => `${role} accepted: ${title}`,
  edited: (role: string, title: string): string => `${role} suggested a change: ${title}`,
  declined: (role: string, title: string): string => `${role} declined: ${title}`,
  done: (role: string, title: string): string => `${role} finished: ${title}`,
} as const;

/** The notices a handoff sends. Their types are in server/lib/roleTaskHandoffs.ts; shared/notificationKinds.ts describes each. */
export const HANDOFF_NOTICE_EVENTS = ["handed", "accepted", "edited", "declined", "done"] as const;
export type HandoffNoticeEvent = (typeof HANDOFF_NOTICE_EVENTS)[number];

/** One stable key per handoff and event, and per recipient where several hear. */
export const handoffDedupeKey = (id: string, event: HandoffNoticeEvent, extra?: string | number): string =>
  `role-task:${id}:${event}${extra === undefined ? "" : `:${extra}`}`;

const str = (v: unknown): v is string => typeof v === "string";
const strOrNull = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v : null);

/** The waiting rows as the client trusts them. */
export function readWaitingHandoffs(v: unknown): WaitingHandoff[] {
  const list = v && typeof v === "object" ? (v as { waiting?: unknown }).waiting : null;
  if (!Array.isArray(list)) return [];
  return list
    .filter((h: any) => h && str(h.id) && str(h.role) && str(h.title) && str(h.sentOn) && (HANDOFF_VIA as readonly string[]).includes(h.via))
    .map((h: any) => ({
      id: h.id, roleId: str(h.roleId) ? h.roleId : "", role: h.role, circle: strOrNull(h.circle), title: h.title,
      note: strOrNull(h.note), dueOn: strOrNull(h.dueOn), from: str(h.from) ? h.from : "", sentOn: h.sentOn, via: h.via, edited: h.edited === true,
    }));
}

/** The sent rows as the client trusts them. */
export function readSentHandoffs(v: unknown): SentHandoff[] {
  const list = v && typeof v === "object" ? (v as { sent?: unknown }).sent : null;
  if (!Array.isArray(list)) return [];
  return list
    .filter((h: any) => h && str(h.id) && str(h.role) && str(h.title) && str(h.sentOn) && (SENT_STATUSES as readonly string[]).includes(h.status))
    .map((h: any) => ({
      id: h.id, roleId: str(h.roleId) ? h.roleId : "", role: h.role, title: h.title, note: strOrNull(h.note), dueOn: strOrNull(h.dueOn),
      status: h.status, reason: strOrNull(h.reason), edited: h.edited === true, sentOn: h.sentOn,
    }));
}
