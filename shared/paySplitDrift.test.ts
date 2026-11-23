/**
 * A split said by hand that the card does not pay (the coordinator, 23 Nov 2026): what the reader finds in words,
 * and what it leaves alone. Each refusal has a control beside it that differs in the one thing being tested.
 */
import { describe, expect, it } from "vitest";
import { splitDrift, splitDriftProblem, statedSplits, storedSplitWords } from "./paySplitDrift";

const SHAPE = [{ label: "Cash", pct: 60 }, { label: "Equity", pct: 40 }, { label: "Credits", pct: 0 }];
const at = (text: string) => splitDrift([{ field: "aim", text }], SHAPE);

describe("the splits a text names", () => {
  it("reads a percent and its share, a share and its percent, and a slash split about pay", () => {
    expect(statedSplits("Paid 60% cash, 40% tokens.").map((s) => s.parts)).toEqual([{ cash: 60 }, { equity: 40 }]);
    expect(statedSplits("55% paid in Harbour tokens").map((s) => s.parts)).toEqual([{ equity: 55 }]);
    expect(statedSplits("Cash: 70%, Credits 5%").map((s) => s.parts)).toEqual([{ cash: 70 }, { credits: 5 }]);
    expect(statedSplits("A 70/30 split between cash and tokens.").map((s) => s.parts)).toEqual([{ cash: 70, equity: 30 }]);
    expect(statedSplits("Paid 50/45/5.").map((s) => s.parts)).toEqual([{ cash: 50, equity: 45, credits: 5 }]);
  });

  it("names no share in a percent about something else, and no split in a slash that is not one", () => {
    expect(statedSplits("At 60% commitment and cash flow.")).toEqual([]);
    expect(statedSplits("On call 24/7 for the water.")).toEqual([]);
    // Adds to 100 but says nothing about pay.
    expect(statedSplits("A 50/50 chance of rain.")).toEqual([]);
    expect(statedSplits("Due 2026/11/30.")).toEqual([]);
    // "60% cash 40% tokens" without a comma: 40 is the tokens' share, never the cash's.
    expect(statedSplits("60% cash 40% tokens").map((s) => s.parts)).toEqual([{ cash: 60 }, { equity: 40 }]);
  });
});

describe("a split the shape does not pay", () => {
  it("refuses words that name a different split, and passes the same words with the shape's own numbers (control)", () => {
    expect(at("Paid 70% cash, 30% tokens.")).toEqual({ field: "aim", said: "70% cash" });
    expect(at("Paid 60% cash, 40% tokens.")).toBeNull();
    expect(at("A 70/30 split.")).toEqual({ field: "aim", said: "70/30" });
    expect(at("A 60/40 split.")).toBeNull();
    // One share named, and it agrees: nothing to refuse.
    expect(at("40% in tokens")).toBeNull();
    expect(at("50% in tokens")).toEqual({ field: "aim", said: "50% tokens" });
  });

  it("compares nothing when the shape is empty or reads as no share", () => {
    expect(splitDrift([{ field: "aim", text: "70% cash" }], [])).toBeNull();
    expect(splitDrift([{ field: "aim", text: "70% cash" }], [{ label: "Housing", pct: 30 }, { label: "Cash", pct: 70 }])).toBeNull();
  });

  it("says the words, where they are and the stored split", () => {
    const d = at("Paid 70% cash.")!;
    expect(storedSplitWords(SHAPE)).toBe("60% Cash, 40% Equity, 0% Credits");
    expect(splitDriftProblem(d, SHAPE, "Aim")).toBe('Aim says "70% cash", but this card\'s split is 60% Cash, 40% Equity, 0% Credits. Change the words to match, or change the split under How compensation works.');
  });
});
