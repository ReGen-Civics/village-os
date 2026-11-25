/**
 * READ AS A PLAIN MEMBER (the lead, 25 Nov 2026): the ONE helper for a request that must be answered as a plain
 * member would be answered, whoever's session it carries. Shared by the connector's open reads (server/routes/agentMcp.ts,
 * shared/agentFullAccess.ts) and any token whose reads must not widen because its holder is an admin, such as a live
 * view. Do not build a second one: call `asPlainMemberHeaders` to mark a request and `readsAsPlainMember` to honour it.
 *
 * WHAT IT CLOSES while the request is marked:
 *   isAdmin            false (server/index.ts), so a route that widens for an admin answers as for a member, and an
 *                      admin-only route refuses
 *   the editor's door  closed (server/routes/roleEdit.ts `door`)
 *   canReadTerms       false (server/routes/orgDraftDecide.ts), so a role card's pay terms stay out of the answer
 *
 * WHY A PLAIN HEADER IS SAFE: the mark only ever takes power away. A client that sends it itself only answers itself
 * as a member, which it could do by signing in as one. Nothing reads it as a grant, and nothing may: a check that
 * opens anything on this header is a defect.
 */

export const READ_AS_MEMBER_HEADER = "x-village-read-as";
export const READ_AS_MEMBER_VALUE = "member";

/** The headers that mark an internal request to be answered as a plain member. */
export function asPlainMemberHeaders(): Record<string, string> {
  return { [READ_AS_MEMBER_HEADER]: READ_AS_MEMBER_VALUE };
}

/** Whether this request is marked to be answered as a plain member. Takes an Express request or a bare headers object. */
export function readsAsPlainMember(req: unknown): boolean {
  if (!req || typeof req !== "object") return false;
  const r = req as { get?: (name: string) => unknown; headers?: Record<string, unknown> };
  const raw = typeof r.get === "function" ? r.get(READ_AS_MEMBER_HEADER) : r.headers?.[READ_AS_MEMBER_HEADER];
  const value = Array.isArray(raw) ? raw[0] : raw;
  return typeof value === "string" && value.trim().toLowerCase() === READ_AS_MEMBER_VALUE;
}
