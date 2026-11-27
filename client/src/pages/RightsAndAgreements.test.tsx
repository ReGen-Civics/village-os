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
 * And what QA round 1 found (27 Nov 2026):
 *   - a config that never loads shows the try-again card where a story chapter goes, never Leaving Well;
 *   - a pick drops `?focus=`, so arriving from the delete screen does not pin the page;
 *   - an address naming a switched-off chapter is rewritten to the chapter shown, with one quiet line;
 *   - a chapter's title takes focus once its words have arrived, not before;
 *   - the tab names the chapter, and each chapter has a name of its own for a screen reader.
 *
 * The chapters themselves (their words, their switches, their doors) are held by their own tests in
 * components/rights; here each is a stand-in that names itself. The resident one draws its title invisible
 * first, the way a chapter waits for its words.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";

vi.mock("@/components/Layout", () => ({ default: ({ children }: { children: ReactNode }) => <>{children}</> }));
const state = vi.hoisted(() => ({
  config: null as null | { brochurePages?: boolean; brochureHidden?: string[]; project?: { name: string } },
  failed: false,
  retried: 0,
}));
vi.mock("@/lib/gameApi", () => ({
  useGameConfig: () => state.config,
  useConfigFailed: () => state.failed,
  retryGameConfig: async () => {
    state.retried++;
  },
}));
vi.mock("@/hooks/useGoodNeighborName", () => ({ useGoodNeighborName: () => "Good Neighbor Criteria" }));
vi.mock("@/components/natural", () => ({ BreathingLoader: () => <p>loading</p> }));
const stand = vi.hoisted(() => (name: string, id: string) => () => <h2 id={`${id}-title`} tabIndex={-1}>{name} chapter</h2>);
vi.mock("@/components/rights/GoodNeighborChapter", () => ({ default: stand("Good Neighbor", "good-neighbor") }));
vi.mock("@/components/rights/ResidentRightsChapter", async () => {
  const { useEffect, useState } = await import("react");
  return {
    default: function Resident() {
      // Its words arrive a moment after it mounts, as a real chapter's do.
      const [words, setWords] = useState(false);
      useEffect(() => {
        const t = setTimeout(() => setWords(true), 20);
        return () => clearTimeout(t);
      }, []);
      return (
        <h2 id="resident-rights-title" tabIndex={-1} className={words ? "" : "invisible"}>
          Your Rights and Responsibilities
        </h2>
      );
    },
  };
});
vi.mock("@/components/rights/StewardRightsChapter", () => ({
  default: () => (
    <h2 id="steward-rights-title" tabIndex={-1}>
      Your Rights and Responsibilities
    </h2>
  ),
}));
vi.mock("@/components/rights/LeavingWellChapter", () => ({
  default: () => (
    <>
      <h2 id="leaving-well-title" tabIndex={-1}>Leaving chapter</h2>
      <div id="begin-departure">departure card</div>
    </>
  ),
}));

import RightsAndAgreements, { chapterInAddress, searchWithoutFocus } from "./RightsAndAgreements";

const at = (address: string) => window.history.replaceState(null, "", address);
const chapter = (id: string) => document.getElementById(id) as HTMLElement;
const shown = (id: string) => !!chapter(id) && !chapter(id).classList.contains("hidden");
const list = () => screen.getByRole("navigation", { name: "Agreements on this page" });

beforeEach(() => {
  state.config = { brochurePages: true, brochureHidden: [], project: { name: "Willowbrook" } };
  state.failed = false;
  state.retried = 0;
  Element.prototype.scrollIntoView = vi.fn();
  document.title = "Willowbrook";
  at("/rights");
});
afterEach(() => vi.restoreAllMocks());

describe("chapterInAddress and searchWithoutFocus", () => {
  it("reads a chapter's anchor, an id inside a chapter, and a focus target inside one", () => {
    expect(chapterInAddress("#steward-rights", "")).toBe("steward-rights");
    expect(chapterInAddress("#begin-departure", "")).toBe("leaving-well");
    expect(chapterInAddress("", "?focus=begin-departure")).toBe("leaving-well");
    expect(chapterInAddress("#nothing-here", "?focus=something-else")).toBeNull();
    expect(chapterInAddress("#%E0%A4%A", "")).toBeNull();
  });

  it("takes focus out of the query and keeps the rest", () => {
    expect(searchWithoutFocus("?focus=begin-departure")).toBe("");
    expect(searchWithoutFocus("?lang=es&focus=begin-departure")).toBe("?lang=es");
    expect(searchWithoutFocus("")).toBe("");
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

  it("places the reader in their own village above the title", () => {
    render(<RightsAndAgreements />);
    expect(screen.getByText(/Willowbrook · What we promise each other/)).toBeInTheDocument();
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

  it("focuses a chapter's title once its words have arrived, never while it is still invisible", async () => {
    at("/rights#resident-rights");
    render(<RightsAndAgreements />);
    expect(document.activeElement?.id).not.toBe("resident-rights-title");
    await waitFor(() => expect(document.activeElement?.id).toBe("resident-rights-title"));
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
  });

  it("opens Leaving Well for the delete screen's focus link, and leaves the scrolling to the card", () => {
    at("/rights?focus=begin-departure#leaving-well");
    render(<RightsAndAgreements />);
    expect(shown("leaving-well")).toBe(true);
    expect(document.activeElement?.id).not.toBe("leaving-well-title");
  });

  it("lets a reader who arrived by the focus link move on: a pick drops focus and brings the chapter", () => {
    at("/rights?focus=begin-departure#leaving-well");
    render(<RightsAndAgreements />);
    fireEvent.click(within(list()).getByRole("link", { name: /Steward rights/ }));
    expect(window.location.search).toBe("");
    expect(window.location.hash).toBe("#steward-rights");
    expect(shown("steward-rights")).toBe(true);
    expect(document.activeElement?.id).toBe("steward-rights-title");
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
    expect(document.activeElement?.id).toBe("leaving-well-title");
  });

  it("names each chapter for a screen reader by the list's name and its own title, so two alike headings differ", () => {
    render(<RightsAndAgreements />);
    expect(chapter("resident-rights")).toHaveAccessibleName("Resident rights Your Rights and Responsibilities");
    expect(chapter("steward-rights")).toHaveAccessibleName("Steward rights Your Rights and Responsibilities");
  });

  it("names a chapter whose list name is its heading by the heading alone, so it is never read twice", () => {
    render(<RightsAndAgreements />);
    expect(chapter("good-neighbor")).toHaveAccessibleName("Good Neighbor chapter");
    expect(chapter("leaving-well")).toHaveAccessibleName("Leaving chapter");
  });

  it("names the chapter in the tab", () => {
    at("/rights#leaving-well");
    render(<RightsAndAgreements />);
    expect(document.title).toBe("Leaving Well · Rights and agreements · Willowbrook");
    fireEvent.click(within(list()).getByRole("link", { name: /Steward rights/ }));
    expect(document.title).toBe("Steward rights · Rights and agreements · Willowbrook");
  });

  it("keeps the chapter's name and the way back to the list in the phone's bar", () => {
    at("/rights#steward-rights");
    render(<RightsAndAgreements />);
    const bar = screen.getByTestId("rights-chapter-bar");
    expect(bar).toHaveTextContent("Steward rights");
    expect(within(bar).getByRole("button", { name: /All agreements/ })).toBeInTheDocument();
  });

  it("rewrites an address naming a switched-off chapter to the one shown, and says so once", () => {
    state.config = { brochurePages: true, brochureHidden: ["/resident-rights"] };
    at("/rights#resident-rights");
    render(<RightsAndAgreements />);
    expect(chapter("resident-rights")).toBeNull();
    expect(within(list()).queryByRole("link", { name: /Resident rights/ })).toBeNull();
    expect(shown("good-neighbor")).toBe(true);
    expect(window.location.hash).toBe("#good-neighbor");
    expect(screen.getByRole("status")).toHaveTextContent("The part you asked for is not published here.");
  });

  it("keeps Leaving Well, alone, while the story pages are off", () => {
    state.config = { brochurePages: false };
    render(<RightsAndAgreements />);
    expect(within(list()).getAllByRole("link").map((a) => a.getAttribute("href"))).toEqual(["#leaving-well"]);
    expect(shown("leaving-well")).toBe(true);
    // One chapter has no next one.
    expect(screen.queryByRole("navigation", { name: "More agreements" })).toBeNull();
  });

  it("waits for the config before drawing a story chapter", () => {
    state.config = null;
    render(<RightsAndAgreements />);
    expect(screen.queryByRole("navigation", { name: "Agreements on this page" })).toBeNull();
    expect(screen.getByText("loading")).toBeInTheDocument();
  });

  it("shows the try-again card where a story chapter goes when the config never comes, never Leaving Well", () => {
    state.config = null;
    state.failed = true;
    at("/rights#good-neighbor");
    render(<RightsAndAgreements />);
    const card = screen.getByRole("alert");
    expect(card).toHaveTextContent("We couldn't reach the village just now");
    expect(shown("leaving-well")).toBe(false);
    fireEvent.click(within(card).getByRole("button", { name: /Try again/ }));
    expect(state.retried).toBe(1);
    // Leaving Well is still one tap away, and opens when asked for.
    expect(within(list()).getAllByRole("link").map((a) => a.getAttribute("href"))).toEqual(["#leaving-well"]);
    fireEvent.click(within(list()).getByRole("link", { name: /Leaving Well/ }));
    expect(shown("leaving-well")).toBe(true);
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
