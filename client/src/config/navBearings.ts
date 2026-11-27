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
import { NAV, isGroup, type NavEntry, type NavGroup, type NavLink } from "./nav";

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
  /** The group's own page, when it has one (NavGroup.href) and the village has not hidden it. */
  groupHref?: string;
  href: string;
  exact: boolean;
  /** The entry itself, before the shell puts the village's word on it. */
  item: NavLink;
  /**
   * True when the page's own entry is not in the reader's menu because another took its place (Roles folds into
   * "Circles & Roles" while the map runs, NavLink.unlessModule), and `href` names that other entry instead. The menu
   * marks it as the way to the page, never as the page itself; the breadcrumb keeps the page's own entry (`item`).
   */
  replaced?: boolean;
}

/**
 * aria-current for an entry: "page" on the page itself, "true" on the entry a deeper page sits under (a decision
 * under Decisions), nothing elsewhere.
 */
export function currentFor(lit: Lit | null, href: string): "page" | "true" | undefined {
  if (!lit || lit.href !== href) return undefined;
  return lit.exact && !lit.replaced ? "page" : "true";
}

/**
 * The lit branch for the menu a reader sees: `visible` is the shell's own gate (modules, roles, the front door, the
 * village's hidden entries), `menu` the village's menu document, `word` the platform's group name in the reader's
 * language. The group is returned as it is DRAWN, the village's rename first.
 */
export function litFor(
  location: string,
  visible: (link: NavLink) => boolean,
  menu: { hidden: readonly string[]; groups: Readonly<Record<string, string>> },
  word: (group: string) => string,
  defined: readonly NavEntry[] = NAV,
): Lit | null {
  const seen = defined.flatMap((e): NavEntry[] => (isGroup(e) ? [{ ...e, items: e.items.filter(visible) }] : visible(e) ? [e] : []));
  const b = bearingsFor(location, seen, menu.hidden, defined);
  if (!b) return null;
  const own = b.group ? defined.find((e): e is NavGroup => isGroup(e) && e.label === b.group)?.href : undefined;
  // The page's entry gave way to another (the live check, 27 Nov 2026: a role lit Village and marked nothing inside it).
  // The one that took its place is the entry in the same group gated on the module that hid this one.
  const swappedFor = b.item.unlessModule && !visible(b.item)
    ? seen.flatMap((e) => (isGroup(e) ? (e.label === b.group ? e.items : []) : b.group ? [] : [e])).find((l) => l.module === b.item.unlessModule && !menu.hidden.includes(l.href))
    : undefined;
  return {
    group: b.group ? menu.groups[b.group] || word(b.group) : null,
    groupHref: own && !menu.hidden.includes(own) ? own : undefined,
    href: swappedFor ? swappedFor.href : b.item.href,
    exact: b.exact,
    item: b.item,
    ...(swappedFor ? { replaced: true } : {}),
  };
}
