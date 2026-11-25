/**
 * FOLLOW-UPS AS ONE LIST (profile overhaul, Direction D; the lead, 24 Nov 2026: "the tasks list ... should all
 * be in one"). This file is the pure part: it turns the reads the profile already makes into one list of rows,
 * each in one of three groups.
 *
 *   today    a task of yours dated today or earlier, or an ask of you where someone is stuck or it is due
 *   later    the rest of what is yours to do, dated soonest first, undated last
 *   others   what you are waiting on: your open asks of a member, and what you asked of a role
 *
 * The sources are the task board (held by you, or by a seat you sit in), the asks between members, and the
 * asks raised with a role. Each row keeps where it came from, so a filter can narrow by source and the row can
 * link to where it lives in full. A row carries a tick only when one call can close it: a task (`taskDoneUrl`)
 * and an ask of you (the ask's `done`). Everything else is closed where it lives.
 *
 * Only the member's own rows, from their own reads. Nobody else's list is ever built.
 */
import type { TaskBoardPayload, TaskCard } from "@shared/sessionTasks";
import type { AsksPayload, AskView } from "@shared/memberAsks";
import type { RaisedAsk } from "@shared/priorities";

export const FOLLOW_GROUPS = ["today", "later", "others"] as const;
export type FollowGroup = (typeof FOLLOW_GROUPS)[number];

export const FOLLOW_SOURCES = ["task", "seat", "asked", "yours", "role"] as const;
export type FollowSource = (typeof FOLLOW_SOURCES)[number];

export type FollowTick = { kind: "task"; id: number } | { kind: "ask"; id: string };

export interface FollowRow {
  key: string;
  source: FollowSource;
  group: FollowGroup;
  title: string;
  /** Who it is with: the session, the seat, the member or the role. */
  with: string;
  /** YYYY-MM-DD or null. */
  dueOn: string | null;
  /** Someone is stuck until it is done (an ask of you marked so). */
  blocking: boolean;
  href: string;
  tick: FollowTick | null;
}

export interface FollowReads {
  board: TaskBoardPayload | null;
  asks: AsksPayload | null;
  raised: RaisedAsk[] | null;
  /** The village's YYYY-MM-DD; the board sends it, and the reader's own day stands in without it. */
  today: string;
}

const due = (d: string | null, today: string) => !!d && d <= today;

function taskRow(c: TaskCard, source: "task" | "seat", today: string, boardHref: string): FollowRow {
  return {
    key: `task-${c.entryId}`,
    source,
    group: due(c.dueOn, today) ? "today" : "later",
    title: c.text,
    with: source === "seat" && c.seat ? c.seat.name : c.sessionTitle,
    dueOn: c.dueOn,
    blocking: false,
    href: `${boardHref}-${c.entryId}`,
    // A card still in an open session is answered in the room, and some cards are not this reader's to answer.
    tick: c.canAnswer && !c.inSessionNow ? { kind: "task", id: c.entryId } : null,
  };
}

function askedRow(a: AskView, today: string): FollowRow {
  return {
    key: `asked-${a.id}`,
    source: "asked",
    group: a.blocking || due(a.dueOn, today) ? "today" : "later",
    title: a.why,
    with: a.otherName,
    dueOn: a.dueOn,
    blocking: a.blocking,
    href: a.link,
    tick: { kind: "ask", id: a.id },
  };
}

function yoursRow(a: AskView): FollowRow {
  return { key: `yours-${a.id}`, source: "yours", group: "others", title: a.why, with: a.otherName, dueOn: a.dueOn, blocking: a.blocking, href: "#waiting", tick: null };
}

function roleRow(r: RaisedAsk): FollowRow {
  return { key: `role-${r.id}`, source: "role", group: "others", title: r.text, with: r.role, dueOn: r.place?.expectWeek ?? null, blocking: false, href: "#roles", tick: null };
}

/** Soonest first, undated last, the stuck before the rest on the same day; the source order breaks a tie. */
function order(a: FollowRow, b: FollowRow): number {
  if (a.blocking !== b.blocking) return a.blocking ? -1 : 1;
  if (a.dueOn !== b.dueOn) return !a.dueOn ? 1 : !b.dueOn ? -1 : a.dueOn < b.dueOn ? -1 : 1;
  return FOLLOW_SOURCES.indexOf(a.source) - FOLLOW_SOURCES.indexOf(b.source);
}

export function followUpRows(r: FollowReads, boardHref = "#task"): FollowRow[] {
  const today = r.board?.today || r.today;
  const open = (c: TaskCard) => c.status === "open";
  const rows: FollowRow[] = [
    ...(r.board?.holding ?? []).filter(open).map((c) => taskRow(c, "task", today, boardHref)),
    ...(r.board?.seatsHold ?? []).filter(open).map((c) => taskRow(c, "seat", today, boardHref)),
    ...(r.asks?.waitingOnYou ?? []).filter((a) => a.status === "open").map((a) => askedRow(a, today)),
    ...(r.asks?.yourAsks ?? []).filter((a) => a.status === "open").map(yoursRow),
    ...(r.raised ?? []).map(roleRow),
  ];
  return rows.sort(order);
}

/** The rows of one group, in order. */
export function inGroup(rows: FollowRow[], g: FollowGroup): FollowRow[] {
  return rows.filter((r) => r.group === g);
}
