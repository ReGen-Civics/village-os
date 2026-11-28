// @vitest-environment jsdom
/**
 * How the menu is used, drawn: it asks for the current season's window, shows the counts against the menu, says
 * what is not recorded, and words the suggestions. Invented counts; no person anywhere.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";

vi.mock("@/lib/gameApi", () => ({
  fetchSeasonCached: async () => ({}),
  useGameConfig: () => null,
  useSeason: () => ({
    today: "2026-11-30",
    current: { id: "s2", name: "Season of Roots", startsOn: "2026-11-01", endsOn: "2027-02-01" },
    seasons: [
      { id: "s1", name: "Season of Seeds", startsOn: "2026-08-01", endsOn: "2026-11-01" },
      { id: "s2", name: "Season of Roots", startsOn: "2026-11-01", endsOn: "2027-02-01" },
    ],
  }),
}));
const on = vi.hoisted(() => ({ modules: ["map", "events"] }));
vi.mock("@/modules/ModuleProvider", () => ({ useModules: () => ({ modules: on.modules.map((id) => ({ id })) }) }));
vi.mock("@/hooks/useVillageMenu", () => ({ useVillageMenu: () => ({ hidden: [], labels: {}, groups: {} }) }));

import MenuUseTab from "./MenuUseTab";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  on.modules = ["map", "events"];
});

/** The usage route, answering every window with these totals. */
const answering = (totals: Array<{ path: string; count: number }>, recordedSince = "2026-11-01") =>
  vi.stubGlobal("fetch", async (url: string) => {
    const past = url.includes("from=2026-08-01");
    return new Response(
      JSON.stringify({ from: past ? "2026-08-01" : "2026-11-01", to: past ? "2026-11-01" : "2027-02-01", today: "2026-11-30", recordedSince, totals }),
      { status: 200 },
    );
  });

describe("MenuUseTab", () => {
  it("reads the season's window and shows the most visited, the unopened and what it suggests", async () => {
    const asked: string[] = [];
    vi.stubGlobal("fetch", async (url: string) => {
      asked.push(url);
      return new Response(
        JSON.stringify({
          from: "2026-11-01",
          to: "2027-02-01",
          today: "2026-11-30",
          recordedSince: "2026-11-01",
          totals: [
            { path: "/quests", count: 70 },
            { path: "/map", count: 20 },
            { path: "/events", count: 10 },
          ],
        }),
        { status: 200 },
      );
    });
    render(<MenuUseTab password="admin-token" />);
    const most = await screen.findByRole("table", { name: "Most visited" });
    expect(asked[0]).toBe("/api/admin/nav/usage?from=2026-11-01&to=2027-02-01");
    const rows = within(most).getAllByRole("row").slice(1);
    expect(rows[0].textContent).toContain("Quests");
    expect(rows[0].textContent).toContain("70");
    expect(rows[0].textContent).toContain("70%");
    expect(screen.getByRole("combobox").textContent).toContain("This season (Season of Roots)");
    const limits = screen.getByTestId("menu-use-limits");
    expect(limits.textContent).toMatch(/visitor's visits are not recorded/);
    expect(limits.textContent).toMatch(/Members and admins are counted together/);
    expect(limits.textContent).toContain("This window counted 30 days");
    const suggestions = screen.getByTestId("menu-use-suggestions");
    // The suggestion names the first unopened page in the menu's order, and Join leads the menu (the lead, 27 Nov 2026).
    expect(suggestions.textContent).toMatch(/No one opened Open Roles this season: consider folding it\./);
    expect(screen.getByTestId("menu-use-unopened").textContent).toContain("Gratitude");
    expect(screen.getByTestId("menu-use-window").textContent).toBe("1 Nov 2026 to 31 Jan 2027, counted in UTC days");
    // Places in one line, in the menu's order: "In Village, and in Govern under This season".
    expect(rows[0].textContent).toContain("In Village, and in Govern under This season");
  });

  it("reads a past season by its name, with its dates, and drops \"so far\" once it has ended", async () => {
    const asked: string[] = [];
    vi.stubGlobal("fetch", async (url: string) => {
      asked.push(url);
      const past = url.includes("from=2026-08-01");
      return new Response(
        JSON.stringify({
          from: past ? "2026-08-01" : "2026-11-01",
          to: past ? "2026-11-01" : "2027-02-01",
          today: "2026-11-30",
          recordedSince: "2026-08-01",
          totals: [{ path: "/quests", count: 4 }],
        }),
        { status: 200 },
      );
    });
    render(<MenuUseTab password="admin-token" />);
    await screen.findByTestId("menu-use-suggestions");
    expect(screen.getByTestId("menu-use-suggestions").textContent).toContain("so far");
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "s1" } });
    await screen.findByText(/No one opened these in Season of Seeds \(\d+\)/);
    expect(asked.at(-1)).toBe("/api/admin/nav/usage?from=2026-08-01&to=2026-11-01");
    expect(screen.getByTestId("menu-use-window").textContent).toBe("1 Aug to 31 Oct 2026, counted in UTC days");
    const said = screen.getByTestId("menu-use-suggestions").textContent ?? "";
    expect(said).toContain("Only 4 visits over 92 days.");
    expect(said).not.toContain("so far");
    expect(said).not.toContain("this season");
  });

  it("says in words when the counts cannot be read", async () => {
    vi.stubGlobal("fetch", async () => new Response(JSON.stringify({ error: "unavailable", message: "The visit counts could not be read just now." }), { status: 503 }));
    render(<MenuUseTab password="admin-token" />);
    expect((await screen.findByRole("alert")).textContent).toBe("The visit counts could not be read just now.");
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("says one day and one visit in the singular (QA round 2)", async () => {
    answering([{ path: "/quests", count: 1 }], "2026-11-30");
    render(<MenuUseTab password="admin-token" />);
    const said = (await screen.findByTestId("menu-use-suggestions")).textContent ?? "";
    expect(said).toContain("Only 1 visit over 1 day so far.");
    expect(screen.getByTestId("menu-use-limits").textContent).toContain("This window counted 1 day.");
    expect(screen.getByText("1 visit to pages in the menu.")).toBeTruthy();
  });

  it("puts the count in the lift-out sentence, so all of a handful reads as a handful", async () => {
    // Events holds every one of Community's 5 visits from inside Gatherings; plenty elsewhere clears the window.
    answering([{ path: "/events", count: 5 }, { path: "/quests", count: 60 }]);
    render(<MenuUseTab password="admin-token" />);
    const said = (await screen.findByTestId("menu-use-suggestions")).textContent ?? "";
    expect(said).toContain("Events draws all 5 visits in Community from inside the Gatherings folder");
    expect(said).not.toContain("100%");
  });

  it("tells two pages the menu calls by one name apart by their addresses", async () => {
    // Map off: /map/circles is not in the menu (not judged) and /circles is, both called Circles.
    on.modules = ["events"];
    answering([{ path: "/quests", count: 60 }]);
    render(<MenuUseTab password="admin-token" />);
    await screen.findByTestId("menu-use-suggestions");
    const page = screen.getByTestId("menu-use").textContent ?? "";
    // The hidden one in the not-judged line, the shown one in the unopened list, each with its address.
    expect(page).toMatch(/not judged: [^.]*Circles \(\/map\/circles\)/);
    expect(screen.getByTestId("menu-use-unopened").textContent).toContain("Circles (/circles)");
  });
});
