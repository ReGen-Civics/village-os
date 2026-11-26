import { describe, expect, it } from "vitest";
import { NAV, isGroup, type NavEntry } from "./nav";
import { bearingsFor, bearingsPath, currentFor, litFor } from "./navBearings";

const SEEN: NavEntry[] = [
  { href: "/map", label: "Living Map" },
  { label: "Village", items: [{ href: "/quests", label: "Quests" }, { href: "/map/circles", label: "Circles & Roles" }] },
  { label: "Decide", items: [{ href: "/decisions", label: "Decisions" }, { href: "/propose", label: "Make a Proposal" }] },
  { label: "Join", items: [{ href: "/steward", label: "Hold a role" }] },
];

describe("bearingsFor", () => {
  it("lights the entry and its group on the entry's own page", () => {
    expect(bearingsFor("/decisions", SEEN)).toMatchObject({ group: "Decide", item: { href: "/decisions" }, exact: true });
  });

  it("lights the entry a deeper page sits under, and says it is deeper", () => {
    expect(bearingsFor("/decisions/42", SEEN)).toMatchObject({ group: "Decide", item: { href: "/decisions" }, exact: false });
  });

  it("takes the longest address, so a circle sits under Circles & Roles and not under the map", () => {
    expect(bearingsFor("/map/circles/water", SEEN)).toMatchObject({ group: "Village", item: { href: "/map/circles" } });
    expect(bearingsFor("/map/places", SEEN)).toMatchObject({ group: null, item: { href: "/map" }, exact: false });
  });

  it("matches at a slash only, so /decisionsx is not under /decisions", () => {
    expect(bearingsFor("/decisionsx", SEEN, [], [])).toBeNull();
  });

  it("ignores the query, the hash and a trailing slash", () => {
    expect(bearingsFor("/decisions/?tab=open#top", SEEN)).toMatchObject({ item: { href: "/decisions" }, exact: true });
    expect(bearingsPath("/a/b/?x=1")).toBe("/a/b");
    expect(bearingsPath("/")).toBe("/");
  });

  it("keeps the entry's own label, so a village's rename is what the caller draws", () => {
    expect(bearingsFor("/steward", SEEN)?.item.label).toBe("Hold a role");
  });

  it("finds a page whose entry a gate swapped out in the whole menu (Roles, on a village with a map)", () => {
    const b = bearingsFor("/roles/gardener", SEEN);
    expect(b).toMatchObject({ group: "Village", item: { href: "/roles" }, exact: false });
  });

  it("lights nothing for a page the village hid from its menu, even through the whole menu", () => {
    expect(bearingsFor("/roles/gardener", SEEN, ["/roles"])).toBeNull();
    expect(bearingsFor("/decisions/42", SEEN, ["/decisions"])).toBeNull();
  });

  it("lights nothing for a page in no entry, and nothing for home", () => {
    expect(bearingsFor("/admin", SEEN)).toBeNull();
    expect(bearingsFor("/", SEEN)).toBeNull();
  });

  it("knows every page the platform's menu lists, each in its own group", () => {
    for (const e of NAV) {
      if (!isGroup(e)) continue;
      for (const item of e.items) {
        const b = bearingsFor(item.href, [], [], NAV);
        expect(b?.item.href, item.href).toBe(item.href);
      }
    }
  });
});

describe("currentFor", () => {
  const lit = { group: "Decide", href: "/decisions", exact: false, item: { href: "/decisions", label: "Decisions" } };
  it("says page on the page, true on the entry above a deeper page, nothing elsewhere", () => {
    expect(currentFor({ ...lit, exact: true }, "/decisions")).toBe("page");
    expect(currentFor(lit, "/decisions")).toBe("true");
    expect(currentFor(lit, "/propose")).toBeUndefined();
    expect(currentFor(null, "/decisions")).toBeUndefined();
  });
});

describe("litFor", () => {
  const MENU: NavEntry[] = [
    { label: "Join", href: "/ways-in", items: [{ href: "/steward", label: "Village Steward" }] },
    { label: "Decide", items: [{ href: "/decisions", label: "Decisions" }] },
  ];
  const all = () => true;
  const word = (g: string) => `[${g}]`;

  it("names the group as it is drawn: the village's rename, else the platform's word in the reader's language", () => {
    expect(litFor("/decisions/4", all, { hidden: [], groups: {} }, word, MENU)?.group).toBe("[Decide]");
    expect(litFor("/decisions/4", all, { hidden: [], groups: { Decide: "Choose together" } }, word, MENU)?.group).toBe("Choose together");
  });

  it("gives the group's own page only where it has one, and not once the village hid it", () => {
    expect(litFor("/steward/x", all, { hidden: [], groups: {} }, word, MENU)?.groupHref).toBe("/ways-in");
    expect(litFor("/decisions/4", all, { hidden: [], groups: {} }, word, MENU)?.groupHref).toBeUndefined();
    expect(litFor("/steward/x", all, { hidden: ["/ways-in"], groups: {} }, word, MENU)?.groupHref).toBeUndefined();
  });

  it("carries no group page on the platform's own menu today (/join only redirects)", () => {
    expect(NAV.filter(isGroup).filter((g) => g.href)).toEqual([]);
  });
});
