import { describe, expect, it } from "vitest";
import { changedShares, offeredSplit, proposalSplitOf, readProposedSplit, retotal, setAmount, setPercent, shapePercents, shareOut, splitChanged, splitTotal, withAmounts } from "./proposalSplit";

const SHAPE = [
  { label: "Cash", pct: 60 },
  { label: "Equity", pct: 40 },
  { label: "Credits", pct: 0 },
];
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const amounts = (s: { shares: Array<{ amount?: number }> }) => s.shares.map((x) => x.amount ?? 0);
const pcts = (s: { shares: Array<{ pct: number }> }) => s.shares.map((x) => x.pct);

describe("sharing a total out", () => {
  it("adds up to the total exactly, whole units, whatever the rounding", () => {
    for (const t of [0, 1, 7, 9623, 12029, 5773, 100001]) {
      const out = shareOut(t, [33, 33, 34]);
      expect(sum(out)).toBe(t);
      out.forEach((n) => expect(Number.isInteger(n)).toBe(true));
    }
  });
  it("shares evenly when every weight is 0", () => {
    expect(shareOut(10, [0, 0])).toEqual([5, 5]);
  });
});

describe("the offered split", () => {
  it("is the shape in force, its amounts adding to the total at the commitment", () => {
    const total = splitTotal(12029, 60, null)!;
    expect(total).toBe(7217);
    const o = offeredSplit(SHAPE, total);
    expect(pcts(o)).toEqual([60, 40, 0]);
    expect(sum(amounts(o))).toBe(7217);
    expect(o.shares[0].amount).toBe(4330);
  });
  it("gives a shape under 100 the rest as credits, else to the last share", () => {
    expect(pcts({ shares: shapePercents([{ label: "Cash", pct: 50 }, { label: "Credits", pct: 0 }, { label: "Equity", pct: 30 }]) })).toEqual([50, 20, 30]);
    expect(pcts({ shares: shapePercents([{ label: "Cash", pct: 50 }, { label: "Equity", pct: 30 }]) })).toEqual([50, 50]);
  });
  it("prices at 100% before a commitment is chosen, and at their own price when they wrote one", () => {
    expect(splitTotal(12029, null, null)).toBe(12029);
    expect(splitTotal(12029, 50, 7000)).toBe(7000);
    expect(splitTotal(null, 50, null)).toBeNull();
  });
});

describe("editing the split both ways", () => {
  const start = offeredSplit(SHAPE, 10000);
  it("a percent sets its amount, and the others rebalance by their size to 100", () => {
    const s = setPercent(start, 0, 50);
    expect(pcts(s)).toEqual([50, 50, 0]);
    expect(amounts(s)).toEqual([5000, 5000, 0]);
  });
  it("a percent takes from every other share by its size", () => {
    const s = setPercent(withAmounts([{ label: "Cash", pct: 50 }, { label: "Equity", pct: 30 }, { label: "Credits", pct: 20 }], 10000), 0, 0);
    expect(pcts(s)).toEqual([0, 60, 40]);
    expect(sum(amounts(s))).toBe(10000);
  });
  it("raising a share at 0 when the others hold it all draws from them", () => {
    const s = setPercent(start, 2, 10);
    expect(pcts(s)).toEqual([54, 36, 10]);
    expect(amounts(s)).toEqual([5400, 3600, 1000]);
  });
  it("an amount keeps exactly what was typed and sets its percent", () => {
    const s = setAmount(start, 1, 2550);
    expect(s.shares[1]).toEqual({ label: "Equity", pct: 26, amount: 2550 });
    expect(sum(amounts(s))).toBe(10000);
    expect(sum(pcts(s))).toBe(100);
    expect(s.shares[0].amount).toBe(7450);
  });
  it("holds a value above the whole to the whole", () => {
    expect(pcts(setPercent(start, 0, 140))).toEqual([100, 0, 0]);
    expect(amounts(setAmount(start, 0, 99999))).toEqual([10000, 0, 0]);
  });
  it("a new commitment keeps the percents and works the amounts again", () => {
    const s = retotal(setPercent(start, 0, 70), 5000);
    expect(pcts(s)).toEqual([70, 30, 0]);
    expect(amounts(s)).toEqual([3500, 1500, 0]);
  });
});

describe("whether the applicant changed the split", () => {
  const offered = offeredSplit(SHAPE, 10000);
  it("is false for an untouched split, at their own price too", () => {
    expect(splitChanged(offered, offered)).toBe(false);
    expect(splitChanged(offered, retotal(offered, 12000))).toBe(false);
  });
  it("is true for a changed percent, and names the shares that changed", () => {
    const p = setPercent(offered, 2, 10);
    expect(splitChanged(offered, p)).toBe(true);
    expect(changedShares(offered, p)).toEqual([true, true, true]);
    const q = setPercent(offered, 0, 50);
    expect(changedShares(offered, q)).toEqual([true, true, false]);
  });
});

describe("the split the server keeps", () => {
  it("reads a proposed split against the shape and the price", () => {
    const sent = { shares: [{ label: "Cash", pct: 50, amount: 3500 }, { label: "Equity", pct: 50, amount: 3500 }, { label: "Credits", pct: 0, amount: 0 }] };
    expect(readProposedSplit(sent, SHAPE, 7000)).toEqual({ ok: true, value: { total: 7000, ...sent } });
    expect(readProposedSplit(null, SHAPE, 7000)).toEqual({ ok: true, value: null });
  });
  it("works the amounts when only percents were sent, and keeps percents alone with no readable price", () => {
    const sent = [{ label: "Cash", pct: 50 }, { label: "Equity", pct: 50 }, { label: "Credits", pct: 0 }];
    const r = readProposedSplit(sent, SHAPE, 7001);
    expect(r.ok && amounts(r.value!)).toEqual([3501, 3500, 0]);
    const n = readProposedSplit(sent, SHAPE, null);
    expect(n.ok && n.value).toEqual({ total: null, shares: sent });
  });
  it("refuses labels out of the shape, percents not adding to 100, fractions, and amounts off the price", () => {
    expect(readProposedSplit([{ label: "Cash", pct: 100 }], SHAPE, 100).ok).toBe(false);
    expect(readProposedSplit([{ label: "Cash", pct: 60 }, { label: "Equity", pct: 30 }, { label: "Credits", pct: 0 }], SHAPE, 100).ok).toBe(false);
    expect(readProposedSplit([{ label: "Cash", pct: 59.5 }, { label: "Equity", pct: 40.5 }, { label: "Credits", pct: 0 }], SHAPE, 100).ok).toBe(false);
    expect(readProposedSplit([{ label: "Cash", pct: 60, amount: 61 }, { label: "Equity", pct: 40, amount: 40 }, { label: "Credits", pct: 0, amount: 0 }], SHAPE, 100).ok).toBe(false);
    expect(readProposedSplit([{ label: "Cash", pct: 100 }], [], 100).ok).toBe(false);
  });
  it("reads a stored pair back, and nothing unreadable", () => {
    const pair = { commitmentPct: 60, offered: offeredSplit(SHAPE, 7217), proposed: setPercent(offeredSplit(SHAPE, 7217), 0, 50) };
    expect(proposalSplitOf(JSON.parse(JSON.stringify(pair)))).toEqual(pair);
    expect(proposalSplitOf({ offered: {}, proposed: {} })).toBeNull();
    expect(proposalSplitOf("x")).toBeNull();
  });
});
