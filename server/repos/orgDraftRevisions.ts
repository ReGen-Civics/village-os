/**
 * THE REVISIONS OF AN ORG DRAFT (0437; the draft page, PR D). The table's every reader and writer.
 *
 * `reviseInTransaction` runs on the connection of the transaction `reviseChange` (server/lib/orgDraftRevise.ts)
 * opens, after the draft row is locked, so a revision and the change it rewrites commit together or not at all.
 */
import type { Pool, PoolConnection, RowDataPacket } from "mysql2/promise";

export interface RevisionRow {
  id: string;
  draftId: string;
  number: number;
  changeIdBefore: string;
  changeIdAfter: string;
  payloadBefore: Record<string, unknown> | null;
  payloadAfter: Record<string, unknown> | null;
  note: string | null;
  revisedBy: string | null;
  createdAt: string | null;
}

const asObject = (v: unknown): Record<string, unknown> | null => {
  let x = v;
  if (typeof x === "string") {
    try {
      x = JSON.parse(x);
    } catch {
      return null;
    }
  }
  return x && typeof x === "object" && !Array.isArray(x) ? (x as Record<string, unknown>) : null;
};

/** The change a revision rewrites, read under the draft's lock. Null when it is not in this draft. */
export async function changeForRevision(conn: PoolConnection, draftId: string, changeId: string): Promise<{ op: string; orgRoleId: string; payload: Record<string, unknown> } | null> {
  const [rows] = await conn.query<RowDataPacket[]>("SELECT op, org_role_id, payload FROM org_draft_changes WHERE id = ? AND draft_id = ? FOR UPDATE", [changeId, draftId]);
  const r = rows[0];
  return r ? { op: String(r.op), orgRoleId: String(r.org_role_id), payload: asObject(r.payload) ?? {} } : null;
}

/**
 * Rewrite one change under a NEW id, and record the revision. The new id is the point: a publish sends back the
 * change ids it was shown (`expectedChanges`), so a person who read the draft before this edit is refused with
 * "This draft changed since you opened it" and never publishes words they did not read.
 */
export async function reviseInTransaction(
  conn: PoolConnection,
  r: { id: string; draftId: string; changeIdBefore: string; changeIdAfter: string; payloadBefore: unknown; payloadAfter: unknown; note: string | null; revisedBy: string },
): Promise<number> {
  await conn.query("UPDATE org_draft_changes SET id = ?, payload = ? WHERE id = ? AND draft_id = ?", [r.changeIdAfter, JSON.stringify(r.payloadAfter), r.changeIdBefore, r.draftId]);
  // Sera's answer that put this change in the draft follows it to its new id (server/lib/seraAnswer.ts reads it by id).
  await conn.query("UPDATE saberra_settled SET draft_change_id = ? WHERE draft_id = ? AND draft_change_id = ?", [r.changeIdAfter, r.draftId, r.changeIdBefore]);
  const [[n]] = await conn.query<RowDataPacket[]>("SELECT COALESCE(MAX(number), 1) + 1 AS next FROM org_draft_revisions WHERE draft_id = ?", [r.draftId]);
  const number = Number(n?.next ?? 2);
  await conn.query(
    "INSERT INTO org_draft_revisions (id, draft_id, number, change_id_before, change_id_after, payload_before, payload_after, note, revised_by) VALUES (?,?,?,?,?,?,?,?,?)",
    [r.id, r.draftId, number, r.changeIdBefore, r.changeIdAfter, JSON.stringify(r.payloadBefore), JSON.stringify(r.payloadAfter), r.note, r.revisedBy],
  );
  return number;
}

/** A draft's revisions, oldest first. Revision 1 is the draft as it was made, which has no row. */
export async function revisionsOf(pool: Pool, draftId: string): Promise<RevisionRow[]> {
  const [rows] = await pool.query<RowDataPacket[]>("SELECT * FROM org_draft_revisions WHERE draft_id = ? ORDER BY number, id", [draftId]);
  return rows.map((r) => ({
    id: String(r.id),
    draftId: String(r.draft_id),
    number: Number(r.number),
    changeIdBefore: String(r.change_id_before),
    changeIdAfter: String(r.change_id_after),
    payloadBefore: asObject(r.payload_before),
    payloadAfter: asObject(r.payload_after),
    note: r.note == null ? null : String(r.note),
    revisedBy: r.revised_by == null ? null : String(r.revised_by),
    createdAt: r.created_at ? new Date(r.created_at).toISOString() : null,
  }));
}

/** The erasure: a departed member's id leaves every revision they made, and the words stay. */
export async function forgetReviser(pool: Pool, userId: string, anon: string): Promise<number> {
  const [r] = await pool.query<any>("UPDATE org_draft_revisions SET revised_by = ? WHERE revised_by = ?", [anon, userId]);
  return Number(r?.affectedRows ?? 0);
}
