/**
 * EACH MODULE'S MENU ENTRY, NAMED AND PLACED BY THE VILLAGE (the lead, 27 Nov 2026: "all module menu items are up for
 * the village to determine where in the menu they would like them to be and what their name would be").
 *
 * The defaults are today's menu (nothing moves for a village that never chooses), a rename and a move land where they
 * say, a place the menu's rules refuse is refused with a sentence, and the proposal path checks it with the same rules.
 */
import { describe, expect, it } from "vitest";
import { ACCOUNT_MENU, NAV, isGroup, type NavLink } from "./nav";
import { navRows } from "./navNest";
import { placedMenu } from "./navPlaces";
import { MENU_ACCOUNT, placeItems } from "@shared/menuPlace";
import { MENU_SHAPE, MODULE_MENU, choiceOf, choicesChangeNothing, menuDocumentProblem, moduleMenuFor, placeProblems, placesProblem, withChoices } from "@shared/moduleMenu";
import { menuDocOf } from "@shared/menuDoc";
import { contentDocumentFor } from "@shared/contentDocuments";
import { mergeOnto } from "@shared/proposedChanges";
import { FIND_PAGES, pageEntry } from "@shared/findPages";

const shapeOf = (items: readonly NavLink[]) =>
  items.map((l) => ({ href: l.href, ...(l.sub ? { sub: l.sub } : {}), ...(l.module ? { module: l.module, label: l.label } : {}), ...(l.unlessModule ? { unlessModule: l.unlessModule } : {}) }));
const groupsOf = (nav: readonly unknown[]) => (nav as typeof NAV).filter(isGroup);
const where = (nav: typeof NAV, account: readonly NavLink[], href: string) => [
  ...groupsOf(nav).flatMap((g) => g.items.filter((l) => l.href === href).map((l) => `${g.label}/${l.sub ?? ""}`)),
  ...account.filter((l) => l.href === href).map((l) => `account/${l.sub ?? ""}`),
];

describe("the defaults are today's menu", () => {
  it("MENU_SHAPE is nav.ts, entry for entry, so the server judges the menu the shell draws", () => {
    const fromNav = [...groupsOf(NAV).map((g) => ({ key: g.label, items: shapeOf(g.items) })), { key: MENU_ACCOUNT, items: shapeOf(ACCOUNT_MENU) }];
    expect(MENU_SHAPE.map((g) => ({ key: g.key, items: g.items.map((i) => ({ ...i })) }))).toEqual(fromNav);
  });

  it("gives every module entry in the menu a default name and place, where nav.ts puts it", () => {
    const gated = [...groupsOf(NAV).flatMap((g) => g.items), ...ACCOUNT_MENU].filter((l) => l.module);
    expect(MODULE_MENU.map((m) => m.href)).toEqual(gated.map((l) => l.href));
    for (const m of MODULE_MENU) {
      const link = gated.find((l) => l.href === m.href)!;
      expect(m.label, m.href).toBe(link.label);
      expect(m.module).toBe(link.module);
      expect(where(NAV, ACCOUNT_MENU, m.href)).toEqual([`${m.place.group}/${m.place.sub ?? ""}`]);
    }
    expect(moduleMenuFor("map").map((m) => m.href)).toEqual(["/map", "/places", "/map/circles"]);
    expect(moduleMenuFor("quests")).toEqual([]);
  });

  it("moves nothing when every entry is placed at its own default", () => {
    const places = Object.fromEntries(MODULE_MENU.map((m) => [m.href, m.place]));
    const placed = placedMenu(places);
    expect(placed.nav.map((e) => (isGroup(e) ? e.items.map((l) => `${l.href}|${l.sub ?? ""}`) : []))).toEqual(NAV.map((e) => (isGroup(e) ? e.items.map((l) => `${l.href}|${l.sub ?? ""}`) : [])));
    expect(placed.account.map((l) => l.href)).toEqual(ACCOUNT_MENU.map((l) => l.href));
    // And no place at all is the platform's own lists, the same objects.
    expect(placedMenu(undefined).nav).toBe(NAV);
    expect(placedMenu({}).account).toBe(ACCOUNT_MENU);
  });

  it("passes its own rules", () => {
    expect(placeProblems({})).toEqual([]);
    expect(placeProblems(Object.fromEntries(MODULE_MENU.map((m) => [m.href, m.place])))).toEqual([]);
  });

  it("turning a module on with its defaults writes nothing", () => {
    const doc = menuDocOf({ labels: { "/forum": "Crew Talk" } });
    const choices = moduleMenuFor("feed").map((e) => choiceOf(e, doc));
    expect(choicesChangeNothing(doc, choices)).toBe(true);
    expect(withChoices(doc, choices)).toEqual(doc);
    // A name typed equal to the default is the default too.
    expect(choicesChangeNothing(doc, [{ ...choices[0]!, label: "Feed" }])).toBe(true);
    expect(choicesChangeNothing(doc, [{ ...choices[0]!, label: "Town Square" }])).toBe(false);
  });
});

describe("a rename and a move", () => {
  const places = { "/forum": { group: "Village", sub: "Maps" }, "/wallet": { group: "Govern", sub: "This season", at: 1 } };

  it("lands the entry in its new group and folder, and takes it out of the old one", () => {
    const m = placedMenu(places);
    expect(where(m.nav as typeof NAV, m.account, "/forum")).toEqual(["Village/Maps"]);
    expect(where(m.nav as typeof NAV, m.account, "/wallet")).toEqual(["Govern/This season"]);
    const season = groupsOf(m.nav).find((g) => g.label === "Govern")!.items.filter((l) => l.sub === "This season").map((l) => l.href);
    expect(season.slice(0, 2)).toEqual(["/season", "/wallet"]);
    // Every other field of the entry comes with it: its module gate, its newcomer rule.
    const forum = groupsOf(m.nav).flatMap((g) => g.items).find((l) => l.href === "/forum")!;
    expect(forum.module).toBe("forum");
    expect(forum.newcomers).toBe("in-use");
  });

  it("places a row of its own at its position, and keeps the Module Library at the bottom", () => {
    const m = placedMenu({ "/forum": { group: "Govern" } });
    const govern = groupsOf(m.nav).find((g) => g.label === "Govern")!;
    const rows = navRows(govern.items);
    expect(govern.items.at(-1)?.href).toBe("/modules");
    expect(rows.at(-2)).toMatchObject({ kind: "link", link: { href: "/forum" } });
    const first = placedMenu({ "/forum": { group: "Govern", at: 0 } });
    expect(groupsOf(first.nav).find((g) => g.label === "Govern")!.items[0]!.href).toBe("/forum");
  });

  it("moves only a module's entries, and ignores a group the menu has not got", () => {
    const { groups } = placeItems([{ key: "A", items: [{ href: "/quests" }, { href: "/x", module: "x" }] }], { "/quests": { group: "A", at: 1 }, "/x": { group: "Nowhere" } });
    expect(groups[0]!.items.map((i) => i.href)).toEqual(["/quests", "/x"]);
  });
});

describe("a place the menu's rules refuse", () => {
  it("refuses a seventh row in Village", () => {
    const p = placeProblems({ "/forum": { group: "Village" } });
    expect(p.map((x) => x.code)).toEqual(["rows"]);
    expect(placesProblem({ "/forum": { group: "Village" } })).toMatch(/Village would show 7 rows once every module is on, and it shows 6 at most/);
  });

  it("refuses a sixth entry in a full folder", () => {
    expect(placesProblem({ "/forum": { group: "Govern", sub: "Guides" } })).toMatch(/"Guides" folder in Govern would hold 6 entries/);
  });

  it("refuses a group or a folder the menu has not got, and an entry that is not a module's", () => {
    expect(placesProblem({ "/forum": { group: "Kitchen" } })).toMatch(/no "Kitchen" group/);
    expect(placesProblem({ "/forum": { group: "Village", sub: "Guides" } })).toMatch(/Village has no "Guides" folder/);
    expect(placesProblem({ "/quests": { group: "Village" } })).toMatch(/not a module's entry/);
    expect(placesProblem({ "/forum": { group: "Village", sub: "Maps", at: -1 } })).toMatch(/whole number/);
  });

  it("refuses a place below the Module Library", () => {
    expect(placesProblem({ "/forum": { group: "Govern", sub: "How we work", at: 9 } })).toMatch(/Module Library stays at the bottom/);
    expect(placesProblem({ "/forum": { group: "Govern", at: 9 } })).toMatch(/Module Library stays at the bottom/);
  });

  it("counts an entry the village hid as not there", () => {
    expect(placesProblem({ "/forum": { group: "Village" } }, ["/library"])).toBeNull();
  });

  it("is the content route's refusal for the whole menu document", () => {
    expect(menuDocumentProblem({ places: { "/forum": { group: "Village" } } })).toMatch(/7 rows/);
    expect(menuDocumentProblem({ places: { "/forum": { group: "Village" } }, hidden: ["/library"] })).toBeNull();
    expect(menuDocumentProblem({ labels: { "/forum": "Crew Talk" }, places: { "/forum": { group: "Village", sub: "Maps" } } })).toBeNull();
    expect(menuDocumentProblem({ places: [] })).toMatch(/Places come as/);
    // The document's own shape is still checked first.
    expect(menuDocumentProblem({ tabs: ["/", "/a", "/b", "/c", "/d"] })).toMatch(/up to 4/);
  });
});

describe("the vote path: a proposal on the menu document", () => {
  // A page_content proposal on app-menu is filed and accepted through the content route's own validator
  // (shared/contentDocuments.ts, server/lib/proposedChanges.ts), its body merged onto the menu as it stands.
  const doc = contentDocumentFor("app-menu")!;
  const live = { labels: { "/forum": "Crew Talk" }, hidden: [], groups: {}, folders: {}, tabs: [] };

  it("is checked by the same rules when it is filed", () => {
    expect(doc.problem(mergeOnto(live, { places: { "/feed": { group: "Village", sub: "Maps" } } }))).toBeNull();
    expect(doc.problem(mergeOnto(live, { places: { "/feed": { group: "Village" } } }))).toMatch(/7 rows/);
  });

  it("keeps the name and the place once accepted, and the menu reads both", () => {
    const accepted = menuDocOf(mergeOnto(live, { labels: { "/feed": "Town Square" }, places: { "/feed": { group: "Village", sub: "Maps" } } }));
    expect(accepted.labels["/feed"]).toBe("Town Square");
    const m = placedMenu(accepted.places);
    expect(where(m.nav as typeof NAV, m.account, "/feed")).toEqual(["Village/Maps"]);
  });
});

describe("find anything says the village's name", () => {
  it("names a renamed page by the village's word, and still finds it by the platform's", () => {
    const forum = FIND_PAGES.find((p) => p.path === "/forum")!;
    const named = pageEntry(forum, { names: { "/forum": "Crew Talk" } });
    expect(named.title).toBe("Crew Talk");
    expect(named.synonyms).toContain("Forum");
    expect(pageEntry(forum, {}).title).toBe("Forum");
    expect(pageEntry(forum, {}).synonyms).not.toContain("Forum");
  });
});
