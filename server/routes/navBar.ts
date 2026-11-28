/**
 * THE RESPONSIVE BOTTOM BAR's two routes (the lead, 24 Nov 2026).
 *
 *   POST /api/nav/visit   { path }   a signed-in member's phone says a page was visited
 *   GET  /api/nav/bar                the bar's settings and the village's most visited pages
 *   GET  /api/admin/nav/usage        an admin's read of the same counts over a window of days (How the menu is
 *                                    used, wayfinding lane, 27 Nov 2026): pages and counts, never a person
 *
 * PRIVACY IS THE DESIGN LINE. The visit route counts the page and nothing else:
 * no member id, session, address or device is written or logged
 * (migration 0431, server/repos/navVisits.ts). The phone sends at most one
 * visit per page per session, and only for a fixed address the client draws,
 * so an address carrying an id (a person's profile, a role) is never counted.
 * The personal place is chosen on the phone (client/src/lib/navVisits.ts).
 *
 * STABILITY. The village's pages are worked out again at most every
 * `nav.refresh_days`, lazily on the first read after that, from the visits of
 * the four periods before; a page replaces one on the bar only when it leads by
 * `nav.swap_margin_pct` (shared/navPopularity.ts). The chosen set is kept as an
 * app_config document, so every member's bar agrees between recomputes.
 */
import type { Express, Request } from "express";
import type { Pool } from "mysql2/promise";
import { chooseSiteBar, MOVING_PLACES, PATH_PATH, pathList, type PathCount } from "../../shared/navPopularity";

export interface NavBarDeps {
  getPool(): Pool;
  authedUser(req: Request): Promise<unknown | null>;
  overLimit(key: string, max: number, windowMs: number): Promise<boolean>;
  connectionKey(req: Request): string;
  /** The fixed (parameter-free) addresses the client draws, from the build's route list. */
  fixedRoutes(): ReadonlySet<string>;
  boolVar(key: string): boolean;
  numberVar(key: string): number;
  stringVar(key: string): string;
  countVisit(pool: Pool, day: string, path: string): Promise<void>;
  visitTotals(pool: Pool, sinceDay: string): Promise<PathCount[]>;
  readDoc(pool: Pool, key: string): Promise<Record<string, unknown> | null>;
  isAdmin(req: Request): Promise<boolean>;
  visitTotalsBetween(pool: Pool, fromDay: string, untilDay: string): Promise<PathCount[]>;
  firstVisitDay(pool: Pool): Promise<string | null>;
  writeDoc(pool: Pool, key: string, doc: Record<string, unknown>): Promise<void>;
  now(): Date;
}

/** The app_config document that holds the village's current bar. */
export const NAV_BAR_DOC = "nav-bar";
const DAY_MS = 86_400_000;
/** Visits a phone may send in an hour, per connection: one per page per session keeps a member far under it. */
const VISITS_PER_HOUR = 300;

const utcDay = (at: Date) => at.toISOString().slice(0, 10);

/** A visited address, cleaned to the form the bar uses: no query, no hash, no trailing slash. */
export function cleanPath(raw: unknown): string | null {
  if (typeof raw !== "string" || raw.length > 191) return null;
  const p = raw.split(/[?#]/)[0].replace(/\/$/, "") || "/";
  return /^\/[\w\-/]*$/.test(p) ? p : null;
}

const DAY_SHAPE = /^\d{4}-\d{2}-\d{2}$/;
/** The widest window one read may ask for: a long season and change. */
const USAGE_MAX_DAYS = 400;
/** The window when none is asked for. */
const USAGE_DEFAULT_DAYS = 90;

/** A "YYYY-MM-DD" that names a real day, or null. */
export function dayParam(raw: unknown): string | null {
  if (typeof raw !== "string" || !DAY_SHAPE.test(raw)) return null;
  const at = Date.parse(`${raw}T00:00:00Z`);
  return Number.isNaN(at) || utcDay(new Date(at)) !== raw ? null : raw;
}

export function register(app: Express, d: NavBarDeps): void {
  app.post("/api/nav/visit", async (req, res) => {
    if (!(await d.authedUser(req))) return res.status(401).json({ error: "auth_required" });
    if (await d.overLimit(`nav-visit:${d.connectionKey(req)}`, VISITS_PER_HOUR, 3_600_000)) return res.status(204).end();
    const path = cleanPath(req.body?.path);
    // Only a fixed address the client draws, and never a fixed place (Home, the path).
    if (!path || path === "/" || path === PATH_PATH || !d.fixedRoutes().has(path)) return res.status(204).end();
    try {
      await d.countVisit(d.getPool(), utcDay(d.now()), path);
    } catch {
      /* a missed count is not the member's problem */
    }
    return res.status(204).end();
  });

  app.get("/api/nav/bar", async (req, res) => {
    res.setHeader("Cache-Control", "private, no-store");
    const off = { on: false, siteWide: [] as string[], personal: false, excluded: [] as string[] };
    if (!d.boolVar("nav.responsive_bar") || !(await d.authedUser(req))) return res.json(off);
    const slots = Math.min(MOVING_PLACES, Math.max(1, d.numberVar("nav.popular_slots")));
    const refreshDays = Math.min(90, Math.max(1, d.numberVar("nav.refresh_days")));
    const pinned = pathList(d.stringVar("nav.pinned"));
    const excluded = pathList(d.stringVar("nav.excluded"));
    const settings = { slots, marginPct: d.numberVar("nav.swap_margin_pct"), pinned, excluded };
    const pool = d.getPool();
    try {
      const doc = await d.readDoc(pool, NAV_BAR_DOC);
      const kept = Array.isArray(doc?.paths) ? (doc!.paths as unknown[]).filter((p): p is string => typeof p === "string") : null;
      const at = typeof doc?.computedAt === "string" ? Date.parse(doc.computedAt) : NaN;
      // The settings it was chosen under: a changed pin, exclusion or slot count is answered at once.
      const same = JSON.stringify(doc?.settings ?? null) === JSON.stringify(settings);
      let siteWide = kept;
      if (!kept || !same || !(d.now().getTime() - at < refreshDays * DAY_MS)) {
        const since = utcDay(new Date(d.now().getTime() - 4 * refreshDays * DAY_MS));
        siteWide = chooseSiteBar(await d.visitTotals(pool, since), kept, settings);
        await d.writeDoc(pool, NAV_BAR_DOC, { paths: siteWide, computedAt: d.now().toISOString(), settings });
      }
      return res.json({ on: true, siteWide, personal: d.boolVar("nav.personal_slot"), excluded });
    } catch {
      // The bar is a convenience: on any trouble the phone keeps the fixed bar.
      return res.json(off);
    }
  });

  /*
   * HOW THE MENU IS USED (an admin's page, wayfinding lane). The same per-page, per-day sums the bar reads, over the
   * window the admin picks (a season's days): `from` inclusive, `to` exclusive. Counts only: the table holds no person,
   * so there is none to leave out. What the counts cannot say is said in the answer itself: visits are signed-in only
   * (a visitor is never counted), members and admins are counted together, and a page reached from the menu, a link
   * or a typed address counts the same.
   */
  app.get("/api/admin/nav/usage", async (req, res) => {
    res.setHeader("Cache-Control", "private, no-store");
    if (!(await d.isAdmin(req))) return res.status(401).json({ error: "auth_required" });
    const today = utcDay(d.now());
    const to = req.query.to === undefined ? utcDay(new Date(d.now().getTime() + DAY_MS)) : dayParam(req.query.to);
    const from = req.query.from === undefined && to ? utcDay(new Date(Date.parse(`${to}T00:00:00Z`) - USAGE_DEFAULT_DAYS * DAY_MS)) : dayParam(req.query.from);
    if (!from || !to) return res.status(400).json({ error: "bad_window", message: "Ask for days as YYYY-MM-DD." });
    if (from >= to) return res.status(400).json({ error: "bad_window", message: "The window has to end after it starts." });
    if ((Date.parse(to) - Date.parse(from)) / DAY_MS > USAGE_MAX_DAYS) return res.status(400).json({ error: "bad_window", message: `Ask for ${USAGE_MAX_DAYS} days at most.` });
    try {
      const pool = d.getPool();
      const [totals, recordedSince] = await Promise.all([d.visitTotalsBetween(pool, from, to), d.firstVisitDay(pool)]);
      return res.json({
        from,
        to,
        today,
        recordedSince,
        totals,
        counted: { signedInOnly: true, byAudience: false, perPage: true },
      });
    } catch {
      return res.status(503).json({ error: "unavailable", message: "The visit counts could not be read just now." });
    }
  });
}
