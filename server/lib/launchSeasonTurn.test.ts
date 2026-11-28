/**
 * THE LAUNCH IS THE TURN OF THE SEASON (Rye, 2026-11-27), with no database.
 *
 * Four things are held here, each against the function the server really
 * calls:
 *
 *   1. ONE DATE MOVES. The next season's start becomes the launch day, and
 *      nothing else on the calendar is written.
 *   2. NO ROLE'S END DATE MOVES, with a control that shows what writing the
 *      outgoing season's end would have done to the people holding its roles.
 *   3. A STEWARD SEATED AFTER THE TURN HOLDS THE WHOLE NEW SEASON, with a
 *      control: before the turn the first village's calendar seats nobody.
 *   4. PAY PERIODS DO NOT MOVE. The cycle id of every instant is the same
 *      string before and after a launch, while the village's own moon count,
 *      which does hang off the launch, starts at 1.
 *
 * `server/launchSeasonTurn.routes.e2e.test.ts` drives the same rule through a
 * real launch vote on the built server.
 */
import { describe, expect, it, vi } from "vitest";
import { seasonTurnAtLaunch, seasonTurnLines, turnSeasonAtLaunch, type CalendarSaved, type TurnSeason } from "./launchSeasonTurn";
import { civilDateInstant, resolveSeatTerm, restampsFor } from "../../shared/seatTerms";
import { LUNAR_CLOCK } from "../../shared/cycleClock";
import { cycleBoundsFor } from "../../shared/lunar";
import { cycleIdFor } from "./gratitude-cycles";
import { cycleKeyFor } from "./economy";
import { anchorCycleFrom, villageMoonFor } from "./villageMoon";

const TZ = "America/Costa_Rica";
const LAUNCH_DAY = "2026-12-30";

/** The first village's shape: a founding season with no end date, and the next one queued. */
const FOUNDATIONS: TurnSeason = { id: "foundations", name: "Season of Foundations", startsOn: "2026-03-01", endsOn: "", theme: "Lay the ground", goals: [{ id: "g1", text: "Open the kitchen" }] };
const ROOTING: TurnSeason = { id: "rooting", name: "Season of Rooting", startsOn: "2027-01-15", endsOn: "2027-04-15", theme: "Take root" };
const BLOOM: TurnSeason = { id: "bloom", name: "Season of Bloom", startsOn: "2027-04-15", endsOn: "2027-07-15" };
const FIRST_VILLAGE = [FOUNDATIONS, ROOTING, BLOOM];

/** A village whose running season has an end date, which is the shape a seat can follow. */
const HARVEST: TurnSeason = { id: "harvest", name: "Season of Harvest", startsOn: "2026-10-01", endsOn: "2027-01-01" };
const DATED_VILLAGE = [HARVEST, { ...ROOTING, startsOn: "2027-01-01" }, BLOOM];

describe("seasonTurnAtLaunch: one date moves", () => {
  it("the first village: the queued season begins on the launch day, taking over from the open-ended one", () => {
    const frozen = JSON.stringify(FIRST_VILLAGE);
    const turn = seasonTurnAtLaunch(FIRST_VILLAGE, LAUNCH_DAY);
    expect(turn.turned).toBe(true);
    if (!turn.turned) return;
    expect(turn.day).toBe(LAUNCH_DAY);
    expect(turn.from).toEqual({ id: "foundations", name: "Season of Foundations", endsOn: null });
    expect(turn.to).toEqual({ id: "rooting", name: "Season of Rooting", endsOn: "2027-04-15", wasToStartOn: "2027-01-15" });
    // THE ONE DATE.
    expect(turn.seasons[1]).toEqual({ ...ROOTING, startsOn: LAUNCH_DAY });
    // Everything else is the very object it was handed: not a copy that happens to match.
    expect(turn.seasons[0]).toBe(FOUNDATIONS);
    expect(turn.seasons[2]).toBe(BLOOM);
    expect(turn.seasons).toHaveLength(3);
    // The founding season still has no end date. The launch does not write one.
    expect(turn.seasons[0].endsOn).toBe("");
    // And the list it was handed is untouched.
    expect(JSON.stringify(FIRST_VILLAGE)).toBe(frozen);
  });

  it("a running season with an end date keeps that date: the launch never writes it", () => {
    const turn = seasonTurnAtLaunch(DATED_VILLAGE, LAUNCH_DAY);
    expect(turn.turned).toBe(true);
    if (!turn.turned) return;
    expect(turn.from).toEqual({ id: "harvest", name: "Season of Harvest", endsOn: "2027-01-01" });
    expect(turn.seasons[0]).toBe(HARVEST);
    expect(turn.seasons[0].endsOn).toBe("2027-01-01");
    expect(turn.seasons[1].startsOn).toBe(LAUNCH_DAY);
    expect(turn.seasons[1].endsOn).toBe("2027-04-15");
  });

  it("a launch on the first day of a season turns nothing: that season is the new one", () => {
    const turn = seasonTurnAtLaunch([FOUNDATIONS, { ...ROOTING, startsOn: LAUNCH_DAY }, BLOOM], LAUNCH_DAY);
    expect(turn).toEqual({ turned: false, reason: "began_that_day", day: LAUNCH_DAY, running: { id: "rooting", name: "Season of Rooting", endsOn: "2027-04-15" } });
  });

  it("with no next season nothing turns, and the running season is named", () => {
    expect(seasonTurnAtLaunch([FOUNDATIONS], LAUNCH_DAY)).toEqual({
      turned: false, reason: "no_next_season", day: LAUNCH_DAY, running: { id: "foundations", name: "Season of Foundations", endsOn: null },
    });
    expect(seasonTurnAtLaunch([], LAUNCH_DAY)).toEqual({ turned: false, reason: "no_next_season", day: LAUNCH_DAY, running: null });
  });

  it("a village between seasons begins the next one, taking over from nothing", () => {
    const turn = seasonTurnAtLaunch([{ ...HARVEST, endsOn: "2026-12-01" }, ROOTING], LAUNCH_DAY);
    expect(turn.turned).toBe(true);
    if (!turn.turned) return;
    expect(turn.from).toBeNull();
    expect(turn.to.id).toBe("rooting");
  });

  it("reads the list by date and hands it back in the order it came", () => {
    const turn = seasonTurnAtLaunch([BLOOM, ROOTING, FOUNDATIONS], LAUNCH_DAY);
    expect(turn.turned).toBe(true);
    if (!turn.turned) return;
    expect(turn.seasons.map((s) => s.id)).toEqual(["bloom", "rooting", "foundations"]);
    expect(turn.seasons[1].startsOn).toBe(LAUNCH_DAY);
  });

  it("a season with no start date is no season to begin, and rides through untouched", () => {
    const undated: TurnSeason = { id: "someday", name: "Someday", startsOn: "" };
    const turn = seasonTurnAtLaunch([FOUNDATIONS, undated, ROOTING], LAUNCH_DAY);
    expect(turn.turned).toBe(true);
    if (!turn.turned) return;
    expect(turn.to.id).toBe("rooting");
    expect(turn.seasons[1]).toBe(undated);
  });

  it("a season with no name is named by its id, so a sentence never has a hole in it", () => {
    const turn = seasonTurnAtLaunch([FOUNDATIONS, { id: "season-2", startsOn: "2027-02-01", endsOn: "2027-05-01" }], LAUNCH_DAY);
    expect(turn.turned && turn.to.name).toBe("season-2");
  });

  it("A RE-RUN TURNS NOTHING, because the day is the day the launch was recorded", () => {
    const first = seasonTurnAtLaunch(FIRST_VILLAGE, LAUNCH_DAY);
    if (!first.turned) throw new Error("the first run must turn");
    // The closer runs again, on the launch day or a week later: the day it passes is the same one.
    expect(seasonTurnAtLaunch(first.seasons, LAUNCH_DAY)).toMatchObject({ turned: false, reason: "began_that_day", running: { id: "rooting" } });
    // THE CONTROL: measured against "today" a week on, the re-run would pull the season after it forward too.
    const againstToday = seasonTurnAtLaunch(first.seasons, "2027-01-06");
    expect(againstToday.turned && againstToday.to.id, "this is the second turn the recorded day prevents").toBe("bloom");
  });
});

describe("turnSeasonAtLaunch: through the Season tab's own save, and never a refused launch", () => {
  const config = () => ({ seasons: FIRST_VILLAGE, cadence: "custom", timezone: TZ, timezoneAnswer: { at: "2026-03-01T00:00:00.000Z", by: "u1" } });

  it("saves the whole document once with the one date moved, and records what happened", async () => {
    const save = vi.fn(async (): Promise<CalendarSaved> => ({ ok: true, seatsMoved: { permission: 0, org: 0 } }));
    const audit = vi.fn();
    const out = await turnSeasonAtLaunch({ config, launchDay: () => LAUNCH_DAY, save, audit });
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith({
      cadence: "custom", timezone: TZ, timezoneAnswer: { at: "2026-03-01T00:00:00.000Z", by: "u1" },
      seasons: [FOUNDATIONS, { ...ROOTING, startsOn: LAUNCH_DAY }, BLOOM],
    });
    expect(out.stored).toBe(true);
    expect(out.failed).toBeNull();
    expect(out.seatsMoved).toEqual({ permission: 0, org: 0 });
    expect(audit.mock.calls.map((c) => c[0])).toEqual(["launch:season-turned:foundations->rooting:2026-12-30:seats-moved:0"]);
  });

  it("with nothing to turn to it saves nothing and says why", async () => {
    const save = vi.fn();
    const audit = vi.fn();
    const out = await turnSeasonAtLaunch({ config: () => ({ seasons: [FOUNDATIONS] }), launchDay: () => LAUNCH_DAY, save, audit });
    expect(save).not.toHaveBeenCalled();
    expect(out.stored).toBe(false);
    expect(out.failed).toBeNull();
    expect(audit.mock.calls.map((c) => c[0])).toEqual(["launch:season-not-turned:no_next_season:foundations"]);
  });

  it("a save that refuses is reported, and the launch is not thrown at", async () => {
    const audit = vi.fn();
    const out = await turnSeasonAtLaunch({
      config, launchDay: () => LAUNCH_DAY, audit,
      save: async () => ({ ok: false, refused: "\"Bogus/Zone\" is not a timezone this server knows." }),
    });
    expect(out.stored).toBe(false);
    expect(out.failed).toBe("\"Bogus/Zone\" is not a timezone this server knows.");
    expect(audit.mock.calls.map((c) => c[0])).toEqual(["launch:season-turn-failed:rooting"]);
  });

  it("a save that throws is caught: a carried launch is never refused over its calendar", async () => {
    const audit = vi.fn();
    const quiet = vi.spyOn(console, "error").mockImplementation(() => {});
    const out = await turnSeasonAtLaunch({ config, launchDay: () => LAUNCH_DAY, audit, save: async () => { throw new Error("the database went away"); } });
    quiet.mockRestore();
    expect(out.stored).toBe(false);
    expect(out.failed).toBe("the database went away");
    expect(audit.mock.calls.map((c) => c[0])).toEqual(["launch:season-turn-failed:rooting"]);
  });

  it("a list that saved while its seat step failed still turned the season", async () => {
    const audit = vi.fn();
    const out = await turnSeasonAtLaunch({ config, launchDay: () => LAUNCH_DAY, audit, save: async () => ({ ok: false, refused: null }) });
    expect(out.stored).toBe(true);
    expect(out.seatsMoved).toBeNull();
    expect(audit.mock.calls.map((c) => c[0])).toEqual(["launch:season-turned:foundations->rooting:2026-12-30:seats-moved:unknown"]);
  });

  it("a calendar or a zone that cannot be read is caught too", async () => {
    const quiet = vi.spyOn(console, "error").mockImplementation(() => {});
    const save = vi.fn();
    const noConfig = await turnSeasonAtLaunch({ config: () => { throw new Error("no document"); }, launchDay: () => LAUNCH_DAY, save, audit: vi.fn() });
    const noDay = await turnSeasonAtLaunch({ config, launchDay: () => { throw new RangeError("Invalid time zone specified: Bogus/Zone"); }, save, audit: vi.fn() });
    quiet.mockRestore();
    expect(noConfig.failed).toBe("no document");
    expect(noDay.failed).toContain("Invalid time zone");
    expect(save).not.toHaveBeenCalled();
  });
});

describe("what the turn does to the roles people hold: nothing", () => {
  const now = new Date("2026-12-30T21:00:00Z");
  const harvestEnd = civilDateInstant("2027-01-01", TZ) as Date;
  /** A seat given for the Season of Harvest, ending with it, as `role_holders` and the org chart both record one. */
  const seat = { id: "h-1", seasonId: "harvest", termEndsAt: harvestEnd, followsSeason: true };

  it("no seat that follows the outgoing season moves when the launch turns it", () => {
    const turn = seasonTurnAtLaunch(DATED_VILLAGE, LAUNCH_DAY);
    if (!turn.turned) throw new Error("must turn");
    const calendar = { seasons: turn.seasons as any[], currentSeasonId: "rooting", timezone: TZ };
    expect(restampsFor([seat], calendar, now)).toEqual([]);
  });

  it("THE CONTROL: writing the outgoing season's end as the launch day would end that seat the same morning", () => {
    const tidy = [{ ...HARVEST, endsOn: LAUNCH_DAY }, { ...ROOTING, startsOn: LAUNCH_DAY }, BLOOM];
    const moves = restampsFor([seat], { seasons: tidy as any[], currentSeasonId: "rooting", timezone: TZ }, now);
    expect(moves).toHaveLength(1);
    expect(moves[0].id).toBe("h-1");
    // Midnight that morning in the village: already past when the vote carried in the afternoon.
    expect(moves[0].to.getTime()).toBe((civilDateInstant(LAUNCH_DAY, TZ) as Date).getTime());
    expect(moves[0].to.getTime()).toBeLessThan(now.getTime());
  });
});

describe("a steward seated after the turn holds the whole new season", () => {
  const now = new Date("2026-12-30T21:00:00Z");

  it("THE CONTROL: before the turn, the first village's calendar can seat nobody as a steward", () => {
    const before = resolveSeatTerm({ calendar: { seasons: FIRST_VILLAGE as any[], currentSeasonId: "foundations", timezone: TZ }, capAtSeasonEnd: true, now });
    expect(before.ok).toBe(false);
    expect(!before.ok && before.code).toBe("open_ended_season");
  });

  it("after it, the seat runs to the end of the season the launch began", () => {
    const turn = seasonTurnAtLaunch(FIRST_VILLAGE, LAUNCH_DAY);
    if (!turn.turned) throw new Error("must turn");
    const after = resolveSeatTerm({ calendar: { seasons: turn.seasons as any[], currentSeasonId: turn.to.id, timezone: TZ }, capAtSeasonEnd: true, now });
    expect(after.ok).toBe(true);
    if (!after.ok) return;
    expect(after.endsOn).toBe("2027-04-15");
    expect(after.seasonId).toBe("rooting");
    expect(after.followsSeason).toBe(true);
    expect(after.endsAt.getTime()).toBe((civilDateInstant("2027-04-15", TZ) as Date).getTime());
  });

  it("on a dated calendar the term is the NEW season's end, never the outgoing one's", () => {
    const turn = seasonTurnAtLaunch(DATED_VILLAGE, LAUNCH_DAY);
    if (!turn.turned) throw new Error("must turn");
    const untouched = resolveSeatTerm({ calendar: { seasons: DATED_VILLAGE as any[], currentSeasonId: "harvest", timezone: TZ }, capAtSeasonEnd: true, now });
    const after = resolveSeatTerm({ calendar: { seasons: turn.seasons as any[], currentSeasonId: "rooting", timezone: TZ }, capAtSeasonEnd: true, now });
    expect(untouched.ok && untouched.endsOn, "without the turn a steward would hold two days").toBe("2027-01-01");
    expect(after.ok && after.endsOn).toBe("2027-04-15");
  });
});

describe("PAY PERIODS DO NOT MOVE: a cycle id is the instant's alone", () => {
  const launchedAt = "2026-12-30T21:14:09.000Z";
  const instants = [
    new Date("2026-11-02T08:00:00Z"), // a moon before the launch
    new Date("2026-12-29T23:59:59Z"), // the day before
    new Date(launchedAt), //             the instant it carried
    new Date("2026-12-31T00:00:01Z"), // the day after
    new Date("2027-02-14T12:00:00Z"), // two moons on
  ];

  it("every instant keys to the same pay period before and after the launch, by all four readers", () => {
    const anchorBefore = anchorCycleFrom(null, null).moonOneCycle;
    const anchorAfter = anchorCycleFrom(null, launchedAt).moonOneCycle;
    expect(anchorBefore).toBeNull();
    expect(typeof anchorAfter).toBe("number");
    for (const at of instants) {
      const n = cycleBoundsFor(at).cycleNumber;
      const id = `lunar-${String(n).padStart(6, "0")}`;
      // The settlement clock, the gratitude cycle, the economy's key: one string, with no launch in it.
      expect(LUNAR_CLOCK.idFor(at)).toBe(id);
      expect(cycleIdFor(at, LUNAR_CLOCK)).toBe(id);
      expect(cycleKeyFor(at)).toBe(cycleIdFor(at));
      // The same lunation, with the same bounds, whether or not the village has launched.
      const before = villageMoonFor(at, anchorBefore);
      const after = villageMoonFor(at, anchorAfter);
      expect(after.cycleNumber).toBe(before.cycleNumber);
      expect(after.cycleNumber).toBe(n);
      expect(after.startsAt).toBe(before.startsAt);
      expect(after.endsAt).toBe(before.endsAt);
    }
  });

  it("what the launch does move is the village's own count: Moon 1 is the moon the launch fell in", () => {
    const anchor = anchorCycleFrom(null, launchedAt).moonOneCycle;
    expect(anchor).toBe(cycleBoundsFor(new Date(launchedAt)).cycleNumber);
    expect(villageMoonFor(new Date(launchedAt), anchor).ordinal).toBe(1);
    expect(villageMoonFor(new Date("2026-12-31T00:00:01Z"), anchor).ordinal).toBe(1);
    expect(villageMoonFor(new Date("2027-02-14T12:00:00Z"), anchor).ordinal).toBe(3);
    // Before the launch there is no count at all, and the pay period is still the pay period.
    expect(villageMoonFor(new Date(launchedAt), null).ordinal).toBeNull();
  });

  it("the season calendar is not an input: turning it changes no cycle", () => {
    const at = new Date(launchedAt);
    const before = { id: cycleIdFor(at), bounds: cycleBoundsFor(at) };
    const turn = seasonTurnAtLaunch(FIRST_VILLAGE, LAUNCH_DAY);
    expect(turn.turned).toBe(true);
    expect({ id: cycleIdFor(at), bounds: cycleBoundsFor(at) }).toEqual(before);
  });
});

describe("seasonTurnLines: what the frozen launch document says", () => {
  it("names the season that begins and the one it takes over from, and how long a steward holds", () => {
    expect(seasonTurnLines(FIRST_VILLAGE, "2026-12-20")).toEqual([
      "The day this carries is the turn of the season. Season of Rooting begins that day, taking over from Season of Foundations.",
      "Whoever is seated as a steward by this vote holds the role for the whole of Season of Rooting, until 2027-04-15.",
      "Nothing else on the calendar moves, and every role anybody holds keeps the end date it was given.",
      "Moon 1 is the moon that day falls in. Pay periods follow the moons as they always have, and none of them moves.",
    ]);
  });

  it("says when the season it would begin has no end date, because that seats no steward", () => {
    const lines = seasonTurnLines([FOUNDATIONS, { ...ROOTING, endsOn: "" }], "2026-12-20");
    expect(lines[1]).toBe(
      "Season of Rooting has no end date yet, and a steward role ends with its season, so nobody can be seated as a steward until it has one. Give it an end date in Admin, Season before this vote.",
    );
  });

  it("says so when no next season is on the calendar", () => {
    expect(seasonTurnLines([FOUNDATIONS], "2026-12-20")[0]).toBe(
      "No next season is on the calendar, so the season does not turn when this carries. Add the next season in Admin, Season before this vote if the launch should begin one.",
    );
  });

  it("on the first day of a season, says which season a launch today begins", () => {
    const lines = seasonTurnLines([FOUNDATIONS, { ...ROOTING, startsOn: "2026-12-20" }, BLOOM], "2026-12-20");
    expect(lines[0]).toContain("Season of Rooting began today. If this carries today, that is the season the launch begins");
    expect(lines[0]).toContain("until 2027-04-15");
  });

  it("never names a date for the turn itself: nobody knows the day a vote carries", () => {
    for (const line of seasonTurnLines(FIRST_VILLAGE, "2026-12-20")) expect(line).not.toContain("2026-12-20");
  });
});
