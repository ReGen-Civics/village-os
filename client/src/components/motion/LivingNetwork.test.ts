import { describe, expect, it } from "vitest";
import { growNetwork } from "./LivingNetwork";

const village = [
  { id: "land", held: 3 },
  { id: "care", held: 1 },
  { id: "welcome", held: 0 },
  { id: "hearth", held: 20 },
];

describe("growNetwork", () => {
  it("puts every circle on the ring and a knot on each held seat, a dozen at most per circle", () => {
    const net = growNetwork(village, 1200, 500);
    expect(net.nodes).toHaveLength(4);
    expect(net.knots).toHaveLength(3 + 1 + 0 + 12);
  });

  it("grows the same network for the same village every visit", () => {
    expect(growNetwork(village, 1200, 500)).toEqual(growNetwork(village, 1200, 500));
  });

  it("thickens as people take seats", () => {
    const before = growNetwork(village, 1200, 500).knots.length;
    const after = growNetwork(village.map((c) => (c.id === "welcome" ? { ...c, held: 2 } : c)), 1200, 500).knots.length;
    expect(after).toBe(before + 2);
  });

  it("finishes: a bounded walk, every thread inside a margin around the box", () => {
    for (const [w, h] of [[390, 420], [1280, 520]]) {
      const net = growNetwork(village, w, h);
      expect(net.steps).toBeLessThan(700);
      expect(net.segments.length).toBeGreaterThan(20);
      for (const s of net.segments) {
        for (const [x, y] of [[s.x1, s.y1], [s.x2, s.y2]]) {
          expect(x).toBeGreaterThan(-w * 0.2);
          expect(x).toBeLessThan(w * 1.2);
          expect(y).toBeGreaterThan(-h * 0.3);
          expect(y).toBeLessThan(h * 1.3);
        }
      }
    }
  });

  it("draws nothing to grow for a village with no circles yet", () => {
    const net = growNetwork([], 800, 400);
    expect(net.nodes).toHaveLength(0);
    expect(net.segments).toHaveLength(0);
  });
});
