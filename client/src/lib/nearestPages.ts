/**
 * THE NEAREST REAL PAGES to an address that has none (the helpful not-found page, wayfinding lane, 27 Nov 2026).
 *
 * An unknown address is usually a near miss: a typo (`/quets`), an old word (`/calendar` for Events), or a page
 * that moved. So the words of the address are matched, typo-tolerant, against every menu entry's names: its label
 * as the reader sees it, its platform label, the page's name in shared/pageTitles.ts, and the words of its own
 * address. The best few are offered, each with the menu group it lives in.
 *
 * ONLY THE MENU'S PAGES, and only those the reader may open. A page reaches the list through the menu entries
 * (config/nav.ts), and the caller hands in the same `visible` test the menu draws with (lib/menuVisible.ts), so a
 * page the reader's menu would hide (a module that is off, a role they do not hold, a member's working area for a
 * newcomer) is never suggested. A page named only in pageTitles has no gate this file can read, so its name helps a
 * menu entry at the same address match and is never offered on its own.
 *
 * Pure: no React, no i18n. The caller passes words already in the reader's language.
 */
import { ACCOUNT_MENU, NAV, isGroup, type NavEntry, type NavLink } from "@/config/nav";
import { PAGE_TITLES } from "@shared/pageTitles";

/** One page a reader could have meant, with where it sits in the menu. */
export interface MenuPage {
  href: string;
  link: NavLink;
  /** The group's platform label ("Village"), or null for the account menu. */
  group: string | null;
  /** The folder inside the group (`sub`), when it has one. */
  folder: string | null;
}

export interface NearPage extends MenuPage {
  score: number;
  /** Every place in the menu this page sits, first one first (Quests is in Village and in Govern). */
  places: Array<{ group: string | null; folder: string | null }>;
}

/** Every page the menu can draw, in menu order, the account menu last. */
export function menuPages(nav: readonly NavEntry[] = NAV, account: readonly NavLink[] = ACCOUNT_MENU): MenuPage[] {
  const out: MenuPage[] = [];
  for (const e of nav) {
    if (isGroup(e)) for (const link of e.items) out.push({ href: link.href, link, group: e.label, folder: link.sub ?? null });
    else out.push({ href: e.href, link: e, group: null, folder: e.sub ?? null });
  }
  for (const link of account) out.push({ href: link.href, link, group: null, folder: link.sub ?? null });
  return out;
}

/**
 * Words an address or a name carries, lower case, accents off. Ids and numbers carry no meaning to match, and nor does
 * "village": half the pages are the village's something, so it would tie every one of them.
 */
const FILLER = new Set(["the", "a", "an", "of", "and", "my", "your", "our", "to", "in", "on", "for", "we", "us", "page", "village"]);
export function wordsOf(text: string): string[] {
  let raw = text;
  try {
    raw = decodeURIComponent(text);
  } catch {
    /* a malformed escape: read it as typed */
  }
  return raw
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 1 && !FILLER.has(w) && !/^\d+$/.test(w) && !/^[0-9a-f]{8,}$/.test(w));
}

/** Edit distance with one swap of neighbours counted as one edit (optimal string alignment). */
export function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  const m = a.length;
  const n = b.length;
  if (!m) return n;
  if (!n) return m;
  let prev2: number[] = [];
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, prev2[j - 2] + 1);
      cur.push(v);
    }
    prev2 = prev;
    prev = cur;
  }
  return prev[n];
}

/** How well one typed word matches one word of a page's names, 0 to 1. */
export function wordMatch(typed: string, word: string): number {
  if (typed === word) return 1;
  const short = Math.min(typed.length, word.length);
  const longest = Math.max(typed.length, word.length);
  // A word begun ("treas" for treasury), or a word with a little more on its end ("quests" for quest). A long tail
  // is another word: "feedbak" is not the feed.
  const begun = word.startsWith(typed) || (typed.startsWith(word) && typed.length - word.length <= 2);
  if (short >= 3 && begun) return 0.6 + 0.3 * (short / longest);
  if (short < 3) return 0;
  const allowed = longest <= 5 ? 1 : longest <= 9 ? 2 : 3;
  const d = editDistance(typed, word);
  if (d > allowed) return 0;
  return (0.8 - (d - 1) * 0.25) * (1 - 0.1 * (d / longest));
}

/** The words a page answers to: what the reader sees, the platform's word, its title, its addresses. */
export function namesOf(page: MenuPage, shownLabel?: string, titles: Readonly<Record<string, string>> = PAGE_TITLES): string[] {
  const path = page.href.split("#")[0];
  const anchor = page.href.includes("#") ? page.href.slice(page.href.indexOf("#") + 1) : "";
  const parts = [shownLabel ?? "", page.link.label, titles[path] ?? "", path, anchor, page.link.story ?? "", page.link.story ? titles[page.link.story] ?? "" : ""];
  // A chapter answers to its own names, never to the page it sits on: "Rights and agreements" is not Leaving Well.
  if (anchor) parts[2] = parts[3] = "";
  return Array.from(new Set(parts.flatMap(wordsOf)));
}

/**
 * A typed address against one page: each typed word's best match, weighted by the word's length so the long words
 * that carry the meaning count most, with a little for the single best word, so `/roles/apply` still finds Roles.
 */
export function scorePage(typed: readonly string[], names: readonly string[]): number {
  if (!typed.length || !names.length) return 0;
  let weighted = 0;
  let weight = 0;
  let best = 0;
  for (const w of typed) {
    const m = Math.max(0, ...names.map((n) => wordMatch(w, n)));
    weighted += m * w.length;
    weight += w.length;
    best = Math.max(best, m);
  }
  return 0.75 * (weighted / weight) + 0.25 * best;
}

/** Below this a guess is noise, and the page offers home and search alone. */
export const NEAR_ENOUGH = 0.6;

/**
 * The pages the reader most likely meant by `location`, best first, at most `limit`. `visible` is the menu's own
 * test for this reader, so nothing they may not open is offered; `label` gives each entry's name as the reader's menu
 * draws it. A page in two places in the menu is offered once, with both places.
 */
export function nearestPages(
  location: string,
  {
    visible,
    label = (l) => l.label,
    pages = menuPages(),
    titles = PAGE_TITLES,
    limit = 3,
  }: {
    visible: (link: NavLink) => boolean;
    label?: (link: NavLink) => string;
    pages?: readonly MenuPage[];
    titles?: Readonly<Record<string, string>>;
    limit?: number;
  },
): NearPage[] {
  const here = location.split(/[?#]/)[0].replace(/\/+$/, "") || "/";
  const typed = wordsOf(here);
  if (!typed.length) return [];
  const byHref = new Map<string, NearPage>();
  for (const page of pages) {
    if (!visible(page.link)) continue;
    if (page.href.split("#")[0] === here && !page.href.includes("#")) continue; // the page that just refused them
    const score = scorePage(typed, namesOf(page, label(page.link), titles));
    const seen = byHref.get(page.href);
    if (seen) {
      seen.places.push({ group: page.group, folder: page.folder });
      seen.score = Math.max(seen.score, score);
      continue;
    }
    byHref.set(page.href, { ...page, score, places: [{ group: page.group, folder: page.folder }] });
  }
  return Array.from(byHref.values())
    .filter((p) => p.score >= NEAR_ENOUGH)
    .sort((a, b) => b.score - a.score || a.href.length - b.href.length)
    .slice(0, limit);
}
