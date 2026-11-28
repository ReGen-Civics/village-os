import { describe, expect, it } from "vitest";
import { BOOKED_MAX_DAYS, BOOKED_WORDS, readBookedAt, sayBookedAt, sayVillageTime } from "./callBooked";

const NOW = new Date("2026-12-01T12:00:00Z");

describe("I've booked it (the lead, 27 Nov 2026)", () => {
  it("accepts a future instant within the window, and refuses the past, the far and the unreadable", () => {
    expect(readBookedAt("2026-12-03T16:00:00.000Z", NOW)).toEqual({ ok: true, at: new Date("2026-12-03T16:00:00Z") });
    expect(readBookedAt("2026-12-03T10:00-06:00", NOW)).toEqual({ ok: true, at: new Date("2026-12-03T16:00:00Z") });
    expect(readBookedAt("2026-11-30T16:00:00Z", NOW)).toEqual({ ok: false, error: "past" });
    expect(readBookedAt(NOW.toISOString(), NOW)).toEqual({ ok: false, error: "past" });
    expect(readBookedAt(new Date(NOW.getTime() + (BOOKED_MAX_DAYS + 1) * 86_400_000).toISOString(), NOW)).toEqual({ ok: false, error: "far" });
    // No zone: never guessed.
    for (const raw of ["2026-12-03T10:00", "next Tuesday", "", null, 42]) expect(readBookedAt(raw, NOW)).toEqual({ ok: false, error: "when" });
  });

  it("says the time in the reader's zone with the village's beside it, the day too when they differ", () => {
    const at = new Date("2026-12-03T16:00:00Z");
    const local = sayBookedAt(at, "America/New_York", "en");
    const village = sayVillageTime(at, "America/New_York", "America/Costa_Rica", "en");
    expect(BOOKED_WORDS.en.booked(local, village, "Costa Rica time")).toBe("Booked: Thu 3 Dec, 11:00 your time (10:00 Costa Rica time)");
    // Across midnight, the village's day is said too.
    expect(sayVillageTime(new Date("2026-12-04T03:00:00Z"), "Europe/Berlin", "America/Costa_Rica", "en")).toBe("Thu 3 Dec, 21:00");
    expect(BOOKED_WORDS.en.booked(sayBookedAt(at, "America/Costa_Rica", "en"), null, "Costa Rica time")).toBe("Booked: Thu 3 Dec, 10:00 Costa Rica time");
    expect(BOOKED_WORDS.es.booked(sayBookedAt(at, "America/New_York", "es"), sayVillageTime(at, "America/New_York", "America/Costa_Rica", "es"), "hora de Costa Rica")).toBe("Reservada: jue, 3 dic, 11:00 su hora (10:00 hora de Costa Rica)");
  });
});
