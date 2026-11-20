/**
 * SHARING ONE ROLE'S DELIVERABLES ACROSS SEVERAL CANDIDATES (the lead, 20 Nov 2026): "how we can accept multiple
 * candidates for the same role and not overlapping in their deliverables ... getting the most contributions to the
 * organization across as many candidates that are qualified."
 *
 * A MAP, NEVER A JUDGEMENT. This file reads only three things: the deliverables each candidate wrote, their
 * commitment, and the role's own outcomes and the commitment it needs in all. It never reads a name, an email, a
 * note, a score, a reference or anything else about the person, so it cannot prefer one person to another, and the
 * refusal test holds it to that (server/lib/applicationReview.refusal.test.ts).
 *
 *   - QUALIFIED FIRST, BY A PERSON. Only the candidates a person marked as qualified are mapped. Who is qualified is
 *     theirs to say, before this runs; nothing here says it.
 *   - NO ORDER BY MERIT. Candidates come back in the order the person gave them. Nothing is scored, ranked, rated or
 *     recommended: the output has no field that could hold one.
 *   - OVERLAPS ARE NAMED. A piece of work two or more of them offered is listed with everybody who offered it.
 *   - SPLITS ARE SUGGESTIONS. Each split hands every shared piece to exactly one of the people who offered it, by a
 *     plain rule written beside it (`SPLIT_RULES`): the fewest pieces held so far, or the most room for their
 *     commitment. A tie goes to whoever the person listed first. A person moves any piece with `movePiece`, and
 *     nothing here accepts, declines, sends or saves anything.
 *   - THE COMMITMENTS ADD UP, or they do not, and it says which (`commitmentSum`).
 *
 * Two deliverables are the same piece when their words match once case, punctuation and the small joining words
 * are set aside, or when most of their meaningful words are shared (`samePiece`). A deliverable picked from the
 * role's own outcomes therefore lands on that outcome's piece exactly.
 *
 * Pure: no Node builtins, no clock, no model.
 */

export interface SplitCandidate {
  /** The comparison's own key for this proposal. Never a name. */
  key: string;
  deliverables: readonly string[];
  /** Their commitment for this role, 0 to 100, or null when they gave none. */
  commitmentPct: number | null;
}

export interface Piece {
  id: string;
  /** The words, as the first person to offer it wrote them (or as the role writes its outcome). */
  text: string;
  /** The keys of the candidates who offered it, in the order the candidates were given. */
  offeredBy: string[];
  /** Whether it is one of the role's own outcomes. */
  roleOutcome: boolean;
}

export interface Overlap {
  pieceId: string;
  text: string;
  by: string[];
}

export const SPLIT_RULES = ["fewest-first", "room-for-commitment"] as const;
export type SplitRule = (typeof SPLIT_RULES)[number];

/** One suggested way to hold the work: each candidate's key to the pieces they would hold. */
export interface SplitOption {
  rule: SplitRule;
  holds: Record<string, string[]>;
}

export interface CommitmentSum {
  total: number;
  target: number;
  state: "fits" | "over" | "under";
  /** How far over or under, 0 when it fits. */
  gap: number;
  /** Candidates who gave no commitment, so the sum leaves them out. */
  unknown: string[];
}

export interface DeliverableMap {
  /** The qualified candidates, in the order given. */
  candidates: string[];
  pieces: Piece[];
  overlaps: Overlap[];
  /** Pieces only one candidate offered, by candidate. */
  onlyThem: Record<string, string[]>;
  /** The role's own outcomes nobody offered. */
  unclaimed: string[];
  splits: SplitOption[];
  commitment: CommitmentSum;
}

const SMALL_WORDS = new Set(
  "a an and are as at be by for from in into is it its of on or our so that the their them they this to up we will with you your i ill my me all each every".split(" "),
);

/** The meaningful words of a deliverable, case and punctuation set aside, a plural or an -ing folded. */
export function wordsOf(text: string): string[] {
  return String(text ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1 && !SMALL_WORDS.has(w))
    .map((w) => (w.length > 3 && w.endsWith("s") && !w.endsWith("ss") ? w.slice(0, -1) : w))
    .map((w) => (w.length > 5 && w.endsWith("ing") ? w.slice(0, -3) : w));
}

/** Whether two deliverables are the same piece of work. */
export function samePiece(a: string, b: string): boolean {
  const wa = wordsOf(a);
  const wb = wordsOf(b);
  if (!wa.length || !wb.length) return false;
  if (wa.join(" ") === wb.join(" ")) return true;
  const A = new Set(wa);
  const B = new Set(wb);
  let shared = 0;
  A.forEach((w) => {
    if (B.has(w)) shared++;
  });
  const union = new Set([...wa, ...wb]).size;
  return shared >= 2 && shared / union >= 0.5;
}

/** The sum of the qualified candidates' commitments against what the role needs in all. */
export function commitmentSum(candidates: readonly SplitCandidate[], target: number | null): CommitmentSum {
  const need = typeof target === "number" && target > 0 ? target : 100;
  let total = 0;
  const unknown: string[] = [];
  for (const c of candidates) {
    if (typeof c.commitmentPct === "number" && c.commitmentPct >= 0) total += c.commitmentPct;
    else unknown.push(c.key);
  }
  const state = total === need ? "fits" : total > need ? "over" : "under";
  return { total, target: need, state, gap: Math.abs(total - need), unknown };
}

/**
 * Map the qualified candidates' deliverables for one role. `qualified` is the keys a person marked, in their order;
 * candidates not in it are left out entirely.
 */
export function mapDeliverables(all: readonly SplitCandidate[], qualified: readonly string[], roleOutcomes: readonly string[], roleTarget: number | null): DeliverableMap {
  const byKey = new Map(all.map((c) => [c.key, c]));
  const candidates = qualified.filter((k, i) => byKey.has(k) && qualified.indexOf(k) === i).map((k) => byKey.get(k) as SplitCandidate);
  const pieces: Piece[] = [];
  const pieceFor = (text: string, roleOutcome: boolean): Piece | null => {
    const clean = String(text ?? "").trim();
    if (!clean || !wordsOf(clean).length) return null;
    const found = pieces.find((p) => samePiece(p.text, clean));
    if (found) return found;
    const made: Piece = { id: `p${pieces.length + 1}`, text: clean, offeredBy: [], roleOutcome };
    pieces.push(made);
    return made;
  };
  for (const o of roleOutcomes) pieceFor(o, true);
  for (const c of candidates) {
    for (const d of c.deliverables) {
      const p = pieceFor(d, false);
      if (p && !p.offeredBy.includes(c.key)) p.offeredBy.push(c.key);
    }
  }
  const offered = pieces.filter((p) => p.offeredBy.length > 0);
  const overlaps = offered.filter((p) => p.offeredBy.length > 1).map((p) => ({ pieceId: p.id, text: p.text, by: [...p.offeredBy] }));
  const onlyThem: Record<string, string[]> = {};
  for (const c of candidates) onlyThem[c.key] = offered.filter((p) => p.offeredBy.length === 1 && p.offeredBy[0] === c.key).map((p) => p.id);
  const unclaimed = pieces.filter((p) => p.roleOutcome && p.offeredBy.length === 0).map((p) => p.id);
  const order = candidates.map((c) => c.key);
  const splits: SplitOption[] = [splitBy("fewest-first", offered, order, candidates)];
  if (candidates.length && candidates.every((c) => typeof c.commitmentPct === "number" && c.commitmentPct > 0)) {
    splits.push(splitBy("room-for-commitment", offered, order, candidates));
  }
  return { candidates: order, pieces, overlaps, onlyThem, unclaimed, splits, commitment: commitmentSum(candidates, roleTarget) };
}

/**
 * One split by one rule. Every piece only one person offered stays with them; each shared piece, in the order the
 * pieces were found, goes to one of the people who offered it:
 *   fewest-first          whoever holds the fewest pieces so far;
 *   room-for-commitment   whoever holds the fewest pieces for each part of their commitment.
 * A tie goes to whoever the person listed first. Nothing about the person is read.
 */
function splitBy(rule: SplitRule, offered: readonly Piece[], order: readonly string[], candidates: readonly SplitCandidate[]): SplitOption {
  const holds: Record<string, string[]> = Object.fromEntries(order.map((k) => [k, [] as string[]]));
  for (const p of offered) if (p.offeredBy.length === 1) holds[p.offeredBy[0]].push(p.id);
  const weight = new Map(candidates.map((c) => [c.key, rule === "room-for-commitment" ? Math.max(1, c.commitmentPct ?? 1) : 1]));
  for (const p of offered) {
    if (p.offeredBy.length < 2) continue;
    let best = p.offeredBy[0];
    for (const k of p.offeredBy) {
      const load = (holds[k].length + 1) / (weight.get(k) ?? 1);
      const bestLoad = (holds[best].length + 1) / (weight.get(best) ?? 1);
      if (load < bestLoad || (load === bestLoad && order.indexOf(k) < order.indexOf(best))) best = k;
    }
    holds[best].push(p.id);
  }
  return { rule, holds };
}

/** Move one piece to another candidate (or to nobody, with `to` null). Returns a new map; the old one is kept. */
export function movePiece(holds: Readonly<Record<string, readonly string[]>>, pieceId: string, to: string | null): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const [k, ids] of Object.entries(holds)) out[k] = ids.filter((id) => id !== pieceId);
  if (to !== null && to in out) out[to] = [...out[to], pieceId];
  return out;
}

/** Pieces two or more people hold in one split: none, once a split has no overlap left. */
export function heldTwice(holds: Readonly<Record<string, readonly string[]>>): string[] {
  const seen = new Map<string, number>();
  for (const ids of Object.values(holds)) for (const id of ids) seen.set(id, (seen.get(id) ?? 0) + 1);
  return Array.from(seen.entries()).filter(([, n]) => n > 1).map(([id]) => id);
}

/** Pieces somebody offered that nobody holds in a split, after a person moved them away. */
export function heldByNobody(map: Pick<DeliverableMap, "pieces">, holds: Readonly<Record<string, readonly string[]>>): string[] {
  const held = new Set(Object.values(holds).flat());
  return map.pieces.filter((p) => p.offeredBy.length > 0 && !held.has(p.id)).map((p) => p.id);
}

/**
 * A commitment for each candidate that fits the role's need, for a person to put in each counter-offer if they choose.
 * When their own commitments already fit within the need, each keeps their own. When they run over, each is scaled by
 * the same share and rounded down to a step of ten, never below ten. The same rule for everybody; nothing about the
 * person is read. A candidate who gave none gets none.
 */
export function fittedCommitments(candidates: readonly SplitCandidate[], target: number | null): Record<string, number | null> {
  const sum = commitmentSum(candidates, target);
  const scale = sum.state === "over" && sum.total > 0 ? sum.target / sum.total : 1;
  const out: Record<string, number | null> = {};
  for (const c of candidates) {
    if (typeof c.commitmentPct !== "number") out[c.key] = null;
    else if (scale === 1) out[c.key] = c.commitmentPct;
    else out[c.key] = Math.max(10, Math.floor((c.commitmentPct * scale) / 10) * 10);
  }
  return out;
}
