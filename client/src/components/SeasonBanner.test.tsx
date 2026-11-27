// @vitest-environment jsdom
/**
 * The season strap names the season and the day it closes, never a countdown
 * (the art rules; batch 158: "49 days until the season turns" on /).
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { Router } from "wouter";

const state = vi.hoisted(() => ({ season: null as unknown, user: null as Record<string, unknown> | null }));
vi.mock("@/lib/gameApi", () => ({ useSeason: () => state.season, useGameConfig: () => ({ stages: [{ id: "guest" }, { id: "member" }] }) }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: state.user }) }));

import SeasonBanner from "./SeasonBanner";

const entry = (over: Record<string, unknown> = {}) => ({ id: "s1", name: "Season of Foundations", theme: "", focus: "", startsOn: "2026-10-01", endsOn: "2026-12-31", goals: [], ...over });
const base = { needsNextSeason: false, daysUntilStart: 0, timezone: "UTC", cadence: "quarter", today: "2026-11-12" };

afterEach(() => {
  cleanup();
  state.user = null;
});

describe("the season strap", () => {
  it("names the season and its closing day, with no count of days", () => {
    state.season = { ...base, current: entry(), upcoming: null, daysLeft: 49 };
    const { container } = render(<Router><SeasonBanner /></Router>);
    expect(container.textContent).toContain("Season of Foundations");
    expect(container.querySelector("[data-season-closes]")?.textContent).toBe("Closes on 31 December 2026.");
    expect(container.textContent).not.toMatch(/\d+ days?/);
    expect(container.textContent).not.toMatch(/until the season turns/);
  });

  // The lead, 27 Nov 2026: "get rid of repetitive text". The name and the closing day are each said once.
  it("says the season's name once and its closing day once, plan button and all", () => {
    state.season = {
      ...base,
      current: entry({ focus: "Site planning, first structures, and growing the founding community.", goals: [{ text: "a", done: true }, { text: "b", done: false }] }),
      upcoming: null,
      daysLeft: 49,
      planWindow: { seasonId: "s1", seasonName: "Season of Foundations", opensOn: "2026-11-01", closesOn: "2026-12-31", state: "open" },
    };
    state.user = { id: "u1", role: "member", membershipGranted: true };
    const { container } = render(<Router><SeasonBanner /></Router>);
    const text = container.textContent ?? "";
    expect(text.split("Season of Foundations").length - 1).toBe(1);
    expect(text.split("31 December 2026").length - 1).toBe(1);
    expect(text.split("Plan your season").length - 1).toBe(1);
    expect(container.querySelector('[data-season-plan] a')?.getAttribute("href")).toBe("/season-plans/mine");
  });

  it("draws the goals as a ring, one segment each, the met ones lit, and marks today on the time line", () => {
    state.season = { ...base, current: entry({ goals: [{ text: "a", done: true }, { text: "b", done: true }, { text: "c", done: false }] }), upcoming: null, daysLeft: 49 };
    state.user = { id: "u1", role: "member", membershipGranted: true };
    const { container } = render(<Router><SeasonBanner /></Router>);
    const ring = container.querySelector("[data-season-ring]") as SVGElement;
    expect(ring.getAttribute("aria-hidden")).toBe("true");
    expect(ring.querySelectorAll("circle")).toHaveLength(3);
    expect(ring.querySelectorAll("[data-goal-lit]")).toHaveLength(2);
    // 12 Nov in a season of 1 Oct to 31 Dec: today sits under halfway along.
    const today = container.querySelector("[data-season-today]") as HTMLElement;
    const left = Number.parseFloat(today.style.left);
    expect(left).toBeGreaterThan(40);
    expect(left).toBeLessThan(50);
  });

  it("shows the planning window's own day only when it differs from the season's close", () => {
    state.season = { ...base, current: entry(), upcoming: null, daysLeft: 49, planWindow: { seasonId: "s1", seasonName: "Season of Foundations", opensOn: "2026-11-01", closesOn: "2026-11-30", state: "open" } };
    state.user = { id: "u1", role: "member", membershipGranted: true };
    const { container } = render(<Router><SeasonBanner /></Router>);
    expect(container.querySelector("[data-season-plan]")?.textContent).toContain("Open until 30 November 2026.");
  });

  it("names the season being planned when the window plans another season than the card's, with its own day", () => {
    state.season = { ...base, current: entry(), upcoming: null, daysLeft: 49, planWindow: { seasonId: "s2", seasonName: "Season of Rains", opensOn: "2026-12-01", closesOn: "2026-12-31", state: "open" } };
    state.user = { id: "u1", role: "member", membershipGranted: true };
    const { container } = render(<Router><SeasonBanner /></Router>);
    // Same closing day as the season, but another season: the name and the day both say something new.
    expect(container.querySelector("[data-season-plan]")?.textContent).toContain("For Season of Rains. Open until 31 December 2026.");
  });

  it("compares the window's close with the season's as civil days, so a full ISO stamp on the same day says nothing more", () => {
    state.season = { ...base, current: entry({ endsOn: "2026-12-31T00:00:00.000Z" }), upcoming: null, daysLeft: 49, planWindow: { seasonId: "s1", seasonName: "Season of Foundations", opensOn: "2026-11-01", closesOn: "2026-12-31", state: "open" } };
    state.user = { id: "u1", role: "member", membershipGranted: true };
    const { container } = render(<Router><SeasonBanner /></Router>);
    expect(container.querySelector("[data-season-plan]")?.textContent).toBe("Plan your season");
  });

  it("gives a visitor no plan button", () => {
    state.season = { ...base, current: entry(), upcoming: null, daysLeft: 49, planWindow: { seasonId: "s1", seasonName: "Season of Foundations", opensOn: "2026-11-01", closesOn: "2026-12-31", state: "open" } };
    const { container } = render(<Router><SeasonBanner /></Router>);
    expect(container.querySelector("[data-season-plan]")).toBeNull();
  });

  it("says nothing of a close for an open-ended season", () => {
    state.season = { ...base, current: entry({ endsOn: "" }), upcoming: null, daysLeft: null, openEnded: true };
    const { container } = render(<Router><SeasonBanner /></Router>);
    expect(container.querySelector("[data-season-closes]")).toBeNull();
  });

  it("names the day a coming season begins, never how many days away", () => {
    state.season = { ...base, current: null, upcoming: entry({ name: "Season of Rains", startsOn: "2027-01-01" }), daysLeft: null, daysUntilStart: 50 };
    const { container } = render(<Router><SeasonBanner /></Router>);
    expect(container.textContent).toContain("begins on 1 January 2027");
    expect(container.textContent).not.toMatch(/begins in \d/);
  });
});

describe("the count of season goals met (the front door, 24 Nov 2026)", () => {
  const goals = [{ text: "Clean the river", done: true }, { text: "Plant the orchard", done: false }];

  it("is not shown to a visitor or to someone the village has not admitted", () => {
    state.season = { ...base, current: entry({ goals }), upcoming: null, daysLeft: 49 };
    const visitor = render(<Router><SeasonBanner /></Router>);
    expect(visitor.container.querySelector("[data-season-goals-met]")).toBeNull();
    expect(visitor.container.textContent).not.toMatch(/goals? met/);
    expect(visitor.container.textContent).toContain("Season of Foundations");
    visitor.unmount();
    state.user = { id: "u2", role: "member", stageGranted: "guest" };
    const applicant = render(<Router><SeasonBanner /></Router>);
    expect(applicant.container.querySelector("[data-season-goals-met]")).toBeNull();
  });

  it("CONTROL: a member keeps it", () => {
    state.season = { ...base, current: entry({ goals }), upcoming: null, daysLeft: 49 };
    state.user = { id: "u1", role: "member", membershipGranted: true };
    const { container } = render(<Router><SeasonBanner /></Router>);
    expect(container.querySelector("[data-season-goals-met]")?.textContent).toBe("1 of 2 season goals met");
  });
});
