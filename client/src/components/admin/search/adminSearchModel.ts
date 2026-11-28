/**
 * What Admin search searches, built from two halves (Admin evolution, PR 3):
 *
 *   the pages     the tabs this person's menu shows (already filtered by the
 *                 modules that are on), each by its one name in adminAreas.ts,
 *                 with the menu's label, old names and synonyms
 *                 (shared/adminSearch.ts) as the words it is also found by
 *   the rest      controls, acts, dials and steward pages outside /admin, from
 *                 GET /api/admin/search-index, which reads the registry of
 *                 acts (shared/adminActs.ts) and asked the one gate
 *
 * A control whose page the menu does not show is left out, so a result never
 * lands on a page this person cannot open. Nothing here acts.
 */
import {
  TAB_SYNONYMS,
  adminSearchHref,
  type AdminSearchEntry,
} from "@shared/adminSearch";
import { readStoredJson, writeStoredJson } from "@/lib/safeStorage";
import type { NavGroup } from "../adminNavGroups";
import { tabEntry } from "../adminAreas";

/** The pages, from the menu this person sees. */
export function pageEntries(groups: readonly NavGroup[]): AdminSearchEntry[] {
  const seen = new Set<string>();
  const out: AdminSearchEntry[] = [];
  for (const g of groups) {
    for (const item of g.items) {
      if (seen.has(item.key)) continue;
      seen.add(item.key);
      const known = tabEntry(item.key);
      // The page's one name is the area list's (adminAreas.ts): the menu's label
      // can be as bare as "Settings" under a heading the result does not show.
      // The menu's label stays findable as a synonym.
      const extra = known && known.name.toLowerCase() !== item.label.toLowerCase() ? [item.label] : [];
      out.push({
        id: `tab.${item.key}`,
        kind: "page",
        tab: item.key,
        title: known?.name ?? item.label,
        help: known?.help ?? g.title,
        synonyms: [...(TAB_SYNONYMS[item.key] ?? []), ...extra, g.title],
      });
    }
  }
  return out;
}

/** Everything search can find, with every control on a page this person can open. */
export function searchEntries(groups: readonly NavGroup[], served: readonly AdminSearchEntry[]): AdminSearchEntry[] {
  const pages = pageEntries(groups);
  const tabs = new Set(pages.map((p) => p.tab));
  const rest = served.filter((e) => {
    if (e.kind === "outside") return true;
    // An act on a page beside Admin lands on that page's own path.
    if (e.kind === "act" && !e.tab) return true;
    // A dial lands on Game mechanics, a control or an act on its own page: all only when that page is in the menu.
    return tabs.has(e.tab ?? "");
  });
  return [...pages, ...rest];
}

// ── Recent places: this device only ────────────────────────────────────────

export const RECENT_KEY = "admin.searchRecent";
export const RECENT_MAX = 6;

export interface RecentPlace {
  id: string;
  title: string;
  href: string;
}

export function readRecent(): RecentPlace[] {
  const read = readStoredJson("local", RECENT_KEY);
  const v = read.status === "value" ? read.value : null;
  if (!Array.isArray(v)) return [];
  return (v as unknown[])
    .filter((r): r is RecentPlace => {
      const x = r as Partial<RecentPlace> | null;
      return !!x && typeof x.id === "string" && typeof x.title === "string" && typeof x.href === "string" && x.href.startsWith("/");
    })
    .slice(0, RECENT_MAX);
}

export function rememberPlace(e: AdminSearchEntry): RecentPlace[] {
  const next = [{ id: e.id, title: e.title, href: adminSearchHref(e) }, ...readRecent().filter((r) => r.id !== e.id)].slice(0, RECENT_MAX);
  writeStoredJson("local", RECENT_KEY, next);
  return next;
}

/**
 * Go to an address. Inside /admin: push it and raise `popstate`, the event
 * Admin already follows for Back and Forward, so the tab changes (asking
 * first when edits are unsaved) and an open page re-reads `setting`.
 * Anywhere else: an ordinary navigation.
 */
export function goTo(href: string): void {
  if (href.startsWith("/admin?") || href === "/admin") {
    window.history.pushState({}, "", href);
    window.dispatchEvent(new PopStateEvent("popstate"));
    return;
  }
  window.location.assign(href);
}

/** True for the keys that open search: "/" outside a text field, and Ctrl K or Cmd K anywhere. */
export function isSearchShortcut(e: Pick<KeyboardEvent, "key" | "ctrlKey" | "metaKey" | "altKey" | "target">): boolean {
  if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === "k") return true;
  if (e.key !== "/" || e.ctrlKey || e.metaKey || e.altKey) return false;
  const t = e.target as HTMLElement | null;
  const typing = !!t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName ?? ""));
  return !typing;
}
