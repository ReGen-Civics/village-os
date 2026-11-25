/**
 * The team cards (surnames, portraits, bios) reach only a reader who may see the village's people
 * (the lead, 25 Nov 2026). Every name is made up.
 */
import { describe, expect, it } from "vitest";
import { teamCardsFor } from "./teamCards";

const cards = [{ name: "Juno Fairweather", photo: "/uploads/juno.webp", bio: "Grows the beans." }];

describe("the team cards, to whom", () => {
  it("a visitor or a newcomer reads none of them", () => {
    expect(teamCardsFor(cards, false)).toEqual([]);
    expect(JSON.stringify(teamCardsFor(cards, false))).not.toContain("Fairweather");
  });

  it("a member who may see people reads them unchanged", () => {
    expect(teamCardsFor(cards, true)).toBe(cards);
  });
});
