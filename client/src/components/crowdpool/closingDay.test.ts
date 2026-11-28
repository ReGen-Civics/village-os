/**
 * The pool lantern's closing day (QA round 2, 27 Nov 2026): the browser's own format read "12/19/2026" for a pool that
 * closes on 20 Dec, in the reader's zone and month-first. It reads as the village says a day, in the village's zone.
 */
import { describe, expect, it } from "vitest";
import { closingDay, daysUntilClosing } from "./PoolPieces";

describe("the lantern's closing day", () => {
  it("says the day in the village's zone, day first", () => {
    // 05:00 UTC on 20 Dec is still 19 Dec in Costa Rica, and 20 Dec in Madrid.
    expect(closingDay("2026-12-20T05:00:00Z", "America/Costa_Rica")).toBe("19 Dec 2026");
    expect(closingDay("2026-12-20T05:00:00Z", "Europe/Madrid")).toBe("20 Dec 2026");
  });

  it("reads a civil date as written, whatever the zone", () => {
    expect(closingDay("2026-12-20", "Pacific/Kiritimati")).toBe("20 Dec 2026");
    expect(closingDay("2026-12-20", "Pacific/Pago_Pago")).toBe("20 Dec 2026");
  });

  it("says nothing for no date or a date it cannot read, and falls back to UTC for an unknown zone", () => {
    expect(closingDay(null, "UTC")).toBeNull();
    expect(closingDay("not a date", "UTC")).toBeNull();
    expect(closingDay("2026-12-20T12:00:00Z", "Not/AZone")).toBe("20 Dec 2026");
  });
});

describe("the lantern's day count (QA round 3)", () => {
  // 27 Nov 2026, 15:00 UTC: 09:00 that morning in Costa Rica.
  const now = new Date("2026-11-27T15:00:00Z");

  it("counts the village's days, so it agrees with the closing day beside it", () => {
    // Ends 20 Dec 00:00 UTC, which is 19 Dec in Costa Rica: 22 days from 27 Nov, where 24-hour spans read 23.
    const end = "2026-12-20T00:00:00Z";
    expect(closingDay(end, "America/Costa_Rica")).toBe("19 Dec 2026");
    expect(daysUntilClosing(end, "America/Costa_Rica", now)).toBe(22);
    expect(Math.ceil((new Date(end).getTime() - now.getTime()) / 86_400_000)).toBe(23);
  });

  it("says 0 on the closing day and never goes below it, and reads a civil date as written", () => {
    expect(daysUntilClosing("2026-11-27T23:00:00Z", "America/Costa_Rica", now)).toBe(0);
    expect(daysUntilClosing("2026-11-01T00:00:00Z", "America/Costa_Rica", now)).toBe(0);
    // Already 28 Nov in Kiritimati (UTC+14), so a 30 Nov close is two days off there.
    expect(daysUntilClosing("2026-11-30", "Pacific/Kiritimati", now)).toBe(2);
    expect(daysUntilClosing("2026-11-30", "America/Costa_Rica", now)).toBe(3);
    expect(daysUntilClosing(null, "UTC", now)).toBeNull();
  });
});
