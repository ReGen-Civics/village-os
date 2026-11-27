/**
 * THE MENU'S FOLDERS (the lead, 27 Nov 2026: "make use of nesting to not overwhelm so we're never showing more
 * than ~5 options while still being able to nest all pages into the menu").
 *
 * A group's links, as the reader may see them, become ROWS: a link stands as a row of its own, and links that name
 * the same `sub` (config/nav.ts) become one folder row in the place of the first of them. A folder left with a single
 * visible link becomes that link, so nobody opens a folder to find one page. Every surface that draws the menu (the
 * desktop dropdowns, the drawer, the phone's More sheet and the account menu) draws these rows, so the folders are
 * the same everywhere.
 *
 * Pure: no React, no i18n. The folder's name is translated where it is drawn (navWords.ts, `navWord`).
 */
import type { NavLink } from "./nav";

export type NavRow =
  | { kind: "link"; link: NavLink }
  | { kind: "folder"; label: string; links: NavLink[] };

/** The rows a list of visible links draws as, in the order the links are written. */
export function navRows(links: readonly NavLink[]): NavRow[] {
  const rows: NavRow[] = [];
  const folders = new Map<string, { kind: "folder"; label: string; links: NavLink[] }>();
  for (const link of links) {
    if (!link.sub) {
      rows.push({ kind: "link", link });
      continue;
    }
    const open = folders.get(link.sub);
    if (open) {
      open.links.push(link);
      continue;
    }
    const folder = { kind: "folder" as const, label: link.sub, links: [link] };
    folders.set(link.sub, folder);
    rows.push(folder);
  }
  return rows.map((r) => (r.kind === "folder" && r.links.length === 1 ? { kind: "link", link: r.links[0] } : r));
}

/** A stable id for a folder's own list, for aria-controls. */
export function navFolderId(group: string, folder: string): string {
  return `nav-folder-${`${group}-${folder}`.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
}

/** True when the page being read sits inside this folder, so the folder opens with the menu. */
export function folderHolds(row: NavRow, href: string | null | undefined): boolean {
  return row.kind === "folder" && !!href && row.links.some((l) => l.href === href);
}
