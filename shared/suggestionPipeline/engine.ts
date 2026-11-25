/**
 * THE REVIEW ENGINE: from everything staged to what a person reads (docs/REVIEW_INBOX_PLAN.md, gates 0 to 4 and 6).
 *
 * The lead, 23 Nov 2026: suggestions from Sera, agents and any other stream go into staging first and are integrated
 * into one coherent stream before anything reaches the proposals page, so streams never contradict or duplicate each
 * other. Machines merge identical suggestions; only people resolve conflicts. And 25 Nov: conflicts BLOCK, one card
 * and one accept; held items stay until a person clears them.
 *
 * `runEngine` is the whole pipeline as one pure function of what is staged and what the village holds now. The server
 * runs it again on every filing, after every accept and after every vote closes, and writes the difference. Because
 * it recomputes from the whole open set, a re-run can never leave two cards for one thing.
 *
 *   caps       a filer's day and a thing's options are capped; anything over is HELD, never dropped
 *   check      held when it is already live, its target is gone, a village vote or veto window is open on it, a
 *              decision landed on it after it arrived, or it was discarded inside the window (a reconsider waits
 *              for a person to release it; it never skips the window by itself)
 *   group      identical values MERGE into one card, first filer first; different values on the same thing become
 *              ONE card with options, which only a person resolves
 *   order      a card that needs something another card creates waits for it: inside one filer's batch it is put
 *              after it; across filers it waits on it and is accepted on its own
 *   version    a digest of the card as shown, which an accept must carry back
 *
 * THE LINES THIS FILE HOLDS:
 *   - It decides nothing. Its output is what a person reads; every accept still runs the target's own route as that
 *     person (server/routes/proposedChanges.ts).
 *   - A seating, or anything tied to an application (`touchesPerson`), is never merged, never grouped, never ordered
 *     by anything but arrival, and passes none of the check gate's judgements. AI never selects, ranks or judges
 *     applicants.
 *   - Who filed it (`stream`, `filer`) is set by the server from the route and the signed-in principal before it
 *     gets here. Nothing in a payload can claim to be another stream.
 *   - Validation (gate 5) is the target route's own validator, which lives on the server; the filing route refuses a
 *     broken filing whole at the door before anything is staged.
 *
 * Pure: no database, no Express, no React.
 */
import { canonicalJson } from "../canonicalJson";
import type { ProposalKind } from "../proposedChanges";
import { aimOf, aimsMeet, keysMeet, keysOfAim, mixedScript, needsOf, type Aim } from "./keys";

export const STREAMS = ["intake", "sera", "connector", "agent", "approval", "quest", "assistant", "agenda"] as const;
export type StreamId = (typeof STREAMS)[number];

/** Why something waits in Held: a fixed code, with fields. Never prose, so no filer's words reach another filer. */
export const HELD_CODES = [
  "over_cap",
  "mixed_script",
  "already_live",
  "target_gone",
  "under_vote",
  "decided_since",
  "reconsider_waits",
  "recently_discarded",
  "too_many_options",
  "needs_missing",
  "waits_on_held",
  "order_cycle",
] as const;
export type HeldCode = (typeof HELD_CODES)[number];

export interface Staged {
  id: string;
  /** Set by the route the filing arrived on. */
  stream: StreamId;
  /** An opaque reference to the signed-in principal that filed it, set by the server. */
  filer: string;
  kind: ProposalKind;
  target: Record<string, unknown>;
  body: Record<string, unknown>;
  /** The server's clock when it was staged. Never a time the filer supplied. */
  receivedAt: string;
  /** Filed again after a discard, naming the discarded change and what is new. */
  reconsider?: { code: string; reason: string } | null;
  /** A seating, or anything tied to an application. */
  touchesPerson?: boolean;
  /** Refs a stream's adapter adds: things this needs first, and things it creates. */
  needs?: string[];
  provides?: string[];
}

export interface EngineContext {
  now: string;
  /** `review.rediscard_days`: how long a discarded change is held if it is sent again unchanged. */
  rediscardDays: number;
  caps: { perFilerPerDay: number; optionsPerThing: number };
  /** Staged ids whose proposed value is what is live now. */
  alreadyLive: ReadonlySet<string>;
  /** Staged ids whose target no longer exists. */
  targetGone: ReadonlySet<string>;
  /** Things that exist now, as refs such as `role:water-steward`. */
  liveRefs: ReadonlySet<string>;
  discarded: readonly { keys: string[]; valueDigest: string; at: string; code: string }[];
  /** Open village votes, frozen drafts and veto windows, by what they decide. */
  openVotes: readonly { keys: string[]; ref: string; closesAt: string | null }[];
  /** Decisions that landed: accepted changes, published drafts, closed votes. */
  decisions: readonly { keys: string[]; at: string; code: string }[];
  /** Staged ids a person released from Held (a reconsider). */
  released: ReadonlySet<string>;
  /** Digest of the live value each staged id is shown against, so a card's version moves when live moves. */
  liveDigest?: Readonly<Record<string, string>>;
}

export interface Credit {
  stagedId: string;
  stream: StreamId;
  filer: string;
  receivedAt: string;
}

/** One value on offer. A plain card has one; a card with options has two or more. */
export interface Option {
  valueDigest: string;
  /** Everyone who sent this exact value, first filer first. Only the first leads with their why and evidence. */
  credits: Credit[];
}

export interface Card {
  id: string;
  /** `one`: a single filing. `joined`: identical filings merged. `choose`: different values a person picks between. */
  shape: "one" | "joined" | "choose";
  options: Option[];
  keys: string[];
  touchesPerson: boolean;
  batchId: string;
  position: number;
  /** A card in another filer's batch this one needs first. It is accepted on its own once that one lands. */
  waitsOn: string | null;
  version: string;
}

export interface Held {
  stagedId: string;
  code: HeldCode;
  fields: Record<string, string>;
}

export interface Batch {
  id: string;
  /** Batches never mix filers or streams. A card several filers sent sits in a batch of its own. */
  stream: StreamId | null;
  filer: string | null;
  cardIds: string[];
}

export interface EngineResult {
  cards: Card[];
  held: Held[];
  batches: Batch[];
}

// ── Digests ─────────────────────────────────────────────────────────────────

function fnv(s: string, seed: number): number {
  let h = seed >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** A 64-bit digest as hex, from two FNV-1a passes. Stable in every browser and in Node. Not a secret. */
export function digest(s: string): string {
  return fnv(s, 0x811c9dc5).toString(16).padStart(8, "0") + fnv(s, 0x01000193 ^ 0x5bd1e995).toString(16).padStart(8, "0");
}

/** Strings compared as a person reads them: the same letters in the same order, spaces collapsed. */
function normalized(v: unknown): unknown {
  if (typeof v === "string") return v.normalize("NFC").replace(/\s+/g, " ").trim();
  if (Array.isArray(v)) return v.map(normalized);
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v as Record<string, unknown>).map(([k, x]) => [k, normalized(x)]));
  return v;
}

/**
 * What makes two suggestions IDENTICAL: the same kind, the same target and the same value, compared after spaces
 * and Unicode form. Lookalike letters are NOT folded here: a value spelled with a Cyrillic letter is a different
 * value, so it becomes an option a person sees beside the real one and can never borrow the real one's credit.
 */
export function valueDigestOf(s: Pick<Staged, "kind" | "target" | "body">): string {
  return digest(canonicalJson(normalized({ kind: s.kind, target: s.target, body: s.body })));
}

// ── The pipeline ────────────────────────────────────────────────────────────

const byArrival = (a: Pick<Staged, "receivedAt" | "id">, b: Pick<Staged, "receivedAt" | "id">) =>
  a.receivedAt.localeCompare(b.receivedAt) || a.id.localeCompare(b.id);

const DAY_MS = 24 * 60 * 60 * 1000;

interface Entry {
  s: Staged;
  aim: Aim;
  keys: string[];
  value: string;
}

/** Gate 2, for one entry: the reason it is held, or null. */
function checkOne(e: Entry, ctx: EngineContext): Omit<Held, "stagedId"> | null {
  const { s } = e;
  if (ctx.alreadyLive.has(s.id)) return { code: "already_live", fields: {} };
  if (ctx.targetGone.has(s.id)) return { code: "target_gone", fields: {} };
  const vote = ctx.openVotes.find((v) => keysMeet(e.keys, v.keys));
  if (vote) return { code: "under_vote", fields: { vote: vote.ref, ...(vote.closesAt ? { closesAt: vote.closesAt } : {}) } };
  const since = ctx.decisions.find((d) => d.at > s.receivedAt && keysMeet(e.keys, d.keys));
  if (since) return { code: "decided_since", fields: { decision: since.code, at: since.at } };
  const windowMs = Math.max(0, ctx.rediscardDays) * DAY_MS;
  const now = Date.parse(ctx.now);
  const discard = ctx.discarded.find((d) => d.valueDigest === e.value && keysMeet(e.keys, d.keys) && now - Date.parse(d.at) <= windowMs);
  if (discard) {
    if (s.reconsider && ctx.released.has(s.id)) return null;
    if (s.reconsider) return { code: "reconsider_waits", fields: { discarded: discard.code } };
    return { code: "recently_discarded", fields: { discarded: discard.code, at: discard.at } };
  }
  return null;
}

/** Disjoint sets, for grouping entries that touch the same thing. */
function components(n: number, meets: (i: number, j: number) => boolean): number[][] {
  const parent = Array.from({ length: n }, (_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) if (meets(i, j)) parent[find(j)] = find(i);
  const groups = new Map<number, number[]>();
  for (let i = 0; i < n; i++) groups.set(find(i), [...(groups.get(find(i)) ?? []), i]);
  return Array.from(groups.values());
}

interface Draft {
  id: string;
  shape: Card["shape"];
  options: { value: string; entries: Entry[] }[];
  touchesPerson: boolean;
  first: string;
}

function creditOf(e: Entry): Credit {
  return { stagedId: e.s.id, stream: e.s.stream, filer: e.s.filer, receivedAt: e.s.receivedAt };
}

const entriesOf = (d: Draft) => d.options.flatMap((o) => o.entries);

/** Everything staged, read against what the village holds now, as the cards a person reads and the items held. */
export function runEngine(staged: readonly Staged[], ctx: EngineContext): EngineResult {
  const held: Held[] = [];
  const hold = (id: string, code: HeldCode, fields: Record<string, string> = {}) => held.push({ stagedId: id, code, fields });
  const list = [...staged].sort(byArrival);

  // Caps: a filer's day.
  const perDay = new Map<string, number>();
  const passing: Entry[] = [];
  for (const s of list) {
    const day = `${s.filer}|${s.receivedAt.slice(0, 10)}`;
    const n = (perDay.get(day) ?? 0) + 1;
    perDay.set(day, n);
    if (n > ctx.caps.perFilerPerDay) {
      hold(s.id, "over_cap", { limit: String(ctx.caps.perFilerPerDay) });
      continue;
    }
    const aim = aimOf(s.kind, s.target, s.body);
    passing.push({ s, aim, keys: keysOfAim(aim), value: valueDigestOf(s) });
  }

  // A person's own seat or application: one card each, untouched by every judgement below.
  const drafts: Draft[] = [];
  const pool: Entry[] = [];
  for (const e of passing) {
    if (e.s.touchesPerson) {
      drafts.push({ id: `card:${e.s.id}`, shape: "one", options: [{ value: e.value, entries: [e] }], touchesPerson: true, first: e.s.receivedAt });
      continue;
    }
    if (e.aim.names.some(mixedScript)) {
      hold(e.s.id, "mixed_script");
      continue;
    }
    const why = checkOne(e, ctx);
    if (why) {
      hold(e.s.id, why.code, why.fields);
      continue;
    }
    pool.push(e);
  }

  // Group: identical values merge; different values on the same thing become one card with options.
  const byValue = new Map<string, Entry[]>();
  for (const e of pool) byValue.set(e.value, [...(byValue.get(e.value) ?? []), e]);
  const values = Array.from(byValue.entries()).map(([value, entries]) => ({ value, entries })).sort((a, b) => byArrival(a.entries[0].s, b.entries[0].s));
  for (const group of components(values.length, (i, j) => aimsMeet(values[i].entries[0].aim, values[j].entries[0].aim))) {
    const options = group.map((i) => values[i]).sort((a, b) => byArrival(a.entries[0].s, b.entries[0].s));
    const kept = options.slice(0, Math.max(1, ctx.caps.optionsPerThing));
    for (const o of options.slice(kept.length)) for (const e of o.entries) hold(e.s.id, "too_many_options", { limit: String(ctx.caps.optionsPerThing) });
    const lead = kept[0].entries[0];
    drafts.push({
      id: `card:${lead.s.id}`,
      shape: kept.length > 1 ? "choose" : kept[0].entries.length > 1 ? "joined" : "one",
      options: kept,
      touchesPerson: false,
      first: lead.s.receivedAt,
    });
  }

  // Order: what each card needs and creates. A person's own seat or application is ordered by arrival alone.
  const needs = new Map<string, string[]>();
  const provides = new Map<string, string[]>();
  for (const d of drafts) {
    const need = new Set<string>();
    const give = new Set<string>();
    if (!d.touchesPerson) {
      for (const e of entriesOf(d)) {
        for (const r of [...needsOf(e.s.kind, e.s.target, e.s.body), ...(e.s.needs ?? [])]) if (!ctx.liveRefs.has(r)) need.add(r);
        for (const r of e.s.provides ?? []) give.add(r);
      }
    }
    give.forEach((r) => need.delete(r));
    needs.set(d.id, Array.from(need).sort());
    provides.set(d.id, Array.from(give).sort());
  }
  const holdCard = (d: Draft, code: HeldCode, fields: Record<string, string>) => {
    for (const e of entriesOf(d)) hold(e.s.id, code, fields);
  };
  const earliest = (a: Draft, b: Draft) => a.first.localeCompare(b.first) || a.id.localeCompare(b.id);
  const provider = (among: readonly Draft[], d: Draft, r: string) => among.filter((p) => p !== d && provides.get(p.id)!.includes(r)).sort(earliest)[0];

  // Batches: one filer and one stream each. A card several filers sent is a batch of its own.
  const batchKey = (d: Draft) => {
    const who = new Set(entriesOf(d).map((e) => `${e.s.stream}|${e.s.filer}`));
    return who.size === 1 ? Array.from(who)[0] : `shared|${d.id}`;
  };

  // Settle what can be shown: a card whose need nothing meets is held; a card in a cycle inside its batch is held;
  // a card that needs a held card is held with it. Repeat until nothing changes, so no card ever looks ready while
  // the thing it needs sits in Held.
  let live = [...drafts];
  let order = new Map<string, Draft[]>();
  for (let changed = true; changed; ) {
    changed = false;
    const keep: Draft[] = [];
    for (const d of live) {
      const missing = needs.get(d.id)!.find((r) => !provider(live, d, r));
      if (!missing) {
        keep.push(d);
        continue;
      }
      // Something staged would create it, but it is held: the card waits in Held with it, named as such.
      const mine = new Set(entriesOf(d).map((e) => e.s.id));
      const wasProvided = list.some((s) => !mine.has(s.id) && (s.provides ?? []).includes(missing));
      holdCard(d, wasProvided ? "waits_on_held" : "needs_missing", { needs: missing });
      changed = true;
    }
    live = keep;
    if (changed) continue;

    // Inside a batch, a card goes after the card it needs: Kahn's order, ties by arrival.
    order = new Map();
    for (const d of live) order.set(batchKey(d), [...(order.get(batchKey(d)) ?? []), d]);
    const cyclic: Draft[] = [];
    for (const members of Array.from(order.values())) {
      const inBatch = new Set(members.map((d) => d.id));
      const after = new Map<string, string[]>(
        members.map((d) => [d.id, needs.get(d.id)!.map((r) => provider(live, d, r)!).filter((p) => inBatch.has(p.id)).map((p) => p.id)]),
      );
      const done = new Set<string>();
      const sorted: Draft[] = [];
      const left = [...members].sort(earliest);
      while (left.length) {
        const i = left.findIndex((d) => after.get(d.id)!.every((p) => done.has(p)));
        if (i < 0) break;
        const [d] = left.splice(i, 1);
        done.add(d.id);
        sorted.push(d);
      }
      members.splice(0, members.length, ...sorted);
      cyclic.push(...left);
    }
    if (cyclic.length) {
      for (const d of cyclic) holdCard(d, "order_cycle", { with: cyclic.filter((x) => x !== d).map((x) => x.id).join(",") });
      const gone = new Set(cyclic.map((d) => d.id));
      live = live.filter((d) => !gone.has(d.id));
      changed = true;
    }
  }

  const cards: Card[] = [];
  const batches: Batch[] = [];
  const firstOf = (ds: readonly Draft[]) => ds.reduce((m, d) => (d.first < m ? d.first : m), ds[0].first);
  const groups = Array.from(order.entries()).filter(([, ds]) => ds.length).sort((a, b) => firstOf(a[1]).localeCompare(firstOf(b[1])) || a[0].localeCompare(b[0]));
  for (const [key, members] of groups) {
    const inBatch = new Set(members.map((d) => d.id));
    const [stream, filer] = key.startsWith("shared|") ? [null, null] : (key.split("|") as [StreamId, string]);
    const batchId = `batch:${members[0].id.slice("card:".length)}`;
    batches.push({ id: batchId, stream, filer, cardIds: members.map((d) => d.id) });
    members.forEach((d, position) => {
      const across = needs.get(d.id)!.map((r) => provider(live, d, r)!).find((p) => !inBatch.has(p.id));
      const options: Option[] = d.options.map((o) => ({ valueDigest: o.value, credits: o.entries.map(creditOf) }));
      cards.push({
        id: d.id,
        shape: d.shape,
        options,
        keys: Array.from(new Set(entriesOf(d).flatMap((e) => e.keys))).sort(),
        touchesPerson: d.touchesPerson,
        batchId,
        position,
        waitsOn: across ? across.id : null,
        version: digest(
          canonicalJson({
            id: d.id,
            options: options.map((o) => ({ v: o.valueDigest, by: o.credits.map((c) => c.stagedId) })),
            live: entriesOf(d).map((e) => ctx.liveDigest?.[e.s.id] ?? null),
          }),
        ),
      });
    });
  }

  held.sort((a, b) => a.stagedId.localeCompare(b.stagedId) || a.code.localeCompare(b.code));
  return { cards, held, batches };
}
