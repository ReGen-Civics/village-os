/**
 * The arithmetic of several rhythms per circle (0401), pure: which meeting
 * comes first across two rhythms, how they are listed, which rhythm a skip
 * names, which meetings hear the day before, which agenda items wait for which
 * meeting, how each rhythm is mirrored onto the village calendar, a name read
 * from a body, and a circle's own calendar read through a title word.
 *
 * A fixed week in UTC: Monday 2026-11-23 and Thursday 2026-11-26.
 */
import { describe, expect, it } from "vitest";
import { comingWithinADay, nextOf, rhythmLines } from "./sessionRhythm";
import { mirrorInput } from "./sessionCalendar";
import { MAIN_RHYTHM, cleanRhythm, rhythmForSkip, rhythmSourceId, soonestOf, type StoredRhythm } from "../../shared/sessionRhythm";
import { waitsForMeeting } from "../../shared/sessionLibrary";
import { readTitleFilter, titleMatches } from "../../shared/sessionCalendar";

const Z = "UTC";
const thursday: StoredRhythm = {
  circleId: "c-anchor",
  rhythmKey: MAIN_RHYTHM,
  name: "Thursday steward sync",
  kind: "weekly",
  recurrence: { freq: "weekly", byWeekday: [4], interval: 1 },
  startsOn: "2026-11-19",
  time: "13:00",
  durationMin: 120,
};
const monday: StoredRhythm = {
  circleId: "c-anchor",
  rhythmKey: "rmon",
  name: "Monday all-staff",
  kind: "weekly",
  recurrence: { freq: "weekly", byWeekday: [1], interval: 1 },
  startsOn: "2026-11-23",
  time: "12:00",
  durationMin: 90,
};
/** Sunday 22 November, 10:00. */
const sunday = new Date("2026-11-22T10:00:00Z");
/** Tuesday 24 November, 10:00. */
const tuesday = new Date("2026-11-24T10:00:00Z");

describe("two rhythms in one circle", () => {
  it("takes the soonest meeting of either, whichever rhythm was set first", () => {
    expect(soonestOf([thursday, monday], sunday, Z)).toMatchObject({ rhythm: { rhythmKey: "rmon" }, meeting: { key: "2026-11-23", at: "2026-11-23T12:00:00.000Z" } });
    expect(soonestOf([thursday, monday], tuesday, Z)).toMatchObject({ rhythm: { rhythmKey: MAIN_RHYTHM }, meeting: { key: "2026-11-26" } });
    expect(nextOf([thursday, monday], null, sunday, Z)).toMatchObject({ from: "rhythm", durationMin: 90, rhythm: { name: "Monday all-staff" } });
  });

  it("lists the rhythms soonest first, each with its own next meeting and the items waiting for it", () => {
    const waiting = [
      { circleId: "c-anchor", rhythmKey: "rmon" },
      { circleId: "c-anchor", rhythmKey: null },
      { circleId: "c-other", rhythmKey: null },
    ];
    const lines = rhythmLines([thursday, monday], tuesday, Z, waiting);
    expect(lines.map((l) => [l.key, l.next?.key, l.waiting])).toEqual([
      [MAIN_RHYTHM, "2026-11-26", 1],
      ["rmon", "2026-11-30", 2],
    ]);
    expect(lines[1]).toMatchObject({ name: "Monday all-staff", words: "Every Monday at 12:00", input: { kind: "weekly", weekday: 1, startsOn: "2026-11-30", name: "Monday all-staff" } });
  });

  it("keeps each rhythm's skips its own", () => {
    const skipped = { ...monday, recurrence: { ...monday.recurrence!, exceptions: ["2026-11-23"] } };
    expect(soonestOf([thursday, skipped], sunday, Z)?.meeting.key).toBe("2026-11-26");
    expect(rhythmLines([thursday, skipped], sunday, Z, []).map((l) => l.next?.key)).toEqual(["2026-11-26", "2026-11-30"]);
  });

  it("finds the rhythm a skip names, by key, or by its date for an older page", () => {
    expect(rhythmForSkip([thursday, monday], "2026-11-23", null, sunday, Z)?.rhythmKey).toBe("rmon");
    expect(rhythmForSkip([thursday, monday], "2026-11-26", null, sunday, Z)?.rhythmKey).toBe(MAIN_RHYTHM);
    expect(rhythmForSkip([thursday, monday], "2026-11-23", MAIN_RHYTHM, sunday, Z)?.rhythmKey).toBe(MAIN_RHYTHM);
    expect(rhythmForSkip([thursday, monday], "2026-11-23", "rgone", sunday, Z)).toBeNull();
  });

  it("hears the day before each meeting, once for two rhythms that meet at the same moment", () => {
    const rhythms = new Map([["c-anchor", [thursday, monday]]]);
    // Sunday 13:00: Monday's 12:00 is 23 hours off.
    const sundayAfternoon = new Date("2026-11-22T13:00:00Z");
    expect(comingWithinADay(rhythms, new Map(), ["c-anchor"], sundayAfternoon, Z).map((x) => [x.rhythmKey, x.name, x.next.key])).toEqual([["rmon", "Monday all-staff", "2026-11-23"]]);
    expect(comingWithinADay(rhythms, new Map(), ["c-anchor"], new Date("2026-11-25T14:00:00Z"), Z).map((x) => x.rhythmKey)).toEqual([MAIN_RHYTHM]);
    const twin = { ...monday, rhythmKey: "rtwin", name: "Twin" };
    expect(comingWithinADay(new Map([["c-anchor", [monday, twin]]]), new Map(), ["c-anchor"], sundayAfternoon, Z)).toHaveLength(1);
  });

  it("mirrors each rhythm under its own id, the first under the circle's own id", () => {
    expect(rhythmSourceId("c-anchor", MAIN_RHYTHM)).toBe("c-anchor");
    expect(mirrorInput(thursday, "Anchor circle", Z)).toMatchObject({ sourceId: "c-anchor", title: "Anchor circle: Thursday steward sync" });
    expect(mirrorInput(monday, "Anchor circle", Z)).toMatchObject({ sourceId: "c-anchor~rmon", title: "Anchor circle: Monday all-staff" });
    // A rhythm with no name keeps the title it always had.
    expect(mirrorInput({ ...thursday, name: "" }, "Anchor circle", Z).title).toBe("Anchor circle meeting");
  });
});

describe("the single rhythm a circle kept before 0401", () => {
  it("reads with no key and no name as the circle's first rhythm, as it always did", () => {
    const old: StoredRhythm = { circleId: "c-anchor", kind: "weekly", recurrence: { freq: "weekly", byWeekday: [4], interval: 1 }, startsOn: "2026-11-19", time: "13:00", durationMin: 60 };
    const [line] = rhythmLines([old], sunday, Z, []);
    expect(line).toMatchObject({ key: MAIN_RHYTHM, name: "", words: "Every Thursday at 13:00" });
    expect(line.input).toEqual({ kind: "weekly", weekday: 4, everyWeeks: 1, time: "13:00", startsOn: "2026-11-26", durationMin: 60 });
    expect(mirrorInput(old, "Anchor circle", Z)).toMatchObject({ sourceId: "c-anchor", title: "Anchor circle meeting" });
  });

  it("reads an older page's body exactly as before, and a name when one is sent", () => {
    expect(cleanRhythm({ kind: "weekly", weekday: 4, everyWeeks: 1, time: "13:00" })).toEqual({
      ok: true,
      value: { kind: "weekly", weekday: 4, everyWeeks: 1, time: "13:00", durationMin: 60 },
    });
    expect(cleanRhythm({ kind: "weekly", weekday: 1, everyWeeks: 1, time: "12:00", name: "  Monday\n all-staff " })).toMatchObject({ ok: true, value: { name: "Monday all-staff" } });
  });
});

describe("an agenda item for one meeting", () => {
  const keys = new Set([MAIN_RHYTHM, "rmon"]);
  it("waits for that meeting only; an item for any meeting, or for a rhythm since stopped, waits for each", () => {
    expect(waitsForMeeting("rmon", "rmon", keys)).toBe(true);
    expect(waitsForMeeting("rmon", MAIN_RHYTHM, keys)).toBe(false);
    expect(waitsForMeeting(null, MAIN_RHYTHM, keys)).toBe(true);
    expect(waitsForMeeting("", "rmon", keys)).toBe(true);
    expect(waitsForMeeting("rgone", MAIN_RHYTHM, keys)).toBe(true);
    // A meeting from the circle's own calendar takes the items for any meeting only.
    expect(waitsForMeeting("rmon", null, keys)).toBe(false);
  });
});

describe("a circle's own calendar read through a title word", () => {
  it("matches without regard to case, accents or spacing, and an empty word takes every title", () => {
    expect(titleMatches("Anchor Steward  Sync", "steward sync")).toBe(true);
    expect(titleMatches("Reunión del círculo", "reunion")).toBe(true);
    expect(titleMatches("Dentist", "steward sync")).toBe(false);
    expect(titleMatches("Dentist", "")).toBe(true);
    expect(titleMatches("Dentist", null)).toBe(true);
    expect(readTitleFilter(`  ${"x".repeat(200)} `)).toHaveLength(80);
    expect(readTitleFilter(42)).toBe("");
  });
});
