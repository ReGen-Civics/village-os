/**
 * SEASON PLACES, THE ORCHESTRATION: who a circle's crew is, placing an
 * eligible subject or queueing it, filling places from the waitlist, and
 * telling the crew. The rules are shared/seasonPlaces.ts, the SQL
 * server/repos/seasonPlaces.ts, the doors server/routes/seasonPlaces.ts.
 *
 * A circle's crew is DERIVED, the way the org chart derives a circle's people:
 * every live member holder of an active role whose circle it is. A lapsed
 * seating, a documented holder and a seated agent are not crew.
 */
import type { Pool } from "mysql2/promise";
import {
  CAP_KEY,
  FREE_AFTER_KEY,
  PLACE_NOTICES,
  WHO_KEY,
  subjectKindOf,
  type PlaceSeason,
  type PlaceSubject,
  type SubjectKind,
} from "../../shared/seasonPlaces";
import type { NotifyInput } from "./notify";
import { listOrgAssignments, listOrgRoles, type LapseContext } from "./orgChart";
import { optionalNumberVar, stringVar } from "./variables";
import { circleNames, placeOrQueueOn, positionOf, promoteOn, readPlace, seasonsWithWaiting, withSeasonLock, type StoredPlace } from "../repos/seasonPlaces";
import type { PlaceStatus } from "../../shared/seasonPlaces";

export interface PlaceDeps {
  getPool(): Pool;
  notify(input: NotifyInput): Promise<unknown>;
  lapse(): LapseContext;
  /** The village's seasons, as `seasonState()` in server/index.ts serves them. */
  seasons(): { current: PlaceSeason | null; upcoming: PlaceSeason | null; seasons: PlaceSeason[] };
}

/** The three dials, read where they are used so a vote that moved one is seen at once. */
export const dials = {
  who: (): SubjectKind => subjectKindOf(stringVar(WHO_KEY)),
  freeAfter: (): number | null => optionalNumberVar(FREE_AFTER_KEY),
  cap: (): number | null => optionalNumberVar(CAP_KEY),
};

/** Every circle's crew: circle id to the live members holding a role in it. */
export async function crews(pool: Pool, lapse: LapseContext): Promise<Map<string, string[]>> {
  const roles = await listOrgRoles(pool);
  const circleOf = new Map(roles.filter((r) => r.active && r.circleId).map((r) => [r.id, r.circleId as string]));
  const out = new Map<string, string[]>();
  for (const a of await listOrgAssignments(pool, lapse)) {
    if (a.lapsed || a.holderKind !== "member" || !a.userId || a.isAgent) continue;
    const circle = circleOf.get(a.orgRoleId);
    if (!circle) continue;
    const list = out.get(circle) ?? [];
    if (!list.includes(a.userId)) list.push(a.userId);
    out.set(circle, list);
  }
  return out;
}

/** The people a subject's notices go to, and who may act for it: its crew, or the member. */
export async function candidatesOf(pool: Pool, lapse: LapseContext, kind: SubjectKind, subjectId: string): Promise<string[]> {
  if (kind === "member") return [subjectId];
  return (await crews(pool, lapse)).get(subjectId) ?? [];
}

export async function subjectOf(pool: Pool, place: Pick<StoredPlace, "subjectKind" | "subjectId">): Promise<PlaceSubject> {
  if (place.subjectKind === "member") return { kind: "member", name: "" };
  const names = await circleNames(pool, [place.subjectId]);
  return { kind: "circle", name: names.get(place.subjectId) ?? place.subjectId };
}

export function seasonName(deps: Pick<PlaceDeps, "seasons">, seasonId: string): string {
  const s = deps.seasons().seasons.find((x) => x.id === seasonId);
  return s?.name?.trim() || "the season";
}

export const placeHref = (seasonId: string) => `/season-places?season=${encodeURIComponent(seasonId)}`;

/** The notice kinds a crew hears (shared/notificationKinds.ts), read by the catalogue's producer scan. */
export const CREW_NOTICE_TYPES: Record<"placed" | "waitlisted" | "opened" | "declined", string> = {
  placed: "season_place_placed",
  waitlisted: "season_place_waitlisted",
  opened: "season_place_opened",
  declined: "season_place_declined",
};

export type CrewNotice = keyof typeof CREW_NOTICE_TYPES;

/** Tell a subject's crew one thing, once per (row, kind, person). */
export async function tellCrew(deps: PlaceDeps, place: StoredPlace, kind: CrewNotice, title: string, keyPart: string): Promise<void> {
  const pool = deps.getPool();
  for (const userId of await candidatesOf(pool, deps.lapse(), place.subjectKind, place.subjectId)) {
    await deps.notify({
      userId,
      type: CREW_NOTICE_TYPES[kind],
      title,
      body: null,
      link: placeHref(place.seasonId),
      actorUserId: null,
      dedupeKey: `sp:${place.id}:${keyPart}:${userId}`,
    });
  }
}

/**
 * An eligible subject takes a place, or the waitlist. Runs under the season's
 * lock. Returns what happened, and tells the crew.
 */
export async function admit(
  deps: PlaceDeps,
  placeId: string,
  from: readonly PlaceStatus[],
  decidedBy: string | null,
): Promise<{ result: "taking_part" | "waitlisted" | "moved"; place: StoredPlace | null; position: number | null }> {
  const pool = deps.getPool();
  const before = await readPlace(pool, placeId);
  if (!before) return { result: "moved", place: null, position: null };
  const { result, position } = await withSeasonLock(pool, before.seasonId, async (conn) => {
    const r = await placeOrQueueOn(conn, before, dials.cap(), from, decidedBy);
    return { result: r, position: r === "waitlisted" ? await positionOf(conn, before) : null };
  });
  const place = await readPlace(pool, placeId);
  if (place && result !== "moved") {
    const subject = await subjectOf(pool, place);
    const season = seasonName(deps, place.seasonId);
    // Keyed on the row's created_at, so a subject that withdraws and proposes again is told again.
    const round = place.createdAt.replace(/\D/g, "").slice(0, 14);
    if (result === "taking_part") await tellCrew(deps, place, "placed", PLACE_NOTICES.placed(subject, season), `placed:${round}`);
    else await tellCrew(deps, place, "waitlisted", PLACE_NOTICES.waitlisted(subject, season, position ?? 1), `waitlisted:${round}`);
  }
  return { result, place, position };
}

/** Fill a season's free places from its waitlist, and tell each crew the line reached. */
export async function promoteSeason(deps: PlaceDeps, seasonId: string): Promise<StoredPlace[]> {
  const pool = deps.getPool();
  const promoted = await withSeasonLock(pool, seasonId, (conn) => promoteOn(conn, seasonId, dials.cap()));
  const season = seasonName(deps, seasonId);
  for (const p of promoted) {
    const fresh = (await readPlace(pool, p.id)) ?? p;
    const round = fresh.createdAt.replace(/\D/g, "").slice(0, 14);
    await tellCrew(deps, fresh, "opened", PLACE_NOTICES.opened(await subjectOf(pool, fresh), season), `opened:${round}`);
  }
  return promoted;
}

/** The hourly fill: every season with somebody waiting, so a cap raised by vote fills with nobody pressing anything. */
export async function promoteAll(deps: PlaceDeps): Promise<number> {
  let n = 0;
  for (const seasonId of await seasonsWithWaiting(deps.getPool())) n += (await promoteSeason(deps, seasonId)).length;
  return n;
}
