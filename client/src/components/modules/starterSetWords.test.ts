/**
 * The starter sets in the reader's language (starterSetWords.ts). Every set comes from shared/moduleStarterSets.ts,
 * so a set added there, or a word changed there, fails here until the client has it.
 */
import path from "node:path";
import { setupI18n, type MessageDescriptor } from "@lingui/core";
import { formatter } from "@lingui/format-po";
import { describe, expect, it } from "vitest";
import { STARTER_SETS } from "@shared/moduleStarterSets";
// @ts-expect-error - scripts/ is untyped JavaScript, deliberately outside tsconfig
import { mergedPoText } from "../../../../scripts/lib/poFragments.mjs";
import { STARTER_SET_WORDS, starterSetWords } from "./starterSetWords";

// The build precompiles each message (precompileEnglish.ts), so the English is read the way a page reads it.
const EN = setupI18n({ locale: "en", messages: { en: {} } });

describe("every starter set has the client's words for it", () => {
  it("each set in shared/ is here, with its English word for word, and nothing more", () => {
    for (const s of STARTER_SETS) expect(starterSetWords(s, EN), s.id).toEqual({ name: s.name, gloss: s.gloss });
    for (const s of STARTER_SETS) expect(STARTER_SET_WORDS[s.id], s.id).toBeTruthy();
    expect(Object.keys(STARTER_SET_WORDS).sort()).toEqual(STARTER_SETS.map((s) => s.id).sort());
  });

  it("Spanish carries every one of them", async () => {
    const dir = path.resolve(__dirname, "../../locales");
    const es = await formatter({ lineNumbers: false }).parse(mergedPoText(dir, "es"), { locale: "es", sourceLocale: "en", filename: path.join(dir, "es.po") });
    const all: [string, MessageDescriptor][] = Object.entries(STARTER_SET_WORDS).flatMap(([id, w]) => [[`${id} name`, w.name], [`${id} gloss`, w.gloss]] as [string, MessageDescriptor][]);
    expect(all.filter(([, d]) => !es[d.id]?.translation).map(([k]) => k)).toEqual([]);
  });

  it("draws a set in the reader's language and keeps one it does not know", () => {
    const s = STARTER_SETS[0];
    const es = setupI18n({ locale: "es", messages: { es: { [STARTER_SET_WORDS[s.id].name.id]: "NOMBRE" } } });
    expect(starterSetWords(s, es)).toEqual({ name: "NOMBRE", gloss: s.gloss });
    expect(starterSetWords({ id: "toString", name: "x", gloss: "y" }, es)).toEqual({ name: "x", gloss: "y" });
  });
});
