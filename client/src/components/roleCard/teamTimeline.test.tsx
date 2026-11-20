// @vitest-environment jsdom
/**
 * THREE ROLES, ONE TIMELINE (the lead, 20 Nov 2026; the roles lane's ideas 4 and 5): the open roles' deliverables in
 * one chart, a lane each, today drawn through every lane, the gates they share drawn once and named once, and a
 * tap on a bar for its dates and what it feeds. The text list stays.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, within } from "@testing-library/react";
import DeliverablesGantt from "./DeliverablesGantt";
import { placeLabels } from "@shared/roleDeliverablesGantt";

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
    // One today line and one gate line in each lane (drawn against that lane's own track), and one label each.
    expect(container.querySelectorAll("[data-gantt-today]")).toHaveLength(2);
    expect(new Set(Array.from(container.querySelectorAll("[data-gantt-gate]")).map((g) => g.getAttribute("data-gantt-gate")))).toEqual(new Set(["2027-02-01"]));
    expect(container.querySelectorAll("[data-gantt-gate]")).toHaveLength(2);
    expect(container.querySelectorAll("[data-gantt-today-label]")).toHaveLength(1);
    expect(container.querySelectorAll("[data-gantt-gate-label]")).toHaveLength(1);
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

  it("places the lines against the bar track: the label row carries the lanes' border and padding, and the overlay keeps the lane's padding", () => {
    const { container } = render(<DeliverablesGantt rows={rows} label="3 roles, one timeline" />);
    const head = container.querySelector("[data-gantt-head]") as HTMLElement;
    expect(head.className).toContain("border border-transparent px-2.5");
    const lane = container.querySelector("[data-gantt-lane]") as HTMLElement;
    expect(lane.className).toContain("p-2.5");
    const overlay = lane.querySelector("[data-gantt-overlay]") as HTMLElement;
    expect(overlay.className).toContain("inset-x-2.5");
    // From @lg only: on a phone the lines run through the tracks alone, never through a row's name.
    expect(overlay.className).toMatch(/(^|\s)hidden(\s|$)/);
    expect(overlay.className).toContain("@lg:grid");
    // Every track draws the same lines at the same fractions as the overlay.
    const bars = container.querySelectorAll("[data-gantt-bar]");
    bars.forEach((b) => {
      expect(b.querySelectorAll("[data-gantt-track-gate]")).toHaveLength(1);
      expect(b.querySelectorAll("[data-gantt-track-today]")).toHaveLength(1);
      expect((b.querySelector("[data-gantt-track-gate]") as HTMLElement).style.left).toBe((overlay.querySelector("[data-gantt-gate]") as HTMLElement).style.left);
    });
  });

  it("keeps Today on a row of its own, above the gate labels", () => {
    const { container } = render(<DeliverablesGantt rows={rows} label="3 roles, one timeline" />);
    const today = container.querySelector("[data-gantt-today-label]") as HTMLElement;
    const gate = container.querySelector("[data-gantt-gate-label]") as HTMLElement;
    expect(today.style.top).toBe("0px");
    expect(parseFloat(gate.style.top)).toBeGreaterThanOrEqual(18);
    // The full name stays reachable on a cut label.
    expect(gate.getAttribute("title")).toMatch(/^Land closes, Permits filed, /);
  });
});

describe("the timeline's labels", () => {
  const overlaps = (ls: ReturnType<typeof placeLabels>["labels"]) =>
    ls.some((a, i) => ls.some((b, j) => i !== j && a.row === b.row && a.left < b.left + b.width && b.left < a.left + a.width));

  it("puts labels that would touch on different rows, and leaves apart ones on the same row", () => {
    const { labels, rows: n } = placeLabels([{ at: 0.1, width: 120 }, { at: 0.15, width: 120 }, { at: 0.6, width: 120 }], 600);
    expect(labels.map((l) => l.row)).toEqual([0, 1, 0]);
    expect(n).toBe(2);
    expect(overlaps(labels)).toBe(false);
  });

  it("ends a label at its line when it would run past the right edge, and keeps every label inside the chart", () => {
    const { labels } = placeLabels([{ at: 0.6, width: 180 }, { at: 0.95, width: 60 }], 390);
    expect(labels[0].side).toBe("end");
    expect(labels[0].left + labels[0].width).toBeCloseTo(0.6 * 390);
    for (const l of labels) {
      expect(l.left).toBeGreaterThanOrEqual(0);
      expect(l.left + l.width).toBeLessThanOrEqual(390);
    }
  });

  it("cuts a label with no room either way to the wider side", () => {
    const { labels } = placeLabels([{ at: 0.3, width: 500 }], 300);
    expect(labels[0]).toEqual({ left: 90, width: 210, side: "start", row: 0 });
    const end = placeLabels([{ at: 0.8, width: 500 }], 300).labels[0];
    expect(end).toEqual({ left: 0, width: 240, side: "end", row: 0 });
  });

  it("a label that fits stays on one row after its line (control)", () => {
    expect(placeLabels([{ at: 0.2, width: 80 }], 600).labels[0]).toEqual({ left: 120, width: 80, side: "start", row: 0 });
  });
});
