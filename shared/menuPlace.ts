/**
 * WHERE A MODULE'S MENU ENTRY SITS, AS THE VILLAGE CHOSE (the lead, 27 Nov 2026: "all module menu items are up for
 * the village to determine where in the menu they would like them to be and what their name would be rather than us
 * trying to predict all of this upfront").
 *
 * Every module entry ships with a default name and place (shared/moduleMenu.ts, seeded from client/src/config/nav.ts).
 * A village's own choice is kept in its menu document (shared/menuDoc.ts) beside the names it already keeps there:
 *
 *   labels[href]   the entry's name, as before;
 *   places[href]   its place: a group (by the platform's name, or "account" for the account menu), a folder in that
 *                  group or none for a row of its own, and its position among the group's rows (or the folder's
 *                  entries). No position means the end, above the Module Library.
 *
 * Only a module's own entries move (an entry with `module` in nav.ts). The rest of the menu is the platform's, and
 * the Module Library stays at the bottom whatever a place says.
 *
 * This half is small on purpose: the shell reads it on the first page. The rules a choice is held to are in
 * shared/moduleMenu.ts, which only the editors and the server load.
 *
 * Pure: no React, no i18n.
 */

/** The account menu's key as a place: the member's own menu, under their name. */
export const MENU_ACCOUNT = "account";
/** The one entry that is always last in its group, and so at the bottom of the menu (the lead, 27 Nov 2026). */
export const MENU_PINNED_LAST = "/modules";
/** Positions past this are not positions. */
export const MENU_AT_MAX = 60;

export interface MenuPlace {
  /** The group, by the platform's name (NavGroup.label), or MENU_ACCOUNT. */
  group: string;
  /** A folder in that group, by the platform's name (NavLink.sub). Absent: a row of its own. */
  sub?: string;
  /** Its position: among the group's rows, or among the folder's entries. Absent: the end. */
  at?: number;
}

const isPath = (v: unknown): v is string => typeof v === "string" && /^\/[A-Za-z0-9/#?=&._-]{0,120}$/.test(v);
const name = (v: unknown): string => (typeof v === "string" ? v.replace(/[\u0000-\u001f\u007f]/g, "").replace(/\s+/g, " ").trim().slice(0, 60) : "");

/** The stored places, cleaned: an address, a group, a folder name or none, a whole position or none. */
export function placesOf(raw: unknown): Record<string, MenuPlace> {
  const out: Record<string, MenuPlace> = {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
  for (const [href, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!isPath(href) || !v || typeof v !== "object" || Array.isArray(v)) continue;
    const p = v as Record<string, unknown>;
    const group = name(p.group);
    if (!group) continue;
    const sub = name(p.sub);
    const at = typeof p.at === "number" && Number.isInteger(p.at) && p.at >= 0 && p.at <= MENU_AT_MAX ? p.at : undefined;
    out[href] = { group, ...(sub ? { sub } : {}), ...(at !== undefined ? { at } : {}) };
  }
  return out;
}

/** What placing needs of an entry. nav.ts's NavLink and moduleMenu.ts's shape both have it. */
export interface Placeable {
  href: string;
  sub?: string;
  module?: string;
}

export interface PlaceGroup<T> {
  key: string;
  items: readonly T[];
}

/** The index of each row's first entry, in row order: an entry with no folder is a row, a folder is the row of its first entry. */
export function rowStarts(items: readonly Placeable[]): number[] {
  const seen = new Set<string>();
  const starts: number[] = [];
  items.forEach((it, i) => {
    if (!it.sub) starts.push(i);
    else if (!seen.has(it.sub)) {
      seen.add(it.sub);
      starts.push(i);
    }
  });
  return starts;
}

/** Which row the entry at `index` draws in. */
function rowOf(items: readonly Placeable[], index: number): number {
  const it = items[index]!;
  const first = it.sub ? items.findIndex((x) => x.sub === it.sub) : index;
  return rowStarts(items).indexOf(first);
}

/** Where the entry at `index` stands: its position among its folder's entries, else its row's position. */
export function positionIn(items: readonly Placeable[], index: number): number {
  const it = items[index]!;
  if (it.sub) return items.filter((x, i) => x.sub === it.sub && i < index).length;
  return rowStarts(items).indexOf(index);
}

/** True when a place says nothing the menu does not already say: the same group and folder, and no other position. */
function samePlace(p: MenuPlace, groupKey: string, items: readonly Placeable[], index: number): boolean {
  return p.group === groupKey && (p.sub ?? "") === (items[index]!.sub ?? "") && (p.at === undefined || p.at === positionIn(items, index));
}

/**
 * The menu with each module entry moved to the village's place for it. The groups come back in their order with new
 * item lists; an entry keeps every field but its folder, which becomes the place's. A place naming a group the menu
 * does not have, or an entry that is not a module's, moves nothing. `past` names the entries whose position was below
 * the Module Library; each is put just above it instead (the rules refuse such a place when it is saved).
 */
export function placeItems<T extends Placeable>(
  groups: readonly PlaceGroup<T>[],
  places: Readonly<Record<string, MenuPlace>> | undefined,
): { groups: { key: string; items: T[] }[]; past: string[] } {
  const out = groups.map((g) => ({ key: g.key, items: [...g.items] }));
  const past: string[] = [];
  if (!places || !Object.keys(places).length) return { groups: out, past };
  const moves: { item: T; place: MenuPlace }[] = [];
  const taken = new Set<string>();
  for (let gi = 0; gi < out.length; gi++) {
    const g = out[gi]!;
    const before = groups[gi]!.items;
    for (let i = 0; i < before.length; i++) {
      const item = before[i]!;
      const place = places[item.href];
      if (!place || !item.module || taken.has(item.href) || !out.some((x) => x.key === place.group)) continue;
      taken.add(item.href);
      if (samePlace(place, g.key, before, i)) continue;
      g.items.splice(g.items.indexOf(item), 1);
      moves.push({ item, place });
    }
  }
  for (const { item, place } of moves) {
    const target = out.find((x) => x.key === place.group)!;
    const items = target.items;
    const { sub: _old, ...rest } = item;
    const moved = (place.sub ? { ...rest, sub: place.sub } : rest) as T;
    const pin = items.findIndex((x) => x.href === MENU_PINNED_LAST);
    const inFolder = place.sub ? items.flatMap((x, i) => (x.sub === place.sub ? [i] : [])) : [];
    let index: number;
    if (inFolder.length) {
      const pinAt = inFolder.indexOf(pin);
      const limit = pinAt === -1 ? inFolder.length : pinAt;
      let at = place.at ?? limit;
      if (at > limit) {
        past.push(item.href);
        at = limit;
      }
      index = at < inFolder.length ? inFolder[at]! : inFolder[inFolder.length - 1]! + 1;
    } else {
      const starts = rowStarts(items);
      const limit = pin === -1 ? starts.length : rowOf(items, pin);
      let at = place.at ?? limit;
      if (at > limit) {
        past.push(item.href);
        at = limit;
      }
      index = at < starts.length ? starts[at]! : items.length;
    }
    items.splice(index, 0, moved);
  }
  return { groups: out, past };
}
