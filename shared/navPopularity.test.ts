import { describe, expect, it } from "vitest";
import { barTabs, choosePersonal, chooseSiteBar, dayKey, pathList } from "./navPopularity";

const opts = { slots: 2, marginPct: 20, pinned: [] as string[], excluded: [] as string[] };
const c = (path: string, count: number) => ({ path, count });

describe("pathList", () => {
  it("reads commas and new lines, keeps addresses only, drops a trailing slash", () => {
    expect(pathList("/quests, /roles/\n bad \n/circles")).toEqual(["/quests", "/roles", "/circles"]);
    expect(pathList(undefined)).toEqual([]);
  });
});

describe("chooseSiteBar", () => {
  it("takes the most visited pages, never Home", () => {
    expect(chooseSiteBar([c("/", 999), c("/quests", 50), c("/roles", 40), c("/events", 10)], null, opts)).toEqual(["/quests", "/roles"]);
  });

  it("puts pins first, in order, and they count toward the places", () => {
    expect(chooseSiteBar([c("/quests", 50), c("/roles", 40)], null, { ...opts, pinned: ["/events"] })).toEqual(["/events", "/quests"]);
  });

  it("never shows an excluded page", () => {
    expect(chooseSiteBar([c("/quests", 50), c("/roles", 40), c("/events", 30)], null, { ...opts, excluded: ["/quests"] })).toEqual(["/roles", "/events"]);
  });

  it("keeps the pages it has unless a newcomer leads by the margin", () => {
    // /events now edges past /roles, by under 20%: the bar holds.
    expect(chooseSiteBar([c("/quests", 50), c("/roles", 40), c("/events", 45)], ["/quests", "/roles"], opts)).toEqual(["/quests", "/roles"]);
    // By 20% or more it takes the weakest page's place, and the others keep theirs.
    expect(chooseSiteBar([c("/quests", 50), c("/roles", 40), c("/events", 48)], ["/quests", "/roles"], opts)).toEqual(["/quests", "/events"]);
  });

  it("with no margin follows the counts, and fills empty places", () => {
    expect(chooseSiteBar([c("/quests", 5), c("/roles", 6)], ["/quests"], { ...opts, marginPct: 0 })).toEqual(["/quests", "/roles"]);
  });

  it("drops a held page that has since been excluded", () => {
    expect(chooseSiteBar([c("/quests", 50), c("/roles", 40), c("/events", 1)], ["/quests", "/roles"], { ...opts, excluded: ["/roles"] })).toEqual(["/quests", "/events"]);
  });

  it("with no visits at all chooses nothing, and the phone keeps the platform's tabs", () => {
    expect(chooseSiteBar([], null, opts)).toEqual([]);
  });
});

describe("the personal place", () => {
  it("is the member's most visited page not already on the bar", () => {
    expect(choosePersonal({ "/quests": 9, "/journal": 7, "/": 30 }, ["/quests"], [])).toBe("/journal");
  });

  it("is nothing when every page they visit is on the bar or excluded", () => {
    expect(choosePersonal({ "/quests": 9, "/journal": 2 }, ["/quests"], ["/journal"])).toBeNull();
  });
});

describe("barTabs", () => {
  it("is Home, the village's pages, then the member's own, four at most", () => {
    expect(barTabs(["/quests", "/roles"], "/journal")).toEqual(["/", "/quests", "/roles", "/journal"]);
    expect(barTabs(["/quests", "/roles", "/events"], "/journal")).toEqual(["/", "/quests", "/roles", "/events"]);
    expect(barTabs(["/quests"], null)).toEqual(["/", "/quests"]);
  });
});

describe("dayKey", () => {
  it("is the device's own calendar day", () => {
    expect(dayKey(new Date(2026, 10, 24, 23, 59))).toBe("2026-11-24");
  });
});
