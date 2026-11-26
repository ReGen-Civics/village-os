import { setupI18n } from "@lingui/core";
import { describe, expect, it } from "vitest";
import { BUILDER_EXAMPLES, BUILDER_STEPS } from "@shared/builderJourney";
import { BUILDER_WORDS, builderWord } from "./builderWords";

describe("the module builder's steps in the reader's language (lane ES-A)", () => {
  it("every step and example word on /modules has a translatable entry", () => {
    const words = [...BUILDER_STEPS.flatMap((s) => [s.title, s.line, ...(s.link ? [s.link.label] : [])]), ...BUILDER_EXAMPLES.flatMap((e) => [e.title, e.line])];
    expect(words.filter((w) => !BUILDER_WORDS[w]), "add these to client/src/components/modules/builderWords.ts").toEqual([]);
  });

  it("each entry's English is its own key, and a catalog's word wins where it has one", () => {
    const en = setupI18n({ locale: "en", messages: { en: {} } });
    for (const key of Object.keys(BUILDER_WORDS)) expect(builderWord(key, en), key).toBe(key);
    const d = BUILDER_WORDS["Read the contract"];
    expect(builderWord("Read the contract", setupI18n({ locale: "es", messages: { es: { [d.id]: "Lea el contrato" } } }))).toBe("Lea el contrato");
  });
});
