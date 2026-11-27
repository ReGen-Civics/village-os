/**
 * `GET /api/role-measures`: how the role journey is going (L11).
 *
 * Counts and medians per season and circle. No name, no id of a person, no
 * application ref: the key set is held by `MEASURE_KEYS` and a test.
 *
 * WHO READS WHAT (the lead, 27 Nov 2026: "admin for the whole village and
 * circle leads for their circle"):
 *   - a visitor gets 401;
 *   - an administrator (the house `isAdmin` gate) reads every circle, and the
 *     rows of roles in no circle;
 *   - a member who sits in a circle's lead seat now reads that circle's rows
 *     and no other (`circlesLed` and `measuresScope` in shared/roleMeasures.ts);
 *   - anybody else gets 403 and no rows.
 * `?circle=<id>` narrows the read to one circle; asked for a circle they do
 * not lead, a lead gets 403, the same as anybody else. Writes nothing.
 *
 * The scope is decided before anything else can answer, so a member who leads
 * nothing only ever gets 403: never the rate limit's 429, and a database error
 * while their seats are read is a refusal too, never a 500 that would draw the
 * panel's error card for someone who may not see it. Only a reader the scope
 * lets in can meet the rate limit or a failed read of the measures.
 */
import type { Express } from "express";
import type { AppDeps } from "../lib/appDeps";
import { buildMeasures, circlesLed, measuresScope, rightNow, rowsInScope, type MeasuresScope } from "../../shared/roleMeasures";
import { liveSeatIdsFor } from "../../shared/sessionTasks";
import { listOrgAssignments } from "../lib/orgChart";
import { applicationFacts, circleLeadSeats, circleNames, holderFacts, startFacts } from "../repos/roleMeasures";

type Deps = Pick<AppDeps, "getPool" | "authedUser" | "isAdmin"> & Partial<Pick<AppDeps, "overLimit" | "lapseContext">>;

const REFUSED = { error: "Only administrators and circle leads can see this." };

export function register(app: Express, deps: Deps): void {
  const { getPool, authedUser, isAdmin, overLimit, lapseContext } = deps;

  /** Who this reader is to the measures. A failed seat lookup is a refusal, never an error. */
  const scopeOf = async (req: any, userId: string): Promise<MeasuresScope> => {
    const pool = getPool();
    const admin = await isAdmin(req).catch(() => false);
    let led: string[] = [];
    if (!admin) {
      try {
        led = circlesLed(await circleLeadSeats(pool), liveSeatIdsFor(await listOrgAssignments(pool, lapseContext?.()), userId));
      } catch {
        led = [];
      }
    }
    return measuresScope(admin, led);
  };

  app.get("/api/role-measures", async (req, res) => {
    const user = await authedUser(req);
    if (!user) return res.status(401).json({ error: "Sign in to see this." });
    const asked = typeof req.query?.circle === "string" && req.query.circle ? String(req.query.circle) : null;
    // A cheap gate before the seat reads, so nobody can make them run without end. It answers as a refusal (403),
    // never 429, so a member who leads nothing learns nothing from it either.
    // An admin is told plainly to slow down: they may read, so a refusal would be untrue for them.
    if (overLimit && (await overLimit(`role-measures-gate:${user.id}`, 40, 60_000))) {
      return (await isAdmin(req).catch(() => false)) ? res.status(429).json({ error: "Slow down a little." }) : res.status(403).json(REFUSED);
    }
    const scope = await scopeOf(req, String(user.id));
    if (scope.kind === "none") return res.status(403).json(REFUSED);
    if (asked !== null && scope.kind === "circles" && !scope.circleIds.includes(asked)) return res.status(403).json(REFUSED);
    if (overLimit && (await overLimit(`role-measures:${user.id}`, 20, 60_000))) return res.status(429).json({ error: "Slow down a little." });
    try {
      const pool = getPool();
      const [apps, holders, starts] = await Promise.all([applicationFacts(pool), holderFacts(pool), startFacts(pool)]);
      const names = await circleNames(pool).catch(() => new Map<string, string>());
      const now = Date.now();
      const named = <R extends { circleId: string | null }>(r: R) => ({ ...r, circleName: r.circleId ? (names.get(r.circleId) ?? null) : null });
      const rows = rowsInScope(buildMeasures(apps, holders, now, starts), scope, asked).map(named);
      const stagesNow = rowsInScope(rightNow(apps, now), scope, asked).map(named);
      // The same measures over every circle this reader may see (or the one asked for), one row per season: the
      // page's key measures. Each fact is scoped first, then counted as one circle-less whole.
      const whole = <F extends { circleId: string | null }>(facts: readonly F[]) => rowsInScope(facts, scope, asked).map((f) => ({ ...f, circleId: null }));
      const totals = buildMeasures(whole(apps), whole(holders), now, whole(starts));
      // Whether the circle asked for exists, so the page can say "no circle by that name" rather than draw zeros. A
      // failed read of the names says nothing about it, so it never reads as unknown.
      const circle = asked === null ? null : { id: asked, known: names.size === 0 || names.has(asked) };
      res.json({ rows, totals, rightNow: stagesNow, scope: scope.kind, at: new Date(now).toISOString(), circle });
    } catch {
      res.status(500).json({ error: "Could not read the measures." });
    }
  });

  /**
   * `GET /api/role-measures/scope`: may this reader open the measures, and for
   * which circles. A circle's page asks it before it offers its quiet link, so
   * the link shows only to an admin and that circle's lead. Seat lookups only;
   * no measure is read.
   */
  app.get("/api/role-measures/scope", async (req, res) => {
    const user = await authedUser(req);
    if (!user) return res.status(401).json({ error: "Sign in to see this." });
    if (overLimit && (await overLimit(`role-measures-scope:${user.id}`, 60, 60_000))) return res.status(429).json({ error: "Slow down a little." });
    const scope = await scopeOf(req, String(user.id));
    res.json(scope.kind === "circles" ? { scope: "circles", circleIds: scope.circleIds } : { scope: scope.kind });
  });
}
