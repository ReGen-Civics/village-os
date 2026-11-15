/**
 * A MONTH'S SPLIT PAY IS WEIGHTED BY THE DAYS EACH SPLIT WAS IN PLACE (Rye,
 * 15 Nov 2026, P1-3), with no database. A member who changes their split
 * mid-moon is paid each split for its own days, never the last day's split for
 * the whole moon.
 */
import { describe, expect, it } from "vitest";
import { linesFromTerms, scaleBySplit, scaleBySplitDays, type SplitPeriod, type TermsInForce } from "./moonRecap";

const MOON = { days: 30 };
const terms = (applicationId: string, roleId: string): TermsInForce => ({
  applicationId,
  firstSeatId: `seat-${roleId}`,
  roleIds: [roleId],
  roleNames: [roleId],
  settings: { v: 1, pay: { kind: "fixed", currency: "USD", amountMinor: 100_000, per: "moon" } },
  deliverables: null,
  daysHeld: 30,
});
const APART = [terms("app-1", "r1"), terms("app-2", "r2")];
const HELD = ["r1", "r2"];
const PRICED = { "app-1": 50, "app-2": 50 };
const period = (fromDay: string, days: number, r1: number, givenPct = 100): SplitPeriod => ({ fromDay, days, givenPct, split: [{ roleId: "r1", share: r1 }, { roleId: "r2", share: 100 - r1 }] });

describe("scaleBySplitDays", () => {
  it("weights each split by its days: 10 days at 50/50 and 20 at 80/20", () => {
    const lines = scaleBySplitDays(linesFromTerms(APART, MOON), [period("2026-10-01", 10, 50), period("2026-10-11", 20, 80)], HELD, PRICED);
    // r1: 10 days at 1,000.00 (50% given, priced 50%) and 20 days at 1,200.00 (80% given, held to the 120% cap).
    expect(lines[0].amountMinor).toBe(Math.round((100_000 * 10 + 120_000 * 20) / 30));
    // r2: 10 days at 1,000.00 and 20 days at 400.00 (20% given, priced at 50%).
    expect(lines[1].amountMinor).toBe(Math.round((100_000 * 10 + 40_000 * 20) / 30));
    expect(lines[1].split).toMatchObject({ baseMinor: 100_000, scaledMinor: lines[1].amountMinor, givenPct: 30, pricedPct: 50 });
    expect(lines[1].split?.periods).toEqual([
      { fromDay: "2026-10-01", days: 10, givenPct: 50, scaledMinor: 33_333 },
      { fromDay: "2026-10-11", days: 20, givenPct: 20, scaledMinor: 26_667 },
    ]);
    expect(lines[0].split?.capped).toBe(true);
    expect(lines[1].basisLine).toContain("weighted by the days each of your 2 splits held this moon");
  });

  it("CONTROL: the last day's split alone would pay the whole moon at 80/20", () => {
    const last = scaleBySplit(linesFromTerms(APART, MOON), period("2026-10-11", 30, 80).split, HELD, { totalPct: 100, pricedPct: PRICED });
    const weighted = scaleBySplitDays(linesFromTerms(APART, MOON), [period("2026-10-01", 10, 50), period("2026-10-11", 20, 80)], HELD, PRICED);
    expect(last[1].amountMinor).toBe(40_000);
    expect(weighted[1].amountMinor).not.toBe(last[1].amountMinor);
  });

  it("days before any split pay the terms for those days", () => {
    const none: SplitPeriod = { fromDay: "2026-10-01", days: 15, split: null, givenPct: null };
    const lines = scaleBySplitDays(linesFromTerms(APART, MOON), [none, period("2026-10-16", 15, 80)], HELD, PRICED);
    expect(lines[1].amountMinor).toBe(Math.round((100_000 * 15 + 40_000 * 15) / 30));
    expect(lines[1].split?.periods?.[0]).toMatchObject({ givenPct: null, scaledMinor: 50_000 });
  });

  it("one split all moon is scaleBySplit exactly", () => {
    const one = scaleBySplitDays(linesFromTerms(APART, MOON), [period("2026-10-01", 30, 60)], HELD, PRICED);
    expect(one).toEqual(scaleBySplit(linesFromTerms(APART, MOON), period("2026-10-01", 30, 60).split, HELD, { totalPct: 100, pricedPct: PRICED }));
    expect(one[0].split?.periods).toBeUndefined();
  });

  it("no split on any day leaves every line as the terms give it", () => {
    const lines = scaleBySplitDays(linesFromTerms(APART, MOON), [{ fromDay: "2026-10-01", days: 30, split: null, givenPct: null }], HELD, PRICED);
    expect(lines.map((l) => [l.amountMinor, l.split ?? null])).toEqual([[100_000, null], [100_000, null]]);
  });
});
