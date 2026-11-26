/**
 * WHERE AM I IN THE MENU (the lead's team call, 26 Nov 2026: "there's no menu context that shows you what branch on
 * the menu you're on ... maybe even put a breadcrumb on the page").
 *
 * One answer for the bar, the phone's More and the breadcrumb, read from the menu itself (config/nav.ts) and never
 * from a second hand-kept map. The caller passes the menu AS THE READER SEES IT, after the gates and the village's own
 * menu document (shared/menuDoc.ts), so a hidden entry and a renamed one need nothing here: a rename keeps the
 * entry's address, and the address is what is matched.
 *
 * The page belongs to the entry whose address is the longest one equal to the page's, or above it at a "/" boundary:
 * /decisions/42 is under Decisions, /map/circles/water under Circles & Roles, not under Living Map. "/" matches only
 * itself. A page under no entry the reader can see (an entry a gate swapped out, like Roles on a village with a map) is
 * looked for in the whole menu next, minus what the village hid. A page under nothing lights nothing.
 *
 * Pure: no React, no hooks, so it is tested on its own (navBearings.test.ts).
 */
import { NAV, isGroup, type NavEntry, type NavLink } from "./nav";

export interface Bearings {
  /** The menu entry the page sits at or under. */
  item: NavLink;
  /** The platform's own name for its group (the menu document's key for a rename), or null for a top-level entry. */
  group: string | null;
  /** True when the page IS the entry's page, false when it sits below it (a role, a decision). */
  exact: boolean;
}

/** A path or an address with its query, hash and trailing slash taken off. */
export function bearingsPath(path: string): string {
  return path.split(/[?#]/)[0].replace(/\/+$/, "") || "/";
}

function under(path: string, href: string): boolean {
  const h = bearingsPath(href);
  if (h === "/") return path === "/";
  return path === h || path.startsWith(h + "/");
}

function find(path: string, entries: readonly NavEntry[], skip: readonly string[]): Bearings | null {
  const all = entries.flatMap((e): { item: NavLink; group: string | null }[] =>
    isGroup(e) ? e.items.map((item) => ({ item, group: e.label })) : [{ item: e, group: null }],
  );
  let best: Bearings | null = null;
  let bestLen = -1;
  // The first of two equally long matches wins, so an entry listed twice lights where the menu lists it first.
  for (const { item, group } of all) {
    if (skip.includes(item.href) || !under(path, item.href)) continue;
    const len = bearingsPath(item.href).length;
    if (len <= bestLen) continue;
    best = { item, group, exact: path === bearingsPath(item.href) };
    bestLen = len;
  }
  return best;
}

/**
 * Where `location` sits in the menu.
 *
 * `seen` is the menu the reader can see, grouped by the platform's group names (the group's `label` in config/nav.ts,
 * before any rename). `hidden` is the village's hidden addresses: a page the village took out of its menu lights
 * nothing, even through the fallback.
 */
export function bearingsFor(
  location: string,
  seen: readonly NavEntry[],
  hidden: readonly string[] = [],
  defined: readonly NavEntry[] = NAV,
): Bearings | null {
  const path = bearingsPath(location);
  return find(path, seen, hidden) ?? find(path, defined, hidden);
}

/** What the bar, the drawer and the More sheet light: the group by its DRAWN name, and the entry by its address. */
export interface Lit {
  /** The group's name as the reader sees it (the village's rename, or the platform's word in their language). */
  group: string | null;
  href: string;
  exact: boolean;
}

/**
 * aria-current for an entry: "page" on the page itself, "true" on the entry a deeper page sits under (a decision
 * under Decisions), nothing elsewhere.
 */
export function currentFor(lit: Lit | null, href: string): "page" | "true" | undefined {
  if (!lit || lit.href !== href) return undefined;
  return lit.exact ? "page" : "true";
}
