/*
 * THE ADMIN'S OWN HAND IS NOT THROTTLED (the lead's ruling, 2026-11-18).
 *
 * The per-person limiters on editing role cards and deciding org drafts exist to
 * stop a runaway caller. A village admin accepting a batch of proposed role cards,
 * or editing cards one after another, is not one, and was being told "That is a
 * lot in a few minutes" mid-review. So a PERSON who is a village admin skips
 * those limiters.
 *
 * An agent never does, even holding an admin's grant, so a runaway agent is still
 * throttled. A request is an agent's when any of these hold:
 *   - it came through the connector: the loopback from server/routes/agentMcp.ts
 *     carries `x-village-connector`;
 *   - it was resolved from an agent token (`vat_...`): `resolveAgent` in
 *     server/index.ts stamps `req.agentToken` before an in-process rewrite;
 *   - the signed-in account is an agent's (`users.is_agent`).
 * The connector header can only ever make a request MORE limited, so a person
 * who sends it themselves gains nothing.
 *
 * Accepting a proposed change runs each role card through the role-edit route
 * over the loopback as the person who pressed Accept (server/routes/proposedChanges.ts,
 * `runAs`), with no connector header and only after `person()` refused agents,
 * so the admin's batch accept is uncapped by the same check.
 */
import type { Pool } from "mysql2/promise";
import { isAgentAccount } from "../repos/agentAccounts";

export function cameThroughAnAgent(req: any): boolean {
  if (req?.agentToken) return true;
  const headers = req?.headers ?? {};
  return !!headers["x-village-connector"];
}

/** Whether this request is a person, not an agent, who is a village admin, and so skips the per-person limiters. */
export async function adminUncapped(req: any, userId: string, isAdmin: (req: any) => Promise<boolean>, db: Pool): Promise<boolean> {
  if (cameThroughAnAgent(req)) return false;
  if (!(await isAdmin(req))) return false;
  return !(await isAgentAccount(db, userId));
}
