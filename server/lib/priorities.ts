/**
 * PRIORITIES EVERYONE CAN SEE, the rules. The contract and every refusal is
 * shared/priorities.ts; the statements are server/repos/priorities.ts; the
 * doors are server/routes/sessionTemplates.ts (the week, the board and the
 * room's acts, under the Live Sessions prefix) and server/routes/roleTensions.ts
 * (an ask's place in line).
 *
 *   weekPayload / setOwnLine     a member's top priority for the week, and the team's
 *   roomTops / setLineFor / markLineFor   the Monday round and the Friday read-back
 *   boardPayload / addBoardItem / patchBoardItem   the season's priority board
 *   roomBoard / putBoardOnAgenda / keepAgendaOrder   the board in a meeting's vote
 *   placesFor / writePlace / dropPlaces  an ask's place in line
 *   forgetWeekLines / weekLinesOf        erasure and export
 *
 * Nothing here ranks a person. The team view is by name, A to Z; the board's
 * order is whatever the circle last kept.
 */
import type { Pool, PoolConnection } from "mysql2/promise";
import * as store from "../repos/priorities";
import * as rooms from "../repos/liveSessions";
import { inTransaction } from "../repos/liveSessions";
import { sortByVotes } from "./sessionVotes";
import { civilDateKey } from "../../shared/lunar";
import { LIBRARY_MINUTES } from "../../shared/sessionLibrary";
import { SESSION_LIMITS, cleanLine, type ItemStatus } from "../../shared/sessions";
import { cleanServesGoal, resolveGoal, isPriorityOutcome, type PriorityOutcome, type SeasonGoalRef, type SeasonRef } from "../../shared/sessionTemplates";
import {
  BOARD_DOC,
  BOARD_OPEN,
  PLACES_DOC,
  PRIORITY_LIMITS,
  PRIORITY_REFUSALS as R,
  WEEK_DOC,
  addWeeks,
  boardOrderFromAgenda,
  cleanWeekLine,
  currentLine,
  isBoardStatus,
  mondayOf,
  readBoardDoc,
  readPlacesDoc,
  readWeekDoc,
  withLine,
  withOutcome,
  withoutMember,
  type AskPlace,
  type BoardCard,
  type BoardItem,
  type BoardPayload,
  type RoomBoard,
  type RoomTops,
  type TeamLine,
  type WeekLine,
  type WeekPayload,
} from "../../shared/priorities";

export type Outcome<T> = { ok: true; value: T } | { ok: false; status: number; error: string };
const refuse = (status: number, error: string): { ok: false; status: number; error: string } => ({ ok: false, status, error });
const done = <T>(value: T): Outcome<T> => ({ ok: true, value });

/** The Monday of this week on the village's clock. */
export const thisWeekOf = (now: Date, timeZone: string): string => mondayOf(civilDateKey(now, timeZone || "UTC"));

/** A line's goal words as the season says them now, when it still holds the goal. */
function withGoalWords<T extends { servesGoalId: string | null; servesGoal: string | null }>(row: T, goals: readonly SeasonGoalRef[]): T {
  const goal = resolveGoal(goals, row.servesGoalId, row.servesGoal);
  return goal ? { ...row, servesGoalId: goal.id, servesGoal: goal.text } : row;
}

// ── 1. Each person's top priority ───────────────────────────────────────────

/** A display name for each member number. The route's own lookup, so the room and the week agree. */
export type NamesOf = (nos: number[]) => Promise<Map<number, string>>;

/**
 * The week as one member reads it: their own line, and everyone's from the
 * last few weeks by name, A to Z. A line set before this week carries forward
 * and says so.
 */
export async function weekPayload(
  q: Pool | PoolConnection,
  viewerNo: number | null,
  namesOf: NamesOf,
  goals: readonly SeasonGoalRef[],
  thisWeek: string,
): Promise<WeekPayload> {
  const doc = readWeekDoc(await store.readDoc(q, WEEK_DOC));
  const oldest = addWeeks(thisWeek, -PRIORITY_LIMITS.carryWeeks);
  const current = Object.entries(doc.lines)
    .map(([no, lines]) => ({ no: Number(no), line: currentLine(lines, thisWeek) }))
    .filter((x): x is { no: number; line: WeekLine } => x.line !== null && x.line.weekOf >= oldest);
  const names = await namesOf(current.map((x) => x.no));
  const team: TeamLine[] = current
    .map((x) => ({ name: names.get(x.no) ?? "", line: withGoalWords(x.line, goals), thisWeek: x.line.weekOf === thisWeek }))
    .filter((t) => t.name)
    .sort((a, b) => a.name.localeCompare(b.name));
  const mine = viewerNo == null ? null : currentLine(doc.lines[String(viewerNo)], thisWeek);
  return { weekOf: thisWeek, mine: mine ? withGoalWords(mine, goals) : null, team, goals: [...goals] };
}

/** Write a member's line for this week, inside a transaction that holds the document. */
async function writeLine(conn: PoolConnection, no: number, line: WeekLine): Promise<void> {
  const doc = readWeekDoc(await store.lockDoc(conn, WEEK_DOC));
  await store.writeDoc(conn, WEEK_DOC, withLine(doc, no, line));
}

const lineOf = (text: string, goal: SeasonGoalRef | null, thisWeek: string, sessionId: number | null, now: Date): WeekLine => ({
  weekOf: thisWeek,
  text,
  servesGoalId: goal?.id ?? null,
  servesGoal: goal?.text ?? null,
  outcome: null,
  sessionId,
  setAt: now.toISOString(),
});

/** A member sets their own top priority for this week, from their profile. */
export async function setOwnLine(
  pool: Pool,
  no: number,
  body: unknown,
  goals: readonly SeasonGoalRef[],
  thisWeek: string,
  now = new Date(),
): Promise<Outcome<null>> {
  const c = cleanWeekLine(body, goals);
  if (!c.ok) return refuse(400, c.error);
  await inTransaction(pool, (conn) => writeLine(conn, no, lineOf(c.text, c.goal, thisWeek, null, now)));
  return done(null);
}

/** Each person here and their line, for a meeting's top priority section. */
export async function roomTops(
  q: Pool | PoolConnection,
  people: readonly { no: number; name: string }[],
  goals: readonly SeasonGoalRef[],
  thisWeek: string,
): Promise<RoomTops> {
  const doc = readWeekDoc(await store.readDoc(q, WEEK_DOC));
  const oldest = addWeeks(thisWeek, -PRIORITY_LIMITS.carryWeeks);
  return {
    weekOf: thisWeek,
    people: people.map((p) => {
      const line = currentLine(doc.lines[String(p.no)], thisWeek);
      return { no: p.no, name: p.name, line: line && line.weekOf >= oldest ? withGoalWords(line, goals) : null };
    }),
  };
}

/**
 * The Monday round writes a line: a person here sets their own, and the
 * facilitator or the secretary may type one in for anybody here. The caller
 * holds the session row and has checked the room is open and the writer in it.
 */
export async function setLineFor(
  conn: PoolConnection,
  room: { sessionId: number; writerNo: number; hosts: boolean; hereNos: ReadonlySet<number> },
  body: unknown,
  goals: readonly SeasonGoalRef[],
  thisWeek: string,
  now: Date,
): Promise<Outcome<null>> {
  const b = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const forNo = b.forNo == null ? room.writerNo : Number(b.forNo);
  if (!Number.isInteger(forNo) || forNo <= 0) return refuse(400, R.notHere);
  if (forNo !== room.writerNo) {
    if (!room.hosts) return refuse(403, R.ownOnly);
    if (!room.hereNos.has(forNo)) return refuse(400, R.notHere);
  }
  const c = cleanWeekLine(body, goals);
  if (!c.ok) return refuse(400, c.error);
  await writeLine(conn, forNo, lineOf(c.text, c.goal, thisWeek, room.sessionId, now));
  return done(null);
}

/** The Friday read-back marks a line: the person themself, or the facilitator or the secretary. */
export async function markLineFor(
  conn: PoolConnection,
  room: { writerNo: number; hosts: boolean },
  forNo: number,
  body: unknown,
  thisWeek: string,
): Promise<Outcome<null>> {
  if (forNo !== room.writerNo && !room.hosts) return refuse(403, R.ownOnly);
  const raw = body && typeof body === "object" ? (body as Record<string, unknown>).outcome : undefined;
  if (raw !== null && !isPriorityOutcome(raw)) return refuse(400, R.outcome);
  const outcome: PriorityOutcome | null = raw === null ? null : (raw as PriorityOutcome);
  const doc = readWeekDoc(await store.lockDoc(conn, WEEK_DOC));
  const next = withOutcome(doc, forNo, thisWeek, outcome);
  if (!next) return refuse(404, R.noLine);
  await store.writeDoc(conn, WEEK_DOC, next);
  return done(null);
}

/** A member's lines, for their export. */
export async function weekLinesOf(q: Pool | PoolConnection, no: number): Promise<WeekLine[]> {
  return readWeekDoc(await store.readDoc(q, WEEK_DOC)).lines[String(no)] ?? [];
}

/** A member leaves: their lines go. Runs inside the Live Sessions erasure's transaction. */
export async function forgetWeekLines(conn: PoolConnection, no: number): Promise<void> {
  const raw = await store.readDoc(conn, WEEK_DOC);
  if (raw == null) return;
  const doc = readWeekDoc(await store.lockDoc(conn, WEEK_DOC));
  if (!doc.lines[String(no)]) return;
  await store.writeDoc(conn, WEEK_DOC, withoutMember(doc, no));
}

// ── 2. The priority board ───────────────────────────────────────────────────

function cards(items: readonly BoardItem[], goals: readonly SeasonGoalRef[], roleNames: ReadonlyMap<string, string>): BoardCard[] {
  return items.map((i, n) => ({ ...withGoalWords(i, goals), place: n + 1, ownerRole: i.ownerRoleId ? (roleNames.get(i.ownerRoleId) ?? null) : null }));
}

const roleMap = (roles: readonly { id: string; name: string }[]) => new Map(roles.map((r) => [r.id, r.name]));

/** The board for one season as a member reads it. A season with nothing on it reads as an empty list. */
export async function boardPayload(pool: Pool | PoolConnection, season: SeasonRef | null, mayKeep: boolean): Promise<BoardPayload> {
  if (!season) return { season: null, items: [], goals: [], roles: [], mayKeep: false };
  const doc = readBoardDoc(await store.readDoc(pool, BOARD_DOC));
  const roles = await store.boardRoles(pool);
  return {
    season: { id: season.id, name: season.name },
    items: cards(doc.seasons[season.id] ?? [], season.goals, roleMap(roles)),
    goals: season.goals,
    roles: mayKeep ? roles : [],
    mayKeep,
  };
}

function cleanOwner(raw: unknown, roleIds: ReadonlySet<string>): { ok: true; value: string | null } | { ok: false } {
  if (raw == null || raw === "") return { ok: true, value: null };
  return typeof raw === "string" && roleIds.has(raw) ? { ok: true, value: raw } : { ok: false };
}

/** Add a priority to the season's board, at the end. The circle orders it at its next vote. */
export async function addBoardItem(pool: Pool, season: SeasonRef | null, body: unknown): Promise<Outcome<null>> {
  if (!season) return refuse(409, R.noSeason);
  const b = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const text = cleanLine(b.text, PRIORITY_LIMITS.text);
  if (!text) return refuse(400, R.textNeeded);
  const serves = cleanServesGoal(b, season.goals);
  if (!serves.ok) return refuse(400, R.goalUnknown);
  const owner = cleanOwner(b.ownerRoleId, new Set((await store.boardRoles(pool)).map((r) => r.id)));
  if (!owner.ok) return refuse(400, R.roleUnknown);
  return inTransaction(pool, async (conn) => {
    const doc = readBoardDoc(await store.lockDoc(conn, BOARD_DOC));
    const list = doc.seasons[season.id] ?? [];
    if (list.length >= PRIORITY_LIMITS.boardItems) return refuse(409, R.boardFull);
    const item: BoardItem = {
      id: doc.nextId,
      text,
      servesGoalId: serves.value?.id ?? null,
      servesGoal: serves.value?.text ?? null,
      ownerRoleId: owner.value,
      status: "not_started",
      voteSessionId: null,
      voteItemId: null,
    };
    await store.writeDoc(conn, BOARD_DOC, { nextId: doc.nextId + 1, seasons: { ...doc.seasons, [season.id]: [...list, item] } });
    return done(null);
  });
}

/** Change one item's words, goal, owner role or status. Its place is the circle's and moves only in a meeting. */
export async function patchBoardItem(pool: Pool, season: SeasonRef | null, id: number, body: unknown): Promise<Outcome<null>> {
  if (!season) return refuse(409, R.noSeason);
  const b = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const change: Partial<BoardItem> = {};
  if ("text" in b) {
    const text = cleanLine(b.text, PRIORITY_LIMITS.text);
    if (!text) return refuse(400, R.textNeeded);
    change.text = text;
  }
  if ("servesGoalId" in b || "servesGoal" in b) {
    const serves = cleanServesGoal(b, season.goals);
    if (!serves.ok) return refuse(400, R.goalUnknown);
    change.servesGoalId = serves.value?.id ?? null;
    change.servesGoal = serves.value?.text ?? null;
  }
  if ("ownerRoleId" in b) {
    const owner = cleanOwner(b.ownerRoleId, new Set((await store.boardRoles(pool)).map((r) => r.id)));
    if (!owner.ok) return refuse(400, R.roleUnknown);
    change.ownerRoleId = owner.value;
  }
  if ("status" in b) {
    if (!isBoardStatus(b.status)) return refuse(400, R.status);
    change.status = b.status;
  }
  return inTransaction(pool, async (conn) => {
    const doc = readBoardDoc(await store.lockDoc(conn, BOARD_DOC));
    const list = doc.seasons[season.id] ?? [];
    if (!list.some((i) => i.id === id)) return refuse(404, R.itemNotFound);
    const next = list.map((i) => (i.id === id ? { ...i, ...change } : i));
    await store.writeDoc(conn, BOARD_DOC, { ...doc, seasons: { ...doc.seasons, [season.id]: next } });
    return done(null);
  });
}

/** The board as a meeting's vote section reads it. Null when no season runs. */
export async function roomBoard(
  q: Pool | PoolConnection,
  season: SeasonRef | null,
  sessionId: number,
  agenda: readonly { id: number; status: string }[],
  orderSet: boolean,
): Promise<RoomBoard | null> {
  if (!season) return null;
  const doc = readBoardDoc(await store.readDoc(q, BOARD_DOC));
  const items = doc.seasons[season.id] ?? [];
  const live = new Set(agenda.filter((a) => a.status !== "parked").map((a) => a.id));
  const roles = await store.boardRoles(q);
  return {
    items: cards(items, season.goals, roleMap(roles)),
    onAgenda: items.filter((i) => i.voteSessionId === sessionId && i.voteItemId != null && live.has(i.voteItemId)).length,
    orderSet,
  };
}

/**
 * Put the board's open items on this meeting's agenda, each as an ordinary
 * agenda item the room votes like any other. An item already on this agenda
 * is left where it is. The caller holds the session row, has checked the
 * room is open and the writer one of its hosts, and bumps the room after.
 */
export async function putBoardOnAgenda(
  conn: PoolConnection,
  room: { sessionId: number; writerNo: number; orderSet: boolean },
  season: SeasonRef | null,
  now: Date,
): Promise<Outcome<null>> {
  if (!season) return refuse(409, R.noSeason);
  const doc = readBoardDoc(await store.lockDoc(conn, BOARD_DOC));
  const list = doc.seasons[season.id] ?? [];
  const agenda = (await rooms.itemRows(conn, room.sessionId)).map((r) => ({ id: Number(r.id), status: String(r.status), position: Number(r.position) }));
  const here = new Set(agenda.map((a) => a.id));
  const wanted = list.filter((i) => BOARD_OPEN.has(i.status) && !(i.voteSessionId === room.sessionId && i.voteItemId != null && here.has(i.voteItemId)));
  if (!wanted.length) return refuse(409, R.nothingToVote);
  if (agenda.length + wanted.length > SESSION_LIMITS.maxAgenda) return refuse(409, R.agendaFull);
  let position = agenda.reduce((m, a) => Math.max(m, a.position), 0) + 1;
  const linked = new Map<number, number>();
  for (const i of wanted) {
    const itemId = await rooms.insertItem(conn, {
      sessionId: room.sessionId,
      title: i.text.slice(0, SESSION_LIMITS.agendaTitle),
      aim: "explore",
      minutes: LIBRARY_MINUTES.explore,
      position,
      addedByNo: room.writerNo,
      fromSessionId: null,
      now,
    });
    agenda.push({ id: itemId, status: "waiting", position });
    linked.set(i.id, itemId);
    position += 1;
  }
  if (!room.orderSet) await sortByVotes(conn, room.sessionId, agenda.map((a) => ({ ...a, status: a.status as ItemStatus })));
  const next = list.map((i) => (linked.has(i.id) ? { ...i, voteSessionId: room.sessionId, voteItemId: linked.get(i.id)! } : i));
  await store.writeDoc(conn, BOARD_DOC, { ...doc, seasons: { ...doc.seasons, [season.id]: next } });
  return done(null);
}

/** Keep the agenda's order, as the facilitator set it, on the board. */
export async function keepAgendaOrder(
  conn: PoolConnection,
  room: { sessionId: number; orderSet: boolean },
  season: SeasonRef | null,
): Promise<Outcome<null>> {
  if (!season) return refuse(409, R.noSeason);
  if (!room.orderSet) return refuse(409, R.setOrderFirst);
  const doc = readBoardDoc(await store.lockDoc(conn, BOARD_DOC));
  const list = doc.seasons[season.id] ?? [];
  const agenda = (await rooms.itemRows(conn, room.sessionId)).map((r) => ({ id: Number(r.id), status: String(r.status), position: Number(r.position) }));
  const next = boardOrderFromAgenda(list, room.sessionId, agenda);
  await store.writeDoc(conn, BOARD_DOC, { ...doc, seasons: { ...doc.seasons, [season.id]: next } });
  return done(null);
}

// ── 3. An ask's place in line ───────────────────────────────────────────────

/** The places said for these tensions. */
export async function placesFor(q: Pool | PoolConnection, ids: readonly string[]): Promise<Map<string, AskPlace>> {
  const doc = readPlacesDoc(await store.readDoc(q, PLACES_DOC));
  return new Map(ids.filter((id) => doc[id]).map((id) => [id, doc[id]]));
}

/** Say where a tension sits, or clear it with both fields null. The caller has checked the holder. */
export async function writePlace(pool: Pool, id: string, place: AskPlace): Promise<void> {
  await inTransaction(pool, async (conn) => {
    const doc = readPlacesDoc(await store.lockDoc(conn, PLACES_DOC));
    const { [id]: _old, ...rest } = doc;
    await store.writeDoc(conn, PLACES_DOC, place.position == null && place.expectWeek == null ? rest : { ...rest, [id]: place });
  });
}

/** Places for tensions that are no longer waiting are dropped, so the document stays small. */
export async function dropPlaces(pool: Pool, ids: readonly string[]): Promise<void> {
  if (!ids.length) return;
  const raw = await store.readDoc(pool, PLACES_DOC);
  if (raw == null || !ids.some((id) => readPlacesDoc(raw)[id])) return;
  await inTransaction(pool, async (conn) => {
    const doc = readPlacesDoc(await store.lockDoc(conn, PLACES_DOC));
    for (const id of ids) delete doc[id];
    await store.writeDoc(conn, PLACES_DOC, doc);
  });
}
