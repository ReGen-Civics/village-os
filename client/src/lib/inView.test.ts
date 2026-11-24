import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { observeInView, observeOnce, resetInViewForTests } from "./inView";

/** A hand-driven IntersectionObserver: tests say when an element is in or out. */
class FakeIO {
  static all: FakeIO[] = [];
  targets = new Set<Element>();
  constructor(
    public cb: (entries: { target: Element; isIntersecting: boolean }[]) => void,
    public opts: { rootMargin?: string },
  ) {
    FakeIO.all.push(this);
  }
  observe(el: Element) {
    this.targets.add(el);
  }
  unobserve(el: Element) {
    this.targets.delete(el);
  }
  disconnect() {
    this.targets.clear();
  }
  fire(el: Element, isIntersecting: boolean) {
    if (this.targets.has(el)) this.cb([{ target: el, isIntersecting }]);
  }
}

const el = () => ({}) as Element;

beforeEach(() => {
  FakeIO.all = [];
  vi.stubGlobal("IntersectionObserver", FakeIO);
});
afterEach(() => {
  resetInViewForTests();
  vi.unstubAllGlobals();
});

describe("inView", () => {
  it("shares one observer per root margin", () => {
    observeInView(el(), () => {});
    observeInView(el(), () => {});
    observeOnce(el(), () => {}, "0px 0px -25% 0px");
    expect(FakeIO.all.map((o) => o.opts.rootMargin)).toEqual(["0px", "0px 0px -25% 0px"]);
  });

  it("reports entering and leaving, until unwatched", () => {
    const a = el();
    const seen: boolean[] = [];
    const stop = observeInView(a, (v) => seen.push(v));
    FakeIO.all[0].fire(a, false);
    FakeIO.all[0].fire(a, true);
    FakeIO.all[0].fire(a, false);
    stop();
    FakeIO.all[0].fire(a, true);
    expect(seen).toEqual([false, true, false]);
  });

  it("says ALREADY when the element was on screen the moment it was observed", () => {
    const a = el();
    const cb = vi.fn();
    observeOnce(a, cb);
    FakeIO.all[0].fire(a, true);
    expect(cb).toHaveBeenCalledWith(true);
  });

  it("says NOT already when the reader scrolled it into view, and fires only once", () => {
    const a = el();
    const cb = vi.fn();
    observeOnce(a, cb);
    FakeIO.all[0].fire(a, false);
    FakeIO.all[0].fire(a, true);
    FakeIO.all[0].fire(a, false);
    FakeIO.all[0].fire(a, true);
    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb).toHaveBeenCalledWith(false);
    expect(FakeIO.all[0].targets.has(a)).toBe(false);
  });

  it("without IntersectionObserver, everything is already in view: the still frame", () => {
    vi.stubGlobal("IntersectionObserver", undefined);
    const once = vi.fn();
    const live = vi.fn();
    observeOnce(el(), once);
    observeInView(el(), live);
    expect(once).toHaveBeenCalledWith(true);
    expect(live).toHaveBeenCalledWith(true);
  });
});
