/**
 * THE REVIEW QUEUE AS AN AGENT READS IT (the lead, 19 Nov 2026). Pure: no database, no Express.
 *
 * An agent that files proposals needs to see what is waiting and to confirm what became of its own. The review page's
 * own read (`GET /api/admin/proposals`) carries every body, draft and live value and the names of who decided, so
 * the connector never reads it. This is the redacted read beside it: per change, its batch, id, kind, one sentence,
 * its state, and whether the reader filed it through the connector. Nothing else leaves.
 */
import type { ProposalKind, ProposalStatus, ProposerKind } from "./proposedChanges";

export type QueueState = "waiting" | "accepted" | "discarded";

export interface QueueItem {
  id: string;
  /** The short code, such as B-27.2, as the review page shows it; null on a change not yet numbered. */
  code: string | null;
  batchId: string;
  kind: ProposalKind;
  summary: string;
  state: QueueState;
  /** It did not land when a person accepted it, or may have: a person looks at it on the review page. */
  stuck: boolean;
  /** The reader filed it through the connector or as an agent account, so they may put it aside. */
  yours: boolean;
}

/** The three states an agent reads. A change that failed, or whose outcome is unknown, still waits on a person. */
export function queueStateOf(status: ProposalStatus | "applying"): QueueState {
  if (status === "accepted") return "accepted";
  if (status === "discarded") return "discarded";
  return "waiting";
}

export function queueItemOf(
  c: { id: string; code?: string | null; batchId: string; kind: ProposalKind; summary: string; status: ProposalStatus | "applying"; proposedBy: string; proposedByKind: ProposerKind },
  readerId: string,
): QueueItem {
  return {
    id: c.id,
    code: c.code ?? null,
    batchId: c.batchId,
    kind: c.kind,
    summary: c.summary,
    state: queueStateOf(c.status),
    stuck: c.status === "failed" || c.status === "unknown" || c.status === "applying",
    yours: c.proposedByKind === "agent" && c.proposedBy === readerId,
  };
}

export const QUEUE_WORDS = {
  note: "Each change: its batch (with its code, such as B-27), its id, its code (such as B-27.2, the same code the review page shows on the card), its kind, its one sentence and its state (waiting, accepted or discarded). yours marks what you filed through the connector; you may put those aside while they wait. Accepting is a person's act on the review page.",
  termsNote: "Each role's suggested wording for each setting, the commitment it asks, and the names of the settings its offer sets. Amounts, currencies and pay shapes are never read here: a person reads them in Admin, Roles.",
  notYours: "Only a change you filed through the connector, while it waits, can be put aside here. A person puts aside the others on the review page.",
} as const;
