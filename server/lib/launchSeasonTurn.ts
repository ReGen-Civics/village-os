/**
 * THE LAUNCH IS THE TURN OF THE SEASON.
 *
 * Rye, 27 Nov 2026: "Yes moon 1 starts the turn of the season when we're
 * live". In the Admin Garden plan (Q5a): "The launch is the turn of the
 * season. Moon 1 starts at that turn, when the village is live."
 *
 * So when the launch vote carries, the NEXT season on the village's calendar
 * begins that day. For the first village that is the Season of Rooting taking
 * over from the Season of Foundations.
 *
 * ── WHAT THE TURN IS, EXACTLY: ONE DATE MOVES ───────────────────────────────
 *
 *   the next season's start   becomes the day the launch carried
 *
 * and nothing else on the calendar is written. It goes through the SAME save
 * the Season tab uses (`saveCalendar`, server/routes/seasons.ts), so
 * everything that follows a calendar save follows this one by one code path:
 * the pulse says the season has turned, and the seat applications waiting on
 * the calendar are swept. There is no second meaning of "the season turned"
 * for the launch to drift from.
 *
 * The season that was running stops being the current one because a later
 * season has begun. That is the hand-over the calendar already has
 * (`seasonState`, server/index.ts: "queueing the next one with a start date is
 * how the founder says this one is done"), and it is the shape the first
 * village is in, with a founding season that has no end date.
 *
 * ── WHY THE OUTGOING SEASON'S END IS NOT WRITTEN ────────────────────────────
 *
 * Writing "the old season ended today" reads tidier and is the wrong act, for
 * a reason that is about people and not about dates. A seat whose term is its
 * season's end MOVES when that end moves (`restampsFor`, shared/seatTerms.ts).
 * A launch carries the moment the third yes lands, with no warning, so ending
 * the outgoing season that day would end every seat that follows it in the
 * same instant: the people holding them would lose their roles, and the
 * powers that came with them, on a day nobody chose and nobody was told
 * about. An application already adopted for the next season keeps the first
 * day it was adopted for, so those seats would then stand empty until it.
 *
 * So no seat's end date moves at a launch, in either direction. Every role
 * keeps the date it was given. A founder who wants the old season's dates
 * tidied does it on the Season tab, where the save says how many roles moved.
 * `server/lib/launchSeasonTurn.test.ts` holds this with a seat that follows the
 * outgoing season, beside the control that shows what writing the end would
 * have done to it, and `server/launchSeasonTurn.routes.e2e.test.ts` holds it
 * through a real launch.
 *
 * ── WHAT FOLLOWS FROM IT ────────────────────────────────────────────────────
 *
 * THE FOUNDING STEWARDS ARE SEATED FOR THE WHOLE NEW SEASON. The launch closer
 * turns the season first and reads the calendar for the seating after it, so
 * `resolveSeatTerm` measures the seat against the season that began at the
 * launch, and the term is that season's end. Without the turn a village whose
 * founding season is open-ended could seat nobody at all: a steward's seat
 * ends with the season at the latest, and an open-ended season has no end.
 *
 * MOON 1 IS THE MOON THE LAUNCH FALLS IN, and that is already how
 * `server/lib/villageMoon.ts` counts: Moon 1 is the lunation containing
 * `launch-state.launchedAt`. The turn does not move it and does not need to.
 *
 * PAY PERIODS DO NOT MOVE. A pay period is keyed by an absolute cycle id
 * (`lunar-000333`), computed from the instant alone. Nothing here reads or
 * writes a cycle, and the same two files prove the keys are identical before
 * and after a launch that turned a season.
 *
 * A VILLAGE THAT NEVER WROTE ITS SEASONS NOW HOLDS A LIST OF ITS OWN. Its
 * calendar was derived from its cadence on every read. Remembering that the
 * next season began early means storing the list, so from the launch on the
 * village keeps the seasons it had that day and adds the following ones on the
 * Season tab, as a village that wrote its own always has.
 *
 * ── THE DAY IS THE DAY THE LAUNCH WAS RECORDED, NEVER "TODAY" ───────────────
 *
 * The launch closer can run twice: a failure anywhere in it parks the ballot
 * and the landing job re-runs it, possibly on a later day. Measured against
 * today, a second run a day later would find the new season already running
 * and pull the season AFTER it forward as well. `recordLaunchCarried` keeps
 * the first instant it wrote, so the day is read from that, and a re-run finds
 * a season that began on the launch day and does nothing.
 *
 * ── WHEN THERE IS NOTHING TO TURN TO ────────────────────────────────────────
 *
 * The launch never fails over its calendar. Two cases turn nothing, and each
 * is said on the admin spine:
 *
 *   a season began that day     the launch falls on a turn already. The season
 *                               that started that day is the new one.
 *   no next season is set       there is nothing to begin. The running season
 *                               carries on, and the seating takes its end if
 *                               it has one.
 *
 * Pure in its first half (`seasonTurnAtLaunch`), so every case is a unit test
 * with no database, and the launch document and the admin preview read the
 * same answer the carry will act on.
 */

/** The fields of a season this reads and writes. Every other field rides through untouched. */
export interface TurnSeason {
  id: string;
  name?: string;
  startsOn: string;
  /** Civil date, exclusive: the day the season turns. Empty means open-ended. */
  endsOn?: string | null;
  [key: string]: unknown;
}

export interface SeasonName {
  id: string;
  name: string;
}

export type LaunchTurn =
  | {
      turned: true;
      /** The launch day in the village's zone, which the next season's start became. */
      day: string;
      /** The season the new one takes over from, or null when none was running. */
      from: (SeasonName & { endsOn: string | null }) | null;
      /** The season that begins on the launch day. */
      to: SeasonName & { endsOn: string | null; wasToStartOn: string };
      /** The whole calendar with the one date moved, in the order it was given. */
      seasons: TurnSeason[];
    }
  | {
      turned: false;
      reason: "began_that_day" | "no_next_season";
      day: string;
      /** The season running on the launch day, or null. */
      running: (SeasonName & { endsOn: string | null }) | null;
    };

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const endOf = (s: TurnSeason): string | null => (s.endsOn && DAY.test(String(s.endsOn)) ? String(s.endsOn) : null);
const named = (s: TurnSeason): SeasonName & { endsOn: string | null } => ({
  id: String(s.id),
  name: String(s.name ?? "").trim() || String(s.id),
  endsOn: endOf(s),
});

/**
 * What the calendar looks like once a launch on `day` has turned the season.
 *
 * `running` is chosen the way `seasonState` chooses it (server/index.ts): the
 * LATEST season that has begun and has not ended, so an open-ended founding
 * season hands over to whatever is queued after it. `next` is the first season
 * that starts after the launch day and has not already ended by it.
 */
export function seasonTurnAtLaunch(seasons: readonly TurnSeason[], day: string): LaunchTurn {
  const dated = seasons.filter((s) => DAY.test(String(s.startsOn ?? "")));
  const sorted = [...dated].sort((a, b) => String(a.startsOn).localeCompare(String(b.startsOn)));
  const runningAll = sorted.filter((s) => s.startsOn <= day && (!endOf(s) || day < (endOf(s) as string)));
  const running = runningAll.length ? runningAll[runningAll.length - 1] : null;
  const runningOut = running ? named(running) : null;

  // The launch falls on the first day of a season: that season is the new one.
  if (running && running.startsOn === day) return { turned: false, reason: "began_that_day", day, running: runningOut };

  const next = sorted.find((s) => s.startsOn > day && (!endOf(s) || (endOf(s) as string) > day)) ?? null;
  if (!next) return { turned: false, reason: "no_next_season", day, running: runningOut };

  return {
    turned: true,
    day,
    from: runningOut,
    to: { ...named(next), wasToStartOn: String(next.startsOn) },
    // One date moves. The outgoing season is left exactly as it was: see the header.
    seasons: seasons.map((s) => (s === next ? { ...s, startsOn: day } : s)),
  };
}

/** What the Season tab's save answers (`saveCalendar`, server/routes/seasons.ts), as far as this reads it. */
export type CalendarSaved =
  | { ok: true; seatsMoved: { permission: number; org: number } }
  | { ok: false; refused: string | null };

export interface SeasonTurnDeps {
  /** The calendar as the village holds it now, derived list included (`getSeasonConfig`). */
  config(): { seasons: TurnSeason[] };
  /** The civil date the launch was recorded on, in the village's zone. Never today: see the header. */
  launchDay(): string;
  /** The Season tab's own save, with whoever closed the vote as the actor. */
  save(body: { seasons: TurnSeason[] }): Promise<CalendarSaved>;
  /** The admin-only event spine. */
  audit(text: string): void;
}

export interface SeasonTurnOutcome {
  turn: LaunchTurn;
  /** True when the calendar now holds the turn. */
  stored: boolean;
  /**
   * Seats the save moved. The turn writes no season's end, so it moves none.
   * The save still answers for the whole calendar, so a seat an earlier save
   * left behind its season is caught up here, and the count says so. Reported
   * so the audit line states it instead of assuming zero.
   */
  seatsMoved: { permission: number; org: number } | null;
  /** Why the calendar could not be stored. The launch stands; the season did not turn. */
  failed: string | null;
}

/**
 * Turn the season at the moment the launch carries.
 *
 * Never throws: a launch that has carried is not refused or retried over its
 * calendar. A turn that could not be stored is recorded on the admin spine,
 * the season carries on as it was, and a founder can begin the next season on
 * the Season tab, which is the same act.
 */
export async function turnSeasonAtLaunch(deps: SeasonTurnDeps): Promise<SeasonTurnOutcome> {
  let turn: LaunchTurn;
  let config: { seasons: TurnSeason[] };
  try {
    config = deps.config();
    turn = seasonTurnAtLaunch(config.seasons ?? [], deps.launchDay());
  } catch (e) {
    console.error("[launch] the season calendar could not be read at the carry (the launch stands)", e);
    deps.audit("launch:season-turn-failed:unreadable");
    return {
      turn: { turned: false, reason: "no_next_season", day: "", running: null },
      stored: false,
      seatsMoved: null,
      failed: e instanceof Error ? e.message : String(e),
    };
  }
  if (!turn.turned) {
    deps.audit(`launch:season-not-turned:${turn.reason}${turn.running ? `:${turn.running.id}` : ""}`);
    return { turn, stored: false, seatsMoved: null, failed: null };
  }
  try {
    const saved = await deps.save({ ...config, seasons: turn.seasons });
    if (!saved.ok && saved.refused !== null) {
      deps.audit(`launch:season-turn-failed:${turn.to.id}`);
      return { turn, stored: false, seatsMoved: null, failed: saved.refused };
    }
    // Stored either way. `ok: false` with no refusal is the save's own
    // "the list saved and moving the roles failed", and no role moves here.
    const seatsMoved = saved.ok ? saved.seatsMoved : null;
    deps.audit(
      `launch:season-turned:${turn.from?.id ?? "none"}->${turn.to.id}:${turn.day}:seats-moved:${seatsMoved ? seatsMoved.permission + seatsMoved.org : "unknown"}`,
    );
    return { turn, stored: true, seatsMoved, failed: null };
  } catch (e) {
    const failed = e instanceof Error ? e.message : String(e);
    console.error("[launch] the season could not be turned at the carry (the launch stands, and the Season tab can begin the next season)", e);
    deps.audit(`launch:season-turn-failed:${turn.to.id}`);
    return { turn, stored: false, seatsMoved: null, failed };
  }
}

const MOON_LINE = "Moon 1 is the moon that day falls in. Pay periods follow the moons as they always have, and none of them moves.";

/**
 * What the frozen launch document says about the season, from the calendar as
 * it stands when the vote opens. The day of the turn is the day the vote
 * carries, which nobody knows yet, so the sentences name the seasons and never
 * a date for the turn itself.
 */
export function seasonTurnLines(seasons: readonly TurnSeason[], today: string): string[] {
  const turn = seasonTurnAtLaunch(seasons, today);
  if (turn.turned) {
    const begins = turn.from
      ? `${turn.to.name} begins that day, taking over from ${turn.from.name}.`
      : `${turn.to.name} begins that day.`;
    const term = turn.to.endsOn
      ? `Whoever is seated as a steward by this vote holds the role for the whole of ${turn.to.name}, until ${turn.to.endsOn}.`
      : `${turn.to.name} has no end date yet, and a steward role ends with its season, so nobody can be seated as a steward until it has one. Give it an end date in Admin, Season before this vote.`;
    return [
      `The day this carries is the turn of the season. ${begins}`,
      term,
      "Nothing else on the calendar moves, and every role anybody holds keeps the end date it was given.",
      MOON_LINE,
    ];
  }
  if (turn.reason === "began_that_day") {
    const until = turn.running?.endsOn ? `, until ${turn.running.endsOn}` : "";
    return [
      `${turn.running?.name ?? "The season"} began today. If this carries today, that is the season the launch begins, and whoever is seated as a steward by this vote holds the role for the whole of it${until}. If it carries on a later day, the season after it begins that day.`,
      "Every role anybody holds keeps the end date it was given.",
      MOON_LINE,
    ];
  }
  return [
    "No next season is on the calendar, so the season does not turn when this carries. Add the next season in Admin, Season before this vote if the launch should begin one.",
    MOON_LINE,
  ];
}
