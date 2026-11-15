/**
 * PAY SCALED BY THE MEMBER'S SPLIT (Rye, 14 Nov 2026, answer A), with no
 * database. When a member's roles are paid through separate applications,
 * each role's pay scales by its share of their time, from the split; every
 * other case leaves pay as the terms give it, and a scaled line waits for a
 * Treasurer's confirmation.
 */
import { describe, expect, it } from "vitest";
import { amountsMatch, confirmSplitLines, invoiceTotals, linesFromTerms, pricedCommitments, scaleBySplit, seenAmountsOf, splitHolds, splitUnconfirmed, type TermsInForce } from "./moonRecap";
import { applyAdjusts, adjustUnconfirmed, confirmAdjustLines } from "./accomplishedReview";

const MOON = { days: 30 };

function terms(over: Partial<TermsInForce> & { amount?: number }): TermsInForce {
  const { amount = 100_000, ...rest } = over;
  return {
    applicationId: "app-1",
    firstSeatId: "seat-1",
    roleIds: ["r1"],
    roleNames: ["Hosting"],
    settings: { v: 1, pay: { kind: "fixed", currency: "USD", amountMinor: amount, per: "moon" } },
    deliverables: null,
    daysHeld: 30,
    ...rest,
  };
}

/** Two roles, each on its own application, each paying 1,000.00 a moon. */
const APART = [
  terms({ applicationId: "app-1", firstSeatId: "seat-1", roleIds: ["r1"], roleNames: ["Hosting"] }),
  terms({ applicationId: "app-2", firstSeatId: "seat-2", roleIds: ["r2"], roleNames: ["Garden"] }),
];
const HELD = ["r1", "r2"];
const SPLIT_60_40 = [{ roleId: "r1", share: 60 }, { roleId: "r2", share: 40 }];
/**
 * A member who gives 100% across agreements each priced at full time: the
 * time a split gives each one is its share, so these cases read the share
 * straight through. The no-double-cut cases below price them otherwise.
 */
const FULL = { totalPct: 100, pricedPct: { "app-1": 100, "app-2": 100, a1: 100, a2: 100, a3: 100 } };

describe("scaleBySplit", () => {
  it("roles paid apart: each line scales by its role's share, and shows base, share and scaled amount", () => {
    const lines = scaleBySplit(linesFromTerms(APART, MOON), SPLIT_60_40, HELD, FULL);
    expect(lines.map((l) => l.amountMinor)).toEqual([60_000, 40_000]);
    expect(lines.map((l) => l.split)).toEqual([
      { sharePct: 60, givenPct: 60, pricedPct: 100, baseMinor: 100_000, scaledMinor: 60_000, confirmedBy: null, confirmedAt: null },
      { sharePct: 40, givenPct: 40, pricedPct: 100, baseMinor: 100_000, scaledMinor: 40_000, confirmedBy: null, confirmedAt: null },
    ]);
    expect(lines[0].basisLine).toContain("Your split gives this 60% of your time, and it was priced at 100%");
    expect(invoiceTotals(lines)).toEqual([{ currency: "USD", minor: 100_000 }]);
  });

  it("scales after proration, rounding once", () => {
    const part = [APART[0], { ...APART[1], daysHeld: 10 }];
    const lines = scaleBySplit(linesFromTerms(part, MOON), [{ roleId: "r1", share: 67 }, { roleId: "r2", share: 33 }], HELD, FULL);
    expect(lines.map((l) => l.amountMinor)).toEqual([67_000, Math.round((33_333 * 33) / 100)]);
  });

  it("one pay (every role on one application) is unchanged: nothing to split", () => {
    const one = [terms({ roleIds: ["r1", "r2"], roleNames: ["Hosting", "Garden"] })];
    const lines = scaleBySplit(linesFromTerms(one, MOON), SPLIT_60_40, HELD, FULL);
    expect(lines.map((l) => [l.amountMinor, l.split])).toEqual([[100_000, undefined]]);
  });

  it("one paid application beside a role with no pay is unchanged too", () => {
    const lines = scaleBySplit(linesFromTerms([APART[0]], MOON), SPLIT_60_40, HELD, FULL);
    expect(lines.map((l) => [l.amountMinor, l.split])).toEqual([[100_000, undefined]]);
  });

  it("fails closed with no split", () => {
    for (const none of [null, undefined, []]) {
      expect(scaleBySplit(linesFromTerms(APART, MOON), none, HELD, FULL).map((l) => [l.amountMinor, l.split])).toEqual([[100_000, undefined], [100_000, undefined]]);
    }
  });

  it("fails closed on a split that does not add up to 100", () => {
    for (const bad of [[{ roleId: "r1", share: 60 }, { roleId: "r2", share: 30 }], [{ roleId: "r1", share: 70 }, { roleId: "r2", share: 40 }]]) {
      expect(scaleBySplit(linesFromTerms(APART, MOON), bad, HELD, FULL).map((l) => [l.amountMinor, l.split])).toEqual([[100_000, undefined], [100_000, undefined]]);
    }
  });

  it("fails closed on a split for other roles than the ones held", () => {
    const stale = [{ roleId: "r1", share: 60 }, { roleId: "r9", share: 40 }];
    expect(scaleBySplit(linesFromTerms(APART, MOON), stale, HELD, FULL).map((l) => l.amountMinor)).toEqual([100_000, 100_000]);
    expect(scaleBySplit(linesFromTerms(APART, MOON), SPLIT_60_40, ["r1", "r2", "r3"], FULL).map((l) => l.amountMinor)).toEqual([100_000, 100_000]);
  });

  it("leaves an allowance and a range with no figure as they are", () => {
    const withAllowance = [
      { ...APART[0], settings: { v: 1 as const, pay: { kind: "fixed" as const, currency: "USD", amountMinor: 100_000, per: "moon" as const }, allowance: { kind: "flat" as const, currency: "USD", amountMinor: 5_000, per: "moon" as const } } },
      { ...APART[1], settings: { v: 1 as const, pay: { kind: "range" as const, currency: "USD", minMinor: 50_000, maxMinor: 80_000, per: "moon" as const } } },
    ];
    const lines = scaleBySplit(linesFromTerms(withAllowance, MOON), SPLIT_60_40, HELD, FULL);
    expect(lines.map((l) => [l.key, l.amountMinor, !!l.split])).toEqual([["app-1", 60_000, true], ["app-1:allowance", 5_000, false], ["app-2", null, false]]);
  });

  it("never rescales a range figure Finance set: that line keeps Finance's amount (QA F6)", () => {
    const ranged = [APART[0], { ...APART[1], settings: { v: 1 as const, pay: { kind: "range" as const, currency: "USD", minMinor: 50_000, maxMinor: 80_000, per: "moon" as const } } }];
    const lines = scaleBySplit(linesFromTerms(ranged, MOON, {}, { "app-2": 70_000 }), SPLIT_60_40, HELD, FULL);
    expect(lines.map((l) => [l.key, l.amountMinor, !!l.split])).toEqual([["app-1", 60_000, true], ["app-2", 70_000, false]]);
    // A member's own range proposal, with no Finance figure yet, still scales.
    const proposed = scaleBySplit(linesFromTerms(ranged, MOON, { "app-2": 70_000 }), SPLIT_60_40, HELD, FULL);
    expect(proposed.find((l) => l.key === "app-2")?.amountMinor).toBe(28_000);
  });

  it("refuses the split when a role is named on two pay lines: its share would count twice (QA F9)", () => {
    const dup = [
      terms({ applicationId: "a1", roleIds: ["r1"], roleNames: ["Hosting"] }),
      terms({ applicationId: "a2", roleIds: ["r1"], roleNames: ["Hosting"] }),
      terms({ applicationId: "a3", roleIds: ["r2"], roleNames: ["Garden"] }),
    ];
    const lines = scaleBySplit(linesFromTerms(dup, MOON), SPLIT_60_40, HELD, FULL);
    expect(lines.map((l) => [l.amountMinor, l.split])).toEqual([[100_000, undefined], [100_000, undefined], [100_000, undefined]]);
  });
});

describe("no double cut (Rye, 15 Nov 2026)", () => {
  /** An agreement for one role, with the commitment it was priced at in its terms. */
  const priced = (applicationId: string, roleId: string, pct: number, amount: number) =>
    terms({ applicationId, firstSeatId: `seat-${applicationId}`, roleIds: [roleId], roleNames: [roleId], amount, settings: { v: 1, pay: { kind: "fixed", currency: "USD", amountMinor: amount, per: "moon" }, clocks: { commitmentPct: pct } } });
  const scale = (t: TermsInForce[], split: Array<{ roleId: string; share: number }>, totalPct: number | null) =>
    scaleBySplit(linesFromTerms(t, MOON), split, HELD, { totalPct, pricedPct: pricedCommitments(t) });

  it("two roles priced at 50% for 6,500 each, a member giving 100% split 50/50: each pays 6,500, 13,000 in all", () => {
    const t = [priced("app-1", "r1", 50, 650_000), priced("app-2", "r2", 50, 650_000)];
    const lines = scale(t, [{ roleId: "r1", share: 50 }, { roleId: "r2", share: 50 }], 100);
    expect(lines.map((l) => l.amountMinor)).toEqual([650_000, 650_000]);
    expect(invoiceTotals(lines)).toEqual([{ currency: "USD", minor: 1_300_000 }]);
    // The Treasurer still sees base, share and scaled amount, and still confirms before it pays.
    expect(lines.map((l) => l.split)).toEqual([
      { sharePct: 50, givenPct: 50, pricedPct: 50, baseMinor: 650_000, scaledMinor: 650_000, confirmedBy: null, confirmedAt: null },
      { sharePct: 50, givenPct: 50, pricedPct: 50, baseMinor: 650_000, scaledMinor: 650_000, confirmedBy: null, confirmedAt: null },
    ]);
    expect(splitUnconfirmed(lines)).toBe(true);
  });

  it("a 30% agreement the split gives 50% of the member's time: base x time given / priced, held to the 120% cap (Rye, 15 Nov 2026)", () => {
    const t = [priced("app-1", "r1", 30, 300_000), priced("app-2", "r2", 70, 700_000)];
    const split = [{ roleId: "r1", share: 50 }, { roleId: "r2", share: 50 }];
    // Giving 100%: 50% of them goes to each. 300,000 x 50 / 30 = 500,000 is above 120% of its terms, so it pays 360,000.
    const full = scale(t, split, 100);
    expect(full.map((l) => [l.amountMinor, l.split?.givenPct, l.split?.pricedPct, l.split?.capped])).toEqual([[360_000, 50, 30, true], [500_000, 50, 70, undefined]]);
    expect(full[0].split).toMatchObject({ baseMinor: 300_000, scaledMinor: 360_000, confirmedAt: null });
    expect(full[0].basisLine).toContain("capped at 120%");
    // The Treasurer still confirms a capped line before it pays.
    expect(splitUnconfirmed(full)).toBe(true);
    // Giving 60%: 30% of them to each. The 30% agreement pays its terms, the 70% one three sevenths of them.
    expect(scale(t, split, 60).map((l) => l.amountMinor)).toEqual([300_000, Math.round((700_000 * 60 * 50) / (100 * 70))]);
  });

  it("the cap is 120% of the terms exactly: a line at it is not marked, one a unit over is held there", () => {
    const t = [priced("app-1", "r1", 50, 650_000), priced("app-2", "r2", 50, 650_000)];
    // 60% of a 100% member to a 50% agreement is 120% of it: at the cap, not over.
    const at = scale(t, [{ roleId: "r1", share: 60 }, { roleId: "r2", share: 40 }], 100);
    expect(at.map((l) => [l.amountMinor, l.split?.capped])).toEqual([[780_000, undefined], [520_000, undefined]]);
    // 70% is 140%: held at 780,000.
    const over = scale(t, [{ roleId: "r1", share: 70 }, { roleId: "r2", share: 30 }], 100);
    expect(over.map((l) => [l.amountMinor, l.split?.capped])).toEqual([[780_000, true], [390_000, undefined]]);
  });

  it("a split that matches the priced commitments pays the terms exactly", () => {
    const t = [priced("app-1", "r1", 30, 300_000), priced("app-2", "r2", 70, 700_000)];
    expect(scale(t, [{ roleId: "r1", share: 30 }, { roleId: "r2", share: 70 }], 100).map((l) => l.amountMinor)).toEqual([300_000, 700_000]);
  });

  it("fails closed when an agreement states no priced commitment, or there is no total beside the split", () => {
    const split = [{ roleId: "r1", share: 50 }, { roleId: "r2", share: 50 }];
    const unpriced = [priced("app-1", "r1", 50, 650_000), terms({ applicationId: "app-2", roleIds: ["r2"], roleNames: ["Garden"], amount: 650_000 })];
    expect(scale(unpriced, split, 100).map((l) => [l.amountMinor, l.split])).toEqual([[650_000, undefined], [650_000, undefined]]);
    const both = [priced("app-1", "r1", 50, 650_000), priced("app-2", "r2", 50, 650_000)];
    for (const total of [null, 0, 101, Number.NaN]) {
      expect(scale(both, split, total).map((l) => [l.amountMinor, l.split]), String(total)).toEqual([[650_000, undefined], [650_000, undefined]]);
    }
  });

  it("reads the priced commitment from each agreement's terms, leaving out agreements that state none", () => {
    expect(pricedCommitments([priced("app-1", "r1", 50, 1), terms({ applicationId: "app-2" }), priced("app-3", "r3", 0, 1)])).toEqual({ "app-1": 50 });
  });
});

describe("a proposed amount on a scaled line (QA F1)", () => {
  const scaled = () => scaleBySplit(linesFromTerms(APART, MOON), SPLIT_60_40, HELD, FULL);
  const P = { "app-1": { adjustedMinor: 70_000, reason: "Took on more.", proposedBy: "u-fin", proposedAt: "2026-11-21T10:00:00.000Z" } };

  it("the split is read against the proposal's base, so one confirm clears both and nothing deadlocks", () => {
    const lines = applyAdjusts(scaled(), P);
    const one = lines.find((l) => l.key === "app-1")!;
    expect(one).toMatchObject({ amountMinor: 70_000, split: { scaledMinor: 60_000 }, adjust: { baseMinor: 60_000, adjustedMinor: 70_000 } });
    expect(lines.every(splitHolds)).toBe(true);
    const done = confirmAdjustLines(confirmSplitLines(lines, "u-treasurer", "2026-11-22T09:00:00.000Z"), "u-treasurer", "2026-11-22T09:00:00.000Z");
    expect(splitUnconfirmed(done)).toBe(false);
    expect(adjustUnconfirmed(done)).toBe(false);
  });

  it("still catches a split that moved under the proposal", () => {
    const lines = applyAdjusts(scaled(), P).map((l) => (l.split ? { ...l, split: { ...l.split, scaledMinor: l.split.scaledMinor + 1, confirmedAt: "t" } } : l));
    expect(splitUnconfirmed(lines)).toBe(true);
  });
});

describe("the amounts a Treasurer confirms (QA F2)", () => {
  it("match only the exact lines and amounts that were read", () => {
    const lines = scaleBySplit(linesFromTerms(APART, MOON), SPLIT_60_40, HELD, FULL);
    const seen = seenAmountsOf(lines);
    expect(seen).toEqual({ "app-1": 60_000, "app-2": 40_000 });
    expect(amountsMatch(lines, seen)).toBe(true);
    expect(amountsMatch(lines, { ...seen, "app-1": 59_999 })).toBe(false);
    expect(amountsMatch(lines, { "app-1": 60_000 })).toBe(false);
    expect(amountsMatch(lines, { ...seen, extra: 1 })).toBe(false);
    for (const bad of [undefined, null, "x", [60_000, 40_000]]) expect(amountsMatch(lines, bad)).toBe(false);
  });
});

describe("the Treasurer's confirmation", () => {
  it("a scaled line is unconfirmed until confirmed, and a confirmation names who and when without changing an amount", () => {
    const lines = scaleBySplit(linesFromTerms(APART, MOON), SPLIT_60_40, HELD, FULL);
    expect(splitUnconfirmed(lines)).toBe(true);
    const done = confirmSplitLines(lines, "u-treasurer", "2026-11-14T10:00:00.000Z");
    expect(splitUnconfirmed(done)).toBe(false);
    expect(done.map((l) => [l.amountMinor, l.split?.confirmedBy, l.split?.confirmedAt])).toEqual([
      [60_000, "u-treasurer", "2026-11-14T10:00:00.000Z"],
      [40_000, "u-treasurer", "2026-11-14T10:00:00.000Z"],
    ]);
  });

  it("an amount that moved after confirming needs confirming again", () => {
    const done = confirmSplitLines(scaleBySplit(linesFromTerms(APART, MOON), SPLIT_60_40, HELD, FULL), "u-treasurer", "2026-11-14T10:00:00.000Z");
    expect(splitUnconfirmed([{ ...done[0], amountMinor: 100_000 }, done[1]])).toBe(true);
  });

  it("lines the split never touched need no confirmation", () => {
    expect(splitUnconfirmed(linesFromTerms(APART, MOON))).toBe(false);
  });
});
