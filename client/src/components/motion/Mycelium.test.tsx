// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import Mycelium, { MAX_GAP, threadsFor, type Box } from "./Mycelium";

afterEach(cleanup);

const card = (x: number, y: number, w = 160, h = 120): Box => ({ x, y, w, h });

/** Every thread's two knots sit just inside two different cards' facing edges. */
function knotsOnEdges(boxes: Box[]) {
  for (const t of threadsFor(boxes)) {
    const inside = (p: [number, number]) => boxes.filter((b) => p[0] >= b.x && p[0] <= b.x + b.w && p[1] >= b.y && p[1] <= b.y + b.h);
    expect(inside(t.a).length, `knot a ${t.a}`).toBe(1);
    expect(inside(t.b).length, `knot b ${t.b}`).toBe(1);
    expect(inside(t.a)[0]).not.toBe(inside(t.b)[0]);
  }
}

describe("threadsFor", () => {
  it("stitches a 2x2 grid with four threads: two across, two down", () => {
    const boxes = [card(0, 0), card(176, 0), card(0, 136), card(176, 136)];
    const threads = threadsFor(boxes);
    expect(threads).toHaveLength(4);
    knotsOnEdges(boxes);
  });

  it("stitches a phone's single column card to card, down the gaps", () => {
    const boxes = [card(0, 0, 340, 200), card(0, 216, 340, 200), card(0, 432, 340, 200)];
    const threads = threadsFor(boxes);
    expect(threads).toHaveLength(2);
    knotsOnEdges(boxes);
    for (const t of threads) expect(t.b[1]).toBeGreaterThan(t.a[1]);
  });

  it("stitches a desktop row of four across only", () => {
    const boxes = [0, 1, 2, 3].map((i) => card(i * 276, 0, 260, 300));
    expect(threadsFor(boxes)).toHaveLength(3);
    knotsOnEdges(boxes);
  });

  it("never crosses a gap wider than a thread can, or joins cards that touch", () => {
    expect(threadsFor([card(0, 0), card(160 + MAX_GAP + 1, 0)])).toHaveLength(0);
    expect(threadsFor([card(0, 0), card(160, 0)])).toHaveLength(0);
    expect(threadsFor([card(0, 0)])).toHaveLength(0);
    expect(threadsFor([])).toHaveLength(0);
  });

  it("draws the same threads every time for the same layout", () => {
    const boxes = [card(0, 0), card(176, 0), card(0, 136), card(176, 136)];
    expect(threadsFor(boxes)).toEqual(threadsFor(boxes));
  });
});

describe("Mycelium", () => {
  it("renders its cards untouched, and no threads where there is no layout to measure", () => {
    const { container, getByText } = render(
      <Mycelium className="lg:order-1">
        <ul>
          <li>Join the team</li>
          <li>Start a venture</li>
        </ul>
      </Mycelium>,
    );
    expect(getByText("Join the team")).toBeTruthy();
    expect(container.firstElementChild?.className).toContain("lg:order-1");
    // jsdom lays nothing out (every offset is 0), so there is nothing to stitch and no layer is drawn.
    expect(container.querySelector("svg")).toBeNull();
  });
});
