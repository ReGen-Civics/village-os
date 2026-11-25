/**
 * THE STAGING TABLE (migration 0432): every filing as it arrived, before a person sees anything.
 *
 * The engine (shared/suggestionPipeline/engine.ts) is pure. This file is the SQL around it: put a
 * filing in, read the open set back in the engine's shape, write the engine's answer, release a
 * reconsider a person let through, close a row once its card is decided, and forget a member.
 *
 * THREE RULES THIS FILE KEEPS:
 *   - `stream` and `filer` arrive from the caller, which is the server: the route the filing came
 *     in on and the signed-in principal. Nothing here reads them out of a payload.
 *   - A re-send of an OPEN filing is a no-op: `(stream, dedupe_key)` is unique and both are NOT
 *     NULL. Closing a row rewrites its `dedupe_key` to a digest of its own id, which frees the
 *     real key, so the same value sent again after a decision is a new filing that the engine's
 *     discard window then reads.
 *   - Every column is named on every INSERT with a value, never left to a DEFAULT (the house
 *     trap: a DEFAULT does not apply to a column a write names as NULL).
 */
import { randomUUID } from "node:crypto";
import type { Pool, PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { digest, valueDigestOf, type EngineResult, type HeldCode, type Staged, type StreamId } from "../../shared/suggestionPipeline/engine";
import { aimOf, keysOfAim } from "../../shared/suggestionPipeline/keys";
import type { ProposalKind } from "../../shared/proposedChanges";

type Db = Pool | PoolConnection;

export const FILER_KINDS = ["member", "agent", "integration"] as const;
export type FilerKind = (typeof FILER_KINDS)[number];

/** Where a staged row stands. `closed` is decided, and its key is free again. */
export const STAGING_STATES = ["staged", "held", "carded", "closed"] as const;
export type StagingState = (typeof STAGING_STATES)[number];

export interface StageInput {
  stream: StreamId;
  /** The stream's own id for what it filed, such as a batch item or an intake row. */
  streamRef: string;
  filer: string;
  filerKind: FilerKind;
  kind: ProposalKind;
  target: Record<string, unknown>;
  body: Record<string, unknown>;
  why?: string | null;
  evidence?: { quote: string | null; sourceRef: string | null; occurredAt: string | null } | null;
  reconsider?: { code: string; reason: string } | null;
  touchesPerson?: boolean;
  needs?: string[];
  provides?: string[];
  now: Date;
}

export interface StagedRow {
  staged: Staged;
  filerKind: FilerKind;
  state: StagingState;
  heldCode: HeldCode | null;
  heldFields: Record<string, string>;
  cardId: string | null;
  released: boolean;
}

const json = (v: unknown) => (v === undefined || v === null ? null : JSON.stringify(v));
const parse = <T>(v: unknown, fallback: T): T => {
  if (v === null || v === undefined || v === "") return fallback;
  try {
    return JSON.parse(String(v)) as T;
  } catch {
    return fallback;
  }
};
const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : new Date(String(v)).toISOString());

/** The key that makes a re-send of the same value by the same filer a no-op while it is open. */
export function dedupeKeyOf(filer: string, s: Pick<Staged, "kind" | "target" | "body">): string {
  return digest(`${filer}|${valueDigestOf(s)}`);
}

/** Put one filing in staging. A re-send of an open filing returns the row already there. */
export async function stageSuggestion(db: Db, input: StageInput): Promise<{ id: string; duplicate: boolean }> {
  const id = `sg_${randomUUID().replace(/-/g, "").slice(0, 24)}`;
  const dedupeKey = dedupeKeyOf(input.filer, input);
  const keys = keysOfAim(aimOf(input.kind, input.target, input.body));
  await db.query<ResultSetHeader>(
    "INSERT INTO suggestion_staging (id, stream, stream_ref, filer, filer_kind, kind, target_json, body_json, why, evidence_json, reconsider_json, touches_person, needs_json, provides_json, keys_json, value_digest, dedupe_key, state, held_code, held_fields_json, released_by_capability, released_at, card_id, published_change_id, received_at, updated_at) " +
      "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'staged', NULL, NULL, NULL, NULL, NULL, NULL, ?, ?) " +
      "ON DUPLICATE KEY UPDATE id = id",
    [
      id,
      input.stream,
      input.streamRef.slice(0, 64),
      input.filer.slice(0, 64),
      input.filerKind,
      input.kind,
      JSON.stringify(input.target ?? {}),
      JSON.stringify(input.body ?? {}),
      input.why ? input.why.slice(0, 1000) : null,
      json(input.evidence),
      json(input.reconsider),
      input.touchesPerson ? 1 : 0,
      json(input.needs?.length ? input.needs : null),
      json(input.provides?.length ? input.provides : null),
      JSON.stringify(keys),
      valueDigestOf(input),
      dedupeKey,
      input.now,
      input.now,
    ],
  );
  // The row that holds the key is the answer. `affectedRows` cannot tell an insert from a duplicate
  // here: mysql2 connects with CLIENT_FOUND_ROWS, so `ON DUPLICATE KEY UPDATE id = id` reports one
  // row for a duplicate too, and a re-send was once answered as new with an id never stored.
  const [rows] = await db.query<RowDataPacket[]>("SELECT id FROM suggestion_staging WHERE stream = ? AND dedupe_key = ? LIMIT 1", [input.stream, dedupeKey]);
  const held = rows[0] ? String(rows[0].id) : id;
  return { id: held, duplicate: held !== id };
}

function rowOf(r: RowDataPacket): StagedRow {
  return {
    staged: {
      id: String(r.id),
      stream: String(r.stream) as StreamId,
      filer: String(r.filer),
      kind: String(r.kind) as ProposalKind,
      target: parse(r.target_json, {}),
      body: parse(r.body_json, {}),
      receivedAt: iso(r.received_at),
      reconsider: parse(r.reconsider_json, null),
      touchesPerson: Number(r.touches_person) === 1,
      needs: parse(r.needs_json, undefined),
      provides: parse(r.provides_json, undefined),
    },
    filerKind: (FILER_KINDS as readonly string[]).includes(String(r.filer_kind)) ? (String(r.filer_kind) as FilerKind) : "agent",
    state: String(r.state) as StagingState,
    heldCode: (r.held_code ? String(r.held_code) : null) as HeldCode | null,
    heldFields: parse(r.held_fields_json, {}),
    cardId: r.card_id ? String(r.card_id) : null,
    released: r.released_at !== null && r.released_at !== undefined,
  };
}

/** Everything not yet decided, oldest first: what the engine runs over. */
export async function openStaged(db: Db, limit = 2000): Promise<StagedRow[]> {
  const [rows] = await db.query<RowDataPacket[]>(
    "SELECT * FROM suggestion_staging WHERE state IN ('staged','held','carded') ORDER BY received_at, id LIMIT ?",
    [limit],
  );
  return rows.map(rowOf);
}

/** What one stream has waiting in Held, oldest first: a person clears each one, and none lapses. */
export async function heldOf(db: Db, stream: StreamId, limit = 200): Promise<StagedRow[]> {
  const [rows] = await db.query<RowDataPacket[]>(
    "SELECT * FROM suggestion_staging WHERE state = 'held' AND stream = ? ORDER BY received_at, id LIMIT ?",
    [stream, limit],
  );
  return rows.map(rowOf);
}

/** One staged row by id, or null. */
export async function stagedById(db: Db, id: string): Promise<StagedRow | null> {
  const [rows] = await db.query<RowDataPacket[]>("SELECT * FROM suggestion_staging WHERE id = ? LIMIT 1", [id]);
  return rows[0] ? rowOf(rows[0]) : null;
}

/**
 * Write the engine's answer: each row on a card is `carded` with its card, each held row is
 * `held` with its code. Only open rows are touched, so a decision that closed a row while the
 * engine ran is never reopened. Returns how many rows changed.
 */
export async function applyEngineResult(db: Db, result: EngineResult, now: Date): Promise<number> {
  let changed = 0;
  for (const card of result.cards) {
    for (const o of card.options)
      for (const c of o.credits) {
        const [res] = await db.query<ResultSetHeader>(
          "UPDATE suggestion_staging SET state = 'carded', held_code = NULL, held_fields_json = NULL, card_id = ?, updated_at = ? " +
            "WHERE id = ? AND state IN ('staged','held','carded') AND NOT (state = 'carded' AND card_id <=> ?)",
          [card.id.slice(0, 48), now, c.stagedId, card.id.slice(0, 48)],
        );
        changed += res.affectedRows;
      }
  }
  for (const h of result.held) {
    const fields = JSON.stringify(h.fields);
    const [res] = await db.query<ResultSetHeader>(
      "UPDATE suggestion_staging SET state = 'held', held_code = ?, held_fields_json = ?, card_id = NULL, updated_at = ? " +
        "WHERE id = ? AND state IN ('staged','held','carded') AND NOT (state = 'held' AND held_code <=> ? AND held_fields_json <=> ?)",
      [h.code, fields, now, h.stagedId, h.code, fields],
    );
    changed += res.affectedRows;
  }
  return changed;
}

/**
 * A person lets a reconsider through the discard window. Only a row held for exactly that reason
 * can be released, and the record names the capability that released it, never the person.
 */
export async function releaseReconsider(db: Db, id: string, capability: string, now: Date): Promise<boolean> {
  const [res] = await db.query<ResultSetHeader>(
    "UPDATE suggestion_staging SET released_by_capability = ?, released_at = ?, updated_at = ? WHERE id = ? AND state = 'held' AND held_code = 'reconsider_waits'",
    [capability.slice(0, 64), now, now, id],
  );
  return res.affectedRows === 1;
}

/** A row's card was decided: close it and free its key, so a later re-send is a new filing. */
export async function closeStaged(db: Db, id: string, now: Date): Promise<boolean> {
  const [res] = await db.query<ResultSetHeader>(
    "UPDATE suggestion_staging SET state = 'closed', dedupe_key = ?, updated_at = ? WHERE id = ? AND state <> 'closed'",
    [digest(`closed|${id}`), now, id],
  );
  return res.affectedRows === 1;
}

/** The erasure sweep: a member's own filings leave with them, deleted. */
export async function forgetStagedOf(db: Db, userId: string): Promise<void> {
  if (!userId) return;
  await db.query("DELETE FROM suggestion_staging WHERE filer = ? AND filer_kind = 'member'", [userId]);
}
