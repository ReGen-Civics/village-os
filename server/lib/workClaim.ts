/**
 * Work done in a module, handed in as an ordinary quest claim.
 *
 * A module that records work a village has named a quest for (a checklist run
 * completed, for one) opens a claim on that quest for the member who did it,
 * and hands it in at once. Nothing else moves here.
 *
 * NO NEW MONEY PATH. The claim is opened and submitted exactly as the board's
 * own routes do it (server/routes/quests.ts: `openClaim` under the quest's row
 * lock, then `submitOnce`), and it is consented through the existing route,
 * which already refuses a member consenting their own work. The village's
 * `quest.completed` rules price and pay it there, by the same people, through
 * the same ledger. A village with no rule for the quest pays nothing.
 *
 * THE SAME GATE FIRST. `claimRefusalFor` decides as it does for a tap on the
 * board: a closed quest, an example, a stage or role the quest asks for, age
 * and safety badges. A refusal opens nothing, and the work still stands.
 *
 * ONE LIVE CLAIM PER MEMBER PER QUEST. `openClaim` answers "already" while the
 * member holds one still waiting on a steward, so a second piece of work opens
 * nothing until the first is decided. The caller keeps its own record either way.
 *
 * THE STEWARDS ARE RUNG as the board's submit route rings them, keyed on the
 * claim. A bell that fails is logged and never undoes the claim.
 */
import crypto from "node:crypto";
import type { Pool } from "mysql2/promise";
import type { ClaimsRepo, QuestsRepo } from "../repos/quests";
import type { NotifyInput } from "./notify";
import { claimRefusalFor } from "./questClaimGate";

export interface WorkClaimDeps {
  getPool(): Pool;
  stageOf(user: any): Promise<string>;
  roleIdsFor(userId: string): string[];
  claimsRepo: Pick<ClaimsRepo, "openClaim" | "submitOnce">;
  questsRepo: Pick<QuestsRepo, "byId">;
  /** Who may consent quests, to ring. Absent: nobody is rung (the claim still waits in /review). */
  questConsentRecipients?(): Promise<string[]>;
  notify?(input: NotifyInput): Promise<unknown>;
}

export type WorkClaimOutcome =
  | { ok: true; claimId: string; questTitle: string }
  | { ok: false; reason: "no_quest" | "refused" | "already" | "gone" };

function firstName(name: string | null | undefined): string {
  return String(name ?? "").trim().split(/\s+/)[0] || "A member";
}

/** Open and hand in a claim on `questId` for `user`, with `note` as the evidence. */
export async function openSubmittedClaim(
  deps: WorkClaimDeps,
  input: { questId: string; user: { id: string; name?: string | null }; at: Date; note: string },
): Promise<WorkClaimOutcome> {
  const quest: any = await deps.questsRepo.byId(input.questId);
  if (!quest) return { ok: false, reason: "no_quest" };
  const refusal = await claimRefusalFor({ getPool: deps.getPool, stageOf: deps.stageOf, roleIdsFor: deps.roleIdsFor }, quest, input.user);
  if (refusal) return { ok: false, reason: "refused" };
  const claim = {
    id: `claim-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`,
    questId: String(quest.id),
    questTitle: String(quest.title ?? ""),
    userId: input.user.id,
    userName: String(input.user.name ?? ""),
    status: "claimed" as const,
    claimedAt: input.at.toISOString(),
    artifactUrl: "",
    note: "",
  };
  const taken = await deps.claimsRepo.openClaim(claim);
  if (!taken.ok) return { ok: false, reason: taken.reason === "already" ? "already" : "gone" };
  const moved = await deps.claimsRepo.submitOnce(claim.id, { artifactUrl: "", note: input.note, at: input.at.toISOString() });
  if (!moved.ok) return { ok: false, reason: "gone" };
  if (deps.questConsentRecipients && deps.notify) {
    try {
      for (const recipientId of await deps.questConsentRecipients()) {
        if (recipientId === input.user.id) continue;
        try {
          await deps.notify({
            userId: recipientId,
            type: "quest_submitted",
            title: `${firstName(input.user.name)} submitted work on ${claim.questTitle || "a quest"}`,
            body: "Read what they did and consent when you are ready. Value moves when a steward says so.",
            link: "/review",
            dedupeKey: `quest-submission:${claim.id}:${recipientId}`,
            actorUserId: input.user.id,
          });
        } catch (bell) {
          console.error("[work-claim] claim %s: the submission bell for %s did not send", claim.id, recipientId, bell);
        }
      }
    } catch (who) {
      console.error("[work-claim] claim %s: could not read who to ring about the submission", claim.id, who);
    }
  }
  return { ok: true, claimId: claim.id, questTitle: claim.questTitle };
}
