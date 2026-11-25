/**
 * THE FRONT DOOR'S PURE PARTS (24 Nov 2026): who is a newcomer, when an area
 * counts as in use, the phone tab bar a newcomer gets, and the shortcuts a
 * newcomer is not offered.
 */
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/haptics", () => ({ haptic: () => false }));

import { isMemberView } from "./newcomer";
import { areaInUse } from "./areasInUse";
import { eventsInUse } from "./areasInUseReads";
import { newcomerSlots } from "@/components/mobile/MobileTabBar";
import { cornerRows } from "@/components/mobile/MobileFab";
import { NEWCOMER_SLOT, NEWCOMER_SWAPPED_TABS, PATH_SLOT, TAB_SLOTS } from "@/config/mobileNav";
import { NAV, ACCOUNT_MENU, isGroup } from "@/config/nav";

const STAGES = [{ id: "guest" }, { id: "explorer" }, { id: "member" }, { id: "steward" }];

describe("who is a member, read the way the server reads admission", () => {
  it("a visitor and a signed-in guest are newcomers", () => {
    expect(isMemberView(null, STAGES)).toBe(false);
    expect(isMemberView({ role: "member" }, STAGES)).toBe(false);
    expect(isMemberView({ role: "member", stageGranted: "explorer" }, STAGES)).toBe(false);
  });

  it("a granted membership, a stage granted at the door or above, an admin and a founder are members", () => {
    expect(isMemberView({ role: "member", membershipGranted: true }, STAGES)).toBe(true);
    expect(isMemberView({ role: "member", stageGranted: "member" }, STAGES)).toBe(true);
    expect(isMemberView({ role: "member", stageGranted: "steward" }, STAGES)).toBe(true);
    expect(isMemberView({ role: "admin" }, STAGES)).toBe(true);
    expect(isMemberView({ role: "founder" }, null)).toBe(true);
  });

  it("a ladder with no admission rung has no door, so everyone signed in is in; a ladder not known yet admits nobody on a stage alone", () => {
    expect(isMemberView({ role: "member" }, [{ id: "guest" }, { id: "elder" }])).toBe(true);
    expect(isMemberView({ role: "member", stageGranted: "steward" }, null)).toBe(false);
  });
});

describe("when an area is in use", () => {
  const now = Date.parse("2026-11-24T12:00:00Z");

  it("events: something real today or later, beyond the season itself", () => {
    expect(eventsInUse({ events: [] }, now)).toBe(false);
    expect(eventsInUse({ events: [{ kind: "season", startsAt: "2026-06-21", endsAt: "2026-12-31" }] }, now)).toBe(false);
    expect(eventsInUse({ events: [{ kind: "gathering", isExample: true, startsAt: "2026-12-01T10:00:00Z" }] }, now)).toBe(false);
    expect(eventsInUse({ events: [{ kind: "gathering", startsAt: "2026-11-01T10:00:00Z", endsAt: "2026-11-01T12:00:00Z" }] }, now)).toBe(false);
    expect(eventsInUse({ events: [{ kind: "gathering", startsAt: "2026-12-01T10:00:00Z", endsAt: "2026-12-01T12:00:00Z" }] }, now)).toBe(true);
    expect(eventsInUse(null, now)).toBe(false);
  });

  it("examples: in use once the module shows none; unknown is not in use", () => {
    const known = (exampleModules: string[] | null) => ({ exampleModules, seasons: 0 });
    expect(areaInUse({ href: "/feed", module: "feed" }, known(["feed", "forum"]))).toBe(false);
    expect(areaInUse({ href: "/feed", module: "feed" }, known(["forum"]))).toBe(true);
    expect(areaInUse({ href: "/feed", module: "feed" }, known(null))).toBe(false);
  });

  it("places, photographs and festivals read their own answers", () => {
    expect(areaInUse({ href: "/photographs", module: "map" }, { exampleModules: [], places: true, seasons: 0 })).toBe(true);
    expect(areaInUse({ href: "/places", module: "map" }, { exampleModules: [], seasons: 0 })).toBe(false);
    expect(areaInUse({ href: "/seasonal-festivals" }, { exampleModules: null, seasons: 2 })).toBe(true);
    expect(areaInUse({ href: "/seasonal-festivals" }, { exampleModules: null, seasons: 0 })).toBe(false);
  });

  it("keeps Badges (examples only) and the Cash Budget (refused before admission) out of a newcomer's account menu", () => {
    // The every-page audit (24 Nov 2026) found both on a newcomer's phone menu: Badges showed only standing examples,
    // and /budget answered the newcomer's read with 403.
    const at = (href: string) => ACCOUNT_MENU.find((l) => l.href === href);
    expect(at("/badges")?.newcomers).toBe("in-use");
    expect(at("/budget")?.newcomers).toBe("never");
    expect(areaInUse(at("/badges")!, { exampleModules: ["badges"], seasons: 0 }), "hidden while badges shows examples").toBe(false);
  });

  it("every in-use entry in the menu has an answer here: a module with examples, or a read of its own", () => {
    const entries = [...NAV.flatMap((e) => (isGroup(e) ? e.items : [e])), ...ACCOUNT_MENU].filter((l) => l.newcomers === "in-use");
    for (const e of entries) {
      const allIn = areaInUse(e, { exampleModules: [], places: true, campaigns: true, events: true, seasons: 1 });
      expect(allIn, e.href).toBe(true);
    }
  });
});

describe("a newcomer's phone tab bar", () => {
  it("takes the roles in place of Gratitude, keeps five distinct slots and More last", () => {
    const slots = newcomerSlots(TAB_SLOTS, () => false);
    // Home, Your path, Roles, Quests, More: the platform's bar for everyone (the lead, 25 Nov 2026).
    expect(slots.map((s) => s.path ?? s.event)).toEqual(["/", PATH_SLOT.path, NEWCOMER_SLOT.path, "/quests", "open-mobile-menu"]);
  });

  it("CONTROL: an in-use slot stays for a newcomer; only the swapped tabs give way to the roles", () => {
    // The gratitude wall is public (#1528) but its tab is the way in for a newcomer (NEWCOMER_SWAPPED_TABS).
    const expected = TAB_SLOTS.map((s) => (s.path && NEWCOMER_SWAPPED_TABS.includes(s.path) ? NEWCOMER_SLOT.path : s.path ?? s.event));
    expect(newcomerSlots(TAB_SLOTS, () => true).map((s) => s.path ?? s.event)).toEqual(expected);
  });
});

describe("a newcomer's corner (phone doors v4)", () => {
  // The lotus's shortcut rows are gone: the corner is companions and help, for everybody, and the
  // working areas reach a member through More, from the account entries Layout already gates for a
  // newcomer (config/nav.ts, `newcomers`).
  it("offers nobody messages, live sessions, the task board or the hidden map", () => {
    const t = ({ message }: { message: string }) => message;
    for (const signedIn of [true, false]) {
      const keys = cornerRows({ signedIn, admin: false, army: null, guide: "the guide", t }).map((r) => r.key);
      for (const k of ["messages", "sessions", "tasks", "hidden-map"]) expect(keys, k).not.toContain(k);
    }
  });
});
