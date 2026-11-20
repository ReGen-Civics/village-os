/**
 * THE DECIDERS' STAMPS ON A PROPOSAL (the lead, 20 Nov 2026): a choice to go above a role's limit (`overLimit`,
 * shared/commitmentLimit.ts) and a saved split of the role's deliverables (`heldSplit`, shared/proposalCompare.ts).
 *
 * Each is one key in the proposal's own stored JSON: `open_role_proposals.body_json` for a stranger's proposal,
 * `seat_applications.answers` for a member's application. JSON_SET writes the one key and keeps every other, the way
 * the counter-offer and the voice transcripts are written, so no migration is needed and nothing else moves. The
 * value goes through JSON_EXTRACT(?, '$'), which both MySQL and MariaDB read as JSON.
 *
 * Neither key is ever taken from a form: the member door parses its answers field by field, and the open form builds
 * its body field by field, so a person cannot send a stamp in their own proposal. Both are erased with the proposal.
 */
import type { Pool, PoolConnection, ResultSetHeader } from "mysql2/promise";

type Db = Pool | PoolConnection;

export type StampKey = "overLimit" | "heldSplit";

const PATH: Record<StampKey, string> = { overLimit: "$.overLimit", heldSplit: "$.heldSplit" };

/** Write one stamp onto a stranger's open proposal. True when the row was there. */
export async function stampOpenProposal(db: Db, id: string, key: StampKey, value: unknown): Promise<boolean> {
  const [r] = await db.query<ResultSetHeader>(
    `UPDATE open_role_proposals SET body_json = JSON_SET(COALESCE(body_json, JSON_OBJECT()), '${PATH[key]}', JSON_EXTRACT(?, '$')) WHERE id = ?`,
    [JSON.stringify(value), id],
  );
  return Number(r.affectedRows ?? 0) === 1;
}

/** Write one stamp onto a member's application. True when the row was there. */
export async function stampApplication(db: Db, id: string, key: StampKey, value: unknown): Promise<boolean> {
  const [r] = await db.query<ResultSetHeader>(
    `UPDATE seat_applications SET answers = JSON_SET(COALESCE(answers, JSON_OBJECT()), '${PATH[key]}', JSON_EXTRACT(?, '$')) WHERE id = ?`,
    [JSON.stringify(value), id],
  );
  return Number(r.affectedRows ?? 0) === 1;
}
