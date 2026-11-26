import { describe, expect, it } from "vitest";
import { seasonInLanguage } from "./useSeasonWords";

const SERVED = { current: { id: "founding", name: "Founding Season", focus: "Land", goals: [{ text: "Plant the forest", done: true }] } };
const FIELDS = { "founding.name": "Temporada fundadora", "founding.goals.0": "Sembrar el bosque" };

describe("the season's words in the reader's language", () => {
  it("keeps the goals in the village's words unless a page reads them by id, since a season plan matches on that text", () => {
    const shared = seasonInLanguage(SERVED, FIELDS);
    expect(shared.current.name).toBe("Temporada fundadora");
    expect(shared.current.goals[0].text).toBe("Plant the forest");
    expect(seasonInLanguage(SERVED, FIELDS, { goals: true }).current.goals[0]).toEqual({ text: "Sembrar el bosque", done: true });
  });

  it("is the same object with nothing to lay, and passes a missing season through", () => {
    expect(seasonInLanguage(SERVED, {})).toBe(SERVED);
    expect(seasonInLanguage(SERVED, { "founding.goals.0": "x" })).toBe(SERVED);
    expect(seasonInLanguage(null, FIELDS)).toBeNull();
  });
});
