// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import * as Living from "./living";

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
      expect(svg.getAttribute("stroke-width")).toBe("1.5");
      expect(svg.getAttribute("fill")).toBe("none");
      expect(svg.getAttribute("aria-hidden")).toBe("true");
      expect(svg.getAttribute("focusable")).toBe("false");
      expect(svg.getAttribute("class")).toBe("size-6");
      // Any fill is currentColor (a nucleolus, a knot), never a colour of its own, so the tab bar's tint reaches it.
      for (const el of Array.from(svg.querySelectorAll("[fill]"))) expect(el.getAttribute("fill")).toBe("currentColor");
      for (const el of Array.from(svg.querySelectorAll("[stroke]"))) expect(["currentColor", "none"]).toContain(el.getAttribute("stroke"));
    });
  }
});
