/**
 * The day a village vote closes, as the decide doors print it inside "The village is voting on this until {day}."
 * English keeps the short day it always read; Spanish reads its own long form.
 */
import { describe, expect, it } from "vitest";
import { formatDay } from "@shared/roleSheet";
import { votingDay } from "./DecideDoors";

const closes = "2027-03-21T15:00:00.000Z";

describe("votingDay", () => {
  it("keeps the English the doors always printed", () => {
    expect(votingDay(closes, "en")).toBe(formatDay(closes));
    expect(votingDay(closes, "en-XA")).toBe(formatDay(closes));
  });

  it("says the day in Spanish for a Spanish reader", () => {
    expect(votingDay(closes, "es")).toBe("21 de marzo de 2027");
  });

  it("falls back to the English day for an instant it cannot read", () => {
    expect(votingDay("not a day", "es")).toBe("");
  });
});
