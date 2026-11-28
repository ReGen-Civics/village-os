/**
 * THE MENU WITH THE VILLAGE'S OWN PLACES IN IT (the lead, 27 Nov 2026: "all module menu items are up for the village to
 * determine where in the menu they would like them to be").
 *
 * nav.ts is where every entry ships. A village that moved a module's entry (Admin, Menu, or when it turned the module
 * on) keeps that in its menu document's `places` (shared/menuPlace.ts); this lays them over NAV and ACCOUNT_MENU once,
 * so the bar, the drawer, the phone's More sheet, the breadcrumb, Recent and the firefly all read one menu. An entry
 * keeps its address and its gates wherever it goes; only its group, its folder and its position change.
 *
 * With no places the platform's own lists come back as they are, the same objects, so nothing moves.
 */
import { MENU_ACCOUNT, placeItems, placesOf, type MenuPlace } from "@shared/menuPlace";
import { ACCOUNT_MENU, NAV, isGroup, type NavEntry, type NavLink } from "./nav";

export interface PlacedMenu {
  nav: readonly NavEntry[];
  account: readonly NavLink[];
}

const PLATFORM: PlacedMenu = { nav: NAV, account: ACCOUNT_MENU };
let last: { key: string; menu: PlacedMenu } | null = null;

/** The menu with `places` laid over it. The same answer for the same places, so a memo downstream holds. */
export function placedMenu(places: Readonly<Record<string, MenuPlace>> | undefined, nav: readonly NavEntry[] = NAV, account: readonly NavLink[] = ACCOUNT_MENU): PlacedMenu {
  if (!places || !Object.keys(places).length) return nav === NAV && account === ACCOUNT_MENU ? PLATFORM : { nav, account };
  const key = JSON.stringify(places);
  if (last && last.key === key && nav === NAV && account === ACCOUNT_MENU) return last.menu;
  const groups = [...nav.filter(isGroup).map((g) => ({ key: g.label, items: g.items })), { key: MENU_ACCOUNT, items: account }];
  const placed = placeItems(groups, placesOf(places)).groups; // cleaned here: the menu document passes them through
  const itemsOf = (k: string) => placed.find((g) => g.key === k)!.items;
  const menu: PlacedMenu = {
    nav: nav.map((e) => (isGroup(e) ? { ...e, items: itemsOf(e.label) } : e)),
    account: itemsOf(MENU_ACCOUNT),
  };
  if (nav === NAV && account === ACCOUNT_MENU) last = { key, menu };
  return menu;
}
