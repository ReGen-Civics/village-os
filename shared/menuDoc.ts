/**
 * A VILLAGE'S OWN MENU AND PHONE TABS (gap G5).
 *
 * Every menu label was a literal in client/src/config/nav.ts, whose header
 * said "a fork changes its menu by editing THIS file", which a village running
 * the published image cannot do; and the phone's five tabs were fixed. This is
 * the village's menu document, kept as the content section `app-menu` (Admin,
 * Make it yours, Menu; written through the content route, `story.tell`):
 *
 *   labels  an entry's own word, by its address ("/forum": "Crew Talk")
 *   hidden  entries the village takes out of its menu, by address
 *   groups  a group's own name, by the platform's ("Community": "Aboard")
 *   folders a folder's own name, by the platform's ("Places and homes": "Where we live"; the lead, 27 Nov
 *           2026: "Yes" to village-named folders). Until a village names one, a folder is the platform's
 *           word in the reader's language.
 *   tabs    the four phone tabs before More, by address
 *   places  where a module's entry sits, by address (shared/menuPlace.ts; the lead, 27 Nov 2026: "all module menu
 *           items are up for the village to determine where in the menu they would like them to be and what their
 *           name would be"). Its name is its label above. Until a village places one, it sits where it ships
 *           (shared/moduleMenu.ts), and the rules a place is held to are checked there.
 *
 * ENTRIES KEEP THEIR ROUTES AND THEIR GATES. A label never changes where an
 * entry goes, and a hidden flag only ever takes an entry away: an entry a
 * member cannot reach (its module off, a role they do not hold) stays out
 * whatever the document says, and a phone tab whose page is not open to them
 * falls back to the platform's tab in that place.
 *
 * Nothing set is today's menu exactly.
 */

import { placesOf, type MenuPlace } from "./menuPlace";
import { placesProblem } from "./moduleMenu";

export const MENU_SECTION = "app-menu";
export const MENU_LABEL_MAX = 32;
export const MENU_TABS = 4;

export interface MenuDoc {
  labels: Record<string, string>;
  hidden: string[];
  groups: Record<string, string>;
  /** A folder's own name, keyed by the platform's folder name (NavLink.sub in client/src/config/nav.ts). */
  folders: Record<string, string>;
  tabs: string[];
  /** Where a module's entry sits, by its address (shared/menuPlace.ts). Absent when the village placed none. */
  places?: Record<string, MenuPlace>;
}

const isPath = (v: unknown): v is string => typeof v === "string" && /^\/[A-Za-z0-9/#?=&._-]{0,120}$/.test(v);
const word = (v: unknown, max = MENU_LABEL_MAX): string =>
  typeof v === "string" ? v.replace(/[\u0000-\u001f\u007f]/g, "").replace(/\s+/g, " ").trim().slice(0, max) : "";

/** The stored document, cleaned: addresses only where addresses go, labels clipped, at most four tabs. */
export function menuDocOf(raw: unknown): MenuDoc {
  const d = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const labels: Record<string, string> = {};
  for (const [k, v] of Object.entries(d.labels && typeof d.labels === "object" ? (d.labels as Record<string, unknown>) : {})) {
    const w = word(v);
    if (isPath(k) && w) labels[k] = w;
  }
  const groups: Record<string, string> = {};
  for (const [k, v] of Object.entries(d.groups && typeof d.groups === "object" ? (d.groups as Record<string, unknown>) : {})) {
    const w = word(v);
    if (word(k, 60) && w) groups[k] = w;
  }
  const folders: Record<string, string> = {};
  for (const [k, v] of Object.entries(d.folders && typeof d.folders === "object" ? (d.folders as Record<string, unknown>) : {})) {
    const w = word(v);
    if (word(k, 60) && w) folders[k] = w;
  }
  const hidden = Array.isArray(d.hidden) ? Array.from(new Set(d.hidden.filter(isPath))) : [];
  const tabs = Array.isArray(d.tabs) ? d.tabs.filter(isPath).slice(0, MENU_TABS) : [];
  const places = placesOf(d.places);
  return carriedOver({ labels, hidden, groups, folders, tabs, ...(Object.keys(places).length ? { places } : {}) });
}

/**
 * MENU ENTRIES AND GROUPS THAT MOVED (Governance, 26 Nov 2026: "call it governance"). A village's document names an
 * entry by its address and a group by the platform's name, so a village that renamed or hid "Review Queue" at
 * /review, or renamed the "Decide" group, would lose that silently when the platform moved them. Read the old key as
 * the new one, unless the village has already said something under the new key. Tabs are left alone: every old
 * address still opens (as a redirect), and /governance is still a page.
 */
export const MOVED_ENTRIES: Readonly<Record<string, string>> = {
  "/review": "/governance/work",
  "/decisions": "/governance/decisions",
  "/governance": "/governance/how",
};
// Round 2 (the lead, 27 Nov 2026: "which we could just call govern"): Governance is Govern in the menu, and Decide,
// carried to Governance before, carries on to Govern. About and Guides are gone as groups; their pages sit in the
// other groups, so a name a village gave those groups has no group left to name.
export const MOVED_GROUPS: Readonly<Record<string, string>> = { Governance: "Govern", Decide: "Govern" };

function carriedOver(m: MenuDoc): MenuDoc {
  const labels = { ...m.labels };
  for (const [from, to] of Object.entries(MOVED_ENTRIES)) {
    if (labels[from] !== undefined && labels[to] === undefined) labels[to] = labels[from]!;
    delete labels[from];
  }
  const groups = { ...m.groups };
  for (const [from, to] of Object.entries(MOVED_GROUPS)) {
    if (groups[from] !== undefined && groups[to] === undefined) groups[to] = groups[from]!;
    delete groups[from];
  }
  const hidden = Array.from(new Set(m.hidden.map((h) => MOVED_ENTRIES[h] ?? h)));
  return { labels, hidden, groups, folders: m.folders, tabs: m.tabs, ...(m.places ? { places: m.places } : {}) };
}

/** True when the village changed nothing, so the menu is the platform's. */
export function menuDocIsEmpty(m: MenuDoc): boolean {
  return !Object.keys(m.labels).length && !m.hidden.length && !Object.keys(m.groups).length && !Object.keys(m.folders).length && !m.tabs.length && !Object.keys(m.places ?? {}).length;
}

/** Why the content route must refuse this document, or null. */
export function menuDocProblem(raw: unknown): string | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return "Send the menu as { labels, hidden, groups, folders, tabs, places }.";
  const d = raw as Record<string, unknown>;
  for (const [k, v] of Object.entries((d.labels as Record<string, unknown>) ?? {})) {
    if (!isPath(k)) return `"${k}" is not an address in the menu.`;
    if (typeof v !== "string" || v.trim().length > MENU_LABEL_MAX) return `The label for ${k} must be words, ${MENU_LABEL_MAX} characters at most.`;
  }
  for (const [k, v] of Object.entries((d.groups as Record<string, unknown>) ?? {})) {
    if (typeof v !== "string" || v.trim().length > MENU_LABEL_MAX) return `The name for the "${k}" group must be words, ${MENU_LABEL_MAX} characters at most.`;
  }
  if (d.folders !== undefined && (!d.folders || typeof d.folders !== "object" || Array.isArray(d.folders))) return "Folder names come as { platform name: your name }.";
  for (const [k, v] of Object.entries((d.folders as Record<string, unknown>) ?? {})) {
    if (typeof v !== "string" || v.trim().length > MENU_LABEL_MAX) return `The name for the "${k}" folder must be words, ${MENU_LABEL_MAX} characters at most.`;
  }
  if (d.hidden !== undefined && (!Array.isArray(d.hidden) || d.hidden.some((h) => !isPath(h)))) return "Hidden entries are named by their addresses.";
  if (d.tabs !== undefined && (!Array.isArray(d.tabs) || d.tabs.length > MENU_TABS || d.tabs.some((h) => !isPath(h)))) {
    return `Choose up to ${MENU_TABS} phone tabs, by their addresses. The fifth is always More.`;
  }
  // A module entry's place, held to the menu's rules (shared/moduleMenu.ts), with the entries this document hides left out.
  return placesProblem(d.places, Array.isArray(d.hidden) ? d.hidden.filter(isPath) : []);
}
