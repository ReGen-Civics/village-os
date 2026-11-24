/**
 * WHERE A PARTNER PROPOSAL GOES (the lead, 23 Nov 2026: "routed to the role that holds the partnerships domain").
 *
 * The role is the village's to name, by id, in `org.partnerships_role` (shared/contributorRoutes.ts), the same
 * shape as `org.onboarding_role`: no role name is typed in platform code. Its live member holders get the
 * submission email. With no role named, or nobody holding it, or no address on file for any holder, it goes
 * to the fallback the caller gives (the business inbox), so a proposal is never sent to nobody.
 *
 * The proposal itself is a `partner` row in the submissions table, through POST /api/forms/submit, with that
 * route's honeypot and per-IP limit. Nothing here stores anything.
 */
import type { Pool } from "mysql2/promise";
import { liveHolderIds } from "../repos/roleAccess";

export interface PartnerRoutingDeps {
  pool: Pool;
  /** The role id the village named, or blank. */
  roleId: string;
  /** A member's address, or null. */
  emailOf: (userId: string) => Promise<string | null>;
  /** Where it goes when the role reaches nobody. */
  fallback: () => string[];
  /** Overridable in tests: the role's live member holders. */
  holdersOf?: (pool: Pool, roleId: string) => Promise<string[]>;
}

const ADDRESS = /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/;

export async function partnerRecipients(deps: PartnerRoutingDeps): Promise<string[]> {
  const roleId = deps.roleId.trim();
  if (roleId) {
    const holders = await (deps.holdersOf ?? liveHolderIds)(deps.pool, roleId);
    const out = new Set<string>();
    for (const id of holders) {
      const email = String((await deps.emailOf(id)) ?? "").trim();
      if (ADDRESS.test(email)) out.add(email);
    }
    if (out.size > 0) return Array.from(out);
  }
  return deps.fallback();
}
