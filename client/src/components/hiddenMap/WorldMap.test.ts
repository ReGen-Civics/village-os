/**
 * Pins closer than a fingertip gather into one target (QA pass 3 re-run,
 * P3-r-3): 140 pairs of one garden's pins sat closer than 24px and could not
 * be picked apart. Each group is one button that zooms in on them.
 */
import { describe, expect, it } from "vitest";
import { gatherPins } from "./WorldMap";

const at = (id: string, x: number, y: number) => ({ p: { id }, s: { x, y } });

describe("gatherPins", () => {
  it("gathers pins within 24px into one group at their centre, and leaves far ones alone", () => {
    const g = gatherPins([at("a", 100, 100), at("b", 110, 100), at("c", 300, 300), at("d", 104, 108)]);
    expect(g.map((x) => x.members.map((m) => m.id))).toEqual([["a", "b", "d"], ["c"]]);
    expect(g[0]!.x).toBeCloseTo(104.67, 1);
  });

  it("keeps pins exactly 24px apart as two targets", () => {
    expect(gatherPins([at("a", 0, 0), at("b", 24, 0)])).toHaveLength(2);
  });

  it("gathers nothing from nothing", () => {
    expect(gatherPins([])).toEqual([]);
  });
});
