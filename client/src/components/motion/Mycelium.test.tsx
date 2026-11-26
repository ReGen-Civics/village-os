// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render } from "@testing-library/react";
import Mycelium, { MAX_GAP, MIN_SIDE_GAP, threadsFor, type Box } from "./Mycelium";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

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
    const boxes = [card(0, 0), card(184, 0), card(0, 136), card(184, 136)];
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
    const boxes = [0, 1, 2, 3].map((i) => card(i * 284, 0, 260, 300));
    expect(threadsFor(boxes)).toHaveLength(3);
    knotsOnEdges(boxes);
  });

  it("leaves a column gap narrower than MIN_SIDE_GAP unthreaded, where the S would fold into a zig-zag", () => {
    expect(threadsFor([card(0, 0), card(160 + MIN_SIDE_GAP - 1, 0)])).toHaveLength(0);
    expect(threadsFor([card(0, 0), card(160 + MIN_SIDE_GAP, 0)])).toHaveLength(1);
  });

  it("never crosses a gap wider than a thread can, or joins cards that touch", () => {
    expect(threadsFor([card(0, 0), card(160 + MAX_GAP + 1, 0)])).toHaveLength(0);
    expect(threadsFor([card(0, 0), card(160, 0)])).toHaveLength(0);
    expect(threadsFor([card(0, 0)])).toHaveLength(0);
    expect(threadsFor([])).toHaveLength(0);
  });

  it("draws the same threads every time for the same layout", () => {
    const boxes = [card(0, 0), card(184, 0), card(0, 136), card(184, 136)];
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

  it("follows the cards when two rows swap heights and the wrapper keeps its size (the lead, /roles at 390px)", async () => {
    // Every observer the component makes, and what each one watches.
    const observers: { cb: () => void; targets: Element[] }[] = [];
    vi.stubGlobal(
      "ResizeObserver",
      class {
        targets: Element[] = [];
        constructor(cb: () => void) {
          observers.push({ cb, targets: this.targets });
        }
        observe(el: Element) {
          this.targets.push(el);
        }
        disconnect() {}
        unobserve() {}
      },
    );
    // A 2x2 grid at phone width with an 8px gap, as the four ways lay out.
    const layout = { rowOne: 93 };
    const { container } = render(
      <Mycelium>
        <ul>
          <li>Join the team</li>
          <li>Start a venture</li>
          <li>Become a partner</li>
          <li>Propose a quest</li>
        </ul>
      </Mycelium>,
    );
    const root = container.firstElementChild as HTMLElement;
    const lis = Array.from(root.querySelectorAll("li"));
    lis.forEach((li, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      Object.defineProperties(li, {
        offsetParent: { get: () => root },
        offsetLeft: { get: () => col * 183 },
        offsetTop: { get: () => (row === 0 ? 0 : layout.rowOne + 8) },
        offsetWidth: { get: () => 175 },
        offsetHeight: { get: () => (row === 0 ? layout.rowOne : 166 - layout.rowOne) },
      });
    });
    const fire = async () => {
      await act(async () => {
        observers.forEach((o) => o.cb());
        await new Promise((r) => requestAnimationFrame(() => r(null)));
      });
    };
    await fire();
    const knotsY = () => Array.from(root.querySelectorAll("circle.m-knot")).map((c) => Number(c.getAttribute("cy")));
    // The fallback face: row one 93px tall, so a down thread's knots sit near 90 and 104.
    expect(knotsY()).toContain(90);
    // Every card is watched, not only the wrapper.
    for (const li of lis) expect(observers.some((o) => o.targets.includes(li)), li.textContent ?? "").toBe(true);
    // The display face arrives: row one shrinks to 73 and row two grows by the same, so the wrapper keeps its 174px.
    layout.rowOne = 73;
    await fire();
    expect(knotsY()).not.toContain(90);
    // Now the down threads meet row one's new bottom edge and row two's new top, inside the 8px gap.
    expect(knotsY()).toContain(70);
    expect(knotsY()).toContain(84);
  });
});
