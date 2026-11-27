/**
 * The pool lantern's closing day (QA round 2, 27 Nov 2026): the browser's own format read "12/19/2026" for a pool that
 * closes on 20 Dec, in the reader's zone and month-first. It reads as the village says a day, in the village's zone.
 */
import { describe, expect, it } from "vitest";
import { closingDay } from "./PoolPieces";

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
