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
] as const;
export type InboxSource = (typeof INBOX_SOURCES)[number];

/**
 * The order sections read in: a person's own voice first (votes, consent, applications), then what was proposed,
 * then work and duties, then the desks. Every source has a place; a source with nothing waiting draws nothing.
 */
export const INBOX_ORDER: readonly InboxSource[] = [
  "vote", "consent", "application", "open",
  "connector", "intake", "sera", "approval", "agent", "structure", "change", "suggestion", "quest",
  "claim", "task", "handoff", "tension", "hand",
  "recap", "owed", "cash", "mint", "cycle", "cosign", "letter", "assistant", "feedback", "vouch", "erasure",
];
