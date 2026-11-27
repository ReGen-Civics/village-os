// @vitest-environment jsdom
/**
 * How roles are going, on the circles pages (the lead, 27 Nov 2026: "admin for
 * the whole village and circle leads for their circle ... show all data we
 * have. If we have none say 'no data'").
 *
 * The server decides who reads what; this holds the panel to what it is
 * handed: a visitor asks nothing, a refused member sees nothing, an admin sees
 * every circle, a lead sees the circle the server gave them, and every number
 * shows (1 and 2 included) with "no data" only where nothing was recorded.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@lingui/core";
import type { MeasureRow, Share } from "@shared/roleMeasures";

const auth = vi.hoisted(() => ({ admin: false, signedIn: false }));
const gameFetch = vi.hoisted(() => vi.fn());

vi.mock("@/components/natural", () => ({ BreathingLoader: () => <div data-testid="loader" /> }));
vi.mock("@/lib/gameApi", () => ({
  gameFetch,
  useSeason: () => ({ current: { id: "s2", name: "Rains" }, seasons: [{ id: "s1", name: "Dry" }, { id: "s2", name: "Rains" }] }),
}));
vi.mock("@/contexts/AuthContext", () => ({
  useIsAdmin: () => auth.admin,
  useOptionalAuth: () => ({ user: auth.signedIn ? { id: "u-1" } : null }),
}));

import RoleMeasuresPanel from "./RoleMeasuresPanel";

/** A share as the server builds it: no data only when there was nobody to count. */
const share = (eligible: number, yes: number): Share => ({ eligible, yes, share: eligible === 0 ? null : yes / eligible });
const row = (seasonId: string | null, circleId: string | null, circleName: string | null, n: number): MeasureRow & { circleName: string | null } => ({
  seasonId,
  circleId,
  circleName,
  applications: { count: n, answered: share(n, n - 1), medianHoursToReply: 30, medianHoursToInterview: 100, medianHoursToDecision: null },
  holders: { count: 1, pathCompleteBy30: share(1, 1), stillInRoleAt90: share(2, 0), renewed: share(0, 0) },
});
const ROWS = [row("s2", "c-garden", "Garden Circle", 4), row("s2", null, null, 1), row("s1", "c-garden", "Garden Circle", 6), row("s2", "c-anchor", "Anchor Circle", 2)];

const answer = (status: number, body: unknown = {}) => ({ ok: status >= 200 && status < 300, status, json: async () => body });
const show = (circleId?: string) =>
  render(
    <I18nProvider i18n={i18n}>
      <RoleMeasuresPanel circleId={circleId} />
    </I18nProvider>,
  );
const rowNames = (list: HTMLElement) => Array.from(list.querySelectorAll("details > summary > span:first-child > span:first-child")).map((el) => el.textContent);

describe("RoleMeasuresPanel", () => {
  beforeEach(() => {
    i18n.load("en", {});
    i18n.activate("en");
    gameFetch.mockReset();
    gameFetch.mockResolvedValue(answer(200, { rows: ROWS, scope: "village" }));
    Object.assign(auth, { admin: false, signedIn: false });
    window.history.replaceState(null, "", "/circles");
  });
  afterEach(cleanup);

  it("draws nothing and asks nothing for a visitor", () => {
    const { container } = show();
    expect(container.innerHTML).toBe("");
    expect(gameFetch).not.toHaveBeenCalled();
  });

  it("draws nothing for a signed-in member the server refuses, not even a loader", async () => {
    auth.signedIn = true;
    gameFetch.mockResolvedValue(answer(403, { error: "no" }));
    const { container } = show();
    expect(container.innerHTML).toBe("");
    await waitFor(() => expect(gameFetch).toHaveBeenCalledWith("/api/role-measures"));
    await new Promise((r) => setTimeout(r, 0));
    expect(container.innerHTML).toBe("");
  });

  it("lists every circle of the current season for an admin, roles not in a circle last", async () => {
    Object.assign(auth, { admin: true, signedIn: true });
    show();
    const list = await screen.findByTestId("measures-circles");
    expect(rowNames(list)).toEqual(["Anchor Circle", "Garden Circle", "Roles not in a circle"]);
    expect(screen.getByText("Administrators see every circle; each lead sees their own")).toBeTruthy();
    // An admin's rows start closed.
    expect(list.querySelectorAll("details[open]")).toHaveLength(0);
    expect(screen.getByRole("button", { name: "Rains" }).getAttribute("aria-pressed")).toBe("true");
    expect(list.querySelector('[data-circle-measures="c-garden"] summary')!.textContent).toContain("Answered 75%");
    expect(list.querySelector("summary dl")).toBeNull();
  });

  it("shows a lead the circle the server gave them, and says who sees it", async () => {
    auth.signedIn = true;
    gameFetch.mockResolvedValue(answer(200, { rows: [ROWS[3]], scope: "circles" }));
    show();
    const list = await screen.findByTestId("measures-circles");
    expect(rowNames(list)).toEqual(["Anchor Circle"]);
    expect(screen.getByText("Administrators see every circle; each lead sees their own")).toBeTruthy();
    // A lead's one circle is open from the start.
    expect(list.querySelectorAll("details[open]")).toHaveLength(1);
  });

  it("draws no chapter wrapper for a refused member on the circles page", async () => {
    auth.signedIn = true;
    gameFetch.mockResolvedValue(answer(403, { error: "no" }));
    const { container } = render(
      <I18nProvider i18n={i18n}>
        <RoleMeasuresPanel chapter />
      </I18nProvider>,
    );
    await waitFor(() => expect(gameFetch).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 0));
    expect(container.innerHTML).toBe("");
  });

  it("draws nothing for a member whose read fails: only an admin is told", async () => {
    auth.signedIn = true;
    gameFetch.mockResolvedValue(answer(500));
    const { container } = show();
    await waitFor(() => expect(gameFetch).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 0));
    expect(container.innerHTML).toBe("");
  });

  it("asks for one circle on its page, and draws nothing when the reader does not lead it", async () => {
    auth.signedIn = true;
    gameFetch.mockResolvedValue(answer(403, { error: "no" }));
    const { container } = show("c-garden");
    await waitFor(() => expect(gameFetch).toHaveBeenCalledWith("/api/role-measures?circle=c-garden"));
    await new Promise((r) => setTimeout(r, 0));
    expect(container.innerHTML).toBe("");
  });

  it("shows counts of 1 and 2, a real zero as 0, and no data only where nothing was recorded", async () => {
    Object.assign(auth, { admin: true, signedIn: true });
    gameFetch.mockResolvedValue(answer(200, { rows: [ROWS[3]], scope: "village" }));
    show("c-anchor");
    const panel = await screen.findByTestId("role-measures-panel");
    await waitFor(() => expect(panel.textContent).toContain("Applying"));
    const step = (label: string) => Array.from(panel.querySelectorAll("li")).find((li) => li.textContent?.includes(label))!;
    // Two applications, one answered: counts under three show.
    expect(step("Applied").textContent).toContain("2");
    expect(step("Answered").textContent).toContain("50%");
    expect(step("Answered").textContent).toContain("1 of 2");
    expect(step("Seated").textContent).toContain("1");
    expect(step("Path done by day 30").textContent).toContain("100%");
    expect(step("Path done by day 30").textContent).toContain("1 of 1");
    // Two counted, none still in the role: a real zero.
    expect(step("Still in the role at day 90").textContent).toContain("0%");
    expect(step("Still in the role at day 90").querySelector("[data-no-data]")).toBeNull();
    // Nothing recorded: no data.
    expect(step("Decision").querySelector("[data-no-data]")?.textContent).toBe("no data");
    expect(step("Renewed at each moon").querySelector("[data-no-data]")?.textContent).toBe("no data");
    expect(panel.textContent).not.toMatch(/too few|not yet/);
    expect(screen.getByText("Only this circle's lead and administrators see this")).toBeTruthy();
    expect(screen.getByRole("heading", { level: 2 }).getAttribute("tabindex")).toBe("-1");
  });

  it("draws holding the role as four stones, with no quest step", async () => {
    Object.assign(auth, { admin: true, signedIn: true });
    gameFetch.mockResolvedValue(answer(200, { rows: [ROWS[3]], scope: "village" }));
    show("c-anchor");
    const panel = await screen.findByTestId("role-measures-panel");
    await waitFor(() => expect(panel.textContent).toContain("Holding the role"));
    const holding = Array.from(panel.querySelectorAll("h3")).find((h) => h.textContent === "Holding the role")!.parentElement!;
    const labels = Array.from(holding.querySelectorAll("li")).map((li) => li.textContent ?? "");
    expect(labels).toHaveLength(4);
    expect(labels.map((l) => ["Seated", "Path done by day 30", "Still in the role at day 90", "Renewed at each moon"].find((w) => l.includes(w)))).toEqual([
      "Seated",
      "Path done by day 30",
      "Still in the role at day 90",
      "Renewed at each moon",
    ]);
    expect(panel.textContent).not.toMatch(/quest/i);
  });

  it("reads eighteen minutes as under an hour, and only exactly 0 as 0 hours", async () => {
    Object.assign(auth, { admin: true, signedIn: true });
    const quick = { ...ROWS[3], applications: { ...ROWS[3].applications, medianHoursToReply: 0.3, medianHoursToInterview: 0 } };
    gameFetch.mockResolvedValue(answer(200, { rows: [quick], scope: "village" }));
    show("c-anchor");
    const panel = await screen.findByTestId("role-measures-panel");
    await waitFor(() => expect(panel.textContent).toContain("Applying"));
    const step = (label: string) => Array.from(panel.querySelectorAll("li")).find((li) => li.textContent?.includes(label))!;
    expect(step("First reply").textContent).toContain("under an hour");
    expect(step("First interview").textContent).toContain("0 hours");
  });

  it("switches season and links each named circle to its own measures", async () => {
    Object.assign(auth, { admin: true, signedIn: true });
    show();
    await screen.findByTestId("measures-circles");
    fireEvent.click(screen.getByRole("button", { name: "Dry" }));
    const list = screen.getByTestId("measures-circles");
    expect(list.querySelectorAll("details")).toHaveLength(1);
    expect(list.querySelector("summary")!.textContent).toContain("Applied 6");
    expect(list.querySelector("a")!.getAttribute("href")).toBe("/circles/c-garden#role-measures");
  });

  it("says a failed read in words and asks again on Try again", async () => {
    Object.assign(auth, { admin: true, signedIn: true });
    gameFetch.mockResolvedValueOnce(answer(500));
    show();
    expect((await screen.findByRole("alert")).textContent).toContain("Could not read");
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByTestId("measures-circles")).toBeTruthy();
    expect(gameFetch).toHaveBeenCalledTimes(2);
  });
});
