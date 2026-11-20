// @vitest-environment jsdom
/**
 * THREE ROLES, ONE TIMELINE (the lead, 20 Nov 2026; the roles lane's ideas 4 and 5): the open roles' deliverables in
 * one chart, a lane each, today drawn through every lane, the gates they share drawn once and named once, and a
 * tap on a bar for its dates and what it feeds. The text list stays.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, within } from "@testing-library/react";
import DeliverablesGantt from "./DeliverablesGantt";

const rows = [
  { role: "Finance Steward", title: "Budget agreed", start: "2027-01-05", end: "2027-01-31", feeds: "the first moon's plan" },
  { role: "Finance Steward", title: "Land closes", start: "2027-02-01", end: "2027-02-01", milestone: true },
  { role: "Build Steward", title: "Land closes", start: "2027-02-01", end: "2027-02-01", milestone: true },
  { role: "Build Steward", title: "Permits filed", start: "2027-02-01", end: "2027-02-01", milestone: true },
  { role: "People Steward", title: "Permits filed", start: "2027-02-01", end: "2027-02-01", milestone: true },
  { role: "People Steward", title: "First hires", start: "2027-02-10", end: "2027-03-20" },
];

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2027-01-20T12:00:00Z"));
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("three roles, one timeline", () => {
  it("draws a lane for each role, today through every lane, and one gate for the day two roles share, named once", () => {
    const { container } = render(<DeliverablesGantt rows={rows} label="3 roles, one timeline" />);
    expect(Array.from(container.querySelectorAll("[data-gantt-lane]")).map((l) => l.getAttribute("data-gantt-lane"))).toEqual(["Finance Steward", "People Steward"]);
    expect(container.querySelectorAll("[data-gantt-today]")).toHaveLength(1);
    expect(container.querySelectorAll("[data-gantt-gate]")).toHaveLength(1);
    const gates = container.querySelector("[data-gantt-gates]") as HTMLElement;
    expect(gates.querySelectorAll("li")).toHaveLength(1);
    expect(gates.textContent).toMatch(/^Gate: Land closes, Permits filed, /);
    // A gate is not also a bar in a lane.
    expect(Array.from(container.querySelectorAll("[data-gantt-bar]")).map((b) => b.getAttribute("aria-label"))).toEqual([
      expect.stringMatching(/^Finance Steward: Budget agreed, .+\. Feeds: the first moon's plan$/),
      expect.stringMatching(/^People Steward: First hires, /),
    ]);
  });

  it("says a bar's dates and what it feeds on a tap, and closes on a second tap or Escape", () => {
    const { container } = render(<DeliverablesGantt rows={rows} label="3 roles, one timeline" />);
    const bar = container.querySelector('[data-gantt-bar="0"]') as HTMLElement;
    fireEvent.click(bar);
    const tip = container.querySelector('[data-gantt-tip="0"]') as HTMLElement;
    expect(tip.textContent).toContain("Budget agreed");
    expect(tip.textContent).toContain("Feeds: the first moon's plan");
    expect(bar.getAttribute("aria-expanded")).toBe("true");
    fireEvent.click(bar);
    expect(container.querySelector('[data-gantt-tip="0"]')).toBeNull();
    fireEvent.click(bar);
    fireEvent.keyDown(bar, { key: "Escape" });
    expect(container.querySelector('[data-gantt-tip="0"]')).toBeNull();
  });

  it("keeps the text list, the gate in it once with its roles, and the feeds line", () => {
    const { container } = render(<DeliverablesGantt rows={rows} label="3 roles, one timeline" />);
    const list = within(container.querySelector('[data-testid="deliverables-list"]') as HTMLElement);
    expect(list.getAllByText("Land closes, Permits filed")).toHaveLength(1);
    expect(list.getByText("(Finance Steward, Build Steward, People Steward)")).toBeTruthy();
    expect(list.getByText("Feeds: the first moon's plan")).toBeTruthy();
  });

  it("one role's chart has no lanes and no gates (control)", () => {
    const { container } = render(<DeliverablesGantt rows={rows.slice(0, 2).map(({ role: _r, ...d }) => d)} label="Deliverables" />);
    expect(container.querySelectorAll("[data-gantt-lane]")).toHaveLength(0);
    expect(container.querySelectorAll("[data-gantt-gate]")).toHaveLength(0);
    expect(container.querySelectorAll("[data-gantt-bar]")).toHaveLength(2);
  });
});
