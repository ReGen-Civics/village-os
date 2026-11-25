/**
 * THE CONNECTOR'S FILINGS MEET THE ENGINE BEFORE A PERSON SEES THEM (docs/REVIEW_INBOX_PLAN.md, lane 5).
 *
 * `POST /api/admin/proposals` (the connector's `propose_changes`) checks every item and refuses a broken filing whole,
 * as it always has. What passes is now staged (server/repos/suggestionStaging.ts) and read by the pure engine
 * (shared/suggestionPipeline/engine.ts) before anything reaches the review page:
 *   - the same value discarded inside the re-propose window is HELD (`recently_discarded`), or held for a person to let
 *     through when the filing says what is new (`reconsider_waits`);
 *   - a value that is already live is HELD (`already_live`);
 *   - a name in mixed scripts is HELD (`mixed_script`);
 *   - the same filing sent again while it waits is answered with the change that already waits, never filed twice.
 * Everything else is published as a proposed change exactly as before, and the 4b review page decides it.
 *
 * WHAT THIS NEVER TOUCHES (the coordinator, 25 Nov 2026). The full-access agent's lead-approved writes do not come
 * through here: `admin_request` with the lead's approval runs its route directly, and `accept_proposals` accepts a
 * change that already waits (`accept-as-holder`). Staging is for ordinary filings and adds no second approval to a
 * write the lead already said yes to. server/routes/agentFullAccess.routes.test.ts pins it.
 *
 * NOT READ YET, so never held for it: open votes covering a key (`under_vote`), and caps per filer per day (the
 * filing route's own rate limit stands in). Both are the engine's already and need only their context here.
 */
import { runEngine, type EngineContext, type HeldCode, type Staged } from "../../shared/suggestionPipeline/engine";
import { needsOf } from "../../shared/suggestionPipeline/keys";
import type { ProposalKind } from "../../shared/proposedChanges";
import { engineHistory } from "../repos/suggestionOutcomes";
import { applyEngineResult, setReconsider, stageSuggestion, stagedById, type FilerKind } from "../repos/suggestionStaging";
import type { Pool } from "mysql2/promise";

/** The re-propose window (the lead, 25 Nov 2026): a value discarded within it is held if it is sent again unchanged. */
export const REDISCARD_DAYS = 30;

/** Caps the engine would apply; the filing route's own rate limit stands in until they are read per filer per day. */
const OPEN_CAPS = { perFilerPerDay: 100_000, optionsPerThing: 100_000 };

/** What the filer is told about a held filing: the fixed reason, in a sentence, and what would let it through. */
export const HELD_FOR_FILER: Record<HeldCode, string> = {
  over_cap: "Held: too many came from you today. It is read again tomorrow.",
  mixed_script: "Held: a name mixes letters from more than one alphabet. A person checks it.",
  already_live: "Held: what it asks for is already live. Nothing needs deciding.",
  target_gone: "Held: what it changes is no longer there.",
  under_vote: "Held: a vote covers this. It is read again when the vote closes.",
  decided_since: "Held: this was decided after you sent it.",
  reconsider_waits: "Held: the same was discarded recently. A person reads your reason and may let it through.",
  recently_discarded: "Held: the same was discarded recently. To send it again, say what is new with reconsider: { code, reason }.",
  too_many_options: "Held: there are already enough options for this thing.",
  needs_missing: "Held: it needs something that does not exist yet.",
  waits_on_held: "Held: it needs something that is itself held.",
  order_cycle: "Held: it and another of yours each need the other first.",
};

export interface Filing {
  kind: ProposalKind;
  target: Record<string, unknown>;
  body: Record<string, unknown>;
  summary: string;
  reconsider: { code: string; reason: string } | null;
}

export type Sorted =
  | { index: number; to: "publish"; stagedId: string }
  | { index: number; to: "held"; stagedId: string; code: HeldCode; fields: Record<string, string> }
  | { index: number; to: "waiting"; stagedId: string; changeId: string | null };

/**
 * Whether what is proposed is already what is live: every value the proposal sets is the value live holds there. A
 * change that adds or removes nothing is never worth a person's time. A live value that could not be read is not live.
 */
export function sameAsLive(live: unknown, body: unknown): boolean {
  if (live === undefined || live === null) return false;
  if (body !== null && typeof body === "object" && !Array.isArray(body)) {
    if (typeof live !== "object" || Array.isArray(live)) return false;
    const entries = Object.entries(body as Record<string, unknown>);
    return entries.length > 0 && entries.every(([k, v]) => sameAsLive((live as Record<string, unknown>)[k], v));
  }
  return JSON.stringify(live) === JSON.stringify(body);
}

/** A filing's `reconsider`: the code of the discarded change and what is new, or null. Bounded, never trusted further. */
export function readReconsider(v: unknown): { code: string; reason: string } | null {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  const r = v as Record<string, unknown>;
  const code = typeof r.code === "string" ? r.code.trim().slice(0, 24) : "";
  const reason = typeof r.reason === "string" ? r.reason.replace(/\s+/g, " ").trim().slice(0, 500) : "";
  return code && reason.length >= 3 ? { code, reason } : null;
}

export interface SortDeps {
  pool: Pool;
  /** Whether each filing's value is what is live now, read as the person filing. */
  isLive: (f: Filing) => Promise<boolean>;
  now: Date;
}

/**
 * Stage each filing and sort it: published, held with its reason, or already waiting. Nothing here publishes; the
 * route publishes what comes back as `publish`, in the order it was filed.
 */
export async function stageAndSort(deps: SortDeps, filings: readonly Filing[], filer: string, filerKind: FilerKind): Promise<Sorted[]> {
  const { pool, now } = deps;
  const out: Sorted[] = [];
  const fresh: { index: number; staged: Staged }[] = [];
  for (let i = 0; i < filings.length; i++) {
    const f = filings[i]!;
    const { id, duplicate } = await stageSuggestion(pool, {
      stream: "connector",
      streamRef: `filing:${now.getTime()}:${i}`,
      filer,
      filerKind,
      kind: f.kind,
      target: f.target,
      body: f.body,
      why: f.summary,
      reconsider: f.reconsider,
      now,
    });
    if (duplicate) {
      // Sent again with what is new, after being told it was held as recently discarded: it takes the reason and is
      // read again, as a reconsider for a person to let through.
      if (f.reconsider && (await setReconsider(pool, id, f.reconsider, now))) {
        const again = await stagedById(pool, id);
        if (again) {
          fresh.push({ index: i, staged: again.staged });
          continue;
        }
      }
      // Sent again while it waits: answer with what already waits. A held one answers as held, with its reason.
      const row = await stagedById(pool, id);
      if (row?.state === "held" && row.heldCode) out.push({ index: i, to: "held", stagedId: id, code: row.heldCode, fields: row.heldFields });
      else out.push({ index: i, to: "waiting", stagedId: id, changeId: row?.publishedChangeId ?? null });
      continue;
    }
    const row = await stagedById(pool, id);
    if (row) fresh.push({ index: i, staged: row.staged });
  }
  if (!fresh.length) return out.sort((a, b) => a.index - b.index);

  const since = new Date(now.getTime() - REDISCARD_DAYS * 86_400_000).toISOString();
  const history = await engineHistory(pool, since);
  const alreadyLive = new Set<string>();
  for (const x of fresh) if (await deps.isLive(filings[x.index]!)) alreadyLive.add(x.staged.id);
  // Every filing here passed its target's own check at the door, so what each one needs exists now.
  const liveRefs = new Set(fresh.flatMap((x) => needsOf(x.staged.kind, x.staged.target, x.staged.body)));
  const ctx: EngineContext = {
    now: now.toISOString(),
    rediscardDays: REDISCARD_DAYS,
    caps: OPEN_CAPS,
    alreadyLive,
    targetGone: new Set(),
    liveRefs,
    discarded: history.discarded,
    openVotes: [],
    decisions: history.decisions,
    released: new Set(),
  };
  const result = runEngine(
    fresh.map((x) => x.staged),
    ctx,
  );
  await applyEngineResult(pool, result, now);
  const heldBy = new Map(result.held.map((h) => [h.stagedId, h]));
  for (const x of fresh) {
    const h = heldBy.get(x.staged.id);
    out.push(h ? { index: x.index, to: "held", stagedId: x.staged.id, code: h.code, fields: h.fields } : { index: x.index, to: "publish", stagedId: x.staged.id });
  }
  return out.sort((a, b) => a.index - b.index);
}

/**
 * A held reconsider a person let through: read it again with the release counted, and answer whether it may now be
 * published. Anything else that holds it (already live since, a later decision) still holds it, with that reason.
 */
export async function afterRelease(deps: SortDeps, stagedId: string): Promise<{ publish: true } | { publish: false; code: HeldCode; fields: Record<string, string> } | null> {
  const { pool, now } = deps;
  const row = await stagedById(pool, stagedId);
  if (!row || row.state !== "held") return null;
  const s = row.staged;
  const history = await engineHistory(pool, new Date(now.getTime() - REDISCARD_DAYS * 86_400_000).toISOString());
  const filing: Filing = { kind: s.kind, target: s.target, body: s.body, summary: row.why ?? "", reconsider: s.reconsider ?? null };
  const result = runEngine([s], {
    now: now.toISOString(),
    rediscardDays: REDISCARD_DAYS,
    caps: OPEN_CAPS,
    alreadyLive: (await deps.isLive(filing)) ? new Set([s.id]) : new Set(),
    targetGone: new Set(),
    liveRefs: new Set(needsOf(s.kind, s.target, s.body)),
    discarded: history.discarded,
    openVotes: [],
    decisions: history.decisions,
    released: new Set([s.id]),
  });
  await applyEngineResult(pool, result, now);
  const h = result.held.find((x) => x.stagedId === s.id);
  return h ? { publish: false, code: h.code, fields: h.fields } : { publish: true };
}
