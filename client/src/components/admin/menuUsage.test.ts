/**
 * How the menu is used: the maths, on an invented menu and invented counts, so every number below is worked out by
 * hand in the comment beside it.
 */
import { describe, expect, it } from "vitest";
import type { NavLink } from "@/config/nav";
import type { MenuPage } from "@/lib/nearestPages";
import { daysCounted, LIFT_FLOOR_GROUP, LIFT_FLOOR_PAGE, MIN_VISITS, menuUsage, UNOPENED_NAMED, type PathCount } from "./menuUsage";

const row = (href: string, group: string | null, folder: string | null = null, extra: Partial<NavLink> = {}): MenuPage => ({
  href,
  link: { href, label: href.slice(1) || "home", ...extra },
  group,
  folder,
});

/** Village: Map (own row), Quests (own row), Stay and Places (folder "Homes"). Govern: Quests again, Rights and its chapter. */
const MENU: MenuPage[] = [
  row("/map", "Village"),
  row("/quests", "Village"),
  row("/stay", "Village", "Homes", { module: "stays" }),
  row("/places", "Village", "Homes"),
  row("/quests", "Govern", "This season"),
  row("/rights", "Govern", "Guides"),
  row("/rights#leaving-well", "Govern", "Guides"),
  row("/library", "Village", null, { module: "library" }),
];

const WINDOW = { from: "2026-11-01", to: "2027-01-01", today: "2026-11-30", recordedSince: "2026-11-02" };
const allLive = () => true;
const use = (totals: PathCount[], live: (l: NavLink) => boolean = allLive, window = WINDOW) => menuUsage(MENU, totals, { live, ...window });

describe("the days a window counted", () => {
  it("starts at the later of the window and the first counted day, and stops at today", () => {
    // 2 Nov to 30 Nov inclusive: 29 days.
    expect(daysCounted("2026-11-01", "2027-01-01", "2026-11-02", "2026-11-30")).toBe(29);
    // A past season, wholly counted: 1 Oct to 31 Oct.
    expect(daysCounted("2026-10-01", "2026-11-01", "2026-09-01", "2026-11-30")).toBe(31);
    // A season before counting began, and a village that has counted nothing yet.
    expect(daysCounted("2026-08-01", "2026-09-01", "2026-09-01", "2026-11-30")).toBe(0);
    expect(daysCounted("2026-11-01", "2027-01-01", null, "2026-11-30")).toBe(0);
  });
});

describe("pages, counts and shares", () => {
  const u = use([
    { path: "/quests", count: 60 },
    { path: "/map", count: 25 },
    { path: "/places", count: 10 },
    { path: "/rights", count: 5 },
    { path: "/profile/settings", count: 9 },
  ]);

  it("groups rows by the page they open: Quests' two rows are one page, a chapter counts with its page", () => {
    const quests = u.pages.find((p) => p.path === "/quests")!;
    expect(quests.links).toHaveLength(1);
    expect(quests.places).toEqual([
      { group: "Village", folder: null },
      { group: "Govern", folder: "This season" },
    ]);
    const rights = u.pages.find((p) => p.path === "/rights")!;
    expect(rights.links.map((l) => l.href)).toEqual(["/rights", "/rights#leaving-well"]);
    expect(rights.count).toBe(5);
    expect(u.pages.map((p) => p.path)).toEqual(["/map", "/quests", "/stay", "/places", "/rights", "/library"]);
  });

  it("totals only the menu's pages, and shares them out of that total", () => {
    // 60 + 25 + 10 + 5 = 100; the 9 visits to an unlisted page are not the menu's.
    expect(u.total).toBe(100);
    expect(u.pages.find((p) => p.path === "/quests")!.share).toBeCloseTo(0.6);
    expect(u.pages.find((p) => p.path === "/rights")!.share).toBeCloseTo(0.05);
    expect(u.unlisted).toEqual([{ path: "/profile/settings", count: 9 }]);
  });

  it("ranks the most and the least visited, and names the pages nobody opened", () => {
    expect(u.most.map((p) => p.path)).toEqual(["/quests", "/map", "/places", "/rights"]);
    // Four opened pages all fit in the most-visited list, so the least list repeats none of them.
    expect(u.least).toEqual([]);
    expect(u.unopened.map((p) => p.path)).toEqual(["/stay", "/library"]);
  });

  it("sets a page the menu does not show aside, unjudged and out of the total", () => {
    const v = use([{ path: "/quests", count: 60 }, { path: "/stay", count: 40 }], (l) => l.module !== "stays");
    expect(v.notInMenu.map((p) => p.path)).toEqual(["/stay"]);
    expect(v.total).toBe(60);
    expect(v.unopened.map((p) => p.path)).not.toContain("/stay");
  });

  it("ranks least-visited past the top five", () => {
    const many: MenuPage[] = Array.from({ length: 8 }, (_, i) => row(`/p${i}`, "G"));
    const v = menuUsage(many, many.map((m, i) => ({ path: m.href, count: (i + 1) * 10 })), { live: allLive, ...WINDOW });
    expect(v.most.map((p) => p.count)).toEqual([80, 70, 60, 50, 40]);
    expect(v.least.map((p) => p.count)).toEqual([10, 20, 30]);
  });
});

describe("what this suggests", () => {
  it("says only that the window is too thin under a week or under thirty visits", () => {
    const thin = use([{ path: "/quests", count: MIN_VISITS - 1 }]);
    expect(thin.suggestions).toEqual([{ rule: "too-few", values: { visits: 29, days: 29, minDays: 7, minVisits: 30 } }]);
    const young = use([{ path: "/quests", count: 500 }], allLive, { ...WINDOW, recordedSince: "2026-11-27" });
    // 27 Nov to 30 Nov: 4 days.
    expect(young.suggestions.map((s) => s.rule)).toEqual(["too-few"]);
    expect(young.suggestions[0].values.days).toBe(4);
  });

  it("names a page nobody opened", () => {
    const u = use([{ path: "/quests", count: 60 }, { path: "/map", count: 25 }, { path: "/places", count: 10 }, { path: "/rights", count: 5 }]);
    expect(u.suggestions.filter((s) => s.rule === "unopened").map((s) => s.path)).toEqual(["/stay", "/library"]);
  });

  it("names five unopened pages and counts the rest", () => {
    const many: MenuPage[] = [row("/busy", "G"), ...Array.from({ length: UNOPENED_NAMED + 3 }, (_, i) => row(`/quiet${i}`, "G"))];
    const v = menuUsage(many, [{ path: "/busy", count: 100 }], { live: allLive, ...WINDOW });
    const unopened = v.suggestions.filter((s) => s.rule === "unopened");
    expect(unopened.filter((s) => s.path)).toHaveLength(UNOPENED_NAMED);
    expect(unopened.at(-1)).toEqual({ rule: "unopened", values: { more: 3 } });
  });

  it("lifts a busy page out of its folder", () => {
    // Village: map 10, quests 10, stay 40 (in Homes), places 10, library 10. Total 80; median 10.
    // Stay: 40 >= 80 / 4 and 40 >= 2 x 10, so it is lifted out. Places, in the same folder, is not.
    const u = use([{ path: "/map", count: 10 }, { path: "/quests", count: 10 }, { path: "/stay", count: 40 }, { path: "/places", count: 10 }, { path: "/library", count: 10 }, { path: "/rights", count: 10 }]);
    expect(u.suggestions.filter((s) => s.rule === "lift-out")).toEqual([{ rule: "lift-out", path: "/stay", values: { pct: 50, group: "Village", folder: "Homes" } }]);
  });

  it("lifts nothing out on a handful of visits: the group needs thirty, or the page five", () => {
    // One group, Gatherings-like: /stay (in Homes) has every visit there is, but only 4, in a group of 4.
    const small: MenuPage[] = [row("/a", "Community", "Gatherings"), row("/b", "Community"), row("/c", "Community"), row("/busy", "Elsewhere")];
    const window = { live: allLive, ...WINDOW };
    const few = menuUsage(small, [{ path: "/a", count: LIFT_FLOOR_PAGE - 1 }, { path: "/busy", count: 100 }], window);
    expect(few.suggestions.filter((s) => s.rule === "lift-out")).toEqual([]);
    // Five on the page clears the floor, though the group is still under thirty.
    const page = menuUsage(small, [{ path: "/a", count: LIFT_FLOOR_PAGE }, { path: "/busy", count: 100 }], window);
    expect(page.suggestions.filter((s) => s.rule === "lift-out").map((s) => s.path)).toEqual(["/a"]);
    expect(LIFT_FLOOR_GROUP).toBe(30);
  });

  it("names and places a page by the rows the menu shows, never a hidden row's", () => {
    // /rights#leaving-well sits in Govern; a Village chapter row of the same page is switched off.
    const menu: MenuPage[] = [row("/rights#good-neighbor", "Village", "Places and homes", { module: "off" }), row("/rights", "Govern", "Guides"), row("/rights#leaving-well", "Govern", "Guides")];
    const v = menuUsage(menu, [{ path: "/rights", count: 3 }], { live: (l) => l.module !== "off", ...WINDOW });
    const rights = v.pages[0];
    expect(rights.places).toEqual([{ group: "Govern", folder: "Guides" }]);
    expect(rights.shown.map((l) => l.href)).toEqual(["/rights", "/rights#leaving-well"]);
    expect(rights.links).toHaveLength(3);
  });

  it("folds a quiet top-level row into a folder", () => {
    // Village: map 40, quests 40, stay 40, places 40, library 2. Median 40; 2 <= 40 / 4, and Library has its own row.
    const u = use([{ path: "/map", count: 40 }, { path: "/quests", count: 40 }, { path: "/stay", count: 40 }, { path: "/places", count: 40 }, { path: "/library", count: 2 }, { path: "/rights", count: 9 }]);
    expect(u.suggestions.filter((s) => s.rule === "fold-in")).toEqual([{ rule: "fold-in", path: "/library", values: { visits: 2, group: "Village", median: 40 } }]);
  });

  it("asks for an entry for a busy page the menu does not list, never for a rare one", () => {
    // Menu medians: 60, 25, 10, 5, 0, 0 -> (10 + 5) / 2 = 7.5. The profile's 9 clears it and five; the journal's 4 does not.
    const u = use([{ path: "/quests", count: 60 }, { path: "/map", count: 25 }, { path: "/places", count: 10 }, { path: "/rights", count: 5 }, { path: "/profile/settings", count: 9 }, { path: "/journal", count: 4 }]);
    expect(u.suggestions.filter((s) => s.rule === "add-entry")).toEqual([{ rule: "add-entry", path: "/profile/settings", values: { visits: 9 } }]);
  });

  it("carries numbers only, never a person", () => {
    const u = use([{ path: "/quests", count: 60 }, { path: "/map", count: 40 }]);
    for (const s of u.suggestions) for (const v of Object.values(s.values)) expect(typeof v === "number" || typeof v === "string").toBe(true);
    expect(JSON.stringify(u)).not.toMatch(/userId|email|@/);
  });
});
