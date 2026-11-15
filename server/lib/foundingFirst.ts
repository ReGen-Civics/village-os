/**
 * WHETHER AN APPLICATION'S ROLES OPEN AFTER THE FOUNDING TEAM (Rye, 14 Nov 2026).
 *
 * While `org.founding_team` features its roles, every other listed role can be
 * applied for, and its applicant is told the reply waits until the founding
 * team is in place (shared/foundingTeam.ts `opensAfterFounding`). The reply
 * promise then reads `null` instead of the village's days.
 */
import type { Pool } from "mysql2/promise";
import { foundingRoles, opensAfterFounding } from "../../shared/foundingTeam";
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

/** The reply promise for these roles: the village's days, or `null` while they open after the founding team. */
export async function replyDaysFor(pool: Pool, roleIds: readonly string[]): Promise<number | null> {
  return (await afterFounding(pool, roleIds)) ? null : numberVar("org.applicant_reply_days");
}
