/**
 * SEASON PLACES: who takes part in a season, how many may, and who waits.
 *
 * A village can ask each circle (or each member, `season_places.who`) to
 * propose taking part, season by season, until it has held a place for
 * `season_places.free_after` seasons. After that it takes part without a
 * proposal. `season_places.cap` caps the places in a season; over it, a
 * circle waits in the order it became eligible, and takes the first place
 * that frees. Everything here is pure: no pool, no clock unless handed one.
 *
 * The rules are worked through in docs/modules/season-places.md. The SQL is
 * server/repos/seasonPlaces.ts and the doors are server/routes/seasonPlaces.ts.
 *
 * ── WHY A PROPOSAL WAITS ON `org.seat` ──────────────────────────────────────
 *
 * Taking part is placing people in the village's season, which is the power
 * the member door for roles already asks (`ADOPTING_POWER`,
 * shared/seatApplications.ts). So the road is the one that door takes: a live
 * holder who is not in the proposing circle adopts it, and where the village
 * holds the power, or nobody outside the circle holds it live, the village
 * votes (`season_place` ballot). Nobody says yes to their own circle.
 */

export const SEASON_PLACES_MODULE = "season-places";

/** The ballot subject a proposal goes to the village under. */
export const SEASON_PLACE = "season_place";

/** The power that adopts a proposal without a vote, the member door's own. */
export const SEASON_PLACE_POWER = "org.seat";

export const WHO_KEY = "season_places.who";
export const FREE_AFTER_KEY = "season_places.free_after";
export const CAP_KEY = "season_places.cap";

export const SUBJECT_KINDS = ["circle", "member"] as const;
export type SubjectKind = (typeof SUBJECT_KINDS)[number];

export const PLACE_STATUSES = ["proposed", "voting", "waitlisted", "taking_part", "declined", "withdrawn"] as const;
export type PlaceStatus = (typeof PLACE_STATUSES)[number];

/** How a subject became eligible: its proposal was adopted, or it had served enough seasons. */
export const ROADS = ["proposal", "served"] as const;
export type Road = (typeof ROADS)[number];

/** A row still in play: waiting on a decision, waiting for a place, or holding one. */
export const LIVE_STATUSES: readonly PlaceStatus[] = ["proposed", "voting", "waitlisted", "taking_part"];

export const WORDS_MAX = 600;

export function isSubjectKind(v: unknown): v is SubjectKind {
  return (SUBJECT_KINDS as readonly string[]).includes(String(v));
}

/** `season_places.who` as stored, read safely: anything unknown is a circle. */
export function subjectKindOf(raw: unknown): SubjectKind {
  return raw === "member" ? "member" : "circle";
}

export interface PlaceSeason {
  id: string;
  name?: string | null;
  startsOn: string;
  endsOn?: string | null;
}

/**
 * The seasons a subject may propose for: the one running today and the next
 * one queued. Earlier seasons are over, and a later one has no dates a crew
 * could plan against yet.
 */
export function openSeasons(state: { current: PlaceSeason | null; upcoming: PlaceSeason | null }): PlaceSeason[] {
  return [state.current, state.upcoming].filter((s): s is PlaceSeason => Boolean(s));
}

/**
 * Which season a request means. An id it names must be an open season; no id
 * means the next season when one is queued, else the one running.
 */
export function targetSeasonOf(
  state: { current: PlaceSeason | null; upcoming: PlaceSeason | null },
  requested: unknown,
): PlaceSeason | null {
  const open = openSeasons(state);
  const id = typeof requested === "string" ? requested.trim() : "";
  if (id) return open.find((s) => s.id === id) ?? null;
  return state.upcoming ?? state.current ?? null;
}

export interface PastPlace {
  seasonId: string;
  status: PlaceStatus;
}

/**
 * SEASONS SERVED BEFORE THE TARGET: the seasons in which the subject held a
 * place, counted once each, taking only those that start before the target.
 *
 * A season the calendar no longer lists still counts: a place held is a fact
 * about the past, and deleting a season from the Season tab does not undo it.
 * The season running today counts too (spec C2), so a circle in its third
 * season proposes for its fourth without needing a proposal.
 */
export function seasonsServed(rows: readonly PastPlace[], seasons: readonly PlaceSeason[], target: PlaceSeason): number {
  const startOf = new Map(seasons.map((s) => [s.id, s.startsOn]));
  const held = new Set<string>();
  for (const r of rows) {
    if (r.status !== "taking_part" || r.seasonId === target.id) continue;
    const start = startOf.get(r.seasonId);
    if (start === undefined || start < target.startsOn) held.add(r.seasonId);
  }
  return held.size;
}

/** The road a subject takes into a season: blank `free_after` means every season needs a proposal. */
export function roadFor(served: number, freeAfter: number | null): Road {
  return freeAfter !== null && freeAfter >= 0 && served >= freeAfter ? "served" : "proposal";
}

/**
 * A place, or the waitlist. A blank cap is no cap; 0 is no places at all
 * (caps fail closed, never "unlimited").
 */
export function placeOrQueue(taken: number, cap: number | null): "taking_part" | "waitlisted" {
  if (cap === null) return "taking_part";
  return taken < cap ? "taking_part" : "waitlisted";
}

/** How many waiting subjects a season can take now. */
export function freePlaces(taken: number, cap: number | null, waiting: number): number {
  if (cap === null) return waiting;
  return Math.max(0, Math.min(waiting, cap - taken));
}

/** Places held over a lowered cap. Nobody is removed; the page says how many. */
export function overCap(taken: number, cap: number | null): number {
  return cap === null ? 0 : Math.max(0, taken - cap);
}

/**
 * The words a crew writes with its proposal, cleaned: control characters out,
 * runs of space folded, at most WORDS_MAX characters.
 */
export function parseWords(raw: unknown): { ok: true; words: string | null } | { ok: false; error: string } {
  if (raw === undefined || raw === null) return { ok: true, words: null };
  if (typeof raw !== "string") return { ok: false, error: "Write the proposal as words." };
  const cleaned = raw.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").replace(/[ \t]+/g, " ").trim();
  if (cleaned.length > WORDS_MAX) return { ok: false, error: `Keep it to ${WORDS_MAX} characters. This is ${cleaned.length}.` };
  return { ok: true, words: cleaned || null };
}

/**
 * WHO DECIDES, the member door's rule over the candidates. A proposal waits on
 * a live holder of the power who is not one of the candidates (for a circle,
 * every live holder in it); with none, it goes to the village.
 */
export function placeAdoptionPath(
  rule: { who: "live-holders"; holders: readonly string[] } | { who: string; holders?: readonly string[] },
  candidates: readonly string[],
): "holder" | "ballot" {
  if (rule.who !== "live-holders") return "ballot";
  const mine = new Set(candidates);
  return (rule.holders ?? []).some((h) => !mine.has(h)) ? "holder" : "ballot";
}

export const STATUS_WORDS: Readonly<Record<PlaceStatus, string>> = {
  proposed: "Waiting on a decision",
  voting: "The village is voting",
  waitlisted: "On the waitlist",
  taking_part: "Taking part",
  declined: "Not this season",
  withdrawn: "Withdrawn",
};

export const ROAD_WORDS: Readonly<Record<Road, string>> = {
  proposal: "Proposed for this season",
  served: "Takes part without a proposal",
};

/**
 * Who a notice or a ballot is about. A circle is named; a member subject is
 * "you" to themselves and "a member" anywhere public, because stored text
 * names no person (constitution III.2).
 */
export interface PlaceSubject {
  kind: SubjectKind;
  /** The circle's name. Unused for a member. */
  name: string;
}

const subjectFor = (s: PlaceSubject) => (s.kind === "member" ? { who: "You", takes: "take", is: "are", does: "do" } : { who: s.name, takes: "takes", is: "is", does: "does" });

/** Notice titles, to the circle's crew or to the member. Never a person's name. */
export const PLACE_NOTICES = {
  placed: (s: PlaceSubject, season: string) => { const w = subjectFor(s); return `${w.who} ${w.takes} part in ${season}.`; },
  waitlisted: (s: PlaceSubject, season: string, position: number) => {
    const w = subjectFor(s);
    return `${season} is full. ${w.who} ${w.is} number ${position} on the waitlist, and you will hear the moment a place opens.`;
  },
  opened: (s: PlaceSubject, season: string) => { const w = subjectFor(s); return `A place opened. ${w.who} ${w.takes} part in ${season}.`; },
  declined: (s: PlaceSubject, season: string) => { const w = subjectFor(s); return `${w.who} ${w.does} not take part in ${season}.`; },
  waiting: (s: PlaceSubject, season: string) =>
    s.kind === "member" ? `A member proposes to take part in ${season}, and it waits on you.` : `${s.name} proposes to take part in ${season}, and it waits on you.`,
} as const;

const publicName = (s: PlaceSubject) => (s.kind === "member" ? "A member" : s.name);

/** The ballot's public title and document: the circle and the season, nothing a member wrote. */
export function placeBallotTitle(s: PlaceSubject, season: string): string {
  return `${publicName(s)} takes part in ${season}`;
}

export function placeBallotDoc(s: PlaceSubject, season: string, served: number): string {
  const who = s.kind === "member" ? "a member" : s.name;
  const history =
    served === 0 ? "It has not held a place in an earlier season." : `It has held a place in ${served} earlier ${served === 1 ? "season" : "seasons"}.`;
  return `A vote on whether ${who} takes part in ${season}. ${history} If it carries, it takes a place, or the first place that frees when the season is full.`;
}
