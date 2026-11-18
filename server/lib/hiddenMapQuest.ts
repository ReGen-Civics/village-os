/**
 * A return visit on the hidden map, opening a claim on the quest the village
 * named for it (`returnVisitQuestId` in the module's settings).
 *
 * NO NEW MONEY PATH. The visit only opens and submits an ordinary claim. It is
 * completed by the existing consent route, which already refuses a member
 * consenting their own work, and the village's `quest.completed` rule prices
 * and pays it there. So a visit is paid exactly as any quest is, by the same
 * people, through the same ledger.
 *
 * The claim names a visit and a day, never a place: the people who consent
 * quests are not necessarily people whose map has opened.
 *
 * The quest's own claim gate runs first (`claimRefusalFor`: closed quests,
 * stage, role, safety), and `openClaim` takes the quest's row lock, so a member
 * holding an open claim on it gets no second one until that one is decided.
 */
import crypto from "node:crypto";
import type { Pool } from "mysql2/promise";
import type { ClaimsRepo, QuestsRepo } from "../repos/quests";
import { claimRefusalFor } from "./questClaimGate";

export interface VisitClaimDeps {
  getPool(): Pool;
  stageOf(user: any): Promise<string>;
  roleIdsFor(userId: string): string[];
  claimsRepo: Pick<ClaimsRepo, "openClaim" | "submitOnce">;
  questsRepo: Pick<QuestsRepo, "byId">;
}

/** The claim's words. A day, and nothing about where. */
export function visitClaimNote(at: Date): string {
  return `A return visit, logged on ${at.toISOString().slice(0, 10)}.`;
}

/** A planting's claim words, once it is vouched. A day, and nothing about where. */
export function plantingClaimNote(at: Date): string {
  return `A planting, vouched on ${at.toISOString().slice(0, 10)}.`;
}

/**
 * Open and submit a claim for this visit. Null when the quest is gone, refuses
 * this member, or they already hold an open claim on it: the visit still
 * stands, it just opens nothing this time.
 */
export async function openVisitClaim(
  deps: VisitClaimDeps,
  input: { questId: string; user: { id: string; name?: string | null }; at: Date; note?: string },
): Promise<string | null> {
  const quest: any = await deps.questsRepo.byId(input.questId);
  if (!quest) return null;
  const refusal = await claimRefusalFor({ getPool: deps.getPool, stageOf: deps.stageOf, roleIdsFor: deps.roleIdsFor }, quest, input.user);
  if (refusal) return null;
  const claim = {
    id: `claim-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`,
    questId: quest.id,
    questTitle: quest.title,
    userId: input.user.id,
    userName: input.user.name ?? "",
    status: "claimed" as const,
    claimedAt: input.at.toISOString(),
    artifactUrl: "",
    note: "",
  };
  // Each claim stands for a different planting or visit, so a decided claim does not
  // block the next: only one still open does (QA pass 1 final, P1-r-1).
  const taken = await deps.claimsRepo.openClaim(claim as any, { whileOpenOnly: true });
  if (!taken.ok) return null;
  await deps.claimsRepo.submitOnce(claim.id, { artifactUrl: "", note: input.note ?? visitClaimNote(input.at), at: input.at.toISOString() });
  return claim.id;
}
