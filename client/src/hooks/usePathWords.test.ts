import { describe, expect, it } from "vitest";
import { translatedPathRows, translatedPaths } from "./usePathWords";

const PATHS = [
  { id: "investor", label: "Guardian", role: "Hold the land", description: "Fund the village.", route: "/investor" },
  { id: "resident", label: "Neighbour", role: "Make a home", description: "Live here.", route: "/resident" },
];

describe("the village's path names in the reader's language (the lead's Spanish audit, 26 Nov 2026)", () => {
  it("lays each translated name, second line and sentence over the path it names", () => {
    const out = translatedPaths(PATHS, { "investor.label": "Guardiana", "investor.role": "Sostenga la tierra", "resident.description": "Viva aquí." });
    expect(out[0]).toMatchObject({ id: "investor", label: "Guardiana", role: "Sostenga la tierra", description: "Fund the village.", route: "/investor" });
    expect(out[1]).toMatchObject({ label: "Neighbour", description: "Viva aquí." });
    expect(PATHS[0].label).toBe("Guardian");
  });

  it("keeps the same array with nothing to lay, and ignores fields that name no path word", () => {
    expect(translatedPaths(PATHS, {})).toBe(PATHS);
    expect(translatedPaths(PATHS, { "investor.route": "/x", "nobody.label": "X" })).toEqual(PATHS);
  });

  it("a menu row showing the path's words takes the translation; a row the village wrote its own words for keeps them", () => {
    const menu = {
      "/investor": { label: "Guardian", subtitle: "Hold the land" },
      "/resident": { label: "Neighbour / Future Villager", subtitle: "Make a home" },
      "/team": { label: "Our Team", subtitle: "" },
    };
    const out = translatedPathRows(menu, PATHS, { "investor.label": "Guardiana", "investor.role": "Sostenga la tierra", "resident.label": "Vecina", "resident.role": "Haga su hogar" });
    expect(out["/investor"]).toEqual({ label: "Guardiana", subtitle: "Sostenga la tierra" });
    expect(out["/resident"]).toEqual({ label: "Neighbour / Future Villager", subtitle: "Haga su hogar" });
    expect(out["/team"]).toBe(menu["/team"]);
    expect(translatedPathRows(menu, PATHS, {})).toBe(menu);
  });
});
