import { describe, expect, it } from "vitest";
import { ceilingAt, commitmentChoices, fillWords, payAskOf, rangeMin, readCommitmentMin, readCommitmentTarget, readPayAsk, roleFill } from "./commitmentRange";

describe("the commitment range (Rye, 14 Nov 2026)", () => {
  it("pays straight proportional to the full band: 50% of $13,000 is up to $6,500 (ruling 1)", () => {
    expect(ceilingAt(13000, 50)).toBe(6500);
    expect(ceilingAt(13000, 30)).toBe(3900);
    expect(ceilingAt(13000, 100)).toBe(13000);
    expect(ceilingAt(13000, 33)).toBe(4290);
    expect(ceilingAt(0, 50)).toBe(0);
  });
  it("offers choices from the role's minimum to 100, in steps of 10; no minimum is the whole role only (ruling 2)", () => {
    expect(commitmentChoices(30)).toEqual([30, 40, 50, 60, 70, 80, 90, 100]);
    expect(commitmentChoices(35)).toEqual([40, 50, 60, 70, 80, 90, 100]);
    expect(commitmentChoices(null)).toEqual([100]);
    expect(rangeMin(undefined)).toBe(100);
  });
  it("fills beyond 100% and stays open while below the target (ruling 4)", () => {
    expect(roleFill([50], null)).toEqual({ heldPct: 50, targetPct: 100, openPct: 50, covered: false });
    expect(fillWords(roleFill([50], null))).toBe("50% held · 50% open");
    expect(fillWords(roleFill([60, 60], 100))).toBe("120% held · covered");
    expect(roleFill([100, 100], 300).covered).toBe(false);
    // A holder whose terms name no commitment holds the whole role.
    expect(roleFill([null], 100).covered).toBe(true);
    expect(roleFill([], 100)).toMatchObject({ heldPct: 0, openPct: 100, covered: false });
  });
  it("reads the role's two fields and refuses what is out of range", () => {
    expect(readCommitmentMin("30%")).toEqual({ ok: true, value: 30 });
    expect(readCommitmentMin(0).ok).toBe(false);
    expect(readCommitmentMin(101).ok).toBe(false);
    expect(readCommitmentTarget(300)).toEqual({ ok: true, value: 300 });
    expect(readCommitmentTarget(1001).ok).toBe(false);
    expect(readCommitmentTarget("")).toEqual({ ok: true, value: null });
  });
  it("reads the optional ask: an amount or negotiate, nothing otherwise (ruling 3)", () => {
    expect(readPayAsk({ kind: "amount", monthly: "6500" })).toEqual({ ok: true, value: { kind: "amount", monthly: 6500 } });
    expect(readPayAsk({ kind: "negotiate" })).toEqual({ ok: true, value: { kind: "negotiate" } });
    expect(readPayAsk({ kind: "amount", monthly: -5 }).ok).toBe(false);
    expect(readPayAsk(undefined)).toEqual({ ok: true, value: null });
    expect(payAskOf({ kind: "amount", monthly: "lots" })).toBeNull();
  });
});
