/**
 * The honest Admin nav (L1): which admin tabs exist follows which modules are
 * on, and this file is the single owner of the tab-to-module mapping.
 *
 * Pure on purpose: `navGroups()` in Admin.tsx stays a literal list of
 * everything the panel CAN show, and `filterNavByModules` decides what this
 * village's Admin DOES show, so the two concerns never tangle and the filter
 * is testable without rendering anything.
 */
import type { ModuleLifecycle } from "@shared/modules";

/**
 * Admin tab key -> module id. The map lives in shared/adminTabModules.ts, beside the tab
 * table (shared/adminTabs.ts), so the server and the registry of acts read the same rows. This file stays
 * its one reader on the client: a tab named there renders only while its module is
 * not off, and carries the module's lifecycle as a badge.
 */
import { TAB_MODULE, TAB_MODULES, tabModules } from "@shared/adminTabModules";

export { TAB_MODULE, TAB_MODULES, tabModules };

/** Whether a module is on. Unknown (the catalog has not arrived) reads as on, so nothing flashes away. */
export function moduleIsOn(lifecycles: Record<string, ModuleLifecycle> | null | undefined, id: string): boolean {
  return !lifecycles || (lifecycles[id] ?? "off") !== "off";
}

/** The badge an admin tab wears: where its module stands right now. */
export type TabBadge = "preview" | "members" | "everyone";

export function tabBadge(lifecycle: ModuleLifecycle | undefined): TabBadge | undefined {
  if (lifecycle === "preview") return "preview";
  if (lifecycle === "members") return "members";
  if (lifecycle === "public") return "everyone";
  return undefined;
}

interface FilterableItem {
  key: string;
  badge?: TabBadge;
}

interface FilterableGroup<I extends FilterableItem> {
  title: string;
  items: I[];
}

/**
 * Drop every tab whose module is off, badge the rest with where their module
 * stands, and drop a group that ends up empty (a bare title is not a menu).
 *
 * `lifecycles` null or undefined means the admin modules payload has not
 * arrived yet: filter NOTHING, so a slow link shows the full rail instead of
 * flashing an empty one. An id missing from the record reads as off, which is
 * exactly the delta-off rule the server lives by.
 */
export function filterNavByModules<I extends FilterableItem, G extends FilterableGroup<I>>(
  groups: G[],
  lifecycles: Record<string, ModuleLifecycle> | null | undefined,
): G[] {
  if (!lifecycles) return groups;
  return groups
    .map((g) => ({
      ...g,
      items: g.items
        .filter((item) => {
          const ids = tabModules(item.key);
          return ids.length === 0 || ids.some((id) => moduleIsOn(lifecycles, id));
        })
        .map((item) => {
          const badges = new Set(tabModules(item.key).filter((id) => moduleIsOn(lifecycles, id)).map((id) => tabBadge(lifecycles[id])));
          const badge = badges.size === 1 ? Array.from(badges)[0] : undefined;
          return badge ? { ...item, badge } : item;
        }),
    }))
    .filter((g) => g.items.length > 0);
}

/**
 * The left rail's classes. Open below the laptop width it is a drawer, fixed
 * above the page at z-40. Docked (lg and up) it is a flex item, and a flex item
 * honours z-index even when static, so the drawer's z-40 used to lift the docked
 * rail over the sticky header (z-30) and cut the header's title off as the page
 * scrolled. `lg:z-auto` keeps the docked rail on the page's own layer.
 */
export function adminNavRailClass(open: boolean): string {
  return `${open ? "fixed z-40 top-0 bottom-0 left-0 w-64 shadow-2xl lg:static lg:z-auto lg:shadow-none lg:w-56" : "w-14"} ` +
    "max-lg:hidden min-h-[calc(100vh-60px)] bg-white border-r border-gray-200 py-3 flex-shrink-0 overflow-y-auto transition-[width] duration-150";
}
