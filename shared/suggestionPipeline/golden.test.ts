/**
 * THE GOLDEN SET: the test of the review engine (docs/REVIEW_INBOX_PLAN.md, "The golden set").
 *
 * Each file in ./golden is one scene: what is staged, what the village holds, and what the engine must make of it.
 * The scenes here are SYNTHETIC, written to the named cases in the plan. Scenes drawn from real past suggestions
 * join them through the redacting export (people become roles, no applicant data, no amounts), each read by a
 * person before it is committed.
 *
 * A record in a scene's context (a discard, an open vote, a decision) names what it was about as a suggestion
 * (`of`), and is turned into keys by the engine's own functions, so a scene states intent and never hand-writes a key.
 */
import { readdirSync, readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";
import type { ProposalKind } from "../proposedChanges";
import { runEngine, valueDigestOf, type EngineContext, type Staged } from "./engine";
import { aimOf, keysOfAim } from "./keys";

type Of = { kind: ProposalKind; target: Record<string, unknown>; body: Record<string, unknown> };

interface Scene {
  name: string;
  why: string;
  synthetic: boolean;
  staged: Staged[];
  context?: {
    now?: string;
    rediscardDays?: number;
    caps?: EngineContext["caps"];
    alreadyLive?: string[];
    targetGone?: string[];
    liveRefs?: string[];
    released?: string[];
    discarded?: { of: Of; at: string; code: string }[];
    openVotes?: { of: Of; ref: string; closesAt: string | null }[];
    decisions?: { of: Of; at: string; code: string }[];
  };
  expect: {
    cards: { shape: string; options: string[][]; batch?: number; position?: number; waitsOn?: string }[];
    held: { stagedId: string; code: string }[];
  };
}

const DIR = join(__dirname, "golden");
const keysOf = (of: Of) => keysOfAim(aimOf(of.kind, of.target, of.body));

function contextOf(scene: Scene): EngineContext {
  const c = scene.context ?? {};
  return {
    now: c.now ?? "2026-11-21T12:00:00.000Z",
    rediscardDays: c.rediscardDays ?? 30,
    caps: c.caps ?? { perFilerPerDay: 50, optionsPerThing: 5 },
    alreadyLive: new Set(c.alreadyLive ?? []),
    targetGone: new Set(c.targetGone ?? []),
    liveRefs: new Set(c.liveRefs ?? []),
    released: new Set(c.released ?? []),
    discarded: (c.discarded ?? []).map((d) => ({ keys: keysOf(d.of), valueDigest: valueDigestOf(d.of), at: d.at, code: d.code })),
    openVotes: (c.openVotes ?? []).map((v) => ({ keys: keysOf(v.of), ref: v.ref, closesAt: v.closesAt })),
    decisions: (c.decisions ?? []).map((d) => ({ keys: keysOf(d.of), at: d.at, code: d.code })),
  };
}

const scenes: Scene[] = readdirSync(DIR)
  .filter((f) => f.endsWith(".json"))
  .sort()
  .map((f) => JSON.parse(readFileSync(join(DIR, f), "utf8")) as Scene);

describe("the golden set", () => {
  it("has scenes to run", () => {
    expect(scenes.length).toBeGreaterThan(10);
  });

  for (const scene of scenes) {
    it(`${scene.name}: ${scene.why}`, () => {
      const out = runEngine(scene.staged, contextOf(scene));
      const batchIndex = new Map(out.batches.map((b, i) => [b.id, i]));
      const got = out.cards.map((c) => ({
        shape: c.shape,
        options: c.options.map((o) => o.credits.map((x) => x.stagedId)),
        ...(scene.expect.cards.some((e) => e.batch !== undefined) ? { batch: batchIndex.get(c.batchId), position: c.position } : {}),
        ...(c.waitsOn ? { waitsOn: c.waitsOn.slice("card:".length) } : {}),
      }));
      expect(got).toEqual(scene.expect.cards);
      expect(out.held.map((h) => ({ stagedId: h.stagedId, code: h.code }))).toEqual(scene.expect.held);
      // Every staged item is accounted for exactly once: on a card or in Held.
      const onCards = out.cards.flatMap((c) => c.options.flatMap((o) => o.credits.map((x) => x.stagedId)));
      const all = [...onCards, ...out.held.map((h) => h.stagedId)].sort();
      expect(all).toEqual(scene.staged.map((s) => s.id).sort());
    });
  }

  it("never lets two cards that could both be accepted write the same thing", () => {
    for (const scene of scenes) {
      const out = runEngine(scene.staged, contextOf(scene));
      for (let i = 0; i < out.cards.length; i++)
        for (let j = i + 1; j < out.cards.length; j++) {
          const a = out.cards[i];
          const b = out.cards[j];
          if (a.touchesPerson || b.touchesPerson) continue;
          const shared = a.keys.filter((k) => b.keys.includes(k));
          expect(shared, `${scene.name}: ${a.id} and ${b.id}`).toEqual([]);
        }
    }
  });
});
