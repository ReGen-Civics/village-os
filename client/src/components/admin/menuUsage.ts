/**
 * HOW THE MENU IS USED: the maths (an admin page, wayfinding lane, 27 Nov 2026). Pure, so it is tested on invented
 * counts; MenuUseTab.tsx draws it.
 *
 * WHAT THE COUNTS ARE. The responsive bar's per-page, per-day sums (migration 0431, server/routes/navBar.ts): a
 * signed-in member's phone or browser says once per page per session that a page was opened, with the address and
 * nothing else. So:
 *   - a count is a PAGE's, never a menu row's. A page opened from the menu, a link or a typed address counts the
 *     same, and a page with two rows (Quests is in Village and in Govern) has one count. So the rows are grouped by
 *     the page they open, and a chapter row (Leaving Well, /rights#leaving-well) is counted with its page;
 *   - visitors are never counted, and members and admins are counted together: there is no audience to split by;
 *   - counts only, never names. There is no person in the table to leave out.
 *
 * "What this suggests" is a handful of plain rules over those counts, written out below. No model is asked.
 */
import type { NavLink } from "@/config/nav";
import type { MenuPage } from "@/lib/nearestPages";

export interface PathCount {
  path: string;
  count: number;
}

/** One page the menu opens, with every row that opens it. */
export interface UsagePage {
  path: string;
  /** Every row that opens it, shown or not. */
  links: NavLink[];
  /** The rows that open it and are shown in the menu now: what it is named by. */
  shown: NavLink[];
  /** Where its shown rows sit, in menu order (a hidden row's place is never listed). */
  places: Array<{ group: string | null; folder: string | null }>;
  count: number;
  /** Its share of every visit to a page the menu lists, 0 to 1. */
  share: number;
  /** In the menu now: some row that opens it is shown (module on, story page served, not hidden). */
  live: boolean;
}

export interface Suggestion {
  rule: "too-few" | "unopened" | "lift-out" | "fold-in" | "add-entry";
  /** The page it is about, when it is about one. */
  path?: string;
  /** The numbers the sentence carries, for the page to word. */
  values: Record<string, string | number>;
}

export interface MenuUsage {
  pages: UsagePage[];
  /** Every visit to a page the menu lists. */
  total: number;
  /** Days in the window with counting on: from the later of its start and the first counted day, to today. */
  daysCounted: number;
  most: UsagePage[];
  least: UsagePage[];
  unopened: UsagePage[];
  /** Menu pages not shown in the menu now, so not judged. */
  notInMenu: UsagePage[];
  /** Pages visited that the menu does not list, most first. */
  unlisted: PathCount[];
  suggestions: Suggestion[];
}

/** Under these a window is too thin to read: a week of days, and thirty visits. */
export const MIN_DAYS = 7;
export const MIN_VISITS = 30;
/** How many of the most and least visited to show. */
export const RANK_SHOWN = 5;
/** The unopened pages named one by one before "and N more". */
export const UNOPENED_NAMED = 5;
/** The lift-out rule waits for this many visits in the group, or this many on the page (QA round 1). */
export const LIFT_FLOOR_GROUP = 30;
export const LIFT_FLOOR_PAGE = 5;

const DAY_MS = 86_400_000;
const pathOf = (href: string) => href.split("#")[0] || "/";
const dayMs = (day: string) => Date.parse(`${day}T00:00:00Z`);

/** Whole days from `from` (inclusive) to `to` (exclusive), counting none before `recordedSince` or after `today`. */
export function daysCounted(from: string, to: string, recordedSince: string | null, today: string): number {
  if (!recordedSince) return 0;
  const start = Math.max(dayMs(from), dayMs(recordedSince));
  const end = Math.min(dayMs(to), dayMs(today) + DAY_MS);
  return Math.max(0, Math.round((end - start) / DAY_MS));
}

function median(values: readonly number[]): number {
  if (!values.length) return 0;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/**
 * The window's counts against the menu. `live` is whether a row is shown in the menu now; a page none of whose rows
 * is shown is set aside, never judged.
 */
export function menuUsage(
  menu: readonly MenuPage[],
  totals: readonly PathCount[],
  {
    live,
    from,
    to,
    today,
    recordedSince,
  }: { live: (link: NavLink) => boolean; from: string; to: string; today: string; recordedSince: string | null },
): MenuUsage {
  const counts = new Map<string, number>();
  for (const t of totals) counts.set(t.path, (counts.get(t.path) ?? 0) + Math.max(0, Math.round(t.count)));

  const byPath = new Map<string, UsagePage>();
  for (const m of menu) {
    const path = pathOf(m.href);
    const page = byPath.get(path) ?? { path, links: [], shown: [], places: [], count: counts.get(path) ?? 0, share: 0, live: false };
    if (!page.links.some((l) => l.href === m.link.href && l.label === m.link.label)) page.links.push(m.link);
    if (live(m.link)) {
      page.live = true;
      if (!page.shown.some((l) => l.href === m.link.href && l.label === m.link.label)) page.shown.push(m.link);
      if (!page.places.some((p) => p.group === m.group && p.folder === m.folder)) page.places.push({ group: m.group, folder: m.folder });
    }
    byPath.set(path, page);
  }
  const pages = Array.from(byPath.values());
  const shown = pages.filter((p) => p.live);
  const total = shown.reduce((n, p) => n + p.count, 0);
  for (const p of pages) p.share = total ? p.count / total : 0;

  const opened = shown.filter((p) => p.count > 0);
  const most = [...opened].sort((a, b) => b.count - a.count || a.path.localeCompare(b.path)).slice(0, RANK_SHOWN);
  const least = [...opened]
    .sort((a, b) => a.count - b.count || a.path.localeCompare(b.path))
    .filter((p) => !most.includes(p))
    .slice(0, RANK_SHOWN);
  const unopened = shown.filter((p) => p.count === 0);
  const notInMenu = pages.filter((p) => !p.live);
  const unlisted = Array.from(counts.entries())
    .filter(([path, count]) => count > 0 && !byPath.has(path))
    .map(([path, count]) => ({ path, count }))
    .sort((a, b) => b.count - a.count || a.path.localeCompare(b.path));
  const days = daysCounted(from, to, recordedSince, today);

  return { pages, total, daysCounted: days, most, least, unopened, notInMenu, unlisted, suggestions: suggest({ shown, total, days, unopened, unlisted }) };
}

/**
 * THE RULES, in the order they are said:
 *   0. too-few     under MIN_DAYS of counting or MIN_VISITS visits, nothing else is said: the window is too thin.
 *   1. unopened    a page in the menu that nobody opened all window: consider folding it.
 *   2. lift-out    a page inside a folder that draws at least a quarter of its group's visits and twice the group's
 *                  median, once there is enough to read (LIFT_FLOOR_GROUP visits in the group, or LIFT_FLOOR_PAGE
 *                  on the page): consider giving it a row of its own. One visit is not "100% of the group".
 *   3. fold-in     a page with a row of its own whose visits are at most a quarter of its group's median (a median of
 *                  at least four): consider moving it into a folder.
 *   4. add-entry   a page the menu does not list, opened at least five times and at least as often as the median page
 *                  the menu lists: consider giving it an entry.
 */
function suggest({ shown, total, days, unopened, unlisted }: { shown: UsagePage[]; total: number; days: number; unopened: UsagePage[]; unlisted: PathCount[] }): Suggestion[] {
  if (days < MIN_DAYS || total < MIN_VISITS) return [{ rule: "too-few", values: { visits: total, days, minDays: MIN_DAYS, minVisits: MIN_VISITS } }];
  const out: Suggestion[] = [];
  for (const p of unopened.slice(0, UNOPENED_NAMED)) out.push({ rule: "unopened", path: p.path, values: {} });
  if (unopened.length > UNOPENED_NAMED) out.push({ rule: "unopened", values: { more: unopened.length - UNOPENED_NAMED } });

  const groups = new Map<string, UsagePage[]>();
  for (const p of shown) {
    const g = p.places[0]?.group ?? "";
    groups.set(g, [...(groups.get(g) ?? []), p]);
  }
  for (const [group, members] of Array.from(groups.entries())) {
    const groupTotal = members.reduce((n, p) => n + p.count, 0);
    const mid = median(members.map((p) => p.count));
    for (const p of members) {
      const folder = p.places[0]?.folder;
      const enough = groupTotal >= LIFT_FLOOR_GROUP || p.count >= LIFT_FLOOR_PAGE;
      if (folder && enough && p.count >= groupTotal / 4 && p.count >= mid * 2 && p.count > 0) {
        out.push({ rule: "lift-out", path: p.path, values: { pct: Math.round((p.count / groupTotal) * 100), group, folder } });
      } else if (!folder && mid >= 4 && p.count > 0 && p.count <= mid / 4) {
        out.push({ rule: "fold-in", path: p.path, values: { visits: p.count, group, median: mid } });
      }
    }
  }

  const mid = median(shown.map((p) => p.count));
  for (const u of unlisted) if (u.count >= 5 && u.count >= mid) out.push({ rule: "add-entry", path: u.path, values: { visits: u.count } });
  return out;
}
