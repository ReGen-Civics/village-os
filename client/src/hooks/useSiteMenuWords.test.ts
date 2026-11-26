import { describe, expect, it } from "vitest";
import { overlaySiteMenu } from "./useSiteMenuWords";

const MENU = {
  "/investor": { label: "Investor", subtitle: "Join the table" },
  "/team": { label: "Our Team", subtitle: "" },
};

describe("the village's menu names take its translation (the lead's Spanish audit, 26 Nov 2026)", () => {
  it("lays a translated subtitle and label over the names the village wrote", () => {
    const out = overlaySiteMenu(MENU, { "menu.pages./investor.subtitle": "Súmese a la mesa", "menu.pages./team.label": "Nuestro equipo" });
    expect(out["/investor"]).toEqual({ label: "Investor", subtitle: "Súmese a la mesa" });
    expect(out["/team"]).toEqual({ label: "Nuestro equipo", subtitle: "" });
    expect(MENU["/investor"].subtitle).toBe("Join the table");
  });

  it("ignores blanks, other sections' fields and pages the menu does not have, and keeps the same object when nothing applies", () => {
    expect(overlaySiteMenu(MENU, { "menu.pages./nowhere.label": "X", "footer.signoff": "Y", "menu.pages./team.label": "  " })).toBe(MENU);
    expect(overlaySiteMenu(undefined, { "menu.pages./team.label": "X" })).toBeUndefined();
  });
});

describe("the server's own address: a row's place in the list", () => {
  it("menu.pages.0 is the first page the menu names", () => {
    const out = overlaySiteMenu(MENU, { "menu.pages.0.subtitle": "Súmese a la mesa", "menu.pages.7.label": "nadie" });
    expect(out["/investor"].subtitle).toBe("Súmese a la mesa");
    expect(out["/team"]).toBe(MENU["/team"]);
  });
});
