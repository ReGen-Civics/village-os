/**
 * WHICH MODULE AN ADMIN TAB NEEDS ON. Moved here unchanged from
 * client/src/lib/adminNav.ts, which re-exports it, so the server and the
 * registry of acts (shared/adminActs.ts) read the same rows the menu filters by.
 * Its own small file on purpose: the pages that only need this map do not carry
 * the whole tab table (shared/adminTabs.ts) with it.
 *
 * Pure: no I/O, no clock.
 */

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
