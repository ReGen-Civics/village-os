import { describe, expect, it } from "vitest";
import { Canopy, CellRing, MushroomNetwork, SeedPod, TreeCrown } from "@/components/sacred/living";
import { iconFor, knowsIcon } from "./circleIcons";

describe("iconFor", () => {
  it("draws every icon the live village's circles store", () => {
    for (const name of ["Crown", "Sprout", "BookOpen", "Users2", "Music", "Handshake", "Users", "Heart", "Hammer", "Building2", "TrendingUp", "Briefcase", "TreePine"]) {
      expect(knowsIcon(name), name).toBe(true);
    }
    // The names are the village's data and stay; the drawings are the living glyphs (the lead, 24 Nov 2026).
    expect(iconFor("Crown")).toBe(TreeCrown);
  });

  it("reads the spellings the seeds mix: any case, dashes or spaces", () => {
    expect(iconFor("users")).toBe(MushroomNetwork);
    expect(iconFor("shield-check")).toBe(Canopy);
    expect(iconFor("Shield Check")).toBe(Canopy);
    expect(iconFor("dollar")).toBe(SeedPod);
  });

  it("falls back to a plain dot for a missing or unknown name", () => {
    // The circles' own mark, the ring of cells (QA, 25 Nov 2026), in place of the stock dot.
    expect(iconFor(null)).toBe(CellRing);
    expect(iconFor("")).toBe(CellRing);
    expect(iconFor("NotAnIcon")).toBe(CellRing);
    expect(knowsIcon("NotAnIcon")).toBe(false);
  });
});
