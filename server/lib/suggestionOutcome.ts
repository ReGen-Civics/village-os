/**
 * WHAT A DECISION ON A PROPOSED CHANGE LEAVES BEHIND (docs/REVIEW_INBOX_PLAN.md, lane 2b).
 *
 * The review engine holds a suggestion against what was decided before it: a value discarded inside
 * the window is held if it is sent again unchanged, and a decision that landed after a suggestion
 * arrived holds that suggestion. Both read `suggestion_outcomes` (server/repos/suggestionOutcomes.ts),
 * so every door that decides a change writes one row there, through this file.
 *
 * This lane wires the connector's doors (server/routes/proposedChanges.ts): the review page's accept
 * and discard, and the full-access agent's accept and discard. The other streams' doors are wired in
 * the pull request that moves each stream through staging, so a door is never recorded twice or by
 * two shapes.
 *
 * NOT RECORDED: an agent withdrawing a change it filed itself (`discard-mine`). That is the filer
 * taking its own words back, not a person deciding, and counting it would let an agent start the
 * discard window on a suggestion no person has read.
 *
 * The row names the capability that decided, never the person: `decidedBy` below is the key the
 * decider read the review page under, or the word `admin` when an admin read it as one.
 */
import type { Pool } from "mysql2/promise";
import { valueDigestOf } from "../../shared/suggestionPipeline/engine";
import { aimOf, keysOfAim } from "../../shared/suggestionPipeline/keys";
import type { StoredChange } from "../repos/proposedChanges";
import { listDecided } from "../repos/proposedChanges";
import { recordOutcome, type Outcome, type OutcomeInput, type OutcomeLog } from "../repos/suggestionOutcomes";

/** The capability recorded on a decision made before 0432 existed: who decided was never kept by key. */
export const DECIDED_BEFORE_0432 = "before-0432";

/** The one row a decided change leaves. Its id is fixed by the change, so a second write of it is a no-op. */
export function outcomeOfChange(
  c: Pick<StoredChange, "id" | "kind" | "target" | "body" | "proposedByKind" | "createdAt">,
  outcome: Extract<Outcome, "accepted" | "edited" | "discarded">,
  fieldsEdited: number,
  decidedBy: string,
  decidedAt: Date | string,
): OutcomeInput {
  return {
    id: `pcd_${c.id}`,
    stream: "connector",
    sourceId: c.id,
    kind: c.kind,
    // What was PROPOSED, not what was accepted: the discard window compares what a stream sends again.
    valueDigest: valueDigestOf({ kind: c.kind, target: c.target, body: c.body }),
    keys: keysOfAim(aimOf(c.kind, c.target, c.body)),
    proposerKind: c.proposedByKind === "person" ? "member" : "agent",
    outcome,
    fieldsEdited,
    decidedByCapability: decidedBy,
    filedAt: c.createdAt,
    decidedAt,
  };
}

/** Record a decision on one proposed change. Never throws (see `recordOutcome`). */
export function recordChangeOutcome(
  pool: Pool,
  c: Parameters<typeof outcomeOfChange>[0],
  outcome: Extract<Outcome, "accepted" | "edited" | "discarded">,
  fieldsEdited: number,
  decidedBy: string,
  log?: OutcomeLog,
): Promise<boolean> {
  return recordOutcome(pool, outcomeOfChange(c, outcome, fieldsEdited, decidedBy, new Date()), log);
}

/** The run-once key for the backfill below. */
export const CONNECTOR_OUTCOME_BACKFILL = "suggestion-outcomes-connector-0432";

/**
 * Every change decided before this release, written as its outcome, so the discard window and the
 * recorded decisions start from what people already decided rather than from nothing.
 *
 * Idempotent by its ids, never by a ledger: each row's id is `pcd_<change id>`, the same id the live
 * doors write, and the insert keeps the row already there. An agent's withdrawal of its own change
 * (decided by its own filer) is left out, for the reason in the header. Bounded to the last 500
 * decisions, the page's own history, which reaches well past the 30-day window.
 */
export async function backfillConnectorOutcomes(pool: Pool, log?: OutcomeLog): Promise<{ written: number; skipped: number }> {
  let written = 0;
  let skipped = 0;
  for (const c of await listDecided(pool, 500)) {
    if (c.proposedByKind === "agent" && c.decidedBy && c.decidedBy === c.proposedBy && c.status === "discarded") {
      skipped++;
      continue;
    }
    const edited = Array.isArray(c.lessons) ? c.lessons.length : 0;
    const outcome = c.status === "discarded" ? "discarded" : edited ? "edited" : "accepted";
    const ok = await recordOutcome(pool, outcomeOfChange(c, outcome, edited, DECIDED_BEFORE_0432, c.decidedAt ?? c.createdAt), log);
    if (ok) written++;
    else skipped++;
  }
  return { written, skipped };
}
