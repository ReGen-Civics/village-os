/**
 * /admin/proposals IS FOLDED INTO /admin/review (the accepted cut C8, 27 Nov 2026; docs/REVIEW_INBOX_PLAN.md,
 * "Links that move").
 *
 * The old page's whole desk (the batch cards with Accept all and Discard all, its filters, its history) is the
 * Batches view of the review page now. The OLD ADDRESS KEEPS WORKING: links already sent, bookmarks, and the address
 * the server still hands to agents (`reviewAt: "/admin/proposals"`, server/routes/proposedChanges.ts) all land on that
 * view, with the search they carried.
 *
 * Pure, so the mapping is tested without a page.
 */

/** The view of /admin/review that holds what /admin/proposals held. */
export const BATCHES_VIEW = "/admin/review?view=batches";

/**
 * Where an old /admin/proposals address lands. `?find=B-71.2` is kept as the search made on arrival, and an old
 * `#B-71` anchor becomes that search.
 */
export function foldedProposalsAddress(search: string, hash: string): string {
  const to = new URLSearchParams({ view: "batches" });
  const find = (new URLSearchParams(search).get("find") ?? "").trim() || decodeURIComponent(hash.replace(/^#/, "")).trim();
  if (find) to.set("find", find.slice(0, 80));
  return `/admin/review?${to.toString()}`;
}
