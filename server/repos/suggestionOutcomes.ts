/**
 * WHAT BECAME OF EVERY SUGGESTION (migration 0432): one row per decision, whichever door it came
 * through (the review page, the connector's accept, a lead-approved request, suggest-to-edit,
 * canvas adopt).
 *
 * It names the CAPABILITY that decided, never the person, and holds no words and no amounts: the
 * value is a digest and an edit is a count. So erasure has nothing to find here, and nothing here
 * can leak what a steward typed.
 *
 * Two readers: the engine's context (a discard inside the window holds the same value sent again;
 * an accept is a decision later suggestions are held against), and the numbers on the review page.
 *
 * `recordOutcome` NEVER THROWS. It runs after the target's own write has landed, and a change that
 * applied must never be reported as failed because its record could not be written. A failure is
 * logged and answered `false`; the caller carries on.
 */
import { randomUUID } from "node:crypto";
import type { Pool, PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import type { StreamId } from "../../shared/suggestionPipeline/engine";

type Db = Pool | PoolConnection;

/** `other_chosen`: a person picked another option on the same card. `released`: a reconsider let through. */
export const OUTCOMES = ["accepted", "edited", "discarded", "other_chosen", "released"] as const;
export type Outcome = (typeof OUTCOMES)[number];

export interface OutcomeInput {
  /** The decision's own id, when the door has one; otherwise one is made. */
  id?: string;
  stream: StreamId;
  /** The staged row, or the stream's own id for what was decided. */
  sourceId: string;
  kind: string;
  valueDigest: string;
  keys: string[];
  proposerKind: "member" | "agent" | "integration";
  outcome: Outcome;
  fieldsEdited?: number;
  decidedByCapability: string;
  filedAt: Date | string;
  decidedAt: Date | string;
}

export type OutcomeLog = (message: string) => void;

const at = (v: Date | string) => (v instanceof Date ? v : new Date(v));

/** Record one decision. Idempotent on its id. Never throws; answers whether the row is there. */
export async function recordOutcome(db: Pick<Db, "query">, o: OutcomeInput, log: OutcomeLog = (m) => console.warn(m)): Promise<boolean> {
  try {
    const id = (o.id ?? `so_${randomUUID().replace(/-/g, "").slice(0, 24)}`).slice(0, 40);
    await db.query<ResultSetHeader>(
      "INSERT INTO suggestion_outcomes (id, stream, source_id, kind, value_digest, keys_json, proposer_kind, outcome, fields_edited, decided_by_capability, filed_at, decided_at) " +
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE id = id",
      [
        id,
        o.stream,
        o.sourceId.slice(0, 64),
        o.kind.slice(0, 32),
        o.valueDigest.slice(0, 16),
        JSON.stringify(o.keys ?? []),
        o.proposerKind,
        o.outcome,
        Math.max(0, Math.floor(o.fieldsEdited ?? 0)),
        o.decidedByCapability.slice(0, 64),
        at(o.filedAt),
        at(o.decidedAt),
      ],
    );
    return true;
  } catch (err) {
    log(`[suggestion-outcomes] a decision on ${o.stream}:${o.sourceId} was applied and its record was not written: ${(err as Error)?.message ?? err}`);
    return false;
  }
}

export interface EngineHistory {
  discarded: { keys: string[]; valueDigest: string; at: string; code: string }[];
  decisions: { keys: string[]; at: string; code: string }[];
}

const keysOf = (v: unknown): string[] => {
  try {
    const k = JSON.parse(String(v ?? "[]"));
    return Array.isArray(k) ? k.map(String) : [];
  } catch {
    return [];
  }
};

/**
 * What the engine holds suggestions against: discards decided since `sinceIso` (the window), and
 * accepts since then (a decision that landed after a suggestion arrived holds it). `code` is the
 * decision's id; the review page turns it into the change's own code when it shows the reason.
 */
export async function engineHistory(db: Db, sinceIso: string, limit = 5000): Promise<EngineHistory> {
  const [rows] = await db.query<RowDataPacket[]>(
    "SELECT id, keys_json, value_digest, outcome, decided_at FROM suggestion_outcomes WHERE decided_at >= ? AND outcome IN ('accepted','edited','discarded') ORDER BY decided_at, id LIMIT ?",
    [new Date(sinceIso), limit],
  );
  const out: EngineHistory = { discarded: [], decisions: [] };
  for (const r of rows) {
    const when = (r.decided_at instanceof Date ? r.decided_at : new Date(String(r.decided_at))).toISOString();
    const keys = keysOf(r.keys_json);
    if (r.outcome === "discarded") out.discarded.push({ keys, valueDigest: String(r.value_digest), at: when, code: String(r.id) });
    else out.decisions.push({ keys, at: when, code: String(r.id) });
  }
  return out;
}
