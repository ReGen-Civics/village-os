/**
 * THE CONTRIBUTION TOKEN (the lead, 19 Nov 2026): a member reads the village's own word for it, in full and short,
 * never "equity"; a pay share labelled with any of its names reads as that share, exactly and never by substring,
 * so End of Moon pays each share where it was meant.
 */
import { describe, expect, it } from "vitest";
import { labelKey, namedPart, shareNamesFrom, shortName, tokensNoun } from "./contributionToken";
import { vocabularyOf } from "./vocabulary";

const REGISTRY = { "earned-equity": "Earned Equity", credits: "Village Credits" };

describe("the names a member reads", () => {
  it("is the village's own word, in full and short, and never the registry's equity", () => {
    const vocab = vocabularyOf({ contributionToken: { one: "Harbour Token", many: "Harbour Tokens" } });
    expect(shareNamesFrom(vocab, REGISTRY)).toEqual({ equity: "Harbour Tokens", equityShort: "Harbour", credits: "Village Credits" });
  });

  it("falls to the platform default while the village has no word and the registry says equity", () => {
    expect(shareNamesFrom(vocabularyOf({}), REGISTRY)).toEqual({ equity: "Contribution tokens", equityShort: "Contribution tokens", credits: "Village Credits" });
    expect(shareNamesFrom(null, null)).toEqual({ equity: "Contribution tokens", equityShort: "Contribution tokens", credits: "Credits" });
  });

  it("reads a registry name that says nothing of equity, when the village has no word of its own", () => {
    expect(shareNamesFrom(null, { "earned-equity": "Seeds", credits: "Credits" }).equity).toBe("Seeds");
  });

  it("derives the short form by dropping a trailing token or tokens", () => {
    expect(shortName("Harbour Tokens")).toBe("Harbour");
    expect(shortName("Harbour token")).toBe("Harbour");
    expect(shortName("Tokens")).toBe("Tokens");
    expect(shortName("Seeds")).toBe("Seeds");
  });
});

describe("reading a label by name", () => {
  it("compares loosely: case, spaces and a trailing token or tokens", () => {
    expect(labelKey("  Harbour   Tokens ")).toBe("harbour");
  });

  it("reads a label that is one of a share's names as that share, and nothing else", () => {
    const names = { equity: ["Earned Equity", "Harbour Tokens", "Harbour"], credits: "Village Credits" };
    expect(namedPart("Harbour", names)).toBe("equity");
    expect(namedPart("harbour tokens", names)).toBe("equity");
    expect(namedPart("Village Credits", names)).toBe("credits");
    // Never a substring: a label that only contains the name is not the name.
    expect(namedPart("Harbour credits", names)).toBeNull();
    expect(namedPart("Cash", names)).toBeNull();
    expect(namedPart("Harbour", null)).toBeNull();
  });

  it("refuses a name both shares claim, rather than guess", () => {
    expect(namedPart("Harbour", { equity: "Harbour", credits: "Harbour tokens" })).toBeNull();
  });

  it("says the name as a plural noun without doubling tokens", () => {
    expect(tokensNoun("Harbour")).toBe("Harbour tokens");
    expect(tokensNoun("Harbour Tokens")).toBe("Harbour Tokens");
    expect(tokensNoun("")).toBe("Contribution tokens");
  });
});
