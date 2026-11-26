/**
 * THE DRAFT PAGE'S ONE READ (the draft page, PR A): `GET /api/org/drafts/:id/view`.
 *
 * What one org draft changes, field by field, before and after, already diffed
 * and already cut to what the reader may read. An ALLOWLISTED projection: every
 * object below is built through `pick` with a fixed list of keys, and
 * server/lib/orgDraftView.test.ts fails on any key outside these lists, so a
 * field added to a draft row or a role row never reaches a reader by accident.
 *
 * "Before" is the role as it stands NOW. The draft does not yet remember what
 * the card said when it was made; that is PR C (`base_json`), and until it lands
 * `base` is absent and the page says the comparison is against the live card.
 */
import type { DiffRun } from "./orgDraftDiff";

/** How a field is drawn: words, lines, or pay and terms (which may be hidden). */
export type DraftFieldShape = "text" | "list" | "terms";

/** What one change does to its target. */
export type DraftChangeKind = "edit" | "new" | "removed" | "other";

export const DRAFT_VIEW_KEYS = ["id", "title", "rationale", "status", "createdAt", "publishedAt", "source", "proposer", "changeIds", "changes", "otherOpenDrafts"] as const;
export const DRAFT_SOURCE_KEYS = ["kind", "moduleId", "fromProposal"] as const;
export const DRAFT_PROPOSER_KEYS = ["firstName", "roles"] as const;
export const DRAFT_CHANGE_KEYS = ["id", "op", "kind", "targetId", "target", "reads", "blocked", "fields", "unchanged", "holders"] as const;
export const DRAFT_FIELD_KEYS = ["field", "label", "shape", "before", "after", "runs", "hidden"] as const;
export const DRAFT_OTHER_KEYS = ["id", "title"] as const;

export interface DraftFieldView {
  /** The payload key, which the page translates; `label` is the English fallback. */
  field: string;
  label: string;
  shape: DraftFieldShape;
  /** Live now. A list is its lines; null is empty. Null too when `hidden`. */
  before: string | string[] | null;
  after: string | string[] | null;
  /** Words for a text field, lines for a list. Empty when hidden. */
  runs: DiffRun[];
  /** Pay and terms the reader may not read: the page says only that they change. */
  hidden: boolean;
}

export interface DraftChangeView {
  id: string;
  op: string;
  kind: DraftChangeKind;
  /** The role or circle id this change touches. */
  targetId: string;
  /** Its name as it stands, or as the draft names it when the draft makes it. */
  target: string;
  /** The preview's own sentence for what this change does. */
  reads: string;
  /** Why it cannot be applied, or null. */
  blocked: string | null;
  /** Only the fields this change writes. */
  fields: DraftFieldView[];
  /** The card fields this change leaves alone, by key, for the "N fields unchanged" fold. */
  unchanged: string[];
  /** For a removal: how many people hold the role now. Null for every other kind. */
  holders: number | null;
}

export interface DraftView {
  id: string;
  title: string;
  rationale: string | null;
  status: string;
  createdAt: string | null;
  publishedAt: string | null;
  /** Where it came from: a person in the role editor (`human`), an agent, and whether it was built from a waiting proposal. */
  source: { kind: string; moduleId: string | null; fromProposal: boolean };
  /** Who made it: the roles they hold (shown big) and their first name. Null when nobody is recorded. */
  proposer: { firstName: string | null; roles: string[] } | null;
  /** Every change id, which a publish sends back as `expectedChanges`. */
  changeIds: string[];
  changes: DraftChangeView[];
  /** Other open drafts touching the same role, seat or circle. */
  otherOpenDrafts: Array<{ id: string; title: string }>;
}

/** A copy of `o` holding only `keys`. The allowlist every object in the answer is built through. */
export function pick<T extends object, K extends string>(o: T, keys: readonly K[]): Pick<T, Extract<K, keyof T>> {
  const out: Record<string, unknown> = {};
  for (const k of keys) if (k in o) out[k] = (o as Record<string, unknown>)[k];
  return out as Pick<T, Extract<K, keyof T>>;
}
