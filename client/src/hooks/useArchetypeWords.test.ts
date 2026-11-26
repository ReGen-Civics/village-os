import { describe, expect, it } from "vitest";
import { archetypesInLanguage } from "./useArchetypeWords";

describe("the village's classes in the reader's language", () => {
  const FIELDS = { "the-builder.name": "La Constructora", "the-builder.blurb": "Hace cosas." };

  it("replaces only the words a row carries, matched by key", () => {
    const named = [{ key: "the-builder", name: "The Builder" }, { key: "the-healer", name: "The Healer" }];
    const out = archetypesInLanguage(named, FIELDS);
    expect(out).toEqual([{ key: "the-builder", name: "La Constructora" }, { key: "the-healer", name: "The Healer" }]);
    expect(named[0].name).toBe("The Builder");
    const whole = archetypesInLanguage([{ key: "the-builder", name: "The Builder", blurb: "Makes things." }], FIELDS);
    expect(whole[0].blurb).toBe("Hace cosas.");
  });

  it("is the same list with nothing to lay", () => {
    const list = [{ key: "the-builder", name: "The Builder" }];
    expect(archetypesInLanguage(list, {})).toBe(list);
  });
});
