// @vitest-environment jsdom
/**
 * QA FAULTS ON THE ROLE CARDS (production 1.3.34): the team sheet's tile says the card's own words for where, the
 * opened card sits under its own row, the split is named once, and the piece rail is one scrolling row on a phone.
 * jsdom has no layout, so the rail is held by its class contract and its tab order.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, within } from "@testing-library/react";
import FoundingTeam, { type FoundingRole } from "./FoundingTeam";
import RolePieces from "./RolePieces";
import { Sprout } from "lucide-react";
import { offeredSplit } from "@shared/proposalSplit";
import SplitControl from "./SplitControl";

const SECTIONS = { idealBackground: [], qualities: [], aiSupport: "", aiCompanion: "", paid: false, payShape: [], payNote: "", payCeiling: null, paySplitNote: "" };
const role = (id: string, name: string, where?: string): FoundingRole => ({
  seat: { id, name, aim: "An aim.", state: "open", archetypes: [], card: { whereWorked: "both" } },
  circleName: "Anchor Circle",
  sections: { ...SECTIONS, ...(where ? { where } : {}) } as FoundingRole["sections"],
});

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 404, json: async () => ({}) })));
  Element.prototype.scrollIntoView = vi.fn();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("the team sheet", () => {
  it("F2: a tile says the card's own words for where, and the fixed label only when the card has none", () => {
    const { container } = render(<FoundingTeam roles={[role("a", "Role A", "Near the coast (preferred) or remote (possible)"), role("b", "Role B")]} />);
    const tiles = Array.from(container.querySelectorAll('[data-testid="team-sheet"] > ul > li')).filter((li) => li.querySelector("[data-founding-role]"));
    expect(tiles[0].textContent).toContain("Near the coast (preferred) or remote (possible)");
    expect(tiles[0].textContent).not.toContain("On the land or remote");
    expect(tiles[1].textContent).toContain("On the land or remote");
  });

  it("F7: the opened card sits right under its own row, not at the bottom of the page", () => {
    const { container } = render(<FoundingTeam roles={[role("a", "Role A"), role("b", "Role B")]} />);
    fireEvent.click(container.querySelector('[data-founding-role="b"]')!);
    const slot = container.querySelector("[data-founding-card-slot]")!;
    const row = container.querySelector('[data-founding-role="b"]')!.closest("li")!;
    expect(row.nextElementSibling?.contains(slot)).toBe(true);
    expect(container.querySelectorAll("[data-founding-card-slot]").length).toBe(1);
    // The card moves with the choice: opening A puts it under A.
    fireEvent.click(container.querySelector('[data-founding-role="a"]')!);
    expect(container.querySelector('[data-founding-role="a"]')!.closest("li")!.nextElementSibling?.contains(container.querySelector("[data-founding-card-slot]"))).toBe(true);
  });
});

describe("the piece rail", () => {
  const pieces = ["one", "two", "three"].map((k) => ({ key: k, tab: k, icon: Sprout, title: k, body: <p>{k}</p> }));

  it("F8: scrolls sideways in one row and sticks on a phone, wraps from sm up, and keeps the tab order", () => {
    const { container } = render(<RolePieces pieces={pieces} level={3} />);
    const rail = container.querySelector("[data-piece-rail]")!;
    expect(rail.className).toContain("max-sm:sticky");
    const list = container.querySelector("[data-piece-scroll]")!;
    expect(list.className).toContain("overflow-x-auto");
    expect(list.className).not.toMatch(/(^|\s)flex-wrap/);
    expect(list.className).toContain("sm:flex-wrap");
    const tabs = within(list as HTMLElement).getAllByRole("button");
    expect(tabs.map((b) => b.textContent)).toEqual(["one", "two", "three"]);
    expect(tabs.every((b) => b.className.includes("shrink-0"))).toBe(true);
  });
});

describe("the split control", () => {
  it("F6: names the split once, as the group's own label", () => {
    const start = offeredSplit([{ label: "Cash", pct: 60 }, { label: "Equity", pct: 40 }, { label: "Credits", pct: 0 }], 6000);
    const { container } = render(<SplitControl idPrefix="t" split={start} offered={start} onChange={() => {}} currency="USD" per="month" pct={50} />);
    expect((container.textContent ?? "").split("How your total is split").length - 1).toBe(1);
    expect(container.querySelector("fieldset > legend")?.textContent).toBe("How your total is split");
  });
});
