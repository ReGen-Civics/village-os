/**
 * ONE NAMED LOCK PER AGENT FOR A KEEPER'S CLAIM (audit, 15 Nov 2026).
 *
 * The keeper check and the proposal it lets in (server/routes/agentRoleProposals.ts)
 * run while one connection holds `agent-claim:<agent id>`, so two members
 * claiming the same unkept agent at once never both pass the check. A MySQL
 * named lock, held by the connection, released in the same call.
 */
import type { Pool, RowDataPacket } from "mysql2/promise";

/** The answer when the lock could not be had in time. */
export const AGENT_CLAIM_BUSY = Symbol("agent-claim-busy");

/** Run `work` under the agent's claim lock. AGENT_CLAIM_BUSY when the lock did not come within 5 seconds. */
export async function whileAgentClaimHeld<T>(pool: Pool, agentUserId: string, work: () => Promise<T>): Promise<T | typeof AGENT_CLAIM_BUSY> {
  const name = `agent-claim:${agentUserId}`.slice(0, 64);
  const conn = await pool.getConnection();
  try {
    const [rows] = await conn.query<RowDataPacket[]>("SELECT GET_LOCK(?, 5) AS got", [name]);
    if (Number(rows[0]?.got) !== 1) return AGENT_CLAIM_BUSY;
    try {
      return await work();
    } finally {
      await conn.query("SELECT RELEASE_LOCK(?)", [name]).catch(() => undefined);
    }
  } finally {
    conn.release();
  }
}
