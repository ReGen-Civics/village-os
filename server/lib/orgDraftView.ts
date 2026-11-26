/**
 * THE DRAFT PAGE'S ANSWER (the draft page, PR A; shared/orgDraftView.ts is the contract).
 *
 * One org draft, change by change and field by field: the role as it stands now
 * (before), what the draft writes (after), and the difference in words or lines.
 * Pay and terms are cut to "this changes" for a reader who may not read terms.
 * Nothing here writes: the live picture is read on the pool (`readLiveBefore`),
 * and the preview is the same preview every publish runs.
 */
import type { Pool } from "mysql2/promise";
import { draftChangeCap, listDrafts, previewDraft, readLiveBefore, type Draft, type DraftChange } from "./orgDrafts";
import { listOrgAssignments, listOrgRoles } from "./orgChart";
import { BEFORE_COLUMN, labelOf } from "./roleEdit";
import { DRAFT_PAY_KEYS } from "./draftRolePay";
import { firstNames } from "../repos/roleEditHistory";
import { revisionsOf } from "../repos/orgDraftRevisions";
import { openBallotFor } from "./ballots";
import { ORG_DRAFT } from "../../shared/ballotSubjects";
import { overlappingOpenDrafts } from "../../shared/orgDraftOverlap";
import { lineDiff, wordDiff } from "../../shared/orgDraftDiff";
import { ROLE_CCOS_FIELDS } from "../../shared/roleCcos";
import { ROLE_HANDOVER_FIELDS } from "../../shared/roleHandover";
import {
  DRAFT_CHANGE_KEYS,
  DRAFT_FIELD_KEYS,
  DRAFT_OTHER_KEYS,
  DRAFT_PROPOSER_KEYS,
  DRAFT_REVISION_KEYS,
  DRAFT_SOURCE_KEYS,
  DRAFT_VIEW_KEYS,
  pick,
  type DraftChangeKind,
  type DraftChangeView,
  type DraftFieldView,
  type DraftView,
} from "../../shared/orgDraftView";

/** The words of a role card, in the order the card writes them: what the "N fields unchanged" fold counts. */
export const CARD_FIELD_KEYS: readonly string[] = ["name", "aim", "domain", "accountabilities", "whyItMatters", ...ROLE_CCOS_FIELDS, ...ROLE_HANDOVER_FIELDS];

/** Pay and terms: only a reader who may read terms sees how they change. */
export const TERMS_KEYS: readonly string[] = ["termsOffer", ...DRAFT_PAY_KEYS];

/** The pay columns a publish captures, by payload key (`BEFORE_COLUMN` carries the rest). */
const PAY_COLUMN: Record<string, string> = { valueMinor: "value_minor", valueTokens: "value_tokens", cashMinor: "cash_minor" };

/** A stored or proposed value as text or lines. JSON text holding a list reads as the list. */
export function asShown(v: unknown): string | string[] | null {
  if (v === null || v === undefined) return null;
  let x = v;
  if (typeof x === "string" && /^\s*\[/.test(x)) {
    try {
      x = JSON.parse(x);
    } catch {
      /* read as the text it is */
    }
  }
  if (Array.isArray(x)) return x.map((i) => (i !== null && typeof i === "object" ? JSON.stringify(i) : String(i))).filter((i) => i.trim() !== "");
  if (x instanceof Date) return x.toISOString();
  if (typeof x === "object") return JSON.stringify(x);
  const s = String(x);
  return s.trim() === "" ? null : s;
}

const asLines = (v: string | string[] | null): string[] => (v === null ? [] : Array.isArray(v) ? v : [v]);

/** One field, before and after, diffed, or hidden when it is terms the reader may not read. */
export function fieldView(field: string, beforeRaw: unknown, afterRaw: unknown, readsTerms: boolean, baseRaw?: unknown): DraftFieldView {
  const terms = TERMS_KEYS.includes(field);
  const before = asShown(beforeRaw);
  const base = baseRaw === undefined ? null : asShown(baseRaw);
  // Moved: the draft knows its base and the live card no longer says it.
  const moved = baseRaw !== undefined && JSON.stringify(base) !== JSON.stringify(before);
  if (terms && !readsTerms) return pick({ field, label: labelOf(field), shape: "terms" as const, before: null, after: null, runs: [], hidden: true, base: null, moved, movedRuns: [] }, DRAFT_FIELD_KEYS);
  const after = asShown(afterRaw);
  const list = Array.isArray(before) || Array.isArray(after) || Array.isArray(base);
  const diff = (a: string | string[] | null, b: string | string[] | null) => (list ? lineDiff(asLines(a), asLines(b)) : wordDiff(a as string | null, b as string | null));
  return pick(
    {
      field,
      label: labelOf(field),
      shape: terms ? ("terms" as const) : list ? ("list" as const) : ("text" as const),
      before,
      after,
      runs: diff(before, after),
      hidden: false,
      base,
      moved,
      movedRuns: moved ? diff(base, before) : [],
    },
    DRAFT_FIELD_KEYS,
  );
}

const KIND: Partial<Record<string, DraftChangeKind>> = { update_seat: "edit", create_seat: "new", rest_seat: "removed" };

/** A live row's value for a payload key, through the publish's own column map. */
function liveValue(row: Record<string, unknown> | null, key: string): unknown {
  if (!row) return null;
  const col = BEFORE_COLUMN[key] ?? PAY_COLUMN[key];
  return col ? row[col] : null;
}

export interface ViewDeps {
  /** Whether this reader may read pay and terms (`terms.read`, the role editor's own answer). */
  readsTerms: boolean;
  /** A circle's name by id, or null. */
  circleName(id: string): string | null;
}

/** Everything the page shows about one change. */
async function changeView(pool: Pool, open: boolean, c: DraftChange, names: Map<string, string>, line: { reads: string; blocked: string | null } | undefined, deps: ViewDeps, holdersOf: (roleId: string) => number): Promise<DraftChangeView> {
  const kind = KIND[c.op] ?? "other";
  const payload = (c.payload && typeof c.payload === "object" ? c.payload : {}) as Record<string, unknown>;
  const circle = c.orgRoleId.startsWith("circle:") ? deps.circleName(c.orgRoleId.slice("circle:".length)) : null;
  const target = names.get(c.orgRoleId) ?? circle ?? (typeof payload.name === "string" ? payload.name : c.orgRoleId);
  let fields: DraftFieldView[] = [];
  let unchanged: string[] = [];
  // An open draft compares against the card as it stands. A published one against what its publish
  // captured, so the page keeps saying what that publish changed after later edits moved the card on.
  const before = async (op: DraftChange["op"]) =>
    (open ? await readLiveBefore(pool, { ...c, op }) : c.beforeJson && typeof c.beforeJson === "object" ? c.beforeJson : null) as Record<string, unknown> | null;
  // The base is read only for an open draft: a published one compares against its publish's own capture.
  const base = open && c.baseJson && typeof c.baseJson === "object" ? (c.baseJson as Record<string, unknown>) : null;
  if (kind === "edit") {
    const live = await before("update_seat");
    const keys = Object.keys(payload).filter((k) => k in BEFORE_COLUMN || k in PAY_COLUMN);
    fields = keys.map((k) => fieldView(k, liveValue(live, k), payload[k], deps.readsTerms, base ? liveValue(base, k) : undefined));
    unchanged = CARD_FIELD_KEYS.filter((k) => !keys.includes(k));
  } else if (kind === "new") {
    const keys = Object.keys(payload).filter((k) => k in BEFORE_COLUMN || k in PAY_COLUMN);
    fields = keys.map((k) => fieldView(k, null, payload[k], deps.readsTerms));
  } else if (kind === "removed") {
    const live = await before("update_seat");
    fields = CARD_FIELD_KEYS.filter((k) => asShown(liveValue(live, k)) !== null).map((k) => fieldView(k, liveValue(live, k), null, deps.readsTerms));
  }
  return pick(
    {
      id: c.id,
      op: c.op,
      kind,
      targetId: c.orgRoleId,
      target,
      reads: line?.reads ?? "",
      blocked: line?.blocked ?? null,
      baseKnown: !!base,
      fields,
      unchanged,
      holders: kind === "removed" ? holdersOf(c.orgRoleId) : null,
    },
    DRAFT_CHANGE_KEYS,
  );
}

/** The whole answer for one draft. Who may read it is the route's question, asked before this runs. */
export async function draftView(pool: Pool, draft: Draft, deps: ViewDeps): Promise<DraftView> {
  const [roles, assignments, preview, open] = await Promise.all([
    listOrgRoles(pool),
    listOrgAssignments(pool),
    previewDraft(pool, draft.id, draft.sourceKind === "human" ? null : draftChangeCap()),
    draft.status === "open" ? listDrafts(pool, { status: "open" }) : Promise.resolve([] as Draft[]),
  ]);
  const roleNames = new Map(roles.map((r) => [r.id, r.name]));
  const lines = new Map(preview.lines.map((l) => [l.changeId, { reads: l.reads, blocked: l.blocked }]));
  const holdersOf = (roleId: string) => assignments.filter((a) => a.orgRoleId === roleId).length;
  const changes: DraftChangeView[] = [];
  for (const c of draft.changes) changes.push(await changeView(pool, draft.status === "open", c, roleNames, lines.get(c.id), deps, holdersOf));

  const [revs, voting] = await Promise.all([revisionsOf(pool, draft.id), draft.status === "open" ? openBallotFor(pool, ORG_DRAFT, draft.id) : Promise.resolve(null)]);
  const people = await firstNames(pool, [draft.createdBy ?? "", ...revs.map((r) => r.revisedBy ?? "")]);
  /** A person as the page shows them: the roles they hold now, and their first name. */
  const who = (userId: string | null) =>
    userId
      ? pick(
          {
            firstName: people.get(userId) || null,
            roles: Array.from(new Set(assignments.filter((a) => a.holderKind === "member" && a.userId === userId).map((a) => roleNames.get(a.orgRoleId)).filter((n): n is string => !!n))),
          },
          DRAFT_PROPOSER_KEYS,
        )
      : null;
  const proposer = who(draft.createdBy);
  const revisions = revs.map((r) => {
    const before = r.payloadBefore ?? {};
    const after = r.payloadAfter ?? {};
    const keys = Array.from(new Set([...Object.keys(before), ...Object.keys(after)])).filter((k) => JSON.stringify(before[k] ?? null) !== JSON.stringify(after[k] ?? null));
    return pick({ number: r.number, at: r.createdAt, by: who(r.revisedBy), note: r.note, changeId: r.changeIdAfter, fields: keys.map((k) => fieldView(k, before[k], after[k], deps.readsTerms)) }, DRAFT_REVISION_KEYS);
  });
  const overlapping = new Set(overlappingOpenDrafts(draft, open));
  const otherOpenDrafts = open.filter((d) => overlapping.has(d.id)).map((d) => pick({ id: d.id, title: d.title }, DRAFT_OTHER_KEYS));

  return pick(
    {
      id: draft.id,
      title: draft.title,
      rationale: draft.rationale,
      status: draft.status,
      createdAt: draft.createdAt ?? null,
      publishedAt: draft.publishedAt,
      source: pick({ kind: draft.sourceKind, moduleId: draft.sourceModuleId, fromProposal: !!draft.sourceProposalId }, DRAFT_SOURCE_KEYS),
      proposer,
      changeIds: draft.changes.map((c) => c.id),
      changes,
      otherOpenDrafts,
      mayEdit: draft.status === "open" && !voting,
      revisions,
    },
    DRAFT_VIEW_KEYS,
  );
}
