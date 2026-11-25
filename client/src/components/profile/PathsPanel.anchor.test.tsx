// @vitest-environment jsdom
/**
 * THE PATH SLOT's door lands on the path's own card: /profile#path-<id> brings
 * that card into view once it is drawn, and a reader who has started moving the
 * page keeps it.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { Router } from "wouter";
import PathsPanel from "./PathsPanel";

const tiles = ["investor", "steward"].map((id) => ({ id, label: id, role: "", route: `/${id}`, offered: true }));
const panel = () =>
  render(
    <Router>
      <PathsPanel tiles={tiles} claimedIds={["steward"]} offerKnown saving={null} error="" onToggle={() => {}} ladders={[]} />
    </Router>,
  );

let scrolled: string[] = [];
beforeEach(() => {
  vi.useFakeTimers();
  scrolled = [];
  Element.prototype.scrollIntoView = function (this: Element) {
    scrolled.push(this.id);
  };
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  window.history.replaceState(null, "", "/");
});

describe("a path's card answers its address", () => {
  it("every tile carries its path's anchor", () => {
    panel();
    expect(document.getElementById("path-investor")).not.toBeNull();
    expect(document.getElementById("path-steward")).not.toBeNull();
  });

  it("comes into view on arrival, and again once the page has settled", () => {
    window.history.replaceState(null, "", "/profile#path-steward");
    panel();
    vi.advanceTimersByTime(100);
    expect(scrolled).toEqual(["path-steward"]);
    vi.advanceTimersByTime(1000);
    expect(scrolled).toEqual(["path-steward", "path-steward"]);
  });

  it("CONTROL: a reader who touches the page first keeps it where they put it", () => {
    window.history.replaceState(null, "", "/profile#path-steward");
    panel();
    vi.advanceTimersByTime(100);
    window.dispatchEvent(new Event("touchstart"));
    vi.advanceTimersByTime(1000);
    expect(scrolled).toEqual(["path-steward"]);
  });

  it("CONTROL: any other anchor is left to the page", () => {
    window.history.replaceState(null, "", "/profile#about");
    panel();
    vi.advanceTimersByTime(1500);
    expect(scrolled).toEqual([]);
  });
});
