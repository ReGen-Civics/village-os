import { describe, expect, it } from "vitest";
import { CEILING_PERIODS } from "./roleCardSections";
import { aboveCap, askAboveCap, capAt, RANGE_WORDS, ROLE_PAY_CAP_PCT, ASK_PERIODS, askPeriod, ceilingAt, commitmentChoices, digitsOf, priceDifferencePct, signedPct, PRICE_WHY_MAX, fillWords, payAskOf, rangeMin, readCommitmentMin, readCommitmentTarget, readPayAsk, roleFill } from "./commitmentRange";

describe("the 120% cap on a proposal (Rye, 15 Nov 2026)", () => {
  it("is 120% of the listed price at the commitment: $13,000 caps at $15,600 at 100%, $7,800 at 50%", () => {
    expect(ROLE_PAY_CAP_PCT).toBe(120);
    expect(capAt(13000, 100)).toBe(15600);
    expect(capAt(13000, 50)).toBe(7800);
    expect(capAt(13000, 30)).toBe(4680);
    // Whole units, rounded down, and no floating-point unit lost: 1,234 at 30% is 370.2, capped 444.24.
    expect(capAt(1234, 30)).toBe(444);
    expect(capAt(0, 50)).toBe(0);
    expect(capAt(13000, 0)).toBe(0);
  });
  it("refuses an ask just over the cap and takes one at it; negotiate is never over", () => {
    const ask = (monthly: number) => ({ kind: "amount" as const, monthly });
    expect(askAboveCap(ask(7801), 13000, 50)).toBe(true);
    expect(askAboveCap(ask(7800), 13000, 50)).toBe(false);
    expect(askAboveCap(ask(15601), 13000, 100)).toBe(true);
    expect(askAboveCap(ask(15600), 13000, 100)).toBe(false);
    // No commitment chosen yet: the full role's cap.
    expect(askAboveCap(ask(15601), 13000, null)).toBe(true);
    expect(askAboveCap({ kind: "negotiate" }, 13000, 50)).toBe(false);
    expect(askAboveCap(null, 13000, 50)).toBe(false);
  });
  it("says why in plain words", () => {
    expect(aboveCap("$7,800", 50)).toBe("Proposals for this role go up to $7,800 at 50%, 120% of its listed price. Choose a price at or below that.");
  });
});

describe("price-ask attack cases (QA-1115 hostile edges)", () => {
  it.each([
    [{ kind: "amount", monthly: -5 }],
    [{ kind: "amount", monthly: "NaN" }],
    [{ kind: "amount", monthly: "5,000" }],
    [{ kind: "amount", monthly: 0 }],
    [{ kind: "amount", monthly: 1.5 }],
    [{ kind: "amount", monthly: Infinity }],
    [{ kind: "amount", monthly: Number.NaN }],
    [{ kind: "amount", monthly: 100_000_001 }],
  ])("refuses the figure %j", (ask) => expect(readPayAsk(ask)).toEqual({ ok: false, problem: RANGE_WORDS.askAmount }));
  it("refuses a period it does not know, never reading it as a month", () => {
    expect(readPayAsk({ kind: "amount", monthly: 50, per: "hour" })).toEqual({ ok: false, problem: RANGE_WORDS.askPeriod });
    expect(readPayAsk({ kind: "amount", monthly: 50, per: null })).toEqual({ ok: false, problem: RANGE_WORDS.askPeriod });
    // CONTROL: no period is a month, as asks were before they said; a known period is kept.
    expect(readPayAsk({ kind: "amount", monthly: 50 })).toEqual({ ok: true, value: { kind: "amount", monthly: 50 } });
    expect(readPayAsk({ kind: "amount", monthly: 50, per: "moon" })).toEqual({ ok: true, value: { kind: "amount", monthly: 50, per: "moon" } });
  });
  it("refuses negotiate sent with a figure, never dropping the figure without a word", () => {
    expect(readPayAsk({ kind: "negotiate", monthly: 5000 })).toEqual({ ok: false, problem: RANGE_WORDS.askBoth });
    expect(readPayAsk({ kind: "negotiate", monthly: "5000" })).toEqual({ ok: false, problem: RANGE_WORDS.askBoth });
    expect(readPayAsk({ kind: "negotiate", why: "I'd like to talk" })).toEqual({ ok: true, value: { kind: "negotiate", why: "I'd like to talk" } });
  });
  it("refuses an ask that is present but is neither kind", () => {
    for (const ask of [{ kind: "AMOUNT", monthly: 50 }, [1, 2], "5000", 5000, {}, { monthly: 5000 }]) {
      expect(readPayAsk(ask), JSON.stringify(ask)).toEqual({ ok: false, problem: RANGE_WORDS.askShape });
    }
    // Absent is no ask.
    expect(readPayAsk(undefined)).toEqual({ ok: true, value: null });
    expect(readPayAsk(null)).toEqual({ ok: true, value: null });
  });
  it("an absurd figure the reader takes is still above the cap the route checks", () => {
    const ask = readPayAsk({ kind: "amount", monthly: 100_000_000 });
    expect(ask.ok).toBe(true);
    expect(askAboveCap(ask.ok ? ask.value : null, 13000, 100)).toBe(true);
  });
});

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

describe("reading digits without a slow pattern (CodeQL js/polynomial-redos)", () => {
  it("reads a percent or an amount with spaces around it", () => {
    expect(digitsOf(" 30 % ", 4, true)).toBe(30);
    expect(digitsOf("6500", 9)).toBe(6500);
    expect(digitsOf("65 00", 9)).toBeNaN();
    expect(digitsOf("%", 4, true)).toBeNaN();
  });
  it("answers at once for a long run of tabs and spaces, and refuses it", () => {
    const long = "\t".repeat(100_000) + "1" + " ".repeat(100_000) + "x";
    const started = Date.now();
    expect(readCommitmentMin(long).ok).toBe(false);
    expect(readCommitmentTarget(long).ok).toBe(false);
    expect(readPayAsk({ kind: "amount", monthly: long }).ok).toBe(false);
    expect(Date.now() - started).toBeLessThan(100);
  });
});

describe("the price a contractor proposes (Rye, 14 Nov 2026)", () => {
  it("keeps a price above or below the suggestion, with an optional why", () => {
    expect(readPayAsk({ kind: "amount", monthly: 7000, why: "  Two of my changes add work.  " })).toEqual({ ok: true, value: { kind: "amount", monthly: 7000, why: "Two of my changes add work." } });
    expect(readPayAsk({ kind: "amount", monthly: 20000 })).toEqual({ ok: true, value: { kind: "amount", monthly: 20000 } });
    expect(readPayAsk({ kind: "negotiate", why: "Depends on the first moon." })).toEqual({ ok: true, value: { kind: "negotiate", why: "Depends on the first moon." } });
    expect(readPayAsk({ kind: "amount", monthly: 7000, why: "x".repeat(PRICE_WHY_MAX + 1) }).ok).toBe(false);
  });
  it("says the difference on the suggested price as a whole signed percent", () => {
    expect(priceDifferencePct(6500, 7000)).toBe(8);
    expect(priceDifferencePct(6500, 5525)).toBe(-15);
    expect(priceDifferencePct(6500, 6500)).toBe(0);
    expect(priceDifferencePct(0, 7000)).toBeNull();
  });
  it("an ask keeps the period it was written in, and an unknown period is refused (QA F7; QA-1115 hostile edges)", () => {
    expect(readPayAsk({ kind: "amount", monthly: 78000, per: "year" })).toEqual({ ok: true, value: { kind: "amount", monthly: 78000, per: "year" } });
    expect(readPayAsk({ kind: "amount", monthly: 500, per: "moon" })).toEqual({ ok: true, value: { kind: "amount", monthly: 500, per: "moon" } });
    expect(readPayAsk({ kind: "amount", monthly: 500, per: "fortnight" })).toEqual({ ok: false, problem: RANGE_WORDS.askPeriod });
    expect(askPeriod({})).toBe("month");
    expect(askPeriod({ per: "year" })).toBe("year");
    // The ask's periods are the ceiling's, written twice only to keep pay modules off seatSettings.
    expect([...ASK_PERIODS]).toEqual([...CEILING_PERIODS]);
    expect([signedPct(8), signedPct(-15), signedPct(0)]).toEqual(["+8%", "-15%", "0%"]);
  });
});
