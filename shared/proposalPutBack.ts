/**
 * PROPOSE PUTTING IT BACK (the review page, /admin/proposals). Pure: no database, no Express.
 *
 * When a change is accepted, what was live just before it is read the way the page reads it (`liveOf`,
 * server/lib/proposedChanges.ts) and kept on the change (`before_json`, migration 0400). On a decided, accepted
 * change that kept it, the page offers "Propose putting it back". That FILES A NEW PROPOSAL: same kind, same
 * target, the body carrying the value that was live before, marked as putting back the original. Nothing is
 * applied; a person accepts it like any other proposal, through the same dry run and the same route.
 *
 * THE BODY. The put-back sends exactly the fields the accepted change sent, each with the value it held before.
 * Read that way it is right for a route that merges (a page's words, a module's settings) and for one that saves
 * whole (a role card's pay, a list of ids): the key set matches what was accepted, at every depth, and a field the
 * change never touched is never written. A field the change sent that was not there before cannot be taken away by
 * sending fields, so then nothing is offered and the page says why.
 *
 * WHERE IT IS NEVER OFFERED, with the reason the page shows:
 *   made_new      the change made something new (an FAQ, a calendar event, anything POSTed through a setting).
 *                 Putting it back would be taking it away, which is its own change with its own route.
 *   took_away     the change took something down (an FAQ, a DELETE). Putting it back would be making it again,
 *                 with a new id, which is its own change.
 *   goal_links    a season's goals. Quests and moon items serve a goal by its id, and the value read before the
 *                 accept holds goals row by row beside the proposal, without their ids, so a put-back could cut
 *                 those links.
 */
import type { ProposalKind } from "./proposedChanges";

/** Why "Propose putting it back" is not offered on this change. The page words for each are keyed by this union. */
export const PUT_BACK_BLOCKS = ["not_accepted", "not_kept", "unread", "made_new", "took_away", "goal_links", "added_fields", "already_waiting"] as const;
export type PutBackBlock = (typeof PUT_BACK_BLOCKS)[number];

export type PutBackVerdict = { can: true } | { can: false; reason: PutBackBlock };

/**
 * What was kept before the accept: `null` when nothing was kept (SQL NULL: a change accepted before this release, or
 * a kind that is never put back), else `{ value }`, where a value of null means it was read and nothing could be
 * read then.
 */
export type KeptBefore = { value: unknown } | null;

/** The kinds, and the setting methods, that are never put back, whatever was kept. Decided before anything is read. */
export function neverPutBack(kind: ProposalKind, target: Record<string, unknown>): PutBackBlock | null {
  switch (kind) {
    case "faq_add":
      return "made_new";
    case "faq_remove":
      return "took_away";
    case "season_goals":
      return "goal_links";
    case "setting": {
      const m = String(target.method ?? "").toUpperCase();
      if (m === "POST") return "made_new";
      if (m === "DELETE") return "took_away";
      return null;
    }
    default:
      return null;
  }
}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

/**
 * The value `before` held at every field `sent` names, at every depth: objects are read key by key, anything else
 * (a list, a word, a number) is taken whole. `missing` names the first field `sent` names that `before` does not
 * hold at all; a field held as null is held.
 */
export function heldAt(before: unknown, sent: Record<string, unknown>, prefix = ""): { ok: true; value: Record<string, unknown> } | { ok: false; missing: string } {
  const out: Record<string, unknown> = {};
  const from = isObj(before) ? before : {};
  for (const [k, v] of Object.entries(sent)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (!(k in from) || from[k] === undefined) return { ok: false, missing: path };
    const was = from[k];
    if (isObj(v) && isObj(was) && Object.keys(v).length) {
      const inner = heldAt(was, v, path);
      if (!inner.ok) return inner;
      out[k] = inner.value;
    } else {
      out[k] = was;
    }
  }
  return { ok: true, value: out };
}

export interface PutBackSource {
  id: string;
  kind: ProposalKind;
  target: Record<string, unknown>;
  status: string;
  /** What went live: the accepted body (the person's edits included), else what was proposed. */
  accepted: Record<string, unknown> | null;
  body: Record<string, unknown>;
  before: KeptBefore;
}

export interface PutBackProposal {
  kind: ProposalKind;
  target: Record<string, unknown>;
  body: Record<string, unknown>;
  summary: string;
  reverts: string;
}

/** Whether this decided change may be proposed back, and if so the proposal that would be filed. */
export function putBackOf(c: PutBackSource, summary: string): { ok: true; proposal: PutBackProposal } | { ok: false; reason: PutBackBlock } {
  if (c.status !== "accepted") return { ok: false, reason: "not_accepted" };
  const never = neverPutBack(c.kind, c.target);
  if (never) return { ok: false, reason: never };
  if (!c.before) return { ok: false, reason: "not_kept" };
  if (c.before.value === null || c.before.value === undefined) return { ok: false, reason: "unread" };
  const sent = c.accepted ?? c.body;
  const held = heldAt(c.before.value, sent);
  if (!held.ok) return { ok: false, reason: "added_fields" };
  return { ok: true, proposal: { kind: c.kind, target: { ...c.target }, body: held.value, summary: putBackSummary(summary), reverts: c.id } };
}

/** The verdict alone, for the page. */
export function putBackVerdict(c: PutBackSource): PutBackVerdict {
  const r = putBackOf(c, "");
  return r.ok ? { can: true } : { can: false, reason: r.reason };
}

/** The new proposal's one sentence, kept inside the summary's limit. */
export function putBackSummary(original: string): string {
  return `Put back what was live before: ${original}`.slice(0, 400);
}
