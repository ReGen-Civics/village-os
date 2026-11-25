/** The village's words, explained (shared/glossary.ts): the platform ships no meanings, and a stored value is cleaned. */
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { GLOSSARY_SLOT_IDS, MEANING_MAX, glossaryOf } from "./glossary";

describe("glossaryOf", () => {
  it("a village that wrote nothing explains nothing: the platform carries no meaning of its own", () => {
    expect(glossaryOf(null)).toEqual({});
    expect(glossaryOf(undefined)).toEqual({});
    expect(glossaryOf("root")).toEqual({});
    expect(glossaryOf([])).toEqual({});
  });

  it("keeps each slot's one sentence, in either shape, and drops blanks and slots it does not know", () => {
    expect(glossaryOf({ root: "  Where you grow from.  ", domain: { meaning: "The part you look after." }, quest: "   ", stranger: "x" })).toEqual({
      root: "Where you grow from.",
      domain: "The part you look after.",
    });
  });

  it("cleans control characters and holds a sentence to its length", () => {
    const g = glossaryOf({ moon: `One\nmoon\u0007 cycle.${"x".repeat(400)}` });
    expect(g.moon?.startsWith("One moon cycle.")).toBe(true);
    expect(g.moon?.length).toBe(MEANING_MAX);
  });

  it("the first village's seed fills every slot, and only known slots", () => {
    const seed = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../server/seeds/amora/glossary-seed.json"), "utf8")); // brand-ok: reads the first village's own seed, the declared home for its words
    const g = glossaryOf(seed);
    expect(Object.keys(g).sort()).toEqual([...GLOSSARY_SLOT_IDS].sort());
    for (const s of Object.values(g)) expect(s).not.toMatch(/[–—]/);
  });
});
