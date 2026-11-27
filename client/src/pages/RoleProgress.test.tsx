// @vitest-environment jsdom
/**
 * /admin/role-progress, how roles are going on its own page (the lead, 27 Nov 2026). The server decides who reads
 * what; this holds the page to what it is handed:
 *   - a visitor asks nothing; a refused member reads one sentence;
 *   - an admin sees Right now, the key measures, the stage times and every circle; a lead the circle given;
 *   - every count shows (1 and 2 included), a real 0 reads 0, "no data" only where nothing was recorded;
 *   - it reads again every minute while in view and when the window comes back, and says when it last read;
 *   - the server's own error words show when it gave some (a 429).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@lingui/core";
import type { MeasureRow, Share, StageNowRow } from "@shared/roleMeasures";

const auth = vi.hoisted(() => ({ signedIn: true }));
const gameFetch = vi.hoisted(() => vi.fn());
const nav = vi.hoisted(() => ({ search: "", navigate: vi.fn() }));

vi.mock("@/components/Layout", () => ({ default: ({ children }: any) => <div>{children}</div> }));
vi.mock("@/components/natural", () => ({ BreathingLoader: () => <div data-testid="loader" /> }));
vi.mock("@/lib/gameApi", () => ({
  gameFetch,
  useSeason: () => ({ current: { id: "s2", name: "Rains" }, seasons: [{ id: "s1", name: "Dry" }, { id: "s2", name: "Rains" }] }),
}));
vi.mock("@/contexts/AuthContext", () => ({ useOptionalAuth: () => ({ user: auth.signedIn ? { id: "u-1" } : null }) }));
vi.mock("wouter", () => ({
  useSearch: () => nav.search,
  useLocation: () => ["/admin/role-progress", nav.navigate],
  Link: ({ children, href, ...rest }: any) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import RoleProgress, { READ_GAP_MS, REFRESH_MS, reviewHrefFor } from "./RoleProgress";

const share = (eligible: number, yes: number): Share => ({ eligible, yes, share: eligible === 0 ? null : yes / eligible });
const none = share(0, 0);
const row = (seasonId: string | null, circleId: string | null, n: number, extra: Partial<MeasureRow> = {}): MeasureRow & { circleName: string | null } => ({
  seasonId,
  circleId,
  circleName: circleId === null ? null : circleId === "c-anchor" ? "Anchor Circle" : "Garden Circle",
  applications: { count: n, answered: share(n, Math.max(0, n - 1)), medianHoursToReply: 0.3, medianHoursToInterview: 100, medianHoursToDecision: null },
  stages: { review: 30, references: 0, final_interview: null, agreement: 72 },
  conversations: { booked: share(2, 1), held: share(1, 1) },
  references: { medianHoursToFollowUp: null },
  outcomes: { offer: share(1, 1), countered: share(1, 0), withdrawn: share(n, 1), declined: share(n, 0), closed: share(n, 0) },
  start: { medianHoursToStart: 48 },
  holders: { count: 1, pathCompleteBy30: share(1, 1), stillInRoleAt30: share(1, 1), stillInRoleAt90: share(2, 0), renewed: none },
  ...extra,
});
const ROWS = [row("s2", "c-garden", 4), row("s2", null, 1), row("s1", "c-garden", 6), row("s2", "c-anchor", 2)];
const TOTALS = [{ ...row("s2", null, 7), circleName: undefined } as unknown as MeasureRow, row("s1", null, 6) as MeasureRow];
const NOW: StageNowRow[] = [
  { circleId: "c-garden", stage: "review", count: 2, open: 2, member: 0, oldestHours: 30 },
  { circleId: "c-anchor", stage: "agreement", count: 1, open: 0, member: 1, oldestHours: 100 },
];

const answer = (status: number, body: unknown = {}) => ({ ok: status >= 200 && status < 300, status, json: async () => body });
const ok = (over: Record<string, unknown> = {}) => answer(200, { rows: ROWS, totals: TOTALS, rightNow: NOW, scope: "village", at: "2026-11-27T14:05:00Z", ...over });
const show = () =>
  render(
    <I18nProvider i18n={i18n}>
      <RoleProgress />
    </I18nProvider>,
  );
const tile = (root: HTMLElement, label: string) => Array.from(root.querySelectorAll("li")).find((li) => li.querySelector("p")?.textContent === label)!;

describe("/admin/role-progress", () => {
  beforeEach(() => {
    i18n.load("en", {});
    i18n.activate("en");
    gameFetch.mockReset();
    gameFetch.mockResolvedValue(ok());
    auth.signedIn = true;
    nav.search = "";
    nav.navigate.mockReset();
    window.history.replaceState(null, "", "/admin/role-progress");
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("asks nothing for a visitor, and offers a way to sign in", () => {
    auth.signedIn = false;
    show();
    expect(gameFetch).not.toHaveBeenCalled();
    expect(screen.getByRole("link", { name: "Sign in" }).getAttribute("href")).toBe("/login?next=%2Fadmin%2Frole-progress");
    expect(screen.queryByTestId("progress-how-to-read")).toBeNull();
  });

  it("tells a refused member in one sentence with a door to the roles, and shows no number", async () => {
    gameFetch.mockResolvedValue(answer(403, { error: "no" }));
    show();
    const refused = await screen.findByTestId("progress-refused");
    expect(refused.textContent).toContain("administrators and circle leads");
    expect(within(refused).getByRole("link").getAttribute("href")).toBe("/roles");
    expect(screen.queryByTestId("progress-right-now")).toBeNull();
    expect(screen.queryByTestId("progress-how-to-read")).toBeNull();
  });

  it("says where the reader is: roles and the season", async () => {
    show();
    await screen.findByTestId("progress-right-now");
    expect(screen.getByText("Roles · Rains")).toBeTruthy();
    expect(screen.getByTestId("progress-how-to-read").textContent).toContain("Administrators see every circle; each lead sees their own.");
    expect(screen.getByTestId("progress-updated").hasAttribute("aria-live")).toBe(false);
  });

  it("shows right now in the track's order, the longest wait marked, each count a door to the review queue", async () => {
    show();
    const now = await screen.findByTestId("progress-right-now");
    const stages = Array.from(now.querySelectorAll("li[data-stage]")).map((li) => li.getAttribute("data-stage"));
    expect(stages).toEqual(["review", "references", "final_interview", "agreement"]);
    // Agreement's oldest has waited 100 hours, our review's 30: agreement is marked, and stays where it is.
    expect(Array.from(now.querySelectorAll("li[data-oldest]")).map((li) => li.getAttribute("data-stage"))).toEqual(["agreement"]);
    const agreement = now.querySelector('li[data-stage="agreement"]')!;
    expect(agreement.textContent).toContain("1");
    expect(agreement.textContent).toContain("4 days");
    expect(within(agreement as HTMLElement).getByRole("link").getAttribute("href")).toBe("/admin/review?kind=application");
    expect(within(now.querySelector('li[data-stage="review"]') as HTMLElement).getByRole("link").getAttribute("href")).toBe("/admin/review?kind=open");
    expect(now.querySelector('li[data-stage="references"]')!.textContent).toContain("0");
    expect(now.querySelector('li[data-stage="references"] a')).toBeNull();
    expect(screen.getByTestId("progress-updated").textContent).toMatch(/^Updated /);
  });

  it("shows every key measure: 1s and 2s, a real 0, and no data where nothing was recorded", async () => {
    show();
    const key = await screen.findByTestId("progress-key-measures");
    expect(tile(key, "Applications").textContent).toContain("7");
    expect(tile(key, "First reply").textContent).toContain("under an hour");
    expect(tile(key, "Conversations booked").textContent).toContain("50%");
    expect(tile(key, "Conversations booked").textContent).toContain("1 of 2");
    expect(tile(key, "Agreements countered first").textContent).toContain("0%");
    expect(tile(key, "Agreements countered first").querySelector("[data-no-data]")).toBeNull();
    expect(tile(key, "References followed up").querySelector("[data-no-data]")?.textContent).toBe("no data");
    expect(tile(key, "Adoption to start").textContent).toContain("2 days");
    expect(tile(key, "Still in the role at day 30").textContent).toContain("100%");
    expect(key.textContent).not.toMatch(/too few|not yet|quest/i);
  });

  it("times each stage, with 0 hours for a real zero and no data for a stage nobody finished", async () => {
    show();
    const section = (await screen.findByText("Time at each stage")).closest("section")!;
    const step = (label: string) => Array.from(section.querySelectorAll("li")).find((li) => li.textContent?.includes(label))!;
    expect(step("Our review").textContent).toContain("30 hours");
    expect(step("References and proposal").textContent).toContain("0 hours");
    expect(step("Final conversation").querySelector("[data-no-data]")).toBeTruthy();
    expect(step("Agreement").textContent).toContain("3 days");
  });

  it("lists every circle for an admin, roles not in a circle last, and filters to one circle", async () => {
    show();
    const list = await screen.findByTestId("measures-circles");
    const names = Array.from(list.querySelectorAll("details > summary > span:first-child > span:first-child")).map((el) => el.textContent);
    expect(names).toEqual(["Anchor Circle", "Garden Circle", "Roles not in a circle"]);
    expect(list.querySelectorAll("details[open]")).toHaveLength(0);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "c-anchor" } });
    expect(nav.navigate).toHaveBeenCalledWith("/admin/role-progress?circle=c-anchor", { replace: true });
  });

  it("reads one circle when filtered, and shows its holding chain as four stones with no quest", async () => {
    nav.search = "?circle=c-anchor";
    gameFetch.mockResolvedValue(ok({ rows: [ROWS[3]], scope: "circles" }));
    show();
    await waitFor(() => expect(gameFetch).toHaveBeenCalledWith("/api/role-measures?circle=c-anchor"));
    const holding = (await screen.findByText("Holding the role")).closest("div")!;
    expect(holding.querySelectorAll("li")).toHaveLength(4);
    expect(holding.textContent).not.toMatch(/quest/i);
    expect(screen.getByRole("button", { name: "Show every circle you lead" })).toBeTruthy();
  });

  it("draws a lead's one circle as its chains, never repeating its headline numbers in a row", async () => {
    gameFetch.mockResolvedValue(ok({ rows: [ROWS[3]], rightNow: NOW.filter((r) => r.circleId === "c-anchor"), scope: "circles" }));
    show();
    expect(await screen.findByText("Holding the role")).toBeTruthy();
    expect(screen.queryByTestId("measures-circles")).toBeNull();
    expect(screen.getByRole("heading", { name: "Anchor Circle" })).toBeTruthy();
  });

  it("gives a lead a door only to members' applications, the queue a lead can read", async () => {
    gameFetch.mockResolvedValue(ok({ scope: "circles" }));
    show();
    const now = await screen.findByTestId("progress-right-now");
    // Our review's two came from outside: no door for a lead. Agreement's one is a member's: a door.
    expect(now.querySelector('li[data-stage="review"] a')).toBeNull();
    expect(now.querySelector('li[data-stage="agreement"] a')?.getAttribute("href")).toBe("/admin/review?kind=application");
  });

  it("reads again without the filter when a lead asks for a circle they do not lead, and says so", async () => {
    nav.search = "?circle=c-other";
    gameFetch.mockImplementation(async (url: string) => (url.includes("c-other") ? answer(403, { error: "no" }) : ok({ rows: [ROWS[3]], scope: "circles" })));
    show();
    expect((await screen.findByTestId("progress-outside")).textContent).toContain("You can see the circles you lead");
    expect(screen.queryByTestId("progress-refused")).toBeNull();
    expect(await screen.findByText("Holding the role")).toBeTruthy();
  });

  it("reads again every minute while in view, and once when the window comes back", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    show();
    await waitFor(() => expect(gameFetch).toHaveBeenCalledTimes(1));
    await act(async () => {
      vi.advanceTimersByTime(REFRESH_MS);
    });
    await waitFor(() => expect(gameFetch).toHaveBeenCalledTimes(2));
    // Straight after a read, the window's return asks nothing more.
    await act(async () => {
      window.dispatchEvent(new Event("focus"));
    });
    expect(gameFetch).toHaveBeenCalledTimes(2);
    // Later, visibility and focus fire together: one read, not two.
    await act(async () => {
      vi.advanceTimersByTime(READ_GAP_MS + 1000);
      document.dispatchEvent(new Event("visibilitychange"));
      window.dispatchEvent(new Event("focus"));
    });
    await waitFor(() => expect(gameFetch).toHaveBeenCalledTimes(3));
    expect(gameFetch).toHaveBeenCalledTimes(3);
  });

  it("shows the server's own words when it refuses for a reason, and asks again on Try again", async () => {
    gameFetch.mockResolvedValueOnce(answer(429, { error: "Slow down a little." }));
    show();
    expect((await screen.findByRole("alert")).textContent).toContain("Slow down a little.");
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByTestId("progress-right-now")).toBeTruthy();
  });

  it("links a count to the queue for its door, and to every queue when both doors are in it", () => {
    expect(reviewHrefFor(2, 0)).toBe("/admin/review?kind=open");
    expect(reviewHrefFor(0, 1)).toBe("/admin/review?kind=application");
    expect(reviewHrefFor(1, 1)).toBe("/admin/review");
  });
});
