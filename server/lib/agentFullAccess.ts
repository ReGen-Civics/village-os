/**
 * THE FULL-ACCESS SWITCH, read and recorded (the lead, 20 Nov 2026; shared/agentFullAccess.ts holds the rule).
 *
 *   fullAccessFor(pool, userId)  whether THIS holder's agent has full access now: the setting names a role, the
 *                                holder is a person and holds a live seat in it. Read at every call.
 *   recordFullAccessWrite        the audit of one full-access write, with who approved it and their note, stored
 *                                BEFORE the write is dispatched; it throws when it cannot be stored, so nothing is
 *                                written without it.
 *   fullAccessRecipients         who an email send reaches, read fresh at both calls of the two-call confirm, so
 *                                the preview names them and the confirmToken covers them (the lead, 24 Nov 2026)
 *   readsOpenFor                 whether this holder's agent reads open now (the lead, 25 Nov 2026), read at every call
 *   noticeReadsOpenChange        reads open turned on or off: recorded, and told to the Anchor Circle like the switch
 *   noticeFullAccessChange       the switch turned on or off: one admin-audience event naming who did it, and a
 *                                notice to every live role holder of the Anchor Circle, so consent stays visible.
 */
import type { Pool } from "mysql2/promise";
import { recordEvent } from "./events";
import { readConfigDocument } from "../repos/appConfigDocs";
import { holdsLiveSeat, isAgentAccount, orgRoleForFullAccess } from "../repos/agentAccounts";
import { holdersInCircles } from "../repos/roleProposals";
import { anchorCircleId } from "../../shared/circlePicker";
import { FULL_ACCESS_DOC, parseFullAccessDoc, type FullAccessDoc, type FullAccessRecipients, type FullAccessSendKind } from "../../shared/agentFullAccess";
import { lettersRecipients } from "../../shared/roleWaitlistLetters";
import { contactsByIds, letterById, recipientsOf } from "../repos/commsLetters";
import { messageDetail } from "../repos/commsMessages";
import { activeEnrollmentCounts } from "../repos/commsOverview";
import { waitlistForRole } from "../repos/roleWaitlist";
import { listOrgRoles } from "./orgChart";

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

/** Whether this holder's agent reads open now: full access is theirs, and a person turned reads open on. Fails closed. */
export async function readsOpenFor(pool: Pool, userId: string): Promise<boolean> {
  try {
    const doc = await readFullAccess(pool);
    return doc.readsOpen === true && (await fullAccessFor(pool, userId));
  } catch (err) {
    console.warn("[agent-full-access] could not read reads open, so it reads as closed", (err as Error)?.message);
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
  /** For an email send, who it goes to as the preview named them. */
  recipients?: FullAccessRecipients | null;
}

/** The mark every full-access record carries: an agent made it, on its holder's yes. */
export const FULL_ACCESS_MARK = "made by an agent on its holder's yes";

export async function recordFullAccessWrite(pool: Pool, a: FullAccessWriteRecord): Promise<void> {
  const to = a.recipients ? ` Sent to ${a.recipients.to.slice(0, 200)} (${a.recipients.count}).` : "";
  await recordEvent(pool, {
    kind: "audit",
    text: `full access through the connector (${a.tokenPrefix}...), ${FULL_ACCESS_MARK}: ${a.method} ${a.path.slice(0, 200)}. ${a.summary.slice(0, 300)}${to} Approved by ${a.approvedBy.slice(0, 120)}: "${a.approvalNote.slice(0, 600)}"`,
    actorUserId: a.agentUserId,
    actorKind: "agent",
    entityType: "agent_full_access",
    entityRef: `${a.method} ${a.path}`.slice(0, 64),
    audience: "admin",
  }, { throwOnFailure: true });
}

/** An address shown only as its first letter and its domain: a recipient the platform has no name for. */
export function maskAddress(email: string): string {
  const at = email.lastIndexOf("@");
  if (at < 1) return "an address without a name";
  return `${email[0]}...${email.slice(at)}`;
}

const nameOf = (c: { name: string | null; email: string }) => c.name?.trim() || maskAddress(c.email);

/**
 * WHO AN EMAIL SEND REACHES (the lead, 24 Nov 2026), read the way the send route itself will read it, or null when
 * the platform cannot say. Names, never addresses, but for the holder's own address on a test to themselves.
 */
export async function fullAccessRecipients(
  pool: Pool,
  holder: { name: string | null; email: string | null },
  send: { kind: FullAccessSendKind; params: Record<string, string> },
  body: Record<string, unknown> | undefined,
): Promise<FullAccessRecipients | null> {
  switch (send.kind) {
    case "holder": {
      const email = String(holder.email ?? "").trim();
      if (!email) return null;
      return { to: `you, at ${email}`, count: 1, names: [holder.name?.trim() || email] };
    }
    case "letter": {
      const letter = await letterById(pool, send.params.id ?? "");
      if (!letter || letter.recipientCount < 1) return null;
      const pending = await recipientsOf(pool, letter.id, "pending");
      const named = await contactsByIds(pool, pending.slice(0, 20).map((r) => r.contactId).filter((x): x is string => !!x));
      return { to: `the ${letter.recipientCount} people in this letter's audience, as its last preview fixed it`, count: letter.recipientCount, names: named.map(nameOf) };
    }
    case "journey": {
      const key = send.params.key ?? "";
      const now = (await activeEnrollmentCounts(pool))[key] ?? 0;
      const on = body?.state === "on";
      return {
        to: on ? `everyone who enters the ${key} journey from now on, and the ${now} people on it now` : `nobody new: the ${now} people on the ${key} journey stop getting its emails`,
        count: now,
        names: [],
      };
    }
    case "message": {
      const m = await messageDetail(pool, send.params.id ?? "");
      if (!m) return null;
      const contact = m.contactId ? (await contactsByIds(pool, [m.contactId]))[0] : undefined;
      const who = contact ? nameOf(contact) : maskAddress(m.toEmail);
      return { to: `${who}, the one person this email was for`, count: 1, names: [who] };
    }
    case "waitlist": {
      const roleId = typeof body?.roleId === "string" ? body.roleId : "";
      if (!roleId) return null;
      const role = (await listOrgRoles(pool)).find((r) => r.id === roleId);
      if (!role) return null;
      const rows = lettersRecipients((await waitlistForRole(pool, roleId)).map((r) => ({ ...r, email: r.emailKey })));
      return { to: `everyone waiting for ${role.name} who said yes to letters`, count: rows.length, names: [] };
    }
  }
  return null;
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
    ? "That role's agent may now make most admin changes through the connector, settings and email among them, each one approved in the chat with its recipients named, and recorded. Money, secrets, erasure, the veto and the agent accounts stay a person's act."
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

/** Reads open moved (the lead, 25 Nov 2026): recorded with who did it, and told to the Anchor Circle, as the switch is. */
export async function noticeReadsOpenChange(
  pool: Pool,
  deps: NoticeDeps,
  change: { actorUserId: string; before: FullAccessDoc; after: FullAccessDoc },
): Promise<{ anchorNotified: number }> {
  const on = change.after.readsOpen;
  const roleId = change.after.roleId;
  const role = roleId ? await orgRoleForFullAccess(pool, roleId) : null;
  const roleName = role?.name ?? roleId ?? "the full-access role";
  const title = on ? `Reads are open for the agent of whoever holds ${roleName}` : `Reads are closed again for the agent of ${roleName}`;
  const body = on
    ? "That role's agent may now read the village's pages without a listed path, as a plain member reads them. Secrets, money, applicant data, contact details, sign-in, the agent list, voice and erasure records stay closed."
    : "That role's agent reads only the paths a person lists for agents.";
  await recordEvent(pool, {
    kind: "audit",
    text: on ? `opened reads for the agent of whoever holds ${roleName} (${roleId ?? "no role named"})` : `closed reads for the agent of ${roleName} (${roleId ?? "no role named"})`,
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
      const stamp = change.after.readsSetAt ?? new Date().toISOString();
      const people = Array.from(new Set((await holdersInCircles(pool, [anchor])).map((h) => h.userId)));
      for (const userId of people) {
        await deps.notify({ userId, type: "agent_full_access", title, body, link: "/admin", actorUserId: change.actorUserId, dedupeKey: `agent-reads-open:${on ? "on" : "off"}:${roleId ?? "none"}:${stamp}:${userId}` });
        anchorNotified++;
      }
    }
  } catch (err) {
    console.warn("[agent-full-access] the Anchor Circle notice did not go out", (err as Error)?.message);
  }
  return { anchorNotified };
}
