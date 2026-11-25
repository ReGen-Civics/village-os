// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import * as Living from "./living";
import { LIVING_STROKE } from "./livingCore";

afterEach(cleanup);

/** The agreement with glyphs.tsx: one hand, so every living glyph sits beside a sacred one unchanged. */
describe("the living glyphs", () => {
  for (const [name, Glyph] of Object.entries(Living)) {
    it(`${name} is a decorative monoline in currentColor on the 24 grid`, () => {
      const { container } = render(<Glyph className="size-6" />);
      expect(name).toMatch(/^[A-Z]/);
      const svg = container.querySelector("svg")!;
      expect(svg.getAttribute("viewBox")).toBe("0 0 24 24");
      expect(svg.getAttribute("stroke")).toBe("currentColor");
      // The family's line, thicker than glyphs.tsx's 1.5 so the bar and the menus never read as scratches.
      expect(svg.getAttribute("stroke-width")).toBe(String(LIVING_STROKE));
      expect(svg.getAttribute("fill")).toBe("none");
      expect(svg.getAttribute("aria-hidden")).toBe("true");
      expect(svg.getAttribute("focusable")).toBe("false");
      // The class passed through, after the glyph's own name (living living-<name>, like lucide's).
      expect(svg.getAttribute("class")).toMatch(/^living living-[a-z-]+ size-6$/);
      // Any fill is currentColor (a nucleolus, a knot), never a colour of its own, so the tab bar's tint reaches it.
      for (const el of Array.from(svg.querySelectorAll("[fill]"))) expect(el.getAttribute("fill")).toBe("currentColor");
      for (const el of Array.from(svg.querySelectorAll("[stroke]"))) expect(["currentColor", "none"]).toContain(el.getAttribute("stroke"));
    });
  }

  it("draws at a heavier line than the sacred set, and a page may still ask for its own", () => {
    expect(LIVING_STROKE).toBe(1.75);
    const { container } = render(<Living.Lantern strokeWidth={2} />);
    expect(container.querySelector("svg")?.getAttribute("stroke-width")).toBe("2");
  });
});
