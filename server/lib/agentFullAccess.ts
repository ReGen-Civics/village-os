/**
 * THE FULL-ACCESS SWITCH, read and recorded (the lead, 20 Nov 2026; shared/agentFullAccess.ts holds the rule).
 *
 *   fullAccessFor(pool, userId)  whether THIS holder's agent has full access now: the setting names a role, the
 *                                holder is a person and holds a live seat in it. Read at every call.
 *   recordFullAccessWrite        the audit of one full-access write, with who approved it and their note, stored
 *                                BEFORE the write is dispatched; it throws when it cannot be stored, so nothing is
 *                                written without it.
 *   noticeFullAccessChange       the switch turned on or off: one admin-audience event naming who did it, and a
 *                                notice to every live role holder of the Anchor Circle, so consent stays visible.
 */
import type { Pool } from "mysql2/promise";
import { recordEvent } from "./events";
import { readConfigDocument } from "../repos/appConfigDocs";
import { holdsLiveSeat, isAgentAccount, orgRoleForFullAccess } from "../repos/agentAccounts";
import { holdersInCircles } from "../repos/roleProposals";
import { anchorCircleId } from "../../shared/circlePicker";
import { FULL_ACCESS_DOC, parseFullAccessDoc, type FullAccessDoc } from "../../shared/agentFullAccess";

export async function readFullAccess(pool: Pool): Promise<FullAccessDoc> {
  return parseFullAccessDoc(await readConfigDocument(pool, FULL_ACCESS_DOC));
}

/** Whether this holder's agent has full access at this moment. Fails closed: any error reads as off. */
export async function fullAccessFor(pool: Pool, userId: string): Promise<boolean> {
  try {
    const doc = await readFullAccess(pool);
    if (!doc.roleId || !userId) return false;
    if (await isAgentAccount(pool, userId)) return false;
    return await holdsLiveSeat(pool, userId, doc.roleId);
  } catch (err) {
    console.warn("[agent-full-access] could not read the switch, so it reads as off", (err as Error)?.message);
    return false;
  }
}

/** One full-access write, as its record names it. The approval is the agent's claim of the person's words. */
export interface FullAccessWriteRecord {
  agentUserId: string;
  tokenPrefix: string;
  method: string;
  path: string;
  summary: string;
  approvedBy: string;
  approvalNote: string;
}

export async function recordFullAccessWrite(pool: Pool, a: FullAccessWriteRecord): Promise<void> {
  await recordEvent(pool, {
    kind: "audit",
    text: `full access through the connector (${a.tokenPrefix}...): ${a.method} ${a.path.slice(0, 200)}. ${a.summary.slice(0, 300)} Approved by ${a.approvedBy.slice(0, 120)}: "${a.approvalNote.slice(0, 600)}"`,
    actorUserId: a.agentUserId,
    actorKind: "agent",
    entityType: "agent_full_access",
    entityRef: `${a.method} ${a.path}`.slice(0, 64),
    audience: "admin",
  }, { throwOnFailure: true });
}

export interface NoticeDeps {
  notify: (input: { userId: string; type: string; title: string; body?: string | null; link?: string | null; actorUserId?: string | null; dedupeKey: string }) => Promise<unknown>;
  circles: () => ReadonlyArray<{ id?: unknown; name?: unknown; isAnchor?: unknown; parentCircleId?: unknown; isExample?: unknown; status?: unknown }>;
}

/** The switch moved: recorded, and told to the Anchor Circle. A failed notice never undoes the setting. */
export async function noticeFullAccessChange(
  pool: Pool,
  deps: NoticeDeps,
  change: { actorUserId: string; before: FullAccessDoc; after: FullAccessDoc },
): Promise<{ anchorNotified: number }> {
  const on = !!change.after.roleId;
  const roleId = change.after.roleId ?? change.before.roleId;
  const role = roleId ? await orgRoleForFullAccess(pool, roleId) : null;
  const roleName = role?.name ?? roleId ?? "a role";
  const title = on
    ? `Full access is on for the agent of whoever holds ${roleName}`
    : `Full access is off for the agent of ${roleName}`;
  const body = on
    ? "That role's agent may now make most admin changes through the connector, each one approved in the chat and recorded. Money, secrets, erasure, the veto, the agent accounts and letters stay a person's act."
    : "That role's agent is back to the paths a person lists for agents, and the changes the village approved one by one.";
  await recordEvent(pool, {
    kind: "audit",
    text: on ? `turned on full access for the agent of whoever holds ${roleName} (${roleId})` : `turned off full access for the agent of ${roleName} (${roleId ?? "none"})`,
    actorUserId: change.actorUserId,
    entityType: "app_config",
    entityRef: FULL_ACCESS_DOC,
    audience: "admin",
  });
  let anchorNotified = 0;
  try {
    const circles = deps.circles().map((c) => ({
      id: String(c?.id ?? ""),
      name: String(c?.name ?? ""),
      isAnchor: !!c?.isAnchor,
      parentCircleId: c?.parentCircleId ? String(c.parentCircleId) : null,
      isExample: !!c?.isExample,
    }));
    const anchor = anchorCircleId(circles);
    if (anchor) {
      const stamp = change.after.setAt ?? new Date().toISOString();
      const people = Array.from(new Set((await holdersInCircles(pool, [anchor])).map((h) => h.userId)));
      for (const userId of people) {
        await deps.notify({ userId, type: "agent_full_access", title, body, link: "/admin", actorUserId: change.actorUserId, dedupeKey: `agent-full-access:${on ? "on" : "off"}:${roleId ?? "none"}:${stamp}:${userId}` });
        anchorNotified++;
      }
    }
  } catch (err) {
    console.warn("[agent-full-access] the Anchor Circle notice did not go out", (err as Error)?.message);
  }
  return { anchorNotified };
}
