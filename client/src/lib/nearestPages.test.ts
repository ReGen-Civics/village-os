/**
 * The nearest real pages to an address with none (the helpful not-found page). Run against the real menu
 * (config/nav.ts) and the real page names (shared/pageTitles.ts), so a renamed entry is tested as the reader meets it.
 */
import { describe, expect, it } from "vitest";
import type { NavLink } from "@/config/nav";
import { editDistance, menuPages, nearestPages, wordMatch, wordsOf } from "./nearestPages";

/** A member's menu with every module on: the widest view short of an admin's. */
const member = (l: NavLink) => !l.roles || l.roles.includes("member");
const hrefs = (location: string, visible: (l: NavLink) => boolean = member) => nearestPages(location, { visible }).map((p) => p.href);

describe("the words of an address", () => {
  it("splits on slashes and dashes, lower-cases, and drops ids, numbers and filler", () => {
    expect(wordsOf("/Garden-Health")).toEqual(["garden", "health"]);
    // "village" ties half the pages, so it carries nothing.
    expect(wordsOf("/village-health")).toEqual(["health"]);
    expect(wordsOf("/forum/1234/the-garden")).toEqual(["forum", "garden"]);
    expect(wordsOf("/roles/5f3a9b2c1d")).toEqual(["roles"]);
    expect(wordsOf("/Se%C3%B1ales")).toEqual(["senales"]);
  });

  it("counts a swap of two neighbours as one edit", () => {
    expect(editDistance("quests", "qeusts")).toBe(1);
    expect(editDistance("treasury", "treasry")).toBe(1);
    expect(editDistance("map", "map")).toBe(0);
  });

  it("matches a begun word and a near miss, never a short stranger", () => {
    expect(wordMatch("treas", "treasury")).toBeGreaterThan(0.75);
    expect(wordMatch("feedbak", "feed")).toBe(0);
    expect(wordMatch("calender", "calendar")).toBeGreaterThan(0.5);
    expect(wordMatch("go", "gratitude")).toBe(0);
    expect(wordMatch("zebra", "forum")).toBe(0);
  });
});

describe("nearestPages", () => {
  it("finds a typo'd page first", () => {
    expect(hrefs("/quets")[0]).toBe("/quests");
    expect(hrefs("/treasry")[0]).toBe("/governance/treasury");
    expect(hrefs("/gratitud")[0]).toBe("/gratitude");
    expect(hrefs("/village-helth")[0]).toBe("/village-health");
  });

  it("finds a page by its title when the menu calls it something else", () => {
    // The menu says Events; the page's own name is Village Calendar (shared/pageTitles.ts).
    expect(hrefs("/calender")).toContain("/events");
  });

  it("finds a chapter by its old address's words", () => {
    expect(hrefs("/good-neigbor")[0]).toBe("/rights#good-neighbor");
    expect(hrefs("/leaving")[0]).toBe("/rights#leaving-well");
  });

  it("offers a page in two places once, naming both groups", () => {
    const quests = nearestPages("/quets", { visible: member }).find((p) => p.href === "/quests")!;
    expect(quests.places.map((p) => p.group)).toEqual(["Village", "Govern"]);
    expect(quests.places[1].folder).toBe("This season");
  });

  it("says where each page lives in the menu, the account menu as no group", () => {
    const wallet = nearestPages("/walet", { visible: member }).find((p) => p.href === "/wallet")!;
    expect(wallet.group).toBeNull();
    expect(wallet.folder).toBe("Your things");
    const stay = nearestPages("/stays", { visible: member }).find((p) => p.href === "/stay")!;
    expect(stay.places[0]).toEqual({ group: "Village", folder: "Places and homes" });
  });

  it("offers nothing for an address that names no page, and never more than three", () => {
    expect(hrefs("/xyzzy-plugh")).toEqual([]);
    expect(hrefs("/404")).toEqual([]);
    expect(hrefs("/")).toEqual([]);
    expect(hrefs("/governance-roles-quests-map").length).toBeLessThanOrEqual(3);
  });

  it("never offers the page that refused them", () => {
    // A module-off /stay renders this page: Stay itself is not the way on, whatever its name.
    expect(hrefs("/stay", () => true)).not.toContain("/stay");
  });
});

describe("only pages the reader may open", () => {
  it("offers a visitor no account-menu page, and a member the same page", () => {
    // Profile and Journal carry no sign-in flag; the account menu is drawn only for someone signed in.
    expect(nearestPages("/profle", { visible: () => true, signedIn: false })).toEqual([]);
    expect(nearestPages("/jornal", { visible: () => true, signedIn: false })).toEqual([]);
    expect(hrefs("/profle")).toContain("/profile");
    expect(hrefs("/jornal")).toContain("/journal");
  });

  it("leaves out an entry the reader's menu hides, by the menu's own test", () => {
    const staysOff = (l: NavLink) => member(l) && l.module !== "stays";
    expect(hrefs("/stays", member)).toContain("/stay");
    expect(hrefs("/stays", staysOff)).not.toContain("/stay");
  });

  it("keeps an admin's entries from a member and offers them to an admin", () => {
    const admin = (l: NavLink) => !l.roles || l.roles.includes("admin");
    expect(hrefs("/village-setings", member)).not.toContain("/admin");
    expect(hrefs("/village-setings", admin)).toContain("/admin");
  });

  it("asks the test of every entry it offers, so nothing slips past it", () => {
    const asked = new Set<string>();
    const none = (l: NavLink) => {
      asked.add(l.href);
      return false;
    };
    expect(nearestPages("/quests-roles-map-forum", { visible: none })).toEqual([]);
    for (const p of menuPages()) expect(asked.has(p.href), p.href).toBe(true);
  });
});
