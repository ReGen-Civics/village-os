// @vitest-environment jsdom
/**
 * RIGHTS AND AGREEMENTS (the rights fold, 27 Nov 2026): four pages as one, a chapter each.
 *
 * What this file holds the page to:
 *   - every chapter has its own anchor, and the address picks the chapter drawn;
 *   - the three story chapters follow their own Admin, Pages switches, keyed by their old addresses;
 *   - Leaving Well is always there ("Leaving well is guaranteed"), with the story pages off too;
 *   - `?focus=begin-departure` (the delete screen's "Leave the village instead") opens Leaving Well;
 *   - picking a chapter in the list draws it and writes its anchor into the address.
 *
 * The chapters themselves (their words, their switches, their doors) are held by their own tests in
 * components/rights; here each is a stand-in that names itself.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";

vi.mock("@/components/Layout", () => ({ default: ({ children }: { children: ReactNode }) => <>{children}</> }));
const state = vi.hoisted(() => ({
  config: null as null | { brochurePages?: boolean; brochureHidden?: string[] },
  failed: false,
}));
vi.mock("@/lib/gameApi", () => ({
  useGameConfig: () => state.config,
  useConfigFailed: () => state.failed,
}));
vi.mock("@/hooks/useGoodNeighborName", () => ({ useGoodNeighborName: () => "Good Neighbor Criteria" }));
vi.mock("@/components/natural", () => ({ BreathingLoader: () => <p>loading</p> }));
const stand = vi.hoisted(() => (name: string, id: string) => () => <h2 id={`${id}-title`} tabIndex={-1}>{name} chapter</h2>);
vi.mock("@/components/rights/GoodNeighborChapter", () => ({ default: stand("Good Neighbor", "good-neighbor") }));
vi.mock("@/components/rights/ResidentRightsChapter", () => ({ default: stand("Resident", "resident-rights") }));
vi.mock("@/components/rights/StewardRightsChapter", () => ({ default: stand("Steward", "steward-rights") }));
vi.mock("@/components/rights/LeavingWellChapter", () => ({
  default: () => (
    <>
      <h2 id="leaving-well-title" tabIndex={-1}>Leaving chapter</h2>
      <div id="begin-departure">departure card</div>
    </>
  ),
}));

import RightsAndAgreements, { chapterInAddress } from "./RightsAndAgreements";

const at = (address: string) => window.history.replaceState(null, "", address);
const chapter = (id: string) => document.getElementById(id) as HTMLElement;
const shown = (id: string) => !!chapter(id) && !chapter(id).classList.contains("hidden");
const list = () => screen.getByRole("navigation", { name: "Agreements on this page" });

beforeEach(() => {
  state.config = { brochurePages: true, brochureHidden: [] };
  state.failed = false;
  Element.prototype.scrollIntoView = vi.fn();
  at("/rights");
});
afterEach(() => vi.restoreAllMocks());

describe("chapterInAddress", () => {
  it("reads a chapter's anchor, an id inside a chapter, and a focus target inside one", () => {
    expect(chapterInAddress("#steward-rights", "")).toBe("steward-rights");
    expect(chapterInAddress("#begin-departure", "")).toBe("leaving-well");
    expect(chapterInAddress("", "?focus=begin-departure")).toBe("leaving-well");
    expect(chapterInAddress("#nothing-here", "?focus=something-else")).toBeNull();
    expect(chapterInAddress("#%E0%A4%A", "")).toBeNull();
  });
});

describe("Rights and agreements", () => {
  it("lists the four chapters, most read first, each under its own anchor", () => {
    render(<RightsAndAgreements />);
    expect(screen.getByRole("heading", { level: 1, name: "Rights and agreements" })).toBeInTheDocument();
    const entries = within(list()).getAllByRole("link");
    expect(entries.map((a) => a.getAttribute("href"))).toEqual(["#good-neighbor", "#resident-rights", "#steward-rights", "#leaving-well"]);
    for (const id of ["good-neighbor", "resident-rights", "steward-rights", "leaving-well"]) {
      expect(chapter(id)).toHaveAttribute("data-chapter", id);
    }
  });

  it("draws the first chapter when the address names none, and only that one", () => {
    render(<RightsAndAgreements />);
    expect(shown("good-neighbor")).toBe(true);
    expect(shown("resident-rights")).toBe(false);
    expect(shown("leaving-well")).toBe(false);
    expect(within(list()).getByRole("link", { current: true })).toHaveAttribute("href", "#good-neighbor");
  });

  it("draws the chapter the anchor names, and brings it to the reader", () => {
    at("/rights#steward-rights");
    render(<RightsAndAgreements />);
    expect(shown("steward-rights")).toBe(true);
    expect(shown("good-neighbor")).toBe(false);
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
    expect(document.activeElement?.id).toBe("steward-rights-title");
  });

  it("opens Leaving Well for the delete screen's focus link, and leaves the scrolling to the card", () => {
    at("/rights?focus=begin-departure#leaving-well");
    render(<RightsAndAgreements />);
    expect(shown("leaving-well")).toBe(true);
    expect(document.activeElement?.id).not.toBe("leaving-well-title");
  });

  it("draws the picked chapter and writes its anchor into the address", () => {
    render(<RightsAndAgreements />);
    fireEvent.click(within(list()).getByRole("link", { name: /Leaving Well/ }));
    expect(window.location.hash).toBe("#leaving-well");
    expect(shown("leaving-well")).toBe(true);
    expect(shown("good-neighbor")).toBe(false);
  });

  it("ends each chapter with a door to the next", () => {
    at("/rights#steward-rights");
    render(<RightsAndAgreements />);
    const doors = within(chapter("steward-rights")).getByRole("navigation", { name: "More agreements" });
    fireEvent.click(within(doors).getByRole("link", { name: /Leaving Well/ }));
    expect(shown("leaving-well")).toBe(true);
  });

  it("leaves out a story chapter the village switched off on its own, keyed by its old address", () => {
    state.config = { brochurePages: true, brochureHidden: ["/resident-rights"] };
    at("/rights#resident-rights");
    render(<RightsAndAgreements />);
    expect(chapter("resident-rights")).toBeNull();
    expect(within(list()).queryByRole("link", { name: /Resident rights/ })).toBeNull();
    // The anchor names a chapter that is not served: the first one is drawn instead.
    expect(shown("good-neighbor")).toBe(true);
  });

  it("keeps Leaving Well, alone, while the story pages are off", () => {
    state.config = { brochurePages: false };
    render(<RightsAndAgreements />);
    expect(within(list()).getAllByRole("link").map((a) => a.getAttribute("href"))).toEqual(["#leaving-well"]);
    expect(shown("leaving-well")).toBe(true);
    // One chapter has no next one.
    expect(screen.queryByRole("navigation", { name: "More agreements" })).toBeNull();
  });

  it("waits for the config before drawing a story chapter, and serves Leaving Well when it never comes", () => {
    state.config = null;
    const first = render(<RightsAndAgreements />);
    expect(screen.queryByRole("navigation", { name: "Agreements on this page" })).toBeNull();
    first.unmount();

    state.failed = true;
    render(<RightsAndAgreements />);
    expect(within(list()).getAllByRole("link").map((a) => a.getAttribute("href"))).toEqual(["#leaving-well"]);
  });
});
