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
 */
import type { Express } from "express";
import type { AppDeps } from "../lib/appDeps";
import { buildMeasures, circlesLed, measuresScope, rowsInScope } from "../../shared/roleMeasures";
import { liveSeatIdsFor } from "../../shared/sessionTasks";
import { listOrgAssignments } from "../lib/orgChart";
import { applicationFacts, circleLeadSeats, circleNames, holderFacts } from "../repos/roleMeasures";

type Deps = Pick<AppDeps, "getPool" | "authedUser" | "isAdmin"> & Partial<Pick<AppDeps, "overLimit" | "lapseContext">>;

const REFUSED = { error: "Only administrators and circle leads can see this." };

export function register(app: Express, deps: Deps): void {
  const { getPool, authedUser, isAdmin, overLimit, lapseContext } = deps;
  app.get("/api/role-measures", async (req, res) => {
    const user = await authedUser(req);
    if (!user) return res.status(401).json({ error: "Sign in to see this." });
    if (overLimit && (await overLimit(`role-measures:${user.id}`, 20, 60_000))) return res.status(429).json({ error: "Slow down a little." });
    const asked = typeof req.query?.circle === "string" && req.query.circle ? String(req.query.circle) : null;
    try {
      const pool = getPool();
      const admin = await isAdmin(req);
      const led = admin ? [] : circlesLed(await circleLeadSeats(pool), liveSeatIdsFor(await listOrgAssignments(pool, lapseContext?.()), String(user.id)));
      const scope = measuresScope(admin, led);
      if (scope.kind === "none") return res.status(403).json(REFUSED);
      if (asked !== null && scope.kind === "circles" && !scope.circleIds.includes(asked)) return res.status(403).json(REFUSED);
      const [apps, holders] = await Promise.all([applicationFacts(pool), holderFacts(pool)]);
      const names = await circleNames(pool).catch(() => new Map<string, string>());
      const rows = rowsInScope(buildMeasures(apps, holders, Date.now()), scope, asked).map((r) => ({
        ...r,
        circleName: r.circleId ? (names.get(r.circleId) ?? null) : null,
      }));
      res.json({ rows, scope: scope.kind });
    } catch {
      res.status(500).json({ error: "Could not read the measures." });
    }
  });
}
