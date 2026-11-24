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
    expect(container.textContent).toContain("Season of Foundations closes on 31 December 2026.");
    expect(container.textContent).not.toMatch(/\d+ days?/);
    expect(container.textContent).not.toMatch(/until the season turns/);
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
