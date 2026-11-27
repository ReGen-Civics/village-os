/**
 * WHERE A CHANGE REQUEST LIVES (the lead, 27 Nov 2026: change requests become a kind of decision under Decisions).
 *
 * The list is the Change requests section of Decisions, and one change request has its own page under it. Every
 * link the platform makes, in the browser and in a notice, comes from here, so the address is written once. The old
 * addresses (/changes, /changes/:id) redirect here for links already sent.
 *
 * Its own small file, with no imports, because the router reads it in the first page's chunk.
 */

/** The Change requests section of Decisions. */
export const CHANGE_REQUESTS_HREF = "/governance/decisions#changes";

/** One change request's page. */
export function changeRequestHref(id: string): string {
  return `/governance/decisions/changes/${encodeURIComponent(id)}`;
}
