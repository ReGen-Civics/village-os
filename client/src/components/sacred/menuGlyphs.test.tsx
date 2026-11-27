// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import * as Menu from "./menuGlyphs";
import * as Living from "./living";
import { LIVING_STROKE } from "./livingCore";

afterEach(cleanup);

/** The menu's glyphs (27 Nov 2026) keep the living family's hand, so a menu row of old and new glyphs is one weight. */
describe("the menu glyphs", () => {
  for (const [name, Glyph] of Object.entries(Menu)) {
    it(`${name} is a decorative monoline in currentColor on the 24 grid`, () => {
      const { container } = render(<Glyph className="size-6" />);
      expect(name).toMatch(/^[A-Z]/);
      const svg = container.querySelector("svg")!;
      expect(svg.getAttribute("viewBox")).toBe("0 0 24 24");
      expect(svg.getAttribute("stroke")).toBe("currentColor");
      expect(svg.getAttribute("stroke-width")).toBe(String(LIVING_STROKE));
      expect(svg.getAttribute("fill")).toBe("none");
      expect(svg.getAttribute("aria-hidden")).toBe("true");
      expect(svg.getAttribute("focusable")).toBe("false");
      expect(svg.getAttribute("class")).toMatch(/^living living-[a-z-]+ size-6$/);
      // Any fill is currentColor, never a colour of its own, so a menu's tint reaches it.
      for (const el of Array.from(svg.querySelectorAll("[fill]"))) expect(el.getAttribute("fill")).toBe("currentColor");
      for (const el of Array.from(svg.querySelectorAll("[stroke]"))) expect(["currentColor", "none"]).toContain(el.getAttribute("stroke"));
    });
  }

  it("draws thirty glyphs, none of them a name the living family already uses", () => {
    expect(Object.keys(Menu)).toHaveLength(30);
    for (const name of Object.keys(Menu)) expect(Living).not.toHaveProperty(name);
  });
});
