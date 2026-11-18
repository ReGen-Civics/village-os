/**
 * PRIORITIES EVERYONE CAN SEE: the contract (team call, 2026-11-16).
 *
 * Three asks, one file:
 *
 *   1. EACH PERSON'S TOP PRIORITY FOR THE WEEK. One line, and the season goal
 *      it serves if any. A member sets it on their profile, or the Monday
 *      meeting captures it in an "Each person's top priority" round
 *      (`top_priorities`). It carries forward until replaced. Friday's
 *      check-in (`top_priorities_review`) reads each line back and marks it
 *      done, partly or carried over.
 *   2. THE PRIORITY BOARD. The group's priorities for the season, each tied
 *      to a season goal, with an owner role and a status, on one ordered list.
 *      The ORDER is the circle's: a facilitator puts the board on a meeting's
 *      agenda, the room votes it as it votes any agenda, the facilitator sets
 *      the order, and "Keep this order on the board" writes it back. The board
 *      never sorts itself by a score.
 *   3. AN ASK'S PLACE IN LINE. When a role holder has taken a tension raised
 *      with their role, they can say where it sits on their list and the week
 *      they expect to pick it up. Whoever raised it reads that on their
 *      profile in plain words. Nothing here counts days late.
 *
 * STORAGE. Three `app_config` documents, each written under a row lock
 * (server/repos/priorities.ts), so no new table: `week-priorities` keyed by a
 * Live Sessions member number, `priority-board` per season, and `ask-places`
 * keyed by tension id. A member's lines go with them on erasure and come with
 * them in their export (server/lib/sessionTemplates.ts).
 *
 * WHO. Setting your own line is every member. A meeting's facilitator or
 * secretary may type one in for somebody in the room. Keeping the board asks
 * the gate for `session.template`, the people who may run sessions. A place in
 * line is set by a live holder of the role.
 */
import { cleanLine } from "./sessions";
import { PRIORITY_OUTCOMES, cleanServesGoal, type PriorityOutcome, type SeasonGoalRef } from "./sessionTemplates";

// ── Doors ────────────────────────────────────────────────────────────────────

/**
 *   GET   /api/session-templates/week                 WeekPayload
 *   PUT   /api/session-templates/week                 { text, servesGoalId? } -> WeekPayload
 *   GET   /api/session-templates/board?season=<id>    BoardPayload
 *   POST  /api/session-templates/board                { text, servesGoalId?, ownerRoleId? } -> BoardPayload
 *   PATCH /api/session-templates/board/:id            { text? servesGoalId? ownerRoleId? status? } -> BoardPayload
 *   POST  /api/session-templates/rooms/:sid/tops       { text, servesGoalId?, forNo? } -> TemplateRoomView
 *   PATCH /api/session-templates/rooms/:sid/tops/:no   { outcome } -> TemplateRoomView
 *   POST  /api/session-templates/rooms/:sid/board      { act: "agenda" | "keep" } -> TemplateRoomView
 *   POST  /api/role-tensions/:id/place                 { position, inWeeks } -> { place }
 *   GET   /api/role-tensions/raised                    { asks: RaisedAsk[] }
 *
 * Every one sits under a prefix that already carries its module and members
 * gate: the first eight behind Live Sessions, the last two beside the role
 * tension doors, which every village has.
 */
export const WEEK_API = "/api/session-templates/week";
export const BOARD_API = "/api/session-templates/board";
export const boardItemApi = (id: number) => `${BOARD_API}/${id}`;
export const RAISED_ASKS_API = "/api/role-tensions/raised";
export const askPlaceApi = (id: string) => `/api/role-tensions/${encodeURIComponent(id)}/place`;

export const WEEK_DOC = "week-priorities";
export const BOARD_DOC = "priority-board";
export const PLACES_DOC = "ask-places";

export const PRIORITY_LIMITS = {
  text: 200,
  /** Lines kept per member, newest first. Enough for a season's read-back. */
  linesKept: 16,
  /** A line older than this many weeks drops off the team view. */
  carryWeeks: 8,
  boardItems: 60,
  /** The furthest place in line and the furthest week ahead a holder can name. */
  maxPosition: 999,
  maxWeeksAhead: 26,
} as const;

// ── Weeks ────────────────────────────────────────────────────────────────────

const DAY = /^(\d{4})-(\d{2})-(\d{2})$/;
export const isDayKey = (v: unknown): v is string => typeof v === "string" && DAY.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`));

/** The Monday of the week a village day falls in, YYYY-MM-DD. */
export function mondayOf(day: string): string {
  if (!isDayKey(day)) return "";
  const d = new Date(`${day}T00:00:00Z`);
  const back = (d.getUTCDay() + 6) % 7;
  return new Date(d.getTime() - back * 86_400_000).toISOString().slice(0, 10);
}

/** A Monday moved by whole weeks. */
export function addWeeks(monday: string, weeks: number): string {
  if (!isDayKey(monday)) return "";
  return new Date(Date.parse(`${monday}T00:00:00Z`) + weeks * 7 * 86_400_000).toISOString().slice(0, 10);
}

/** Whole weeks from one Monday to another. */
export const weeksBetween = (from: string, to: string): number => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / (7 * 86_400_000));

// ── 1. Each person's top priority ────────────────────────────────────────────

export interface WeekLine {
  /** The Monday of the week it was set for. */
  weekOf: string;
  text: string;
  servesGoalId: string | null;
  servesGoal: string | null;
  outcome: PriorityOutcome | null;
  /** The meeting that captured it, or null when set from the profile. */
  sessionId: number | null;
  setAt: string;
}

/** The stored document: member number to that member's lines, newest first. */
export interface WeekDoc {
  lines: Record<string, WeekLine[]>;
}

const isOutcome = (v: unknown): v is PriorityOutcome => typeof v === "string" && (PRIORITY_OUTCOMES as readonly string[]).includes(v);
const strOrNull = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v : null);

function readLine(v: unknown): WeekLine | null {
  if (!v || typeof v !== "object") return null;
  const l = v as Record<string, unknown>;
  if (!isDayKey(l.weekOf) || typeof l.text !== "string" || !l.text.trim()) return null;
  return {
    weekOf: l.weekOf,
    text: l.text,
    servesGoalId: strOrNull(l.servesGoalId),
    servesGoal: strOrNull(l.servesGoal),
    outcome: isOutcome(l.outcome) ? l.outcome : null,
    sessionId: typeof l.sessionId === "number" && Number.isInteger(l.sessionId) ? l.sessionId : null,
    setAt: typeof l.setAt === "string" ? l.setAt : "",
  };
}

/** The document as stored, read tolerantly: a line that no longer reads is dropped. */
export function readWeekDoc(raw: unknown): WeekDoc {
  const lines: Record<string, WeekLine[]> = {};
  const src = raw && typeof raw === "object" ? (raw as { lines?: unknown }).lines : null;
  if (src && typeof src === "object" && !Array.isArray(src)) {
    for (const [no, list] of Object.entries(src as Record<string, unknown>)) {
      if (!/^\d+$/.test(no) || !Array.isArray(list)) continue;
      const kept = list.map(readLine).filter((l): l is WeekLine => l !== null);
      if (kept.length) lines[no] = kept.sort((a, b) => b.weekOf.localeCompare(a.weekOf));
    }
  }
  return { lines };
}

/** A member's line as it stands now: the newest one set for this week or before. */
export function currentLine(lines: readonly WeekLine[] | undefined, thisWeek: string): WeekLine | null {
  return (lines ?? []).find((l) => l.weekOf <= thisWeek) ?? null;
}

/** Set a member's line for a week: it replaces that week's line, and the list keeps its newest. */
export function withLine(doc: WeekDoc, no: number, line: WeekLine): WeekDoc {
  const key = String(no);
  const rest = (doc.lines[key] ?? []).filter((l) => l.weekOf !== line.weekOf);
  const list = [line, ...rest].sort((a, b) => b.weekOf.localeCompare(a.weekOf)).slice(0, PRIORITY_LIMITS.linesKept);
  return { lines: { ...doc.lines, [key]: list } };
}

/** Mark a member's current line. Null when they have none to mark. */
export function withOutcome(doc: WeekDoc, no: number, thisWeek: string, outcome: PriorityOutcome | null): WeekDoc | null {
  const key = String(no);
  const line = currentLine(doc.lines[key], thisWeek);
  if (!line) return null;
  const list = (doc.lines[key] ?? []).map((l) => (l.weekOf === line.weekOf ? { ...l, outcome } : l));
  return { lines: { ...doc.lines, [key]: list } };
}

/** The document without one member. */
export function withoutMember(doc: WeekDoc, no: number): WeekDoc {
  const { [String(no)]: _gone, ...rest } = doc.lines;
  return { lines: rest };
}

/** A line from a request body, or the sentence that says what is wrong. */
export function cleanWeekLine(
  body: unknown,
  goals: readonly SeasonGoalRef[],
): { ok: true; text: string; goal: SeasonGoalRef | null } | { ok: false; error: string } {
  const b = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const text = cleanLine(b.text, PRIORITY_LIMITS.text);
  if (!text) return { ok: false, error: PRIORITY_REFUSALS.textNeeded };
  const serves = cleanServesGoal(b, goals);
  if (!serves.ok) return { ok: false, error: PRIORITY_REFUSALS.goalUnknown };
  return { ok: true, text, goal: serves.value };
}

/** One person on the team view, by name. Never an id. */
export interface TeamLine {
  name: string;
  line: WeekLine;
  /** Whether it was set for this week; false means it carried forward. */
  thisWeek: boolean;
}

/** GET /api/session-templates/week */
export interface WeekPayload {
  weekOf: string;
  mine: WeekLine | null;
  /** Everyone with a line from the last few weeks, by name, A to Z. */
  team: TeamLine[];
  goals: SeasonGoalRef[];
}

/** One person in a meeting's top priority round. */
export interface RoomTop {
  no: number;
  name: string;
  line: WeekLine | null;
}

export interface RoomTops {
  weekOf: string;
  people: RoomTop[];
}

// ── 2. The priority board ────────────────────────────────────────────────────

export const BOARD_STATUSES = ["not_started", "under_way", "done", "set_aside"] as const;
export type BoardStatus = (typeof BOARD_STATUSES)[number];
export const isBoardStatus = (v: unknown): v is BoardStatus => typeof v === "string" && (BOARD_STATUSES as readonly string[]).includes(v);
/** The statuses a meeting still ranks. */
export const BOARD_OPEN: ReadonlySet<BoardStatus> = new Set<BoardStatus>(["not_started", "under_way"]);

export interface BoardItem {
  id: number;
  text: string;
  servesGoalId: string | null;
  servesGoal: string | null;
  ownerRoleId: string | null;
  status: BoardStatus;
  /** The meeting it was last put on the agenda of, and its agenda item there. */
  voteSessionId: number | null;
  voteItemId: number | null;
}

/** The stored document: each season's items, in the circle's order. */
export interface BoardDoc {
  nextId: number;
  seasons: Record<string, BoardItem[]>;
}

const intOrNull = (v: unknown): number | null => (typeof v === "number" && Number.isInteger(v) && v > 0 ? v : null);

function readItem(v: unknown): BoardItem | null {
  if (!v || typeof v !== "object") return null;
  const i = v as Record<string, unknown>;
  const id = intOrNull(i.id);
  if (id == null || typeof i.text !== "string" || !i.text.trim()) return null;
  return {
    id,
    text: i.text,
    servesGoalId: strOrNull(i.servesGoalId),
    servesGoal: strOrNull(i.servesGoal),
    ownerRoleId: strOrNull(i.ownerRoleId),
    status: isBoardStatus(i.status) ? i.status : "not_started",
    voteSessionId: intOrNull(i.voteSessionId),
    voteItemId: intOrNull(i.voteItemId),
  };
}

export function readBoardDoc(raw: unknown): BoardDoc {
  const r = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const seasons: Record<string, BoardItem[]> = {};
  let top = 0;
  if (r.seasons && typeof r.seasons === "object" && !Array.isArray(r.seasons)) {
    for (const [id, list] of Object.entries(r.seasons as Record<string, unknown>)) {
      if (!Array.isArray(list)) continue;
      const items = list.map(readItem).filter((x): x is BoardItem => x !== null);
      items.forEach((x) => (top = Math.max(top, x.id)));
      seasons[id] = items;
    }
  }
  const nextId = Math.max(intOrNull(r.nextId) ?? 1, top + 1);
  return { nextId, seasons };
}

/**
 * THE CIRCLE'S ORDER. The items the room took onto this meeting's agenda come
 * first, in the agenda's order as the facilitator set it; every other item
 * keeps its place after them, in the order it had. Agenda items taken off the
 * agenda (parked) do not move their board item up.
 */
export function boardOrderFromAgenda(
  items: readonly BoardItem[],
  sessionId: number,
  agenda: readonly { id: number; position: number; status: string }[],
): BoardItem[] {
  const pos = new Map(agenda.filter((a) => a.status !== "parked").map((a) => [a.id, a.position]));
  const voted = items.filter((i) => i.voteSessionId === sessionId && i.voteItemId != null && pos.has(i.voteItemId));
  voted.sort((a, b) => (pos.get(a.voteItemId!) ?? 0) - (pos.get(b.voteItemId!) ?? 0));
  const chosen = new Set(voted.map((i) => i.id));
  return [...voted, ...items.filter((i) => !chosen.has(i.id))];
}

/** One item as a page draws it: its place, and its owner role's name. */
export interface BoardCard extends BoardItem {
  place: number;
  ownerRole: string | null;
}

/** GET /api/session-templates/board */
export interface BoardPayload {
  season: { id: string; name: string } | null;
  items: BoardCard[];
  goals: SeasonGoalRef[];
  /** The roles an item can name as its owner. Only for someone who may keep the board. */
  roles: { id: string; name: string }[];
  mayKeep: boolean;
}

/** What a meeting's vote section reads about the board. */
export interface RoomBoard {
  items: BoardCard[];
  /** How many of them are on this meeting's agenda now. */
  onAgenda: number;
  /** The facilitator has set the agenda's order, so it can be kept. */
  orderSet: boolean;
}

// ── 3. An ask's place in line ────────────────────────────────────────────────

export interface AskPlace {
  /** Where it sits on the role's list, 1 first. Null: not said. */
  position: number | null;
  /** The Monday of the week the holder expects to pick it up. Null: not said. */
  expectWeek: string | null;
}

export type PlacesDoc = Record<string, AskPlace>;

export function readPlacesDoc(raw: unknown): PlacesDoc {
  const out: PlacesDoc = {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
  for (const [id, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!v || typeof v !== "object") continue;
    const p = v as Record<string, unknown>;
    const position = intOrNull(p.position);
    const expectWeek = isDayKey(p.expectWeek) ? p.expectWeek : null;
    if (position != null || expectWeek != null) out[id] = { position, expectWeek };
  }
  return out;
}

/**
 * A place from a request body: `position` 1 to 999 or null, and `inWeeks`, the
 * weeks from this one (0 is this week) or null. The week is kept as its Monday.
 * A body that leaves `inWeeks` out keeps the week already said.
 */
export function cleanPlace(body: unknown, thisWeek: string, before: AskPlace | null = null): { ok: true; place: AskPlace } | { ok: false; error: string } {
  const b = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  let position: number | null = null;
  if (b.position != null && b.position !== "") {
    const n = Number(b.position);
    if (!Number.isInteger(n) || n < 1 || n > PRIORITY_LIMITS.maxPosition) return { ok: false, error: PRIORITY_REFUSALS.position };
    position = n;
  }
  let expectWeek: string | null = b.inWeeks === undefined ? (before?.expectWeek ?? null) : null;
  if (b.inWeeks != null && b.inWeeks !== "") {
    const n = Number(b.inWeeks);
    if (!Number.isInteger(n) || n < 0 || n > PRIORITY_LIMITS.maxWeeksAhead) return { ok: false, error: PRIORITY_REFUSALS.inWeeks };
    expectWeek = addWeeks(thisWeek, n);
  }
  return { ok: true, place: { position, expectWeek } };
}

/** One ask the reader raised that nobody has answered, as they read it on their profile. */
export interface RaisedAsk {
  id: string;
  role: string;
  circle: string | null;
  text: string;
  status: "open" | "taken";
  raisedOn: string;
  place: AskPlace | null;
}

export function readRaisedAsks(v: unknown): RaisedAsk[] {
  if (!Array.isArray(v)) return [];
  const out: RaisedAsk[] = [];
  for (const x of v) {
    if (!x || typeof x !== "object") continue;
    const a = x as Record<string, unknown>;
    if (typeof a.id !== "string" || typeof a.role !== "string" || typeof a.text !== "string" || typeof a.raisedOn !== "string") continue;
    if (a.status !== "open" && a.status !== "taken") continue;
    const p = readPlacesDoc({ x: a.place }).x ?? null;
    out.push({ id: a.id, role: a.role, circle: strOrNull(a.circle), text: a.text, status: a.status, raisedOn: a.raisedOn, place: p });
  }
  return out;
}

// ── Words a server sends ─────────────────────────────────────────────────────

export const PRIORITY_REFUSALS = {
  textNeeded: "Write the priority in a few words.",
  goalUnknown: "Choose one of this season's goals, or none.",
  notHere: "That person is not in the room.",
  ownOnly: "You set your own top priority. The facilitator or the secretary can type one in for somebody here.",
  noLine: "There is no top priority to mark yet.",
  outcome: "Mark it done, partly or carried over.",
  noSection: "This meeting has no section for that.",
  noSeason: "No season is running, so there is no board to keep.",
  boardFull: `The board holds up to ${PRIORITY_LIMITS.boardItems} priorities. Set one aside first.`,
  itemNotFound: "That priority is not on the board.",
  status: "Say not started, under way, done or set aside.",
  roleUnknown: "That is not one of the village's roles.",
  mayNotKeep: "Keeping the board is for people who may run sessions.",
  nothingToVote: "There is nothing on the board to put on the agenda.",
  agendaFull: "The agenda is full.",
  setOrderFirst: "Set the agenda's order first, then keep it on the board.",
  act: "Say agenda or keep.",
  position: `A place in line is a whole number from 1 to ${PRIORITY_LIMITS.maxPosition}.`,
  inWeeks: `Choose a week from this one up to ${PRIORITY_LIMITS.maxWeeksAhead} weeks ahead.`,
  takeFirst: "Take it first, then say where it sits.",
} as const;
