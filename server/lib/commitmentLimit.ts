/**
 * THE COMMITMENT LIMIT AT THE ADOPT DOORS (the lead, 20 Nov 2026). The rule is shared/commitmentLimit.ts; the count is
 * `seatsWithoutRoom` (server/lib/seatApplicationCloser.ts), which marks a role full by its limit with `limit`.
 *
 * Both adopt doors (a stranger's open proposal, a member's application) answer a role above its limit the same way:
 * 409 `over_limit` with the lead's question and the numbers, until the person who may adopt sends
 * `confirmOverLimit: true`. Then the choice is stamped on the proposal and written to the audit by the door.
 */
import type { Pool } from "mysql2/promise";
import { OVER_LIMIT_WORDS, overLimitAudit, type OverLimitRole } from "../../shared/commitmentLimit";
import { recordEvent } from "./events";
import type { FullSeat } from "./seatApplicationCloser";

/** The roles a room check found above their commitment limit. */
export function overLimitRoles(full: readonly FullSeat[]): OverLimitRole[] {
  return full.filter((f) => f.limit && !f.limit.byPlaces).map((f) => ({ roleId: f.id, name: f.name, used: f.limit!.used, adding: f.limit!.adding, target: f.limit!.target }));
}

/** The refusal an adopt door sends until the person confirms. */
export function overLimitRefusal(over: readonly OverLimitRole[]) {
  return {
    error: "over_limit",
    message: OVER_LIMIT_WORDS.ask,
    overLimit: over.map((o) => ({ ...o, words: OVER_LIMIT_WORDS.role(o.name, o.used, o.adding, o.target) })),
    canContinueAboveTheLimit: true,
  };
}

/** Write each choice to go above a role's limit to the admin audit (recordEvent, admin audience): the role and the numbers, never the person. */
export async function auditOverLimit(pool: Pool, ref: string, entityType: "open_proposal" | "role_application", over: readonly OverLimitRole[], actorUserId: string): Promise<void> {
  for (const o of over) await recordEvent(pool, { kind: "audit", text: overLimitAudit(ref, o), actorUserId, entityType, entityRef: ref, audience: "admin" });
}
