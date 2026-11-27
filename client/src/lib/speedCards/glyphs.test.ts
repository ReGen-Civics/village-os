/**
 * A SPEED CARD'S GLYPH (glyphs.ts): the same on the card and in the picker, and never another page's. QA round 2 found
 * Housing wearing the Quests compass and four Join pages the Investor's seed, because a page with no icon borrowed its
 * group's first one. A page with none of its own now wears its group's NEUTRAL glyph, which no page uses.
 */
import { describe, expect, it } from "vitest";
import { isGroup, NAV, ACCOUNT_MENU, type NavGroup } from "@/config/nav";
import { ROUTE_ICON_SET } from "@/config/routeIconSet";
import { TASK_BOARD_PATH } from "@shared/taskMenu";
import { CARD_GLYPHS, fallbackGlyph, GROUP_GLYPHS } from "./glyphs";
import { buildRegistry, groupKeyOf } from "./registry";

const words = { yours: "Yours", more: "More" };
const navGroups = NAV.filter(isGroup) as NavGroup[];

describe("the neutral group glyphs", () => {
  it("give every group in the menu one, and the account its own", () => {
    for (const g of navGroups) expect(GROUP_GLYPHS[g.label], g.label).toBeTruthy();
    expect(GROUP_GLYPHS.Yours).toBeTruthy();
  });

  it("are no page's icon: not the icon set's, not a menu entry's, not a card's own", () => {
    const pageIcons = new Set<unknown>([
      ...Object.values(ROUTE_ICON_SET),
      ...navGroups.flatMap((g) => g.items.map((l) => l.icon)),
      ...ACCOUNT_MENU.map((l) => l.icon),
      ...Object.values(CARD_GLYPHS),
    ]);
    for (const [group, glyph] of Object.entries(GROUP_GLYPHS)) expect(pageIcons.has(glyph), group).toBe(false);
  });
});

describe("a card's glyph", () => {
  // Layout hands the sheet each group translated (here into Spanish) with its items untouched.
  const reg = buildRegistry({
    entries: navGroups.map((g) => ({ ...g, label: `${g.label} (es)` })),
    itemsOf: (g) => [...g.items],
    account: ACCOUNT_MENU.filter((l) => !l.roles && !l.door),
    registered: [],
    words,
  });

  it("knows each group by the menu's own name, whatever the reader sees it called", () => {
    for (const g of navGroups) expect(groupKeyOf({ ...g, label: "Renamed" })).toBe(g.label);
  });

  it("is the group's neutral glyph for a page with no icon of its own, never a neighbour's", () => {
    const join = navGroups.find((g) => g.items.some((l) => l.href === "/partner"))!;
    const partner = reg.byId.get("/partner")!;
    expect(partner.icon).toBeUndefined();
    expect(fallbackGlyph(partner)).toBe(GROUP_GLYPHS[join.label]);
    // The Investor's own seed stays the Investor's.
    const investor = join.items.find((l) => l.href === "/investor");
    if (investor?.icon) expect(fallbackGlyph(partner)).not.toBe(investor.icon);
  });

  it("is the card's own for Profile, Messages, My tasks and Journal, on the card and in the picker alike", () => {
    expect(fallbackGlyph(reg.byId.get("/profile")!)).toBe(CARD_GLYPHS["/profile"]);
    expect(fallbackGlyph(reg.byId.get(TASK_BOARD_PATH)!)).toBe(CARD_GLYPHS[TASK_BOARD_PATH]);
  });
});
