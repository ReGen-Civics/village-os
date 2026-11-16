/**
 * "The first Friday of every month": a monthly rhythm by the nth weekday,
 * from the civil arithmetic up through expansion in village time, the .ics
 * RRULE read back by an independent parser, and the proposals path that a
 * reviewed event arrives through.
 *
 * Pure: no database. The village is in America/Costa_Rica (UTC-6, no
 * daylight saving); forks live in zones that change their clocks, so New
 * York and London are here too.
 */
import { describe, expect, it } from "vitest";
import ICAL from "ical.js";
import { cleanRecurrence, expandOccurrences, type CalendarRow } from "./calendar";
import { buildIcs, rruleFor, startFollowsRule } from "./icsFeed";
import { EXAMPLE_MONTH_NAMES } from "./lunarTable";
import { civilParts } from "../../shared/lunar";
import { describeRecurrence, nthWeekdayDay, nthWeekdayRulesFor, type Recurrence } from "../../shared/gatherings";
import { readProposalInput } from "../../shared/proposedChanges";

const CR = "America/Costa_Rica";
const FRI = 5;
const firstFriday: Recurrence = { freq: "monthly", byNthWeekday: { nth: 1, weekday: FRI } };
const lastFriday: Recurrence = { freq: "monthly", byNthWeekday: { nth: -1, weekday: FRI } };

const row = (over: Partial<CalendarRow> = {}): CalendarRow => ({
  id: "webinar", title: "Monthly webinar", description: null,
  // Friday 6 November 2026, 11:00 to 12:30 in Costa Rica (UTC-6).
  startsAt: new Date("2026-11-06T17:00:00Z"), endsAt: new Date("2026-11-06T18:30:00Z"),
  locationText: null, structureKeys: [], visitTypeId: null, capacity: null, status: "scheduled",
  attendanceMode: "online", onlineUrl: null, isExample: false, kind: "gathering", layer: "village",
  ownerUserId: null, allDay: false, sourceModule: null, sourceId: null, link: null, colour: null,
  recurrence: firstFriday, externalSourceId: null, externalUid: null, removedAt: null,
  updatedAt: new Date("2026-11-01T10:00:00Z"), seatPrice: 0, seatToken: null,
  ...over,
});

const keys = (r: CalendarRow, from: string, to: string, tz = CR) =>
  expandOccurrences(r, new Date(from), new Date(to), tz).map((o) => o.occurrenceKey);

describe("nthWeekdayDay: the civil arithmetic", () => {
  it("finds the first Friday whatever weekday the month opens on", () => {
    expect(nthWeekdayDay(2026, 11, { nth: 1, weekday: FRI })).toBe(6); // opens on a Sunday
    expect(nthWeekdayDay(2027, 1, { nth: 1, weekday: FRI })).toBe(1); // opens on the Friday itself
    expect(nthWeekdayDay(2026, 12, { nth: 1, weekday: FRI })).toBe(4); // opens on a Tuesday
    expect(nthWeekdayDay(2026, 10, { nth: 1, weekday: FRI })).toBe(2); // opens on a Thursday
    expect(nthWeekdayDay(2026, 5, { nth: 1, weekday: FRI })).toBe(1);
  });

  it("in a five-Friday month, the fourth and the last are different days", () => {
    // January 2027: Fridays 1, 8, 15, 22, 29.
    expect(nthWeekdayDay(2027, 1, { nth: 4, weekday: FRI })).toBe(22);
    expect(nthWeekdayDay(2027, 1, { nth: -1, weekday: FRI })).toBe(29);
    // In a four-Friday month they are the same day. February 2026: 6, 13, 20, 27.
    expect(nthWeekdayDay(2026, 2, { nth: 4, weekday: FRI })).toBe(27);
    expect(nthWeekdayDay(2026, 2, { nth: -1, weekday: FRI })).toBe(27);
  });

  it("handles leap February and the last day of a month", () => {
    // February 2028 has 29 days and ends on a Tuesday.
    expect(nthWeekdayDay(2028, 2, { nth: -1, weekday: 2 })).toBe(29);
    expect(nthWeekdayDay(2028, 2, { nth: -1, weekday: FRI })).toBe(25);
    // A 31-day month ending on the weekday asked: July 2026 ends Friday 31.
    expect(nthWeekdayDay(2026, 7, { nth: -1, weekday: FRI })).toBe(31);
  });

  it("refuses a rule it does not understand rather than guessing", () => {
    expect(nthWeekdayDay(2026, 11, { nth: 5 as never, weekday: FRI })).toBeNull();
    expect(nthWeekdayDay(2026, 11, { nth: 1, weekday: 7 })).toBeNull();
  });

  it("offers the rules a start date answers to", () => {
    expect(nthWeekdayRulesFor(2026, 11, 6)).toEqual([{ nth: 1, weekday: FRI }]);
    // Friday 27 November 2026 is the fourth and also the last.
    expect(nthWeekdayRulesFor(2026, 11, 27)).toEqual([{ nth: 4, weekday: FRI }, { nth: -1, weekday: FRI }]);
    // Friday 29 January 2027 is the fifth, which is offered only as the last.
    expect(nthWeekdayRulesFor(2027, 1, 29)).toEqual([{ nth: -1, weekday: FRI }]);
    // Friday 22 January 2027 is the fourth and not the last.
    expect(nthWeekdayRulesFor(2027, 1, 22)).toEqual([{ nth: 4, weekday: FRI }]);
  });
});

describe("expandOccurrences: the first Friday in village time", () => {
  it("lands on the first Friday of each month across a year boundary, never drifting to the 6th", () => {
    const occ = expandOccurrences(row(), new Date("2026-11-01T00:00:00Z"), new Date("2027-06-01T00:00:00Z"), CR);
    expect(occ.map((o) => o.occurrenceKey)).toEqual([
      "2026-11-06", "2026-12-04", "2027-01-01", "2027-02-05", "2027-03-05", "2027-04-02", "2027-05-07",
    ]);
    // Every one at 11:00 to 12:30 Costa Rica, which is 17:00 to 18:30 UTC all year (no daylight saving).
    for (const o of occ) {
      expect(o.startsAt.toISOString().slice(11)).toBe("17:00:00.000Z");
      expect(o.endsAt!.toISOString().slice(11)).toBe("18:30:00.000Z");
      expect(civilParts(o.startsAt, CR).weekday).toBe(FRI);
      expect(civilParts(o.startsAt, CR).hour).toBe(11);
    }
  });

  it("a window that opens mid-month picks up from the next first Friday", () => {
    expect(keys(row(), "2026-12-05T00:00:00Z", "2027-02-01T00:00:00Z")).toEqual(["2027-01-01"]);
    // And a window that closes the day before one leaves it out.
    expect(keys(row(), "2026-11-07T00:00:00Z", "2026-12-04T00:00:00Z")).toEqual([]);
  });

  it("an evening first Friday keeps the village date even when UTC is already Saturday", () => {
    // 20:00 Friday in Costa Rica is 02:00 Saturday UTC.
    const evening = row({ startsAt: new Date("2026-11-07T02:00:00Z"), endsAt: null });
    const occ = expandOccurrences(evening, new Date("2026-11-01T00:00:00Z"), new Date("2027-02-01T00:00:00Z"), CR);
    expect(occ.map((o) => o.occurrenceKey)).toEqual(["2026-11-06", "2026-12-04", "2027-01-01"]);
    expect(occ.map((o) => o.startsAt.toISOString())).toEqual([
      "2026-11-07T02:00:00.000Z", "2026-12-05T02:00:00.000Z", "2027-01-02T02:00:00.000Z",
    ]);
  });

  it("the last Friday takes the fifth Friday in a five-Friday month, and the UTC month may already have turned", () => {
    // Friday 30 April 2027 at 20:00 Costa Rica is 1 May UTC.
    const last = row({ startsAt: new Date("2027-01-30T02:00:00Z"), endsAt: null, recurrence: lastFriday });
    const occ = expandOccurrences(last, new Date("2027-01-01T00:00:00Z"), new Date("2027-06-01T00:00:00Z"), CR);
    expect(occ.map((o) => o.occurrenceKey)).toEqual(["2027-01-29", "2027-02-26", "2027-03-26", "2027-04-30", "2027-05-28"]);
    expect(occ[3].startsAt.toISOString()).toBe("2027-05-01T02:00:00.000Z");
  });

  it("does not repeat before the base row, and honours until, interval, exceptions and overrides by village date", () => {
    expect(keys(row(), "2026-09-01T00:00:00Z", "2026-12-01T00:00:00Z")).toEqual(["2026-11-06"]);
    const until = row({ recurrence: { ...firstFriday, until: "2027-01-15T00:00:00Z" } });
    expect(keys(until, "2026-11-01T00:00:00Z", "2027-06-01T00:00:00Z")).toEqual(["2026-11-06", "2026-12-04", "2027-01-01"]);
    const everyOther = row({ recurrence: { ...firstFriday, interval: 2 } });
    expect(keys(everyOther, "2026-11-01T00:00:00Z", "2027-06-01T00:00:00Z")).toEqual(["2026-11-06", "2027-01-01", "2027-03-05", "2027-05-07"]);
    const skipped = row({
      recurrence: { ...firstFriday, exceptions: ["2027-01-01"], overrides: { "2026-12-04": { startsAt: "2026-12-11T17:00:00Z", title: "Moved webinar" } } },
    });
    const occ = expandOccurrences(skipped, new Date("2026-11-01T00:00:00Z"), new Date("2027-03-01T00:00:00Z"), CR);
    expect(occ.map((o) => o.occurrenceKey)).toEqual(["2026-11-06", "2026-12-04", "2027-02-05"]);
    expect(occ[1].title).toBe("Moved webinar");
    expect(occ[1].startsAt.toISOString()).toBe("2026-12-11T17:00:00.000Z");
  });

  it("holds the wall-clock time across a daylight change in a fork's zone (New York)", () => {
    const NY = "America/New_York";
    // Friday 6 November 2026, 18:00 EST (UTC-5). Clocks go forward on 14 March 2027.
    const r = row({ startsAt: new Date("2026-11-06T23:00:00Z"), endsAt: new Date("2026-11-07T00:30:00Z") });
    const occ = expandOccurrences(r, new Date("2026-11-01T00:00:00Z"), new Date("2027-05-01T00:00:00Z"), NY);
    expect(occ.map((o) => o.occurrenceKey)).toEqual(["2026-11-06", "2026-12-04", "2027-01-01", "2027-02-05", "2027-03-05", "2027-04-02"]);
    expect(occ[4].startsAt.toISOString()).toBe("2027-03-05T23:00:00.000Z"); // still EST
    expect(occ[5].startsAt.toISOString()).toBe("2027-04-02T22:00:00.000Z"); // EDT, same 18:00 on the wall
    expect(occ[5].endsAt!.toISOString()).toBe("2027-04-02T23:30:00.000Z");
    for (const o of occ) expect(civilParts(o.startsAt, NY).hour).toBe(18);
  });

  it("holds the wall-clock time across the autumn change in London, on the first Friday either side", () => {
    const LDN = "Europe/London";
    // Friday 2 October 2026, 18:00 BST (UTC+1). Clocks go back on 25 October.
    const r = row({ startsAt: new Date("2026-10-02T17:00:00Z"), endsAt: null });
    const occ = expandOccurrences(r, new Date("2026-10-01T00:00:00Z"), new Date("2026-12-01T00:00:00Z"), LDN);
    expect(occ.map((o) => o.startsAt.toISOString())).toEqual(["2026-10-02T17:00:00.000Z", "2026-11-06T18:00:00.000Z"]);
  });
});

describe("cleanRecurrence: what the route accepts and stores", () => {
  it("keeps a first-Friday rule, from an object or from stored JSON text", () => {
    expect(cleanRecurrence(firstFriday)).toEqual({ freq: "monthly", byNthWeekday: { nth: 1, weekday: FRI }, interval: 1 });
    expect(cleanRecurrence(JSON.stringify(lastFriday))).toEqual({ freq: "monthly", byNthWeekday: { nth: -1, weekday: FRI }, interval: 1 });
    // Numbers that arrive as strings are read as numbers.
    expect(cleanRecurrence({ freq: "monthly", byNthWeekday: { nth: "2", weekday: "3" } })).toEqual({ freq: "monthly", byNthWeekday: { nth: 2, weekday: 3 }, interval: 1 });
  });

  it("refuses a week or weekday outside the vocabulary", () => {
    expect(cleanRecurrence({ freq: "monthly", byNthWeekday: { nth: 5, weekday: FRI } })).toBeNull();
    expect(cleanRecurrence({ freq: "monthly", byNthWeekday: { nth: 0, weekday: FRI } })).toBeNull();
    expect(cleanRecurrence({ freq: "monthly", byNthWeekday: { nth: 1, weekday: 7 } })).toBeNull();
    expect(cleanRecurrence({ freq: "monthly", byNthWeekday: { nth: 1 } })).toBeNull();
  });

  it("leaves the day-of-month rule exactly as it was", () => {
    expect(cleanRecurrence({ freq: "monthly", byMonthDay: 15, interval: 2 })).toEqual({ freq: "monthly", byMonthDay: 15, interval: 2 });
  });
});

describe("the .ics feed", () => {
  it("writes BYDAY=1FR and BYDAY=-1FR", () => {
    expect(rruleFor(row())).toBe("FREQ=MONTHLY;BYDAY=1FR");
    expect(rruleFor(row({ recurrence: lastFriday }))).toBe("FREQ=MONTHLY;BYDAY=-1FR");
    expect(rruleFor(row({ recurrence: { ...firstFriday, interval: 3 } }))).toBe("FREQ=MONTHLY;INTERVAL=3;BYDAY=1FR");
  });

  it("knows whether the base row's own date is one the rule produces", () => {
    expect(startFollowsRule(firstFriday, civilParts(new Date("2026-11-06T17:00:00Z"), CR))).toBe(true);
    expect(startFollowsRule(firstFriday, civilParts(new Date("2026-11-13T17:00:00Z"), CR))).toBe(false);
    expect(startFollowsRule({ freq: "monthly", byMonthDay: 6 }, civilParts(new Date("2026-11-06T17:00:00Z"), CR))).toBe(true);
  });

  const icsOpts = (timezone: string) => ({
    calendarName: "Test village calendar", timezone, anchor: "december_solstice" as const, hemisphere: "north" as const,
    names: EXAMPLE_MONTH_NAMES.map((name, i) => ({ index: i + 1, name, isExample: true })), moonOneCycle: 283,
    host: "village.test", siteUrl: "https://village.test",
    from: new Date("2026-10-01T00:00:00Z"), to: new Date("2027-06-01T00:00:00Z"), now: new Date("2026-11-01T12:00:00Z"),
  });

  /** Expand the feed's RRULE with ical.js through the feed's own VTIMEZONE. */
  function readBack(ics: string, count: number): string[] {
    const comp = new ICAL.Component(ICAL.parse(ics));
    for (const vt of comp.getAllSubcomponents("vtimezone")) ICAL.TimezoneService.register(new ICAL.Timezone(vt));
    const ev = comp.getAllSubcomponents("vevent").find((e) => !e.getFirstPropertyValue("recurrence-id"))!;
    const it = new ICAL.Event(ev).iterator();
    const got: string[] = [];
    for (let next = it.next(); next && got.length < count; next = it.next()) got.push(next.toJSDate().toISOString());
    return got;
  }

  it("an independent parser reads the same first Fridays the village calendar shows, in Costa Rica and in New York", () => {
    const window = [new Date("2026-10-01T00:00:00Z"), new Date("2027-06-01T00:00:00Z")] as const;
    const cr = row();
    const ours = expandOccurrences(cr, window[0], window[1], CR).map((o) => o.startsAt.toISOString());
    expect(readBack(buildIcs([cr], icsOpts(CR)), ours.length)).toEqual(ours);

    const NY = "America/New_York";
    const ny = row({ startsAt: new Date("2026-11-06T23:00:00Z"), endsAt: null });
    const theirs = expandOccurrences(ny, window[0], window[1], NY).map((o) => o.startsAt.toISOString());
    expect(readBack(buildIcs([ny], icsOpts(NY)), theirs.length)).toEqual(theirs);
  });

  it("a start that is not a first Friday is excluded from the feed, as the calendar never shows it", () => {
    // Friday 13 November is the second Friday; the rule's first date is 4 December.
    const off = row({ startsAt: new Date("2026-11-13T17:00:00Z"), endsAt: null });
    const ours = expandOccurrences(off, new Date("2026-10-01T00:00:00Z"), new Date("2027-03-01T00:00:00Z"), CR).map((o) => o.startsAt.toISOString());
    expect(ours[0]).toBe("2026-12-04T17:00:00.000Z");
    const ics = buildIcs([off], icsOpts(CR));
    expect(ics).toContain("EXDATE");
    expect(readBack(ics, ours.length)).toEqual(ours);
  });
});

describe("words and the proposals path", () => {
  it("says the rhythm in one short plain line", () => {
    expect(describeRecurrence(firstFriday)).toBe("First Friday of every month");
    expect(describeRecurrence(lastFriday)).toBe("Last Friday of every month");
    expect(describeRecurrence({ freq: "monthly", byNthWeekday: { nth: 2, weekday: 2 }, interval: 2 })).toBe("Second Tuesday of every 2 months");
    expect(describeRecurrence({ freq: "monthly", byMonthDay: 15 })).toBe("Every month on day 15");
    expect(describeRecurrence(null)).toBeNull();
  });

  it("a proposed event carries the rule to POST /api/admin/events untouched, and the route's reader keeps it", () => {
    const body = {
      title: "Monthly webinar", status: "draft", attendanceMode: "online",
      startsAt: "2026-12-04T17:00:00.000Z", endsAt: "2026-12-04T18:30:00.000Z",
      recurrence: { freq: "monthly", byNthWeekday: { nth: 1, weekday: FRI } },
    };
    const read = readProposalInput({ kind: "setting", target: { method: "POST", path: "/api/admin/events" }, body, summary: "Add the monthly webinar to the calendar" });
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(read.value.kind).toBe("setting");
    expect(read.value.target).toMatchObject({ method: "POST", path: "/api/admin/events" });
    expect(read.value.body.recurrence).toEqual(body.recurrence);
    expect(cleanRecurrence(read.value.body.recurrence)).toEqual({ freq: "monthly", byNthWeekday: { nth: 1, weekday: FRI }, interval: 1 });
  });
});
