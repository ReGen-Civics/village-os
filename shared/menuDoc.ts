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
 *   tabs    the four phone tabs before More, by address
 *
 * ENTRIES KEEP THEIR ROUTES AND THEIR GATES. A label never changes where an
 * entry goes, and a hidden flag only ever takes an entry away: an entry a
 * member cannot reach (its module off, a role they do not hold) stays out
 * whatever the document says, and a phone tab whose page is not open to them
 * falls back to the platform's tab in that place.
 *
 * Nothing set is today's menu exactly.
 */

export const MENU_SECTION = "app-menu";
export const MENU_LABEL_MAX = 32;
export const MENU_TABS = 4;

export interface MenuDoc {
  labels: Record<string, string>;
  hidden: string[];
  groups: Record<string, string>;
  tabs: string[];
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
  const hidden = Array.isArray(d.hidden) ? Array.from(new Set(d.hidden.filter(isPath))) : [];
  const tabs = Array.isArray(d.tabs) ? d.tabs.filter(isPath).slice(0, MENU_TABS) : [];
  return { labels, hidden, groups, tabs };
}

/** True when the village changed nothing, so the menu is the platform's. */
export function menuDocIsEmpty(m: MenuDoc): boolean {
  return !Object.keys(m.labels).length && !m.hidden.length && !Object.keys(m.groups).length && !m.tabs.length;
}

/** Why the content route must refuse this document, or null. */
export function menuDocProblem(raw: unknown): string | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return "Send the menu as { labels, hidden, groups, tabs }.";
  const d = raw as Record<string, unknown>;
  for (const [k, v] of Object.entries((d.labels as Record<string, unknown>) ?? {})) {
    if (!isPath(k)) return `"${k}" is not an address in the menu.`;
    if (typeof v !== "string" || v.trim().length > MENU_LABEL_MAX) return `The label for ${k} must be words, ${MENU_LABEL_MAX} characters at most.`;
  }
  for (const [k, v] of Object.entries((d.groups as Record<string, unknown>) ?? {})) {
    if (typeof v !== "string" || v.trim().length > MENU_LABEL_MAX) return `The name for the "${k}" group must be words, ${MENU_LABEL_MAX} characters at most.`;
  }
  if (d.hidden !== undefined && (!Array.isArray(d.hidden) || d.hidden.some((h) => !isPath(h)))) return "Hidden entries are named by their addresses.";
  if (d.tabs !== undefined && (!Array.isArray(d.tabs) || d.tabs.length > MENU_TABS || d.tabs.some((h) => !isPath(h)))) {
    return `Choose up to ${MENU_TABS} phone tabs, by their addresses. The fifth is always More.`;
  }
  return null;
}
