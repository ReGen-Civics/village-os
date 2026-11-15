import { describe, expect, it } from "vitest";
import { FOCUS_MAIN_WORK_PCT, focusLevel, isFocusLine, shownCommitment } from "./focusLine";

describe("the focus line (Rye, 15 Nov 2026)", () => {
  it("is the main work at 60% and above, a main part below", () => {
    expect(FOCUS_MAIN_WORK_PCT).toBe(60);
    expect(focusLevel(100)).toBe("main");
    expect(focusLevel(60)).toBe("main");
    expect(focusLevel(59)).toBe("part");
    expect(focusLevel(30)).toBe("part");
  });
  it("reads a commitment nobody stated as the whole role", () => {
    expect(focusLevel(null)).toBe("main");
    expect(focusLevel(undefined)).toBe("main");
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
