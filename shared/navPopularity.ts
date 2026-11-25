/**
 * THE RESPONSIVE BOTTOM BAR, the choosing (the lead, 24 Nov 2026: "a responsive
 * menu that not only is the most popular pages across the whole site, but one
 * of them might be reserved for the most popular page for that user").
 *
 * Pure functions, shared by the server (the site-wide pages) and the phone (the
 * personal slot), so both choose the same way and both are tested here.
 *
 * The bar's fixed places are never chosen: Home first, the member's path (the
 * lead, 24 Nov 2026: the path slot is never displaced by popularity) and More
 * last. Only the places between move: MOVING_PLACES of them.
 *
 * PRIVACY. The site-wide choice reads aggregate counts only, one number per
 * page per day with no person in it (server/repos/navVisits.ts). The personal
 * slot is chosen on the device from the device's own history and never leaves
 * it (client/src/lib/navVisits.ts).
 */

export const HOME_PATH = "/";
/** The path slot's page (fixed on the bar, never counted or chosen). */
export const PATH_PATH = "/path";
/** How many places on the bar the responsive choice fills. */
export const MOVING_PLACES = 2;

export interface PathCount {
  path: string;
  count: number;
}

export interface SiteBarOptions {
  /** How many site-wide places (pins included), at most MOVING_PLACES. */
  slots: number;
  /** A newcomer must beat the page it would replace by this many percent. */
  marginPct: number;
  /** Pages an admin keeps on the bar, in order. They take slots first. */
  pinned: readonly string[];
  /** Pages an admin keeps off the bar. */
  excluded: readonly string[];
}

/** A comma- or line-separated list of addresses from a dial, cleaned. */
export function pathList(raw: unknown): string[] {
  return String(raw ?? "")
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter((s) => /^\/[\w\-/]*$/.test(s))
    .map((s) => s.replace(/\/$/, "") || HOME_PATH);
}

/**
 * The site-wide pages, stable on purpose: the pages already on the bar keep
 * their places unless a page not on it beats the weakest of them by the
 * margin, so the bar does not reshuffle on small differences. Pins come first
 * and never move; excluded pages and Home never appear.
 */
export function chooseSiteBar(counts: readonly PathCount[], current: readonly string[] | null, opts: SiteBarOptions): string[] {
  const slots = Math.min(MOVING_PLACES, Math.max(0, Math.floor(opts.slots)));
  const off = new Set([HOME_PATH, PATH_PATH, ...opts.excluded]);
  const pins = opts.pinned.filter((p, i, a) => !off.has(p) && a.indexOf(p) === i).slice(0, slots);
  const free = slots - pins.length;
  const countOf = new Map<string, number>();
  for (const c of counts) if (!off.has(c.path) && c.count > 0) countOf.set(c.path, (countOf.get(c.path) ?? 0) + c.count);
  const ranked = Array.from(countOf.entries()).filter(([p]) => !pins.includes(p)).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

  // Start from the bar as it stands, keeping only pages still allowed.
  const held = (current ?? []).filter((p, i, a) => !off.has(p) && !pins.includes(p) && a.indexOf(p) === i).slice(0, free);
  // Fill any empty place with the best page not yet held.
  for (const [p] of ranked) {
    if (held.length >= free) break;
    if (!held.includes(p)) held.push(p);
  }
  // Swap the weakest held page for a clearly better newcomer, one at a time.
  const factor = 1 + Math.max(0, opts.marginPct) / 100;
  for (const [p, n] of ranked) {
    if (held.includes(p) || held.length === 0) continue;
    let weakest = 0;
    for (let i = 1; i < held.length; i++) if ((countOf.get(held[i]) ?? 0) < (countOf.get(held[weakest]) ?? 0)) weakest = i;
    if (n >= (countOf.get(held[weakest]) ?? 0) * factor && n > (countOf.get(held[weakest]) ?? 0)) held[weakest] = p;
  }
  return [...pins, ...held];
}

/** A day's key in the device's own calendar, "YYYY-MM-DD". */
export function dayKey(at: Date): string {
  const y = at.getFullYear();
  const m = String(at.getMonth() + 1).padStart(2, "0");
  const d = String(at.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * The personal slot: the page this person visits most that is not already on
 * the bar, from the device's own counts. Null when there is none, and the bar
 * then gives the place to the next site-wide page.
 */
export function choosePersonal(history: Readonly<Record<string, number>>, bar: readonly string[], excluded: readonly string[]): string | null {
  const off = new Set([HOME_PATH, PATH_PATH, ...bar, ...excluded]);
  let best: string | null = null;
  let bestN = 0;
  for (const [p, n] of Object.entries(history)) {
    if (off.has(p) || !(n > 0)) continue;
    if (n > bestN || (n === bestN && best !== null && p < best)) {
      best = p;
      bestN = n;
    }
  }
  return best;
}

/**
 * The bar's moving places, in order: the village's pages, and the personal one
 * (when there is one) reserved as the last of them. Fixed places never appear.
 */
export function barTabs(siteWide: readonly string[], personal: string | null): string[] {
  const village = siteWide.filter((p, i, a) => p !== HOME_PATH && p !== PATH_PATH && a.indexOf(p) === i);
  if (!personal || village.includes(personal) || personal === HOME_PATH || personal === PATH_PATH) return village.slice(0, MOVING_PLACES);
  return [...village.slice(0, MOVING_PLACES - 1), personal];
}
