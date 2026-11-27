// @vitest-environment jsdom
/**
 * land.ts: the season page's one landing scroll (QA round 2).
 *
 *   - it scrolls instantly, never smoothly;
 *   - something above the target folding after the landing (the root strip's
 *     placeholder, about 150ms later on the live page) moves the target, and
 *     the watch lands it again;
 *   - CONTROL: a drift of a few pixels does not;
 *   - the reader's first wheel, touch or key ends the watch, and so does time.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LAND_HOLD_MS, landOn } from "./land";

let observed: Array<() => void> = [];
class FakeResizeObserver {
  constructor(private cb: () => void) {}
  observe() {
    observed.push(this.cb);
  }
  disconnect() {
    observed = observed.filter(cb => cb !== this.cb);
  }
}
const resize = () => observed.forEach(cb => cb());

let top = 160;
let target: HTMLElement;
let calls: Array<ScrollIntoViewOptions | undefined>;

beforeEach(() => {
  vi.useFakeTimers();
  observed = [];
  calls = [];
  vi.stubGlobal("ResizeObserver", FakeResizeObserver);
  target = document.createElement("li");
  target.id = "seat-seat-host";
  target.style.scrollMarginTop = "160px";
  document.body.appendChild(target);
  top = 160;
  target.getBoundingClientRect = () =>
    ({
      top,
      bottom: top + 80,
      left: 0,
      right: 0,
      width: 0,
      height: 80,
      x: 0,
      y: top,
      toJSON: () => ({}),
    }) as DOMRect;
  target.scrollIntoView = (o?: boolean | ScrollIntoViewOptions) => {
    calls.push(typeof o === "object" ? o : undefined);
    top = 160;
  };
});
afterEach(() => {
  target.remove();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("landOn", () => {
  it("lands instantly, at the start of the screen", () => {
    landOn(target);
    expect(calls).toEqual([{ block: "start", behavior: "instant" }]);
  });

  it("lands again when the placeholder above folds and the target rises under the sticky bars", () => {
    landOn(target);
    vi.advanceTimersByTime(700);
    top = 160 - 76; // the 76px strip above folded
    resize();
    expect(calls).toHaveLength(2);
    expect(top).toBe(160);
  });

  it("CONTROL: a drift within 4px is left alone", () => {
    landOn(target);
    top = 163;
    resize();
    expect(calls).toHaveLength(1);
  });

  it("stops at the reader's first wheel, touch or key", () => {
    landOn(target);
    window.dispatchEvent(new Event("wheel"));
    top = 60;
    resize();
    expect(calls).toHaveLength(1);
  });

  it("stops after the hold", () => {
    landOn(target);
    vi.advanceTimersByTime(LAND_HOLD_MS + 1);
    top = 60;
    resize();
    expect(calls).toHaveLength(1);
  });
});
