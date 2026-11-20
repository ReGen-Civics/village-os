import { describe, expect, it } from "vitest";
import { mergeWordTips, readWordTipLines, tipParts } from "./roleCardWordTips";
import { roleCardSharedFrom, readRoleCardShared } from "./roleCardShared";

describe("tooltips for the village's own words", () => {
  it("reads the village's lines as word: tip, skipping bullets, blanks, halves and repeats", () => {
    expect(readWordTipLines("- consent: nobody objects\n\nsteward\n: no word\nConsent: again\nAnchor Circle: the circle we all answer to")).toEqual([
      { word: "consent", tip: "nobody objects" },
      { word: "Anchor Circle", tip: "the circle we all answer to" },
    ]);
    expect(readWordTipLines(null)).toEqual([]);
  });

  it("lets the village's line replace a default, word by word, and add words of its own", () => {
    const merged = mergeWordTips(
      [
        { word: "consent", tip: "default consent" },
        { word: "steward", tip: "default steward" },
      ],
      [
        { word: "Consent", tip: "ours" },
        { word: "Moon circle", tip: "a new word" },
      ],
    );
    expect(merged).toEqual([
      { word: "Consent", tip: "ours" },
      { word: "Moon circle", tip: "a new word" },
      { word: "steward", tip: "default steward" },
    ]);
  });

  it("tips the first mention of each word in a passage, whole words only, longest first, plurals allowed", () => {
    const tips = [
      { word: "steward", tip: "S" },
      { word: "Founding Seeder", tip: "F" },
      { word: "Seeder", tip: "short" },
    ];
    expect(tipParts("Stewards and a Founding Seeder; a steward again, and stewardship.", tips)).toEqual([
      { word: "Stewards", tip: "S" },
      " and a ",
      { word: "Founding Seeder", tip: "F" },
      "; a steward again, and stewardship.",
    ]);
    expect(tipParts("No words here.", tips)).toEqual(["No words here."]);
  });

  it("travels in the shared words only when the village wrote some (control: the old shape is unchanged)", () => {
    const vars: Record<string, string> = { "org.role_card_word_tips": "consent: ours" };
    expect(roleCardSharedFrom((k) => vars[k] ?? "").tips).toEqual([{ word: "consent", tip: "ours" }]);
    expect(roleCardSharedFrom(() => "")).toEqual({ lines: [], rhythm: [], onboarding: [] });
    expect(readRoleCardShared({ lines: [], tips: [{ word: "steward", tip: "ours" }, { word: 3 }] }).tips).toEqual([{ word: "steward", tip: "ours" }]);
  });
});
