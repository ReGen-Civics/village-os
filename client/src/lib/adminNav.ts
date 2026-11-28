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
 * Admin tab key -> module id. A tab named here renders only while its module
 * is not off, and carries the module's lifecycle as a badge. Every tab NOT
 * named here is a platform tab and always renders.
 *
 * `resources-admin` and `intents-admin` are mapped ahead of their modules
 * (L3's `resources`, L7's `introductions`): an id the registry does not know
 * reads as off, so those tabs stay hidden until their lanes land, and neither
 * lane has to edit this map to get the hiding right.
 *
 * Measured, not assumed: `org-chart` and `seasons-patterns` stay platform
 * tabs because `/api/org` and `/api/admin/seasons/patterns` mount behind no
 * requireModule and both surfaces work with `map` off.
 */
export const TAB_MODULE: Record<string, string> = {
  "circles-map": "map",
  "events-admin": "events",
  "tools-admin": "tools",
  "crowdpool-admin": "crowdpool",
  "stays-admin": "stays",
  "exchange-admin": "exchange",
  "badges-admin": "badges",
  "library-admin": "library",
  "health-admin": "health",
  "calls-admin": "automation",
  products: "commerce",
  // `cycles` is NOT here: gratitude is core, always public, and its close
  // route is behind no gate. The Reports queue follows two modules and is in
  // TAB_MODULES below.
  "resources-admin": "resources",
  "intents-admin": "introductions",
  // `app.use("/api/admin/governance", requireModule("governance"))` gates every
  // weight route, so the allocation table is only a table while the engine is
  // on. Off, the tab hides instead of offering a form that 404s.
  "governance-weights": "governance",
  // Village Comms: the five screens that drive the automations follow the
  // module. `comms-sent` and `comms-settings` are deliberately NOT here: a
  // village sets up its sending before it turns anything on, and the post
  // office records every email (a password link included) whatever the
  // module says, so both are platform tabs (server/routes/comms.ts).
  "comms-overview": "comms",
  "comms-journeys": "comms",
  "comms-words": "comms",
  "comms-people": "comms",
  "comms-letters": "comms",
};

/**
 * A tab that answers for more than one module. It renders while ANY of them is
 * on, and wears a badge only when the ones that are on stand in the same place.
 *
 * The one Reports queue (cut C7, 27 Nov 2026) holds the forum's reports and
 * the reports on private messages. `/api/admin/forum` mounts behind
 * requireModule("forum") and `/api/admin/messages` behind
 * requireModule("messaging"), so the queue is only a queue while one of the
 * two is on, and it reads only the half that is.
 */
export const TAB_MODULES: Record<string, readonly string[]> = {
  reports: ["forum", "messaging"],
};

/** The modules a tab follows. None for a platform tab, which always renders. */
export function tabModules(key: string): readonly string[] {
  const one = TAB_MODULE[key];
  return one ? [one] : TAB_MODULES[key] ?? [];
}

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
