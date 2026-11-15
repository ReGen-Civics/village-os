/**
 * HOW FULL EACH ROLE IS (Rye, 14 Nov 2026, ruling 4): what its holders give in all against what the role
 * needs. A holder's share is the commitment in the terms they were seated on (their seat application's
 * Clocks); a holder seated with no commitment written holds the whole role, as everyone did before
 * commitments were written down. Agents and examples hold nothing here.
 *
 * Display only: a fill meter on the founding team and plain arithmetic on a decider's page. It never
 * ranks anyone and nothing that pays reads it.
 */
import type { Pool } from "mysql2/promise";
import { roleFill, type RoleFill } from "../../shared/commitmentRange";
import { readApplications } from "../repos/seatApplications";
import { listOrgAssignments } from "./orgChart";

export async function roleFillsFor(
  pool: Pool,
  roles: ReadonlyArray<{ id: string; commitmentTarget?: number | null }>,
  /** Leave this account's own seatings out: the fill WITHOUT them, for "with this application" (QA F7). */
  except?: string | null,
): Promise<Map<string, RoleFill>> {
  const ids = new Set(roles.map((r) => r.id));
  const seatings = (await listOrgAssignments(pool)).filter((s) => ids.has(s.orgRoleId) && !s.isExample && !s.isAgent && !s.endedAt && !s.lapsed && !(except && s.userId === except));
  const apps = await readApplications(pool, Array.from(new Set(seatings.map((s) => s.applicationId).filter((x): x is string => !!x))));
  const shareOf = new Map(apps.map((a) => [a.id, (a.settings as { clocks?: { commitmentPct?: unknown } } | null)?.clocks?.commitmentPct]));
  const out = new Map<string, RoleFill>();
  for (const r of roles) {
    const shares = seatings.filter((s) => s.orgRoleId === r.id).map((s) => {
      const v = s.applicationId ? shareOf.get(s.applicationId) : undefined;
      return typeof v === "number" ? v : null;
    });
    out.set(r.id, roleFill(shares, r.commitmentTarget ?? null));
  }
  return out;
}
