import { describe, expect, it } from "vitest";
import { FOCUS_BAND_STARTS, FOCUS_BANDS, focusBand, focusEnglish, isFocusLine, shownCommitment } from "./focusLine";

describe("the focus line, six bands (Rye, 15 Nov 2026)", () => {
  it("has a band at 10, 30, 50, 60, 80 and 100, each with words naming the village", () => {
    expect([...FOCUS_BAND_STARTS]).toEqual([10, 30, 50, 60, 80, 100]);
    for (const b of FOCUS_BAND_STARTS) expect(FOCUS_BANDS[b]).toContain("{village}");
  });
  it("each band runs from its number up to the next", () => {
    const cases: Array<[number, number]> = [[10, 10], [29, 10], [30, 30], [49, 30], [50, 50], [59, 50], [60, 60], [79, 60], [80, 80], [99, 80], [100, 100], [120, 100]];
    for (const [pct, band] of cases) expect(focusBand(pct), `${pct}%`).toBe(band);
  });
  it("a share below 10% reads as the 10% band", () => {
    expect(focusBand(0)).toBe(10);
    expect(focusBand(5)).toBe(10);
  });
  it("a commitment nobody stated reads as the main-work band, as these cards said before", () => {
    expect(focusBand(null)).toBe(60);
    expect(focusBand(undefined)).toBe(60);
  });
  it("puts the village's name into a band's words", () => {
    expect(focusEnglish(10, "Rivermoor")).toBe("On your mind: Rivermoor gets a dedicated work block once a week");
    expect(focusEnglish(100, "Rivermoor")).toBe("All in: Rivermoor is your full-time work");
  });
  it("shows the applicant's choice first, then a shared role's minimum, then the whole commitment", () => {
    expect(shownCommitment(70, 30, 100)).toBe(70);
    expect(shownCommitment(null, 30, 100)).toBe(30);
    expect(shownCommitment(null, null, 100)).toBe(100);
    expect(shownCommitment(null, null, null)).toBeNull();
  });
  it("knows the token however it is spaced or cased, and nothing else", () => {
    expect(isFocusLine("{focus}")).toBe(true);
    expect(isFocusLine("  {Focus} ")).toBe(true);
    expect(isFocusLine("Fully focused: the village is your main work")).toBe(false);
    expect(isFocusLine("{focus} and more")).toBe(false);
  });
});
