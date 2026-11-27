/**
 * THE SQL FOR WHO MAY READ THE INVESTOR PAGE (migration 0440; the contract is shared/investorInterest.ts).
 * Read and written only by server/routes/investorAccess.ts.
 *
 * One row per person let in, keyed by `user:<account id>` or `visitor:<sha256 of the proven
 * address>`. The address is hashed for the key only so it fits an index; it is kept in full in
 * `email_key` for the desk.
 */
import crypto from "node:crypto";
import type { Pool, RowDataPacket } from "mysql2/promise";
import { emailKeyOf } from "../../shared/comms/address";

export type AccessHolder = { kind: "account"; userId: string } | { kind: "visitor"; emailKey: string };

export function accessKeyOf(h: AccessHolder): string {
  return h.kind === "account" ? `user:${h.userId}` : `visitor:${crypto.createHash("sha256").update(emailKeyOf(h.emailKey)).digest("hex")}`;
}

/** Whether any of these holders has been let in. */
export async function hasAccess(db: Pool, holders: AccessHolder[]): Promise<boolean> {
  const keys = holders.map(accessKeyOf);
  if (!keys.length) return false;
  const [rows] = await db.query<RowDataPacket[]>(`SELECT 1 FROM investor_access WHERE access_key IN (${keys.map(() => "?").join(",")}) LIMIT 1`, keys);
  return rows.length > 0;
}

/** Let one person in. A second acceptance of the same person keeps the first row. */
export async function grantAccess(db: Pool, h: AccessHolder, submissionId: string | null, grantedBy: string | null, at: Date): Promise<void> {
  await db.query(
    "INSERT INTO investor_access (access_key, user_id, email_key, submission_id, granted_by, granted_at) VALUES (?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE access_key = access_key",
    [accessKeyOf(h), h.kind === "account" ? h.userId : null, h.kind === "visitor" ? emailKeyOf(h.emailKey) : null, submissionId, grantedBy, at],
  );
}

/** Take one person's access away (their accepted answer was moved on to declined). */
export async function revokeAccess(db: Pool, h: AccessHolder): Promise<boolean> {
  const [r] = await db.query("DELETE FROM investor_access WHERE access_key = ?", [accessKeyOf(h)]);
  return Number((r as { affectedRows?: number }).affectedRows ?? 0) > 0;
}
