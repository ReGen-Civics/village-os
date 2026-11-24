// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import Sprout from "./Sprout";

afterEach(cleanup);

/**
 * The still drawing is the markup itself: motion.css only adds the growing,
 * behind prefers-reduced-motion: no-preference (livingMotion.test.ts holds
 * that side). So the component must never set a dash, an offset or a
 * transform of its own, or "reduce motion" would show a half-drawn seedling.
 */
describe("Sprout", () => {
  it("is decorative: hidden from assistive tech and out of the tab order", () => {
    const { container } = render(<Sprout />);
    const svg = container.querySelector("svg")!;
    expect(svg.getAttribute("aria-hidden")).toBe("true");
    expect(svg.getAttribute("focusable")).toBe("false");
  });

  it("draws every part, with nothing in the markup that would leave it half grown", () => {
    const { container } = render(<Sprout size={72} className="text-open" />);
    for (const part of ["m-soil", "m-root", "m-seed", "m-stem", "m-leaf-l", "m-leaf-r"]) {
      expect(container.querySelector(`.${part}`), part).not.toBeNull();
    }
    for (const el of container.querySelectorAll("svg *")) {
      expect(el.getAttribute("style")).toBeNull();
      for (const attr of ["stroke-dasharray", "stroke-dashoffset", "transform", "opacity"]) {
        expect(el.hasAttribute(attr), `${el.getAttribute("class")} ${attr}`).toBe(false);
      }
    }
    const svg = container.querySelector("svg")!;
    expect(svg.getAttribute("width")).toBe("72");
    expect(svg.getAttribute("class")).toContain("text-open");
  });
});
