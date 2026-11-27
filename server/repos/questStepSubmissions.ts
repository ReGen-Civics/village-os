/**
 * WHAT A MEMBER GAVE FOR ONE STEP OF A QUEST (0439; the lead, 27 Nov 2026).
 *
 * A row is one piece of one step of one claim: a few words, a photo or a
 * document. A file lives on the uploads volume and only its stamped name is
 * here, so the uploads sweep reads it as referenced and keeps it.
 *
 * Every read is keyed on the claim, because a step's evidence belongs to the
 * work in hand and not to the quest: two members on one quest each have their
 * own. `user_id` rides along so a member's rows can be found in one read when
 * they leave (server/lib/erasure.ts).
 */
import type { Pool, ResultSetHeader, RowDataPacket } from "mysql2/promise";

export const STEP_SUBMISSION_KINDS = ["text", "photo", "document"] as const;
export type StepSubmissionKind = (typeof STEP_SUBMISSION_KINDS)[number];

export function isStepSubmissionKind(v: unknown): v is StepSubmissionKind {
  return (STEP_SUBMISSION_KINDS as readonly unknown[]).includes(v);
}

export interface StepSubmission {
  id: string;
  claimId: string;
  questId: string;
  userId: string;
  stepIndex: number;
  kind: StepSubmissionKind;
  body: string | null;
  fileName: string | null;
  originalName: string | null;
  createdAt: string | null;
}

const SELECT =
  "SELECT id, claim_id, quest_id, user_id, step_index, kind, body, file_name, original_name, created_at FROM quest_step_submissions";

function toIso(v: unknown): string | null {
  if (v == null) return null;
  const d = v instanceof Date ? v : new Date(String(v));
  return Number.isFinite(d.getTime()) ? d.toISOString() : null;
}

function rowTo(r: RowDataPacket): StepSubmission {
  const kind = String(r.kind ?? "text");
  return {
    id: String(r.id),
    claimId: String(r.claim_id),
    questId: String(r.quest_id),
    userId: String(r.user_id),
    stepIndex: Number(r.step_index ?? 0),
    kind: isStepSubmissionKind(kind) ? kind : "text",
    body: r.body == null ? null : String(r.body),
    fileName: r.file_name == null ? null : String(r.file_name),
    originalName: r.original_name == null ? null : String(r.original_name),
    createdAt: toIso(r.created_at),
  };
}

/** One claim's step submissions, oldest first within each step. */
export async function stepSubmissionsForClaim(pool: Pool, claimId: string): Promise<StepSubmission[]> {
  const [rows] = await pool.query<RowDataPacket[]>(`${SELECT} WHERE claim_id = ? ORDER BY step_index, created_at, id`, [claimId]);
  return rows.map(rowTo);
}

/** Several claims' step submissions at once, for the consent queue. */
export async function stepSubmissionsForClaims(pool: Pool, claimIds: readonly string[]): Promise<StepSubmission[]> {
  if (claimIds.length === 0) return [];
  const [rows] = await pool.query<RowDataPacket[]>(
    `${SELECT} WHERE claim_id IN (${claimIds.map(() => "?").join(", ")}) ORDER BY claim_id, step_index, created_at, id`,
    [...claimIds],
  );
  return rows.map(rowTo);
}

export async function addStepSubmission(pool: Pool, s: Omit<StepSubmission, "createdAt">): Promise<StepSubmission> {
  await pool.query(
    "INSERT INTO quest_step_submissions (id, claim_id, quest_id, user_id, step_index, kind, body, file_name, original_name) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    [s.id, s.claimId, s.questId, s.userId, s.stepIndex, s.kind, s.body, s.fileName, s.originalName],
  );
  return { ...s, createdAt: new Date().toISOString() };
}

/**
 * Remove one of the member's own submissions on one claim. The owner and the
 * claim ride in the WHERE, so nobody removes a row that is not theirs. Answers
 * the row removed, so the caller can take its file off the volume, or null.
 */
export async function removeStepSubmission(pool: Pool, id: string, claimId: string, userId: string): Promise<StepSubmission | null> {
  const [rows] = await pool.query<RowDataPacket[]>(`${SELECT} WHERE id = ? AND claim_id = ? AND user_id = ?`, [id, claimId, userId]);
  if (!rows[0]) return null;
  const [res] = await pool.query<ResultSetHeader>("DELETE FROM quest_step_submissions WHERE id = ? AND claim_id = ? AND user_id = ?", [id, claimId, userId]);
  return Number(res.affectedRows ?? 0) > 0 ? rowTo(rows[0]) : null;
}

/** Every submission of a claim that went away (a quest put back). Answers the rows, for their files. */
export async function removeStepSubmissionsForClaim(pool: Pool, claimId: string): Promise<StepSubmission[]> {
  const rows = await stepSubmissionsForClaim(pool, claimId);
  if (rows.length) await pool.query("DELETE FROM quest_step_submissions WHERE claim_id = ?", [claimId]);
  return rows;
}

/** Every submission a member made, for the erasure sweep to take their files off the volume first. */
export async function stepSubmissionsOfMember(pool: Pool, userId: string): Promise<StepSubmission[]> {
  const [rows] = await pool.query<RowDataPacket[]>(`${SELECT} WHERE user_id = ?`, [userId]);
  return rows.map(rowTo);
}

/** Then their rows. Two calls, so a file that will not come off stops the sweep with the rows still naming it. */
export async function deleteStepSubmissionsOfMember(pool: Pool, userId: string): Promise<number> {
  const [res] = await pool.query<ResultSetHeader>("DELETE FROM quest_step_submissions WHERE user_id = ?", [userId]);
  return Number(res.affectedRows ?? 0);
}
