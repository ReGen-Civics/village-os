/**
 * A season_goals proposal keeps the ids of the goals it rewords or moves, so the
 * quests and moon items linked to a goal (GOAL_LINK_TABLES) stay linked.
 * No database: the season route is a fake `run` that records what it was sent.
 */
import { describe, expect, it } from "vitest";
import type { Pool } from "mysql2/promise";
import { applyProposal, checkProposal, liveOf, type KindDeps, type Run } from "./proposedChanges";
import { keptGoalIds } from "../../shared/proposedChanges";

const HELD = [
  { id: "gwater", text: "Water", done: false },
  { id: "gfood", text: "Food", done: true },
  { id: "gshelter", text: "Shelter", done: false },
];

const deps = (): KindDeps => ({
  pool: {} as Pool,
  content: () => ({}),
  faqs: () => ({}),
  seasons: () => [{ id: "s1", name: "Dry season", goals: HELD }],
  routeExists: () => true,
});

/** The seasons route, faked: answers the season list and keeps every PUT. */
function seasonsRoute() {
  const puts: Array<Record<string, any>> = [];
  const run: Run = async (method, _path, body) => {
    if (method === "GET") return { status: 200, body: { currentId: "s1", seasons: [{ id: "s1", name: "Dry season", goals: HELD }, { id: "s0", goals: [] }] } };
    puts.push(body as Record<string, any>);
    return { status: 200, body: { ok: true } };
  };
  const goalsSent = () => puts[0].seasons.find((s: any) => s.id === "s1").goals as Array<{ id?: string; text: string; done: boolean }>;
  return { run, puts, goalsSent };
}

const apply = async (goals: unknown[]) => {
  const r = seasonsRoute();
  const out = await applyProposal(deps(), r.run, "season_goals", { seasonId: "s1" }, { goals });
  expect(out).toEqual({ ok: true });
  return r.goalsSent();
};

describe("season_goals apply keeps goal ids", () => {
  it("a reworded goal that carries its id keeps that id", async () => {
    const goals = await apply([{ id: "gwater", text: "Wells and water" }, { text: "Food", done: true }, { text: "Shelter" }]);
    expect(goals[0]).toEqual({ id: "gwater", text: "Wells and water", done: false });
  });

  it("an id that is not held is never invented: the goal falls back to the word match, else no id", async () => {
    const goals = await apply([{ id: "gmadeup", text: "Food" }, { id: "gother", text: "Roads" }]);
    expect(goals).toEqual([
      { id: "gfood", text: "Food", done: false },
      { text: "Roads", done: false },
    ]);
  });

  it("two goals naming one id: the first keeps it, the later one falls back", async () => {
    const goals = await apply([{ id: "gwater", text: "Wells" }, { id: "gwater", text: "Rain" }, { id: "gwater", text: "Shelter" }]);
    expect(goals.map((g) => g.id)).toEqual(["gwater", undefined, "gshelter"]);
  });

  it("a word match never takes an id another goal named", async () => {
    const goals = await apply([{ text: "Water" }, { id: "gwater", text: "Wells and water" }]);
    expect(goals).toEqual([
      { text: "Water", done: false },
      { id: "gwater", text: "Wells and water", done: false },
    ]);
  });

  it("the word-for-word path is unchanged: no id, same words, same id", async () => {
    const goals = await apply([{ text: " Water " }, { text: "Food", done: true }, { text: "Gardens" }]);
    expect(goals).toEqual([
      { id: "gwater", text: "Water", done: false },
      { id: "gfood", text: "Food", done: true },
      { text: "Gardens", done: false },
    ]);
  });

  it("the new list's order is the order saved, ids travelling with their goals, other seasons untouched", async () => {
    const r = seasonsRoute();
    await applyProposal(deps(), r.run, "season_goals", { seasonId: "s1" }, {
      goals: [{ id: "gshelter", text: "Homes for families" }, { id: "gwater", text: "Wells and water" }, { id: "gfood", text: "Food forest", done: true }],
    });
    expect(r.goalsSent().map((g) => [g.id, g.text])).toEqual([
      ["gshelter", "Homes for families"],
      ["gwater", "Wells and water"],
      ["gfood", "Food forest"],
    ]);
    expect(r.puts[0].seasons.find((s: any) => s.id === "s0")).toEqual({ id: "s0", goals: [] });
    expect(r.puts[0].currentId).toBeUndefined();
  });
});

describe("season_goals validation", () => {
  const check = (goals: unknown[]) => checkProposal(deps(), { kind: "season_goals", target: { seasonId: "s1" }, body: { goals }, summary: "Reword the goals" });

  it("accepts a goal carrying a string id", async () => {
    expect((await check([{ id: "gwater", text: "Wells and water" }])).ok).toBe(true);
  });

  it("refuses an id that is not text, naming the field", async () => {
    const r = await check([{ text: "Food" }, { id: 7, text: "Wells and water" }]);
    expect(r).toMatchObject({ ok: false, field: "goals.1.id" });
  });
});

describe("season_goals review: live reads row for row", () => {
  it("each proposed goal reads against the held goal it keeps, a new one against nothing", async () => {
    const live = await liveOf(deps(), seasonsRoute().run, "season_goals", { seasonId: "s1" }, {
      goals: [{ id: "gshelter", text: "Homes" }, { text: "Gardens" }, { id: "gwater", text: "Wells and water" }],
    });
    expect(live).toEqual({ goals: [{ text: "Shelter", done: false }, null, { text: "Water", done: false }] });
  });
});

describe("keptGoalIds", () => {
  it("answers index for index and ignores held goals with no id", () => {
    expect(keptGoalIds([{ text: "Water" }, { id: "gfood", text: "Food" }], [{ text: "Water" }, { text: "Food" }, { id: "", text: "x" }])).toEqual([null, "gfood", null]);
  });
});
