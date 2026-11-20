/**
 * Sharing one role's deliverables across several qualified candidates (the lead, 20 Nov 2026): overlaps named,
 * splits with no piece held twice, commitments added up, and a map that reads nothing about the person.
 */
import { describe, expect, it } from "vitest";
import { commitmentSum, fittedCommitments, heldByNobody, heldTwice, mapDeliverables, movePiece, samePiece, wordsOf, type SplitCandidate } from "./deliverableSplit";

const OUTCOMES = ["Keep the seed bank catalogued", "Run the weekly garden circle", "Plan the dry season planting"];
const A: SplitCandidate = { key: "op:1:r", deliverables: ["Keep the seed bank catalogued", "Run the weekly garden circle", "Build a compost system"], commitmentPct: 50 };
const B: SplitCandidate = { key: "op:2:r", deliverables: ["Run the weekly garden circle.", "Plan the dry-season planting"], commitmentPct: 40 };
const C: SplitCandidate = { key: "sa:3:r", deliverables: ["keep THE seed bank catalogued", "Teach children to save seeds"], commitmentPct: 30 };

describe("telling two deliverables apart", () => {
  it("reads the same work in other case, punctuation or a joining word as one piece", () => {
    expect(samePiece("Run the weekly garden circle", "run the weekly garden circle.")).toBe(true);
    expect(samePiece("Plan the dry season planting", "Plan the dry-season planting")).toBe(true);
    expect(samePiece("Build a compost system", "Teach children to save seeds")).toBe(false);
    expect(wordsOf("The seeds, and the plantings!")).toEqual(["seed", "plant"]);
  });
});

describe("the map", () => {
  const map = mapDeliverables([A, B, C], [A.key, B.key, C.key], OUTCOMES, 100);

  it("names each overlap with everybody who offered it", () => {
    expect(map.overlaps.map((o) => ({ text: o.text, by: o.by }))).toEqual([
      { text: "Keep the seed bank catalogued", by: [A.key, C.key] },
      { text: "Run the weekly garden circle", by: [A.key, B.key] },
    ]);
  });

  it("lists what only one offered, and the role's outcomes nobody offered", () => {
    const text = (ids: string[]) => ids.map((id) => map.pieces.find((p) => p.id === id)?.text);
    expect(text(map.onlyThem[A.key])).toEqual(["Build a compost system"]);
    expect(text(map.onlyThem[B.key])).toEqual(["Plan the dry season planting"]);
    expect(text(map.onlyThem[C.key])).toEqual(["Teach children to save seeds"]);
    expect(map.unclaimed).toEqual([]);
    const thin = mapDeliverables([B], [B.key], OUTCOMES, 100);
    expect(text(thin.unclaimed.map((x) => x))).toEqual(["Keep the seed bank catalogued"]);
  });

  it("offers splits in which no piece is held twice and every offered piece is held by someone who offered it", () => {
    expect(map.splits.map((s) => s.rule)).toEqual(["fewest-first", "room-for-commitment"]);
    for (const s of map.splits) {
      expect(heldTwice(s.holds)).toEqual([]);
      expect(heldByNobody(map, s.holds)).toEqual([]);
      for (const [k, ids] of Object.entries(s.holds)) for (const id of ids) expect(map.pieces.find((p) => p.id === id)?.offeredBy).toContain(k);
    }
  });

  it("CONTROL: holding every offered piece by everyone who offered it does show the overlap", () => {
    const naive: Record<string, string[]> = {};
    for (const p of map.pieces) for (const k of p.offeredBy) (naive[k] ??= []).push(p.id);
    expect(heldTwice(naive)).toHaveLength(2);
  });

  it("spreads the shared pieces so each person holds some work", () => {
    const fewest = map.splits[0].holds;
    expect(Object.values(fewest).every((ids) => ids.length >= 1)).toBe(true);
  });

  it("lets a person move a piece, and says when that leaves one held twice or by nobody", () => {
    const s = map.splits[0].holds;
    const piece = map.onlyThem[A.key][0];
    const toB = movePiece(s, piece, B.key);
    expect(toB[A.key]).not.toContain(piece);
    expect(toB[B.key]).toContain(piece);
    expect(s[A.key]).toContain(piece); // the suggestion itself is kept
    expect(heldByNobody(map, movePiece(s, piece, null))).toEqual([piece]);
  });

  it("maps only the candidates a person marked qualified, in the order they marked them", () => {
    const two = mapDeliverables([A, B, C], [C.key, A.key], OUTCOMES, 100);
    expect(two.candidates).toEqual([C.key, A.key]);
    expect(Object.keys(two.splits[0].holds)).toEqual([C.key, A.key]);
    expect(two.pieces.some((p) => p.offeredBy.includes(B.key))).toBe(false);
    expect(mapDeliverables([A, B], [], OUTCOMES, 100).candidates).toEqual([]);
  });

  it("leaves out the commitment rule when someone gave no commitment", () => {
    const none = mapDeliverables([A, { ...B, commitmentPct: null }], [A.key, B.key], OUTCOMES, 100);
    expect(none.splits.map((s) => s.rule)).toEqual(["fewest-first"]);
  });
});

describe("the commitments", () => {
  it("say whether they fit, run over or fall short of what the role needs", () => {
    expect(commitmentSum([A, B], 100)).toEqual({ total: 90, target: 100, state: "under", gap: 10, unknown: [] });
    expect(commitmentSum([A, B, C], 100)).toMatchObject({ total: 120, state: "over", gap: 20 });
    expect(commitmentSum([A, { ...B, commitmentPct: 50 }], null)).toMatchObject({ total: 100, target: 100, state: "fits", gap: 0 });
    expect(commitmentSum([A, { ...B, commitmentPct: null }], 100).unknown).toEqual([B.key]);
  });

  it("fits commitments that run over by one share for everybody, in steps of ten, never below ten", () => {
    expect(fittedCommitments([A, B, C], 100)).toEqual({ [A.key]: 40, [B.key]: 30, [C.key]: 20 });
    expect(fittedCommitments([A, B], 100)).toEqual({ [A.key]: 50, [B.key]: 40 });
    expect(fittedCommitments([{ ...A, commitmentPct: 100 }, { ...B, commitmentPct: 10 }], 100)[B.key]).toBe(10);
  });
});
