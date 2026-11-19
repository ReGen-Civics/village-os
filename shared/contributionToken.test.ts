/**
 * THE CONTRIBUTION TOKEN (the lead, 19 Nov 2026): a pay share labelled with the village's own token name reads as
 * that share, exactly and never by substring, so End of Moon pays each share where it was meant.
 */
import { describe, expect, it } from "vitest";
import { CONTRIBUTION_TOKEN_DEFAULT, labelKey, namedPart, shareNames, tokensNoun } from "./contributionToken";

describe("the contribution token's names", () => {
  it("falls back to the platform defaults for a blank or missing name", () => {
    expect(shareNames(null)).toEqual({ equity: "Contribution tokens", credits: "Credits" });
    expect(shareNames({ equity: "  ", credits: "Usage tokens" })).toEqual({ equity: CONTRIBUTION_TOKEN_DEFAULT, credits: "Usage tokens" });
  });

  it("compares a label loosely: case, spaces and a trailing token or tokens", () => {
    expect(labelKey("  Harbour   Shares tokens ")).toBe("harbour shares");
    expect(labelKey("Usage Token")).toBe("usage");
  });

  it("reads a label that is a token's name as that share, and nothing else", () => {
    const names = { equity: "Harbour", credits: "Usage tokens" };
    expect(namedPart("Harbour", names)).toBe("equity");
    expect(namedPart("harbour tokens", names)).toBe("equity");
    expect(namedPart("Usage", names)).toBe("credits");
    expect(namedPart("Usage tokens", names)).toBe("credits");
    // Never a substring: a label that only contains the name is not the name.
    expect(namedPart("Harbour credits", names)).toBeNull();
    expect(namedPart("Cash", names)).toBeNull();
    expect(namedPart("Harbour", null)).toBeNull();
  });

  it("refuses two names that compare equal, rather than guess", () => {
    expect(namedPart("Harbour", { equity: "Harbour", credits: "Harbour tokens" })).toBeNull();
  });

  it("says the name as a plural noun without doubling tokens", () => {
    expect(tokensNoun("Harbour")).toBe("Harbour tokens");
    expect(tokensNoun("Contribution tokens")).toBe("Contribution tokens");
    expect(tokensNoun("")).toBe("Contribution tokens");
  });
});
