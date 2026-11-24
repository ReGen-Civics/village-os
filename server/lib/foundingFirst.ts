/**
 * WHETHER AN APPLICATION'S ROLES OPEN AFTER THE FOUNDING TEAM (Rye, 14 Nov 2026).
 *
 * While `org.founding_team` features its roles, every other listed role can be
 * applied for, and its applicant is told the reply waits until the founding
 * team is in place (shared/foundingTeam.ts `opensAfterFounding`). The reply
 * promise then reads `null` instead of the village's moon cycles.
 */
import type { Pool } from "mysql2/promise";
import { foundingRoles, opensAfterFounding } from "../../shared/foundingTeam";
import { CONTRIBUTOR_REPLY_DAYS_VARIABLE, REPLY_WINDOW_MOONS_VARIABLE, effectiveReplyMoons } from "../../shared/contributorRoutes";
import { listOrgRoles, type OrgRole } from "./orgChart";
import { boolVar, numberVar, stringVar } from "./variables";

/** The founding team's role ids, in the setting's order. Empty while the section is off. */
export function foundingIdsOf(roles: readonly OrgRole[]): string[] {
  return foundingRoles(boolVar("org.founding_team"), stringVar("org.founding_team_roles"), roles).map((r) => r.id);
}

/** True when the founding team is featured and none of these roles is in it. */
export async function afterFounding(pool: Pool, roleIds: readonly string[]): Promise<boolean> {
  if (!boolVar("org.founding_team") || roleIds.length === 0) return false;
  return opensAfterFounding(foundingIdsOf(await listOrgRoles(pool)), roleIds);
}

/**
 * The window every proposer is told, in moon cycles (the lead, 24 Nov 2026): `org.reply_window_moons`, never fewer
 * cycles than the days a village set in `org.applicant_reply_days` (shared/contributorRoutes.ts effectiveReplyMoons).
 */
export function replyMoonsNow(): number {
  return effectiveReplyMoons(numberVar(REPLY_WINDOW_MOONS_VARIABLE), numberVar(CONTRIBUTOR_REPLY_DAYS_VARIABLE));
}

/** The reply promise for these roles: the village's moon cycles, or `null` while they open after the founding team. */
export async function replyMoonsFor(pool: Pool, roleIds: readonly string[]): Promise<number | null> {
  return (await afterFounding(pool, roleIds)) ? null : replyMoonsNow();
}
