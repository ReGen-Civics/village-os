/**
 * The queues the deciders' one list reads, and the order its sections read in (docs/REVIEW_INBOX_PLAN.md).
 *
 * A file of its own, with no imports, so the page at /admin/review can name every source and order them without
 * pulling the readers (shared/reviewInbox.ts) into its chunk. shared/reviewInbox.test.ts holds the two lists to each
 * other and to the reads, so a source cannot be read and never drawn, or drawn and never read.
 */
export const INBOX_SOURCES = [
  // The first seven (lane 3).
  "connector", "intake", "quest", "claim", "approval", "agent", "sera",
  // Every other queue a person decides from (lane 4a's completeness pass, 25 Nov 2026).
  "application", "consent", "open", "structure", "vote", "change", "suggestion", "hand", "tension", "task", "handoff",
  "recap", "cash", "owed", "mint", "cycle", "cosign", "letter", "assistant", "feedback", "vouch", "erasure",
  // The forms people send (the one count, 27 Nov 2026): Home counted them apart from this list until they joined it.
  "form",
] as const;
export type InboxSource = (typeof INBOX_SOURCES)[number];

/** How many rows of one queue a page of the list carries; the rest is asked for by source and offset. */
export const INBOX_PAGE = 10;

/** The one key of Sera's row: the whole list of differences, gone through together (shared/reviewInbox.ts). */
export const SERA_ROW_KEY = "sera:differences";

/**
 * The order sections read in: a person's own voice first (votes, consent, applications), then what was proposed,
 * then work and duties, then the desks. Every source has a place; a source with nothing waiting draws nothing.
 */
export const INBOX_ORDER: readonly InboxSource[] = [
  "vote", "structure", "consent", "application", "open", "form",
  "connector", "intake", "sera", "approval", "agent", "change", "suggestion", "quest",
  "claim", "task", "handoff", "tension", "hand",
  "recap", "owed", "cash", "mint", "cycle", "cosign", "letter", "assistant", "feedback", "vouch", "erasure",
];
