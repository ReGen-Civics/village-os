/**
 * OLD ADMIN TAB ADDRESSES, AND WHERE EACH ONE LANDS.
 *
 * A tab that is folded keeps its key here, so a link already sent (a notice,
 * an email, a bookmark, a recent place on this device) still opens the control
 * it was sent for. Nothing in this file is drawn in a menu: a key here is an
 * address only.
 *
 * Two kinds, because a control can move two ways:
 *
 *   MOVED_TABS   the control is on another Admin tab. The address is rewritten
 *                in place to that tab, with whatever else it needs to land on
 *                the control itself.
 *   LEFT_ADMIN   the control lives on a page outside /admin. Admin redirects.
 *
 * Folding a tab means adding its key here in the same change, with a case in
 * adminTabAliases.test.ts. That test also holds every key to a tab the menu
 * really has, so an alias cannot point at a second folded tab.
 */
import { VISIT_PROGRAM_SETTING } from "@shared/adminSearch";
import { TREASURY_SECTIONS, treasuryHref } from "@/lib/treasuryAddress";

export interface MovedTab {
  /** The Admin tab that holds the control now. */
  tab: string;
  /** What the address also carries, so the tab opens on the control. */
  params?: Readonly<Record<string, string>>;
}

export const MOVED_TABS: Readonly<Record<string, MovedTab>> = {
  // Mail settings is one page, listed once. Its first name still opens it.
  "email-settings": { tab: "comms-settings" },
  // One Reports queue for the forum and for messages (cut C7, 27 Nov 2026).
  // The server's notices still name both old keys.
  "forum-moderation": { tab: "reports" },
  "message-reports": { tab: "reports" },
  // One visit program editor, the one inside Pages (cut C6, 27 Nov 2026).
  "visit-config": { tab: "pages", params: { setting: VISIT_PROGRAM_SETTING } },
  // The notice that a role waits on the confidentiality agreement was sent to `?tab=content`, a panel with nothing
  // in it. The agreement is written on the Confidentiality agreement tab.
  content: { tab: "confidentiality" },
};

export const LEFT_ADMIN: Readonly<Record<string, string>> = {
  // The tab was one link. Finished work is a kind on the review list (cut C4).
  "quest-claims": "/admin/review?kind=claim",
  // One desk each, on the governance Treasury (cut C5).
  "pricing-desk": treasuryHref(TREASURY_SECTIONS.prices),
  budgets: treasuryHref(TREASURY_SECTIONS.budget),
  // Role-access notices were sent to `?tab=org`, a tab that never existed. The task is done on the season page's
  // plan, by the holder of the granting role, who is often not an admin (server/lib/roleAccess.ts).
  org: "/season#plan",
};

/** A key's own entry only: `constructor` and the like are no tab, and must never read as an alias. */
function own<T>(table: Readonly<Record<string, T>>, key: string): T | undefined {
  return Object.prototype.hasOwnProperty.call(table, key) ? table[key] : undefined;
}

/** Where a tab key lands inside Admin: itself, unless it moved. */
export function tabLanding(key: string): MovedTab {
  return own(MOVED_TABS, key) ?? { tab: key };
}

/** The page outside Admin an old tab key lands on, or null when the key is still Admin's. */
export function leftAdminTarget(key: string): string | null {
  return own(LEFT_ADMIN, key) ?? null;
}

/**
 * The query string an old address settles to, or null when it needs no change.
 * Everything else the address carried (`from=launch`, a hash) is kept.
 */
export function settledSearch(search: string): string | null {
  const p = new URLSearchParams(search);
  const moved = own(MOVED_TABS, p.get("tab") ?? "");
  if (!moved) return null;
  p.set("tab", moved.tab);
  for (const [k, v] of Object.entries(moved.params ?? {})) p.set(k, v);
  return `?${p.toString()}`;
}

/**
 * Rewrite an old tab address in place, and return the query string to read.
 * Called before the tab is read, so the page that opens reads the settled
 * address and a copied link is the new one.
 */
export function settleTabAddress(): string {
  const next = settledSearch(window.location.search);
  if (next !== null) window.history.replaceState(window.history.state, "", `${window.location.pathname}${next}${window.location.hash}`);
  return window.location.search;
}
