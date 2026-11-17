/**
 * Live Sessions: a circle's rhythm, against `live_session_rhythms`
 * (server/repos/sessionRhythm.ts). The doors are server/routes/sessionRhythm.ts;
 * the list door (server/routes/liveSessions.ts) folds "Coming up" in. The
 * shapes, the rights, the arithmetic and the words are shared/sessionRhythm.ts.
 *
 * ── WHAT LIVES HERE ──────────────────────────────────────────────────────
 *
 *   comingUpFor        every circle's next meeting, as one viewer reads it
 *   setRhythm          set, change or stop one of a circle's rhythms
 *   addRhythm          add another rhythm to a circle (0401)
 *   skipMeeting        skip one coming meeting of one rhythm
 *   circleSummary      one circle's sessions, for its home page
 *   runComingUpNotes   the day-before notice, from the hourly job
 *   circleMemberUserIds  who a circle's members are, for that notice
 *   attachOwnCalendarFor / detachOwnCalendarFor / filterOwnCalendarFor  a circle's own calendar
 *
 * ── A CIRCLE'S NEXT MEETING ──────────────────────────────────────────────
 *
 * The soonest of its rhythms' next meetings and the next one on its own
 * calendar, when it has attached one (server/lib/circleOwnCalendar.ts). Coming
 * up, the circle's summary and the day-before notice all ask `nextOf`, so the
 * three never disagree. A skip names a rhythm's meeting only; a meeting from
 * the circle's own calendar is skipped in that calendar.
 *
 * ── SEVERAL RHYTHMS (0401) ───────────────────────────────────────────────
 *
 * A circle keeps up to `RHYTHM_LIMITS.perCircle` named rhythms. The first is
 * the 0271 row (key `MAIN_RHYTHM`); the others are `live_session_more_rhythms`.
 * Each keeps its own skips in its own recurrence. A door that names no rhythm
 * means the first one, the way it did before there were several, so an older
 * page keeps working; a skip that names none finds the rhythm by the date.
 *
 * ── WHO KEEPS IT ─────────────────────────────────────────────────────────
 *
 * The circle's members (standing: its last meeting, or one of its seats now,
 * server/lib/circleStanding.ts) and admins, through `mayKeepRhythm` in the
 * contract. Anybody may read when a circle meets; the count of agenda items
 * waiting for it counts only what the viewer may see (`canSeeBrought`).
 *
 * ── NOTHING HERE OPENS A ROOM ────────────────────────────────────────────
 *
 * A meeting coming up is an invitation. A person opens the room from the
 * start card, the way a person closes it, so a rhythm nobody keeps any more
 * never fills the list with empty rooms.
 */
import type { Pool, PoolConnection } from "mysql2/promise";
import * as room from "../repos/liveSessions";
import * as store from "../repos/sessionRhythm";
import * as library from "../repos/sessionLibrary";
import { listOrgAssignments, listOrgRoles, type LapseContext } from "./orgChart";
import { ensureMemberNo, memberNo, type Outcome, type Refusal } from "./liveSessions";
import { keptSeat, standingIn } from "./circleStanding";
import { libraryViewer, mapLibrary } from "./sessionLibrary";
import { attachOwnCalendar, detachOwnCalendar, filterOwnCalendar, importedNext, ownCalendars, ownCalendarsAvailable, type ImportedMeeting, type OwnCalendar } from "./circleOwnCalendar";
import { civilParts } from "../../shared/lunar";
import { OWN_CALENDAR_COPY, OWN_CALENDAR_REFUSALS, type OwnCalendarView } from "../../shared/sessionCalendar";
import { villageTimezone } from "./villageReaders";
import { attachGatherings, type GatheringDeps } from "./sessionGathering";
import { effectiveLifecycle } from "./modules";
import { LIFECYCLE_RANK, type ModuleLifecycle } from "../../shared/modules";
import { numberVar } from "./variables";
import { nextInWindow } from "../../shared/comms/quietHours";
import { canSeeBrought, waitsForMeeting, type LibraryViewer } from "../../shared/sessionLibrary";
import { randomBytes } from "node:crypto";
import { liveHoldersOf, liveSeatIdsFor } from "../../shared/sessionTasks";
import type { Recurrence } from "../../shared/gatherings";
import {
  MAIN_RHYTHM,
  RHYTHM_LIMITS,
  RHYTHM_NOTICES,
  RHYTHM_REFUSALS,
  cleanRhythm,
  comingLink,
  keptSkips,
  keyOf,
  mayKeepRhythm,
  meetingPhrase,
  meetingWords,
  namedRhythmWords,
  nextMeetings,
  readRhythmKey,
  rhythmAsInput,
  rhythmForSkip,
  rhythmRecord,
  rhythmWords,
  soonestOf,
  type CircleSessionsSummary,
  type ComingUpPayload,
  type ComingUpRow,
  type Meeting,
  type RhythmInput,
  type RhythmKind,
  type RhythmLine,
  type StoredRhythm,
} from "../../shared/sessionRhythm";

const refuse = (status: number, error: string): Refusal => ({ ok: false, status, error });
const done = <T>(value: T): Outcome<T> => ({ ok: true, value });

const toKey = (v: unknown): string => (v instanceof Date ? v.toISOString().slice(0, 10) : String(v ?? ""));

const toIso = (v: unknown): string | null => {
  if (v == null) return null;
  const d = v instanceof Date ? v : new Date(String(v));
  return Number.isFinite(d.getTime()) ? d.toISOString() : null;
};

/** What the rules need from the routes: the live circles, whose seat terms still run, and the bell. */
export interface RhythmDeps extends GatheringDeps {
  circles: () => { id: string; name: string }[];
  lapseContext?: () => LapseContext;
  /** For a test: what reading a circle's own calendar returns. Absent: the guarded fetch. */
  fetchCalendarText?: (url: string) => Promise<string>;
}

export interface RhythmNoticeDeps extends RhythmDeps {
  getPool: () => Pool;
  notify(input: { userId: string; type: string; title: string; body?: string | null; link?: string | null; dedupeKey: string }): Promise<unknown>;
  /** For a test: the daytime window. Absent: the village's own quiet hours. */
  window?: () => { start: number; end: number };
  /** For a test: the module's lifecycle. */
  lifecycle?: () => string;
}

export interface RhythmAsker {
  userId: string;
  admin: boolean;
}

export function mapRhythm(r: Record<string, unknown>): StoredRhythm {
  let recurrence: Recurrence | null = null;
  if (r.recurrence != null && r.recurrence !== "") {
    try {
      recurrence = JSON.parse(String(r.recurrence)) as Recurrence;
    } catch {
      recurrence = null;
    }
  }
  const kind = String(r.kind);
  return {
    circleId: String(r.circle_id),
    rhythmKey: r.rhythm_key ? String(r.rhythm_key) : MAIN_RHYTHM,
    name: String(r.name ?? ""),
    kind: (kind === "weekly" || kind === "moon" || kind === "once" ? kind : "once") as RhythmKind,
    recurrence,
    startsOn: toKey(r.starts_on),
    time: String(r.time_of_day ?? ""),
    durationMin: Number(r.duration_min),
  };
}

/** Every circle's rhythms, by circle, each circle's first rhythm first, live circles only. */
export function rhythmsByCircle(rows: readonly Record<string, unknown>[], live?: { has(id: string): boolean }): Map<string, StoredRhythm[]> {
  const out = new Map<string, StoredRhythm[]>();
  for (const r of rows.map(mapRhythm)) {
    if (live && !live.has(r.circleId)) continue;
    const list = out.get(r.circleId) ?? [];
    list.push(r);
    out.set(r.circleId, list);
  }
  return out;
}

// ── The viewer, and what waits for each circle ──────────────────────────────

/**
 * The asker: the library's reading of them (which items they may see; an
 * admin sees all), and the circles they belong to, measured for admins too,
 * so an admin who sits in a circle still finds it first.
 */
async function viewerOf(pool: Pool, who: RhythmAsker, deps: RhythmDeps): Promise<{ no: number | null; lib: LibraryViewer; own: Set<string> }> {
  const no = await memberNo(pool, who.userId);
  const lib = await libraryViewer(pool, { userId: who.userId, no, admin: who.admin }, deps);
  const own = who.admin
    ? await standingIn(pool, { no, liveSeatIds: liveSeatIdsFor(await listOrgAssignments(pool, deps.lapseContext?.()), who.userId) })
    : new Set(lib.standing);
  return { no, lib, own };
}

/** The waiting agenda items of each circle this viewer may see: the circle and the meeting each waits for. */
type Waiting = { circleId: string; rhythmKey: string | null }[];

async function waitingItems(pool: Pool, v: { no: number | null; lib: LibraryViewer }): Promise<Waiting> {
  const rows = (await library.liveRows(pool, { admin: v.lib.admin, no: v.no, standing: Array.from(v.lib.standing), limit: 500 })).map(mapLibrary);
  return rows
    .filter((r) => r.status === "waiting" && r.circleId != null && canSeeBrought(r, v.lib))
    .map((r) => ({ circleId: r.circleId!, rhythmKey: r.rhythmKey }));
}

/** How many of them wait for a circle at all. */
function waitingIn(items: Waiting, circleId: string): number {
  return items.filter((i) => i.circleId === circleId).length;
}

/** The open room of each circle, the newest when there are several. */
async function openRooms(pool: Pool): Promise<Map<string, { id: number; title: string }>> {
  const out = new Map<string, { id: number; title: string }>();
  for (const r of await room.openSessionRows(pool, 50)) {
    if (r.circle_id == null) continue;
    const circleId = String(r.circle_id);
    if (!out.has(circleId)) out.set(circleId, { id: Number(r.id), title: String(r.title ?? "") });
  }
  return out;
}

/**
 * A circle's next meeting: the sooner of its rhythm's and its own calendar's,
 * with where it came from. `fromRhythm` is the rhythm's own next meeting,
 * which the Change form starts from whichever came first.
 */
export function nextOf(
  rs: StoredRhythm | readonly StoredRhythm[] | null,
  imported: ImportedMeeting | null,
  now: Date,
  zone: string,
): { next: Meeting; from: "rhythm" | "calendar"; title: string | null; durationMin: number; fromRhythm: Meeting | null; rhythm: StoredRhythm | null } | null {
  const list = rs == null ? [] : Array.isArray(rs) ? rs : [rs as StoredRhythm];
  const soonest = soonestOf(list, now, zone);
  const fromRhythm = soonest?.meeting ?? null;
  const rhythm = soonest?.rhythm ?? null;
  if (imported && (!fromRhythm || Date.parse(imported.meeting.at) < Date.parse(fromRhythm.at))) {
    return { next: imported.meeting, from: "calendar", title: imported.title, durationMin: imported.durationMin, fromRhythm, rhythm };
  }
  return fromRhythm && rhythm ? { next: fromRhythm, from: "rhythm", title: null, durationMin: rhythm.durationMin, fromRhythm, rhythm } : null;
}

/**
 * Each of a circle's rhythms as "Coming up" lists it, soonest first; one with
 * nothing coming goes last, so its keepers can still change or remove it.
 * `waiting` counts the items for that meeting and those for any meeting.
 */
export function rhythmLines(rs: readonly StoredRhythm[], now: Date, zone: string, waiting: Waiting): RhythmLine[] {
  const keys = new Set(rs.map(keyOf));
  const lines = rs.map((r): RhythmLine => {
    const next = nextMeetings(r, now, zone, 1)[0] ?? null;
    const key = keyOf(r);
    return {
      key,
      name: r.name ?? "",
      words: rhythmWords(r, now, zone),
      next: next ? { ...next, words: meetingWords(new Date(next.at), now, zone) } : null,
      durationMin: r.durationMin,
      waiting: waiting.filter((i) => i.circleId === r.circleId && waitsForMeeting(i.rhythmKey, key, keys)).length,
      input: rhythmAsInput(r, next?.key),
    };
  });
  const at = (l: RhythmLine) => (l.next ? Date.parse(l.next.at) : Number.POSITIVE_INFINITY);
  return lines.map((l, i) => ({ l, i })).sort((a, b) => at(a.l) - at(b.l) || a.i - b.i).map((x) => x.l);
}

/** "18:00": a meeting's time of day in the village's zone, for a notice's key. */
const timeOfDay = (at: string, zone: string): string => {
  const p = civilParts(new Date(at), zone);
  return `${String(p.hour).padStart(2, "0")}:${String(p.minute).padStart(2, "0")}`;
};

function rowFor(
  rs: readonly StoredRhythm[],
  imported: ImportedMeeting | null,
  circle: { id: string; name: string },
  now: Date,
  zone: string,
  ctx: { waiting: Waiting; rooms: Map<string, { id: number; title: string }>; lib: LibraryViewer; own: Set<string> },
): ComingUpRow | null {
  const n = nextOf(rs, imported, now, zone);
  if (!n) return null;
  // An admin is no circle's member by being an admin: their own circles come first only through standing.
  const mine = ctx.own.has(circle.id);
  // A rhythm with nothing coming (a single meeting already past) says nothing about this row.
  // Soonest first, the order the rhythms are listed in.
  const nextAt = (r: StoredRhythm) => Date.parse(nextMeetings(r, now, zone, 1)[0]?.at ?? "");
  const comingRs = rs.filter((r) => nextMeetings(r, now, zone, 1).length > 0).sort((a, b) => nextAt(a) - nextAt(b));
  const first = rs.find((r) => keyOf(r) === MAIN_RHYTHM) ?? null;
  const firstLive = first && comingRs.includes(first) ? first : null;
  // The first rhythm for an older page; with no first rhythm, the soonest, so its Change still opens on one.
  const formRhythm = firstLive ?? n.rhythm;
  const lines = rhythmLines(rs, now, zone, ctx.waiting);
  return {
    circleId: circle.id,
    circleName: circle.name,
    rhythmWords: comingRs.length
      ? comingRs.length === 1 && !comingRs[0].name
        ? rhythmWords(comingRs[0], now, zone)
        : comingRs.map((r) => namedRhythmWords(r, now, zone)).join("; ")
      : OWN_CALENDAR_COPY.fromOwnCalendar,
    next: n.next,
    nextFrom: n.from,
    nextTitle: n.title,
    rhythmNext: n.fromRhythm ? { ...n.fromRhythm, words: meetingWords(new Date(n.fromRhythm.at), now, zone) } : null,
    words: meetingWords(new Date(n.next.at), now, zone),
    durationMin: n.durationMin,
    waiting: waitingIn(ctx.waiting, circle.id),
    openRoom: ctx.rooms.get(circle.id) ?? null,
    mine,
    canKeep: mayKeepRhythm(circle.id, ctx.lib),
    rhythm: formRhythm ? rhythmAsInput(formRhythm, nextMeetings(formRhythm, now, zone, 1)[0]?.key) : { kind: "none" },
    rhythms: lines,
    nextRhythmKey: n.from === "rhythm" && n.rhythm ? keyOf(n.rhythm) : null,
    nextName: n.from === "rhythm" && n.rhythm?.name ? n.rhythm.name : null,
  };
}

/** The meetings from each circle's own calendar, read once for a whole list. */
async function ownMeetings(pool: Pool, now: Date, zone: string, only?: string): Promise<{ owned: Map<string, OwnCalendar>; imported: Map<string, ImportedMeeting> }> {
  const all = await ownCalendars(pool);
  const owned = only ? new Map(all.has(only) ? [[only, all.get(only)!]] : []) : all;
  return { owned, imported: await importedNext(pool, owned, now, zone) };
}

// ── Coming up ───────────────────────────────────────────────────────────────

/**
 * Every live circle's next meeting, the viewer's own circles first, then by
 * when. A circle whose last single meeting has gone has nothing coming up and
 * is left out until somebody sets it again.
 */
export async function comingUpFor(pool: Pool, who: RhythmAsker, deps: RhythmDeps, now = new Date()): Promise<ComingUpPayload> {
  const zone = villageTimezone();
  const circles = new Map(deps.circles().map((c) => [c.id, c]));
  const v = await viewerOf(pool, who, deps);
  const keepCircleIds = Array.from(circles.keys()).filter((id) => mayKeepRhythm(id, v.lib));
  const rhythms = rhythmsByCircle(await store.rhythmRows(pool), circles);
  const { owned, imported } = await ownMeetings(pool, now, zone);
  // A circle's own calendar shows only to those who may keep it: its address is the circle's business.
  const ownCalendarViews: Record<string, OwnCalendarView> = {};
  for (const o of Array.from(owned.values())) if (keepCircleIds.includes(o.circleId)) ownCalendarViews[o.circleId] = o.view;
  const ids = Array.from(circles.keys()).filter((id) => rhythms.has(id) || imported.has(id));
  const available = ownCalendarsAvailable();
  if (!ids.length) return { rows: [], zone, keepCircleIds, ownCalendars: ownCalendarViews, ownCalendarsAvailable: available };
  const ctx = { waiting: await waitingItems(pool, v), rooms: await openRooms(pool), lib: v.lib, own: v.own };
  const rows = ids
    .map((id) => rowFor(rhythms.get(id) ?? [], imported.get(id) ?? null, circles.get(id)!, now, zone, ctx))
    .filter((r): r is ComingUpRow => r != null)
    .sort((a, b) => Number(b.mine) - Number(a.mine) || Date.parse(a.next.at) - Date.parse(b.next.at));
  // "I'll be there": the gatherings' own `going` for each next meeting (server/lib/sessionGathering.ts).
  await attachGatherings(pool, rows, who, deps);
  return { rows, zone, keepCircleIds, ownCalendars: ownCalendarViews, ownCalendarsAvailable: available };
}

/** One circle's row as "Coming up" shows it, or null when nothing is coming. */
async function oneRow(pool: Pool, circleId: string, who: RhythmAsker, deps: RhythmDeps, now: Date): Promise<ComingUpRow | null> {
  const circle = deps.circles().find((c) => c.id === circleId);
  const zone = villageTimezone();
  const rs = (await store.circleRhythmRows(pool, circleId)).map(mapRhythm);
  const { imported } = await ownMeetings(pool, now, zone, circleId);
  if (!circle || (!rs.length && !imported.has(circleId))) return null;
  const v = await viewerOf(pool, who, deps);
  const ctx = { waiting: await waitingItems(pool, v), rooms: await openRooms(pool), lib: v.lib, own: v.own };
  const one = rowFor(rs, imported.get(circleId) ?? null, circle, now, zone, ctx);
  if (one) await attachGatherings(pool, [one], who, deps);
  return one;
}

// ── A circle's own calendar ─────────────────────────────────────────────────

/**
 * Attach a circle's own calendar, or a different one in its place: the
 * circle's members and admins. Refused in this order: a circle that is not a
 * live one (400), a viewer who may not keep it (403), then whatever the
 * subscription says of the address (400). Read at once.
 */
export async function attachOwnCalendarFor(
  pool: Pool,
  who: RhythmAsker,
  circleId: string,
  raw: unknown,
  deps: RhythmDeps,
  now = new Date(),
): Promise<Outcome<{ ownCalendar: OwnCalendarView; read: boolean; row: ComingUpRow | null }>> {
  const circle = deps.circles().find((c) => c.id === circleId);
  if (!circle) return refuse(400, RHYTHM_REFUSALS.circleUnknown);
  const v = await viewerOf(pool, who, deps);
  if (!mayKeepRhythm(circleId, v.lib)) return refuse(403, OWN_CALENDAR_REFUSALS.notYours);
  const setByNo = v.no ?? (await ensureMemberNo(pool, who.userId, now));
  const out = await attachOwnCalendar(pool, { circleId, circleName: circle.name, raw, userId: who.userId, setByNo, zone: villageTimezone(), now, fetchText: deps.fetchCalendarText });
  if (!out.ok) return out;
  return done({ ownCalendar: out.value.view, read: out.value.read, row: await oneRow(pool, circleId, who, deps, now) });
}

/** Change which titles of a circle's own calendar count as its meetings (0401): the circle's members and admins. */
export async function filterOwnCalendarFor(
  pool: Pool,
  who: RhythmAsker,
  circleId: string,
  raw: unknown,
  deps: RhythmDeps,
  now = new Date(),
): Promise<Outcome<{ ownCalendar: OwnCalendarView; row: ComingUpRow | null }>> {
  if (!deps.circles().some((c) => c.id === circleId)) return refuse(400, RHYTHM_REFUSALS.circleUnknown);
  const v = await viewerOf(pool, who, deps);
  if (!mayKeepRhythm(circleId, v.lib)) return refuse(403, OWN_CALENDAR_REFUSALS.notYours);
  const out = await filterOwnCalendar(pool, circleId, raw);
  if (!out.ok) return out;
  return done({ ownCalendar: out.value.view, row: await oneRow(pool, circleId, who, deps, now) });
}

/** Detach a circle's own calendar: the circle's members and admins. */
export async function detachOwnCalendarFor(pool: Pool, who: RhythmAsker, circleId: string, deps: RhythmDeps, now = new Date()): Promise<Outcome<{ row: ComingUpRow | null }>> {
  if (!deps.circles().some((c) => c.id === circleId)) return refuse(400, RHYTHM_REFUSALS.circleUnknown);
  const v = await viewerOf(pool, who, deps);
  if (!mayKeepRhythm(circleId, v.lib)) return refuse(403, OWN_CALENDAR_REFUSALS.notYours);
  const out = await detachOwnCalendar(pool, circleId, who.userId);
  if (!out.ok) return out;
  return done({ row: await oneRow(pool, circleId, who, deps, now) });
}

// ── Setting and skipping ────────────────────────────────────────────────────

/** Did the body name this field at all? An older page never sends a name, and its save keeps the one there. */
const sent = (raw: unknown, k: string): boolean =>
  !!raw && typeof raw === "object" && Object.prototype.hasOwnProperty.call(raw, k) && (raw as Record<string, unknown>)[k] !== undefined;

/** A `rhythmKey` the body sent: absent is the first rhythm, and one that does not read is refused. */
function sentKey(raw: unknown): { ok: true; key: string } | { ok: false } {
  if (!sent(raw, "rhythmKey") || (raw as Record<string, unknown>).rhythmKey === "") return { ok: true, key: MAIN_RHYTHM };
  const key = readRhythmKey((raw as Record<string, unknown>).rhythmKey);
  return key ? { ok: true, key } : { ok: false };
}

/** Write one rhythm whole, the first in its own table and the others in theirs. */
async function writeRhythm(
  conn: PoolConnection,
  circleId: string,
  key: string,
  old: StoredRhythm | null,
  value: Exclude<RhythmInput, { kind: "none" }>,
  name: string,
  setByNo: number,
  now: Date,
  zone: string,
): Promise<Outcome<null>> {
  const asked = value.kind === "weekly" && !value.startsOn && old?.recurrence?.freq === "weekly" ? { ...value, startsOn: nextMeetings(old, now, zone, 1)[0]?.key } : value;
  const record = rhythmRecord(asked, now, zone);
  if (!record.ok) return refuse(record.status, record.error);
  const skips = keptSkips(old?.recurrence ?? null, record.value, now, zone);
  const recurrence = record.value.recurrence ? { ...record.value.recurrence, ...(skips.length ? { exceptions: skips } : {}) } : null;
  const row = {
    circleId,
    name,
    kind: record.value.kind,
    recurrence: recurrence ? JSON.stringify(recurrence) : null,
    startsOn: record.value.startsOn,
    time: record.value.time,
    durationMin: record.value.durationMin,
    setByNo,
    now,
  };
  if (key === MAIN_RHYTHM) await store.putRhythm(conn, row);
  else await store.putMoreRhythm(conn, key, row);
  return done(null);
}

/**
 * Set one of a circle's rhythms, change it, or stop it (`{ kind: "none" }`):
 * the circle's members and admins. The body's `rhythmKey` names which; with
 * none it is the circle's first rhythm, which is all an older page knows of.
 * Refused in this order: a circle that is not a live one (400), a body that
 * does not read (400), a viewer who may not keep it (403), a further rhythm
 * the circle does not have (404), a time already gone or a first meeting too
 * far ahead (400).
 *
 * A change keeps the circle's week: a weekly rhythm sent with no first date
 * starts from the next meeting the old one had (the page always sends that
 * date). It keeps the skipped meetings still among its next ones, so a new
 * time leaves a skipped date skipped, and it keeps the rhythm's name when the
 * body sends none. The row is locked while it is read and written, the way a
 * skip takes it. Stopping one rhythm leaves the circle's others as they are.
 */
export async function setRhythm(
  pool: Pool,
  who: RhythmAsker,
  circleId: string,
  raw: unknown,
  deps: RhythmDeps,
  now = new Date(),
): Promise<Outcome<{ row: ComingUpRow | null }>> {
  if (!deps.circles().some((c) => c.id === circleId)) return refuse(400, RHYTHM_REFUSALS.circleUnknown);
  const input = cleanRhythm(raw);
  if (!input.ok) return refuse(input.status, input.error);
  const which = sentKey(raw);
  if (!which.ok) return refuse(400, RHYTHM_REFUSALS.rhythmUnknown);
  const key = which.key;
  const v = await viewerOf(pool, who, deps);
  if (!mayKeepRhythm(circleId, v.lib)) return refuse(403, RHYTHM_REFUSALS.notYours);
  if (input.value.kind === "none") {
    await store.deleteRhythm(pool, circleId, key);
    return done({ row: key === MAIN_RHYTHM && !(await store.circleRhythmRows(pool, circleId)).length ? null : await oneRow(pool, circleId, who, deps, now) });
  }
  const zone = villageTimezone();
  const value = input.value;
  const setByNo = v.no ?? (await ensureMemberNo(pool, who.userId, now));
  const out = await room.inTransaction(pool, async (conn: PoolConnection): Promise<Outcome<null>> => {
    const rows = (await store.circleRhythmRows(conn, circleId, true)).map(mapRhythm);
    const old = rows.find((r) => keyOf(r) === key) ?? null;
    if (!old && key !== MAIN_RHYTHM) return refuse(404, RHYTHM_REFUSALS.rhythmUnknown);
    const name = sent(raw, "name") ? (value.name ?? "") : (old?.name ?? "");
    return writeRhythm(conn, circleId, key, old, value, name, setByNo, now, zone);
  });
  if (!out.ok) return out;
  return done({ row: await oneRow(pool, circleId, who, deps, now) });
}

/** A further rhythm's key: short, lowercase, never the first rhythm's. */
function newRhythmKey(): string {
  return `r${randomBytes(5).toString("hex")}`;
}

/**
 * Add another rhythm to a circle (0401), with its own name, day, time and
 * length: the circle's members and admins. A circle with no first rhythm gets
 * this one as its first, so an older page reads it. Refused like a set, and
 * with 409 once the circle keeps `RHYTHM_LIMITS.perCircle`. The circle's rows
 * are locked while they are counted, so two adds at once count each other.
 */
export async function addRhythm(
  pool: Pool,
  who: RhythmAsker,
  circleId: string,
  raw: unknown,
  deps: RhythmDeps,
  now = new Date(),
): Promise<Outcome<{ row: ComingUpRow | null; rhythmKey: string }>> {
  if (!deps.circles().some((c) => c.id === circleId)) return refuse(400, RHYTHM_REFUSALS.circleUnknown);
  const input = cleanRhythm(raw);
  if (!input.ok) return refuse(input.status, input.error);
  if (input.value.kind === "none") return refuse(400, RHYTHM_REFUSALS.kindNeeded);
  const v = await viewerOf(pool, who, deps);
  if (!mayKeepRhythm(circleId, v.lib)) return refuse(403, RHYTHM_REFUSALS.notYours);
  const zone = villageTimezone();
  const value = input.value;
  const setByNo = v.no ?? (await ensureMemberNo(pool, who.userId, now));
  const out = await room.inTransaction(pool, async (conn: PoolConnection): Promise<Outcome<string>> => {
    const rows = (await store.circleRhythmRows(conn, circleId, true)).map(mapRhythm);
    if (rows.length >= RHYTHM_LIMITS.perCircle) return refuse(409, RHYTHM_REFUSALS.tooMany);
    const key = rows.some((r) => keyOf(r) === MAIN_RHYTHM) ? newRhythmKey() : MAIN_RHYTHM;
    const wrote = await writeRhythm(conn, circleId, key, null, value, value.name ?? "", setByNo, now, zone);
    return wrote.ok ? done(key) : wrote;
  });
  if (!out.ok) return out;
  return done({ row: await oneRow(pool, circleId, who, deps, now), rhythmKey: out.value });
}

/**
 * Skip one coming meeting: the circle's members and admins. The meeting is
 * named by its key (its village date), and must be one of the next few of its
 * rhythm. `rhythmKey` names the rhythm; without it (an older page) the
 * rhythm is the first whose coming meetings hold that date. A single meeting
 * skipped is that rhythm stopped. The circle's rows are locked while read and
 * written, so two skips at once add two dates and lose neither.
 */
export async function skipMeeting(
  pool: Pool,
  who: RhythmAsker,
  circleId: string,
  raw: unknown,
  deps: RhythmDeps,
  now = new Date(),
): Promise<Outcome<{ row: ComingUpRow | null }>> {
  const key = raw && typeof raw === "object" ? (raw as Record<string, unknown>).key : null;
  if (typeof key !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(key)) return refuse(400, RHYTHM_REFUSALS.skipUnknown);
  const named = sent(raw, "rhythmKey") ? readRhythmKey((raw as Record<string, unknown>).rhythmKey) : null;
  if (sent(raw, "rhythmKey") && !named) return refuse(400, RHYTHM_REFUSALS.rhythmUnknown);
  const v = await viewerOf(pool, who, deps);
  if (!mayKeepRhythm(circleId, v.lib)) return refuse(403, RHYTHM_REFUSALS.notYours);
  const zone = villageTimezone();
  const setByNo = v.no ?? (await ensureMemberNo(pool, who.userId, now));
  const out = await room.inTransaction(pool, async (conn: PoolConnection): Promise<Outcome<null>> => {
    const rows = (await store.circleRhythmRows(conn, circleId, true)).map(mapRhythm);
    if (!rows.length) return refuse(404, RHYTHM_REFUSALS.noRhythm);
    const r = rhythmForSkip(rows, key, named, now, zone);
    if (!r) return named ? refuse(404, RHYTHM_REFUSALS.rhythmUnknown) : refuse(409, RHYTHM_REFUSALS.skipUnknown);
    if (!nextMeetings(r, now, zone, RHYTHM_LIMITS.skipAhead).some((m) => m.key === key)) return refuse(409, RHYTHM_REFUSALS.skipUnknown);
    if (!r.recurrence) {
      await store.deleteRhythm(conn, circleId, keyOf(r));
      return done(null);
    }
    const exceptions = Array.from(new Set([...(r.recurrence.exceptions ?? []), key])).sort();
    await store.writeRecurrence(conn, circleId, JSON.stringify({ ...r.recurrence, exceptions }), setByNo, now, keyOf(r));
    return done(null);
  });
  if (!out.ok) return out;
  return done({ row: await oneRow(pool, circleId, who, deps, now) });
}

// ── One circle's sessions ───────────────────────────────────────────────────

/**
 * One circle's sessions, for its home page: its rhythm in words, its next
 * meeting, when it last met, what waits for it as this viewer may see it,
 * and its open room. A circle that is not a live one answers null.
 */
export async function circleSummary(pool: Pool, circleId: string, who: RhythmAsker, deps: RhythmDeps, now = new Date()): Promise<CircleSessionsSummary | null> {
  if (!deps.circles().some((c) => c.id === circleId)) return null;
  const zone = villageTimezone();
  const v = await viewerOf(pool, who, deps);
  const rs = (await store.circleRhythmRows(pool, circleId)).map(mapRhythm);
  const { imported } = await ownMeetings(pool, now, zone, circleId);
  const next = nextOf(rs, imported.get(circleId) ?? null, now, zone)?.next;
  const lines = rhythmLines(rs, now, zone, []);
  const [last] = await room.lastMeetingPerCircle(pool, { circleIds: [circleId] });
  const [closed] = last ? await store.closedAtRows(pool, [Number(last.id)]) : [];
  return {
    circleId,
    rhythm: rs.length
      ? { words: rs.length === 1 && !rs[0].name ? rhythmWords(rs[0], now, zone) : rs.map((r) => namedRhythmWords(r, now, zone)).join("; "), kind: rs[0].kind }
      : null,
    rhythms: lines.map((l) => ({ key: l.key, name: l.name, words: l.words })),
    next: next ? { ...next, words: meetingWords(new Date(next.at), now, zone) } : null,
    lastMetAt: closed ? toIso(closed.closed_at) : null,
    waiting: waitingIn(await waitingItems(pool, v), circleId),
    openRoom: (await openRooms(pool)).get(circleId) ?? null,
    canKeep: mayKeepRhythm(circleId, v.lib),
  };
}

// ── The day before ──────────────────────────────────────────────────────────

/**
 * A circle's members, as user ids: whoever sits in one of its kept seats now
 * (live and not lapsed), and whoever was in its last meeting. The same two
 * halves standing reads, from the circle's side.
 */
export async function circleMemberUserIds(pool: Pool, circleId: string, lapseContext?: () => LapseContext): Promise<string[]> {
  const out = new Set<string>();
  const seatings = await listOrgAssignments(pool, lapseContext?.());
  for (const role of await listOrgRoles(pool)) {
    if (role.circleId !== circleId || !keptSeat(role)) continue;
    for (const userId of liveHoldersOf(seatings, role.id)) out.add(userId);
  }
  const [last] = await room.lastMeetingPerCircle(pool, { circleIds: [circleId] });
  if (last) {
    const nos = (await store.peopleOfRows(pool, [Number(last.id)])).map((r) => Number(r.member_no));
    for (const r of await room.memberUserIdRows(pool, nos)) out.add(String(r.user_id));
  }
  return Array.from(out);
}

/**
 * Every meeting that starts within the next day, of every rhythm of every
 * circle and of each circle's own calendar: one entry each, its rhythm's key
 * (null for the calendar's) and name, and the circle's rhythm keys, which an
 * agenda item's meeting is read against. Two rhythms meeting at the same
 * instant are one meeting, the first rhythm's.
 */
export function comingWithinADay(
  rhythms: ReadonlyMap<string, readonly StoredRhythm[]>,
  imported: ReadonlyMap<string, ImportedMeeting>,
  circleIds: readonly string[],
  now: Date,
  zone: string,
): { circleId: string; next: Meeting; rhythmKey: string | null; name: string; keys: Set<string> }[] {
  const within = (m: Meeting) => Date.parse(m.at) > now.getTime() && Date.parse(m.at) - now.getTime() <= RHYTHM_LIMITS.remindHours * 3_600_000;
  const out: { circleId: string; next: Meeting; rhythmKey: string | null; name: string; keys: Set<string> }[] = [];
  for (const circleId of circleIds) {
    const rs = rhythms.get(circleId) ?? [];
    const keys = new Set(rs.map(keyOf));
    const seen = new Set<string>();
    for (const r of rs) {
      const m = nextMeetings(r, now, zone, 1)[0];
      if (!m || !within(m) || seen.has(m.at)) continue;
      seen.add(m.at);
      out.push({ circleId, next: m, rhythmKey: keyOf(r), name: r.name ?? "", keys });
    }
    const cal = imported.get(circleId);
    if (cal && within(cal.meeting) && !seen.has(cal.meeting.at)) out.push({ circleId, next: cal.meeting, rhythmKey: null, name: "", keys });
  }
  return out;
}

/** The job's name and pace: hourly, so each meeting's notice goes in the village's daytime the day before. */
export const COMING_UP_JOB = "session-coming-up";
export const COMING_UP_EVERY_MS = 60 * 60 * 1000;

/**
 * The day before a circle meets, each of its members hears when, with what is
 * on the agenda: in the bell, no email (no preference a member has set covers
 * a meeting reminder). Once per meeting per person: the key is
 * `session-coming:<circle>:<date>T<time>:<user>`, so the job can run every
 * hour of the day, and a skipped meeting, or one moved to another day or
 * another time, is a new key. Nothing runs outside the village's daytime
 * window, or before the module is open to members: in preview the page is
 * still the admins' own, and a notice would send a member to a door that
 * refuses them.
 */
export async function runComingUpNotes(deps: RhythmNoticeDeps, now = new Date()): Promise<string> {
  const lifecycle = deps.lifecycle ?? (() => effectiveLifecycle("sessions"));
  if ((LIFECYCLE_RANK[lifecycle() as ModuleLifecycle] ?? 0) < LIFECYCLE_RANK.members) return "the sessions module is not open to members";
  const zone = villageTimezone();
  const hours = deps.window?.() ?? { start: numberVar("comms.quiet_start_hour"), end: numberVar("comms.quiet_end_hour") };
  if (nextInWindow(now, zone, hours.start, hours.end).getTime() !== now.getTime()) return "outside the village's daytime window";
  const pool = deps.getPool();
  const circles = new Map(deps.circles().map((c) => [c.id, c]));
  const rhythms = rhythmsByCircle(await store.rhythmRows(pool), circles);
  const { imported } = await ownMeetings(pool, now, zone);
  const soon = comingWithinADay(rhythms, imported, Array.from(circles.keys()), now, zone);
  if (!soon.length) return "no circle meets in the next day";
  // Everything waiting, read once: a circle's members may read its own items and those for no circle.
  const waiting = (await library.liveRows(pool, { admin: true, no: null, standing: [], limit: 500 })).map(mapLibrary).filter((r) => r.status === "waiting");
  let sent = 0;
  for (const { circleId, next, rhythmKey, name, keys } of soon) {
    const circle = circles.get(circleId)!;
    // An item for one meeting waits for that one; an item for any meeting waits for each.
    const titles = waiting.filter((i) => i.circleId === circleId && waitsForMeeting(i.rhythmKey, rhythmKey, keys)).map((i) => i.title);
    const when = meetingPhrase(new Date(next.at), now, zone);
    const title = name ? RHYTHM_NOTICES.comingUpNamed(circle.name, when, name) : RHYTHM_NOTICES.comingUp(circle.name, when);
    const body = RHYTHM_NOTICES.agenda(titles.slice(0, 3), Math.max(0, titles.length - 3));
    for (const userId of await circleMemberUserIds(pool, circleId, deps.lapseContext)) {
      try {
        const fresh = await deps.notify({
          userId,
          type: "session_coming_up",
          title,
          body,
          link: comingLink(circleId),
          dedupeKey: `session-coming:${circleId}:${next.key}T${timeOfDay(next.at, zone)}:${userId}`,
        });
        if ((fresh as { fresh?: boolean } | null)?.fresh !== false) sent += 1;
      } catch (e) {
        console.error(`[sessions] a coming-up notice for ${circleId} did not go`, e);
      }
    }
  }
  return `${sent} coming-up notice(s) for ${soon.length} meeting(s)`;
}

// ── The member's own ────────────────────────────────────────────────────────

/** The rhythms a member set last, for the export. */
export async function exportRhythmsFor(pool: Pool, no: number): Promise<Record<string, unknown>[]> {
  return (await store.memberRows(pool, no)).map((r) => ({ circleId: String(r.circle_id), rhythm: String(r.rhythm_key ?? MAIN_RHYTHM), setAt: toIso(r.updated_at) }));
}

/** The member leaves, inside the erasure's transaction. */
export async function forgetRhythmsFor(conn: PoolConnection, no: number): Promise<void> {
  await store.forgetMember(conn, no);
}
