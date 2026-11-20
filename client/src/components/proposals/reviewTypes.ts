/**
 * What GET /api/admin/proposals answers (server/routes/proposedChanges.ts), as the review page reads it.
 */
import type { ProposalKind } from "@shared/proposedChanges";
import type { PutBackVerdict } from "@shared/proposalPutBack";
import type { StaleBy } from "@shared/proposalConflicts";

export interface Where {
  label: string;
  href: string | null;
}

export interface Proposal {
  id: string;
  /** The short code, such as B-27.2; older servers sent none. */
  code?: string | null;
  batchId: string;
  batchCode?: string | null;
  kind: ProposalKind;
  target: Record<string, unknown>;
  targetLabel: string;
  route: { method: string; path: string };
  summary: string;
  body: Record<string, unknown>;
  draft: Record<string, unknown> | null;
  live: unknown;
  labels: Record<string, string>;
  /** Older servers sent no `where`; the page reads its absence as unknown. */
  where?: Where;
  status: "proposed" | "failed" | "unknown";
  error: string | null;
  by: string;
  byKind: "agent" | "person";
  at: string;
  /** Its place in its batch; older servers sent none. */
  position?: number;
  /** When this proposal puts an earlier change back, that change's id. */
  reverts?: string | null;
  /** Accepts made since it was proposed that wrote what it writes; older servers sent none. */
  stale?: StaleBy[];
}

export interface Batch {
  id: string;
  /** The short code, such as B-27; older servers sent none. */
  code?: string | null;
  title: string;
  by: string;
  byKind?: "agent" | "person";
  at: string;
}

export interface Decided {
  id: string;
  code?: string | null;
  batchId?: string;
  batchCode?: string | null;
  batchTitle?: string;
  kind?: ProposalKind;
  target?: Record<string, unknown>;
  targetLabel: string;
  route?: { method: string; path: string };
  summary: string;
  body?: Record<string, unknown>;
  accepted?: Record<string, unknown> | null;
  labels?: Record<string, string>;
  where?: Where;
  status: string;
  error?: string | null;
  proposedBy?: string;
  proposedByKind?: "agent" | "person";
  proposedAt?: string;
  by: string;
  at: string | null;
  edited: number;
  reverts?: string | null;
  /** Whether "Propose putting it back" is offered; older servers sent nothing, which reads as not kept. */
  putBack?: PutBackVerdict;
}

export interface ReviewPayload {
  timezone?: string;
  batches: Batch[];
  changes: Proposal[];
  decided: Decided[];
}

export interface Problem {
  error: string;
  field: string | null;
}
