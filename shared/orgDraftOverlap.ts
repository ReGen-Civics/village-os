/**
 * WHICH OTHER OPEN DRAFTS CHANGE THE SAME PART OF THE ORG CHART (the coordinator, 26 Nov 2026).
 *
 * Three open drafts once proposed changes to one role; publishing a stale one would have overwritten the role's live
 * sections. A draft's row says when another open draft changes something it changes, so nobody publishes the wrong
 * one. "The same part" is the same target: a change's `orgRoleId`, which names a role, a seat, or `circle:<id>`.
 */
export interface DraftTargets {
  id: string;
  status: string;
  changes: readonly { orgRoleId: string }[];
}

/** The ids of the OTHER open drafts that change any target this draft changes, oldest list order kept. */
export function overlappingOpenDrafts(draft: DraftTargets, all: readonly DraftTargets[]): string[] {
  const mine = new Set(draft.changes.map((c) => String(c.orgRoleId)).filter(Boolean));
  if (!mine.size) return [];
  return all.filter((d) => d.id !== draft.id && d.status === "open" && d.changes.some((c) => mine.has(String(c.orgRoleId)))).map((d) => d.id);
}
