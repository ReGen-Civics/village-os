/**
 * The organiser's Repeats list: the month-by-weekday choices come from the
 * start date as typed, and what is picked round-trips through the stored
 * rule so editing a first-Friday series shows the first Friday again.
 */
import { describe, expect, it } from "vitest";
import { recurrenceToRepeat, repeatChoicesFor, repeatToRecurrence } from "./EventsAdminPanel";

describe("Repeats choices", () => {
  it("a start on the first Friday offers the first Friday, and no weekday rule without a start", () => {
    const labels = repeatChoicesFor("2026-11-06T11:00").map((c) => c.label);
    expect(labels).toContain("First Friday of every month");
    expect(labels).not.toContain("Last Friday of every month");
    expect(repeatChoicesFor("").some((c) => c.value.startsWith("monthly-nth:"))).toBe(false);
  });

  it("a start on a fourth Friday that is also the last offers both", () => {
    const values = repeatChoicesFor("2026-11-27T11:00").map((c) => c.value);
    expect(values).toEqual(expect.arrayContaining(["monthly-nth:4:5", "monthly-nth:-1:5"]));
  });

  it("reads the date as typed, so a late-evening start keeps its own weekday", () => {
    expect(repeatChoicesFor("2026-11-06T23:30").map((c) => c.value)).toContain("monthly-nth:1:5");
  });

  it("round-trips the choice through the stored rule", () => {
    const rule = repeatToRecurrence("monthly-nth:1:5", "2026-11-06T11:00");
    expect(rule).toEqual({ freq: "monthly", byNthWeekday: { nth: 1, weekday: 5 } });
    expect(recurrenceToRepeat(rule)).toBe("monthly-nth:1:5");
    expect(recurrenceToRepeat({ freq: "monthly", byMonthDay: 6 })).toBe("monthly");
    expect(repeatToRecurrence("monthly-nth:5:5", "2026-11-06T11:00")).toBeNull();
  });
});
