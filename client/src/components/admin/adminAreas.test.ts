// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { navGroups } from "./adminNavGroups";
import { ADMIN_TABS, fallbackAdminTab, homeBaseOn, setHomeBaseOn, tabEntry, tabFromSearch } from "./adminAreas";

beforeEach(() => localStorage.clear());

describe("admin areas", () => {
  it("gives every nav tab a home", () => {
    const keys = new Set<string>(["home"]);
    for (const complete of [false, true]) {
      for (const group of navGroups(complete)) {
        for (const item of group.items) keys.add(item.key);
      }
    }
    const mapped = new Set(ADMIN_TABS.map((tab) => tab.key));
    const missing = [...keys].filter((key) => !mapped.has(key));
    expect(missing, missing.join(", ")).toEqual([]);
    for (const tab of ADMIN_TABS) {
      expect(tab.help.trim().length, tab.key).toBeGreaterThan(8);
      expect(tabEntry(tab.key)?.name).toBe(tab.name);
    }
  });

  it("lists no page twice in one area, and the old mail settings address opens the one row", () => {
    // "Mail settings" stood on Home twice: once for the page, once for its old address.
    const seen = new Set<string>();
    const twice = ADMIN_TABS.map((tab) => `${tab.area}: ${tab.name.toLowerCase()}`).filter((row) => (seen.has(row) ? true : (seen.add(row), false)));
    expect(twice).toEqual([]);
    expect(ADMIN_TABS.filter((tab) => tab.name === "Mail settings").map((tab) => tab.key)).toEqual(["comms-settings"]);
    expect(tabEntry("email-settings")).toBeUndefined();
    expect(tabFromSearch("?tab=email-settings")).toBe("comms-settings");
  });

  it("opens home unless this device asks for the form list, and an old tab link still wins", () => {
    expect(homeBaseOn()).toBe(true);
    expect(fallbackAdminTab()).toBe("home");
    expect(tabFromSearch("")).toBe("home");
    expect(tabFromSearch("?tab=players")).toBe("players");
    expect(tabFromSearch("?tab=modules&module=saberra")).toBe("modules");
    setHomeBaseOn(false);
    expect(tabFromSearch("")).toBe("submissions");
    expect(tabFromSearch("?tab=feedback")).toBe("feedback");
  });
});
