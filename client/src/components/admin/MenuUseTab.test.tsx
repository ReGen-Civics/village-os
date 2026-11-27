// @vitest-environment jsdom
/**
 * How the menu is used, drawn: it asks for the current season's window, shows the counts against the menu, says
 * what is not recorded, and words the suggestions. Invented counts; no person anywhere.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";

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
vi.mock("@/modules/ModuleProvider", () => ({ useModules: () => ({ modules: [{ id: "map" }, { id: "events" }] }) }));
vi.mock("@/hooks/useVillageMenu", () => ({ useVillageMenu: () => ({ hidden: [], labels: {}, groups: {} }) }));

import MenuUseTab from "./MenuUseTab";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
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
    expect(suggestions.textContent).toMatch(/No one opened Gratitude this season: consider folding it\./);
    expect(screen.getByTestId("menu-use-unopened").textContent).toContain("Gratitude");
  });

  it("says in words when the counts cannot be read", async () => {
    vi.stubGlobal("fetch", async () => new Response(JSON.stringify({ error: "unavailable", message: "The visit counts could not be read just now." }), { status: 503 }));
    render(<MenuUseTab password="admin-token" />);
    expect((await screen.findByRole("alert")).textContent).toBe("The visit counts could not be read just now.");
    expect(screen.queryByRole("table")).toBeNull();
  });
});
