/**
 * What GET /api/admin/proposals answers (server/routes/proposedChanges.ts), as the review page reads it.
 */
import type { ProposalKind } from "@shared/proposedChanges";
import type { PutBackVerdict } from "@shared/proposalPutBack";

export interface Where {
  label: string;
  href: string | null;
}

export interface Proposal {
  id: string;
  batchId: string;
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
  /** When this proposal puts an earlier change back, that change's id. */
  reverts?: string | null;
}

export interface Batch {
  id: string;
  title: string;
  by: string;
  byKind?: "agent" | "person";
  at: string;
}

export interface Decided {
  id: string;
  batchId?: string;
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
