// @vitest-environment jsdom
/**
 * How roles are going, folded into Circles & Roles. Administrators only, as
 * /role-measures was: for a visitor or a member it draws nothing and asks the
 * server for nothing. For an admin, the circles page lists every circle of the
 * season picked and a circle's page shows only its own chains.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@lingui/core";
import type { MeasureRow } from "@shared/roleMeasures";

const auth = vi.hoisted(() => ({ admin: false }));
const gameFetch = vi.hoisted(() => vi.fn());

vi.mock("@/components/natural", () => ({ BreathingLoader: () => <div data-testid="loader" /> }));
vi.mock("@/lib/gameApi", () => ({
  gameFetch,
  useSeason: () => ({ current: { id: "s2", name: "Rains" }, seasons: [{ id: "s1", name: "Dry" }, { id: "s2", name: "Rains" }] }),
}));
vi.mock("@/contexts/AuthContext", () => ({ useIsAdmin: () => auth.admin }));

import RoleMeasuresPanel from "./RoleMeasuresPanel";

const share = (eligible: number, yes: number) => ({ eligible, yes, share: eligible >= 3 ? yes / eligible : null });
const row = (seasonId: string | null, circleId: string | null, circleName: string | null, n: number): MeasureRow & { circleName: string | null } => ({
  seasonId,
  circleId,
  circleName,
  applications: { count: n, answered: share(n, n - 1), medianHoursToReply: 30, medianHoursToInterview: 100, medianHoursToDecision: null },
  holders: { count: 2, pathCompleteBy30: share(2, 1), firstQuestBy14: share(4, 3), stillInRoleAt90: share(5, 5), renewed: share(0, 0) },
});
const ROWS = [row("s2", "c-garden", "Garden Circle", 4), row("s2", null, null, 1), row("s1", "c-garden", "Garden Circle", 6), row("s2", "c-anchor", "Anchor Circle", 3)];

const show = (circleId?: string) =>
  render(
    <I18nProvider i18n={i18n}>
      <RoleMeasuresPanel circleId={circleId} />
    </I18nProvider>,
  );

describe("RoleMeasuresPanel", () => {
  beforeEach(() => {
    i18n.load("en", {});
    i18n.activate("en");
    gameFetch.mockReset();
    gameFetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({ rows: ROWS }) });
    auth.admin = false;
    window.history.replaceState(null, "", "/circles");
  });
  afterEach(cleanup);

  it("draws nothing and asks nothing for anyone who is not an admin", () => {
    const { container } = show();
    expect(container.innerHTML).toBe("");
    expect(gameFetch).not.toHaveBeenCalled();
  });

  it("lists every circle of the current season for an admin, roles in no circle last", async () => {
    auth.admin = true;
    show();
    const list = await screen.findByTestId("measures-circles");
    await waitFor(() => expect(gameFetch).toHaveBeenCalledWith("/api/role-measures"));
    const names = Array.from(list.querySelectorAll("details > summary > span:first-child > span:first-child")).map((el) => el.textContent);
    expect(names).toEqual(["Anchor Circle", "Garden Circle", "Roles in no circle"]);
    expect(screen.getByRole("button", { name: "Rains" }).getAttribute("aria-pressed")).toBe("true");
    const garden = list.querySelector('[data-circle-measures="c-garden"] summary')!;
    expect(garden.textContent).toContain("Applied4");
    expect(garden.textContent).toContain("Answered75%");
  });

  it("switches season and links each named circle to its own measures", async () => {
    auth.admin = true;
    show();
    await screen.findByTestId("measures-circles");
    fireEvent.click(screen.getByRole("button", { name: "Dry" }));
    const list = screen.getByTestId("measures-circles");
    expect(list.querySelectorAll("details")).toHaveLength(1);
    expect(list.querySelector("summary")!.textContent).toContain("Applied6");
    expect(within(list).getByRole("link").getAttribute("href")).toBe("/circles/c-garden#role-measures");
  });

  it("shows only its own circle on a circle's page, with withheld numbers as too few", async () => {
    auth.admin = true;
    show("c-anchor");
    const panel = await screen.findByTestId("role-measures-panel");
    await waitFor(() => expect(panel.textContent).toContain("Applying"));
    expect(screen.queryByTestId("measures-circles")).toBeNull();
    // Anchor has one season, so there is no picker, only its name.
    expect(screen.queryByRole("button", { name: "Rains" })).toBeNull();
    expect(panel.textContent).toContain("30 hours");
    expect(panel.textContent).toContain("4 days");
    expect(panel.textContent).toContain("2 of 3");
    // Decision median and path share were built from too few people.
    expect(panel.textContent).toContain("too few");
  });

  it("says so when a circle has nothing stamped", async () => {
    auth.admin = true;
    show("c-none");
    expect((await screen.findByTestId("measures-empty")).textContent).toContain("this circle");
  });

  it("says the refusal in words when the server refuses, and asks again on Try again", async () => {
    auth.admin = true;
    gameFetch.mockResolvedValueOnce({ ok: false, status: 403, json: async () => ({}) });
    show();
    expect((await screen.findByRole("alert")).textContent).toContain("Only administrators");
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByTestId("measures-circles")).toBeTruthy();
    expect(gameFetch).toHaveBeenCalledTimes(2);
  });
});
