/**
 * WHICH FORMS STILL NEED AN ANSWER, as one rule for the server's count and the admin's pages.
 *
 * Accepted and declined are finished. A missing status is the same as new: nobody has moved it yet. The one count
 * (shared/reviewInbox.ts) and the admin's own lists (client/src/components/admin/waitingWork.ts) both ask this, so a
 * form can never wait on one screen and be done on another.
 *
 * No imports, so any page can read it.
 */
const SETTLED = new Set(["accepted", "declined"]);

export function needsAction(status: string | null | undefined): boolean {
  return !SETTLED.has(String(status || "new").toLowerCase());
}

/** "membership-request" reads "Membership request": a form's kind in words, never its sender. */
export function formKindWords(type: string | null | undefined): string {
  const raw = String(type || "request").replace(/[-_]+/g, " ").trim().toLowerCase() || "request";
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}
