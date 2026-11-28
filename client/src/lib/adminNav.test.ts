import { describe, expect, it } from "vitest";
import type { ModuleLifecycle } from "@shared/modules";
import { filterNavByModules, moduleIsOn, TAB_MODULE, TAB_MODULES, tabBadge, tabModules } from "./adminNav";

/**
 * The Admin nav's honesty, as arithmetic: a fresh village shows platform tabs
 * only, a turned-on module shows its tab wearing its lifecycle, and an
 * unloaded catalog filters nothing. These run without rendering a thing,
 * which is the reason the filter lives in a lib.
 */

type Item = { key: string; label: string; badge?: "preview" | "members" | "everyone" };
type Group = { title: string; items: Item[] };

const groups: Group[] = [
  {
    title: "Submissions",
    items: [
      { key: "submissions", label: "All Forms" },
      { key: "products", label: "Payments" },
      { key: "reports", label: "Reports" },
    ],
  },
  {
    title: "The Game",
    items: [
      { key: "modules", label: "Module Library" },
      { key: "tools-admin", label: "Tools" },
      { key: "stays-admin", label: "Stays & Payments" },
      { key: "events-admin", label: "Calendar" },
      { key: "resources-admin", label: "Resources" },
      { key: "intents-admin", label: "Introductions" },
      { key: "tokens", label: "Tokens" },
    ],
  },
  { title: "Only Modules", items: [{ key: "badges-admin", label: "Badges" }] },
];

const off: Record<string, ModuleLifecycle> = {};

describe("adminNav", () => {
  it("filters nothing while the catalog is unloaded", () => {
    expect(filterNavByModules(groups, null)).toEqual(groups);
    expect(filterNavByModules(groups, undefined)).toEqual(groups);
  });

  it("a fresh village keeps platform tabs and Module Library only", () => {
    const out = filterNavByModules(groups, off);
    const keys = out.flatMap((g) => g.items.map((i) => i.key));
    expect(keys).toEqual(["submissions", "modules", "tokens"]);
    // A group whose every tab was module-gated does not render a bare title.
    expect(out.map((g) => g.title)).toEqual(["Submissions", "The Game"]);
  });

  it("a module that is on shows its tab wearing where it stands", () => {
    const out = filterNavByModules(groups, {
      tools: "preview",
      stays: "members",
      commerce: "public",
    } as Record<string, ModuleLifecycle>);
    const byKey = Object.fromEntries(out.flatMap((g) => g.items.map((i) => [i.key, i])));
    expect(byKey["tools-admin"].badge).toBe("preview");
    expect(byKey["stays-admin"].badge).toBe("members");
    expect(byKey["products"].badge).toBe("everyone");
    // events stayed off, so Calendar is gone; platform tabs carry no badge.
    expect(byKey["events-admin"]).toBeUndefined();
    expect(byKey["modules"].badge).toBeUndefined();
    expect(byKey["tokens"].badge).toBeUndefined();
  });

  it("tabs mapped ahead of their modules stay hidden until the module exists and is on", () => {
    // resources (L3) and introductions (L7) are not in the registry yet: an
    // unknown id reads as off, so both tabs hide today and appear the day
    // their module serves.
    const out = filterNavByModules(groups, { tools: "public" } as Record<string, ModuleLifecycle>);
    const keys = out.flatMap((g) => g.items.map((i) => i.key));
    expect(keys).not.toContain("resources-admin");
    expect(keys).not.toContain("intents-admin");
    expect(TAB_MODULE["resources-admin"]).toBe("resources");
    expect(TAB_MODULE["intents-admin"]).toBe("introductions");
  });

  it("hides the Reports queue while the forum and messaging are both off, and shows it when either is on", () => {
    // One queue for two modules (cut C7, 27 Nov 2026). It reads
    // /api/admin/forum/reports and /api/admin/messages/reports, each behind its
    // own requireModule: with both off the tab would render an empty queue
    // over nothing it can read.
    const keysWith = (lifecycles: Record<string, ModuleLifecycle>) => filterNavByModules(groups, lifecycles).flatMap((g) => g.items.map((i) => i.key));
    expect(keysWith({})).not.toContain("reports");
    expect(keysWith({ forum: "off", messaging: "off" })).not.toContain("reports");
    expect(keysWith({ messaging: "members" })).toContain("reports");
    expect(keysWith({ forum: "preview" })).toContain("reports");
    expect(keysWith({ forum: "public", messaging: "members" })).toContain("reports");
  });

  it("badges the Reports queue only when the modules that are on stand in the same place", () => {
    const badgeWith = (lifecycles: Record<string, ModuleLifecycle>) =>
      filterNavByModules(groups, lifecycles).flatMap((g) => g.items).find((i) => i.key === "reports")?.badge;
    expect(badgeWith({ messaging: "members" })).toBe("members");
    expect(badgeWith({ forum: "preview", messaging: "off" })).toBe("preview");
    expect(badgeWith({ forum: "members", messaging: "members" })).toBe("members");
    // Two different answers is no single answer: the row wears none.
    expect(badgeWith({ forum: "public", messaging: "members" })).toBeUndefined();
  });

  it("names the modules a tab follows, and reads an unloaded catalog as on", () => {
    expect(tabModules("reports")).toEqual(["forum", "messaging"]);
    expect(tabModules("tools-admin")).toEqual(["tools"]);
    expect(tabModules("tokens")).toEqual([]);
    expect(moduleIsOn(null, "forum")).toBe(true);
    expect(moduleIsOn({}, "forum")).toBe(false);
    expect(moduleIsOn({ forum: "preview" }, "forum")).toBe(true);
    expect(moduleIsOn({ forum: "off" }, "forum")).toBe(false);
  });

  it("leaves the settlement desk unmapped, because gratitude is core", () => {
    // Cycle close hangs off /api/admin/cycles, which is behind no
    // requireModule: gratitude is one of the four core modules and cannot be
    // switched off, so a mapping here would be a gate that never opens.
    expect(TAB_MODULE["cycles"]).toBeUndefined();
    const out = filterNavByModules(
      [{ title: "The Game", items: [{ key: "cycles", label: "Cycle Close" }] }],
      {} as Record<string, ModuleLifecycle>,
    );
    expect(out[0].items.map((i) => i.key)).toEqual(["cycles"]);
  });

  it("the mapping is exactly the ruled set: nineteen tabs with one module, and the Reports queue with two", () => {
    expect(TAB_MODULES).toEqual({ reports: ["forum", "messaging"] });
    expect(TAB_MODULE).toEqual({
      "circles-map": "map",
      "events-admin": "events",
      "tools-admin": "tools",
      // The crowdpool shipped with its linked campaigns in module config and
      // no admin surface at all, so a founder could enable the module and the
      // server would report "no campaigns linked" with nothing they could do
      // about it. The tab hides with the module, like every other one here.
      "crowdpool-admin": "crowdpool",
      "stays-admin": "stays",
      "exchange-admin": "exchange",
      "badges-admin": "badges",
      "library-admin": "library",
      "health-admin": "health",
      "calls-admin": "automation",
      products: "commerce",
      "resources-admin": "resources",
      "intents-admin": "introductions",
      // The voting-weight allocation table. Every weight route sits behind
      // app.use("/api/admin/governance", requireModule("governance")), so the
      // tab hides with the engine instead of offering a form that 404s.
      "governance-weights": "governance",
      // Village Comms: the five screens that drive the automations. Sent mail
      // and Settings are NOT here, because a village sets up its sending
      // before it turns comms on and the post office records every email
      // whatever the module says (the comms build spec 6).
      "comms-overview": "comms",
      "comms-journeys": "comms",
      "comms-words": "comms",
      "comms-people": "comms",
      "comms-letters": "comms",
    });
    expect(TAB_MODULE["comms-sent"]).toBeUndefined();
    expect(TAB_MODULE["comms-settings"]).toBeUndefined();
  });

  it("tabBadge maps the lifecycle words a founder reads", () => {
    expect(tabBadge("preview")).toBe("preview");
    expect(tabBadge("members")).toBe("members");
    expect(tabBadge("public")).toBe("everyone");
    expect(tabBadge("off")).toBeUndefined();
    expect(tabBadge(undefined)).toBeUndefined();
  });

  it("does not mutate its input", () => {
    const before = JSON.stringify(groups);
    filterNavByModules(groups, { tools: "public" } as Record<string, ModuleLifecycle>);
    expect(JSON.stringify(groups)).toBe(before);
  });
});
