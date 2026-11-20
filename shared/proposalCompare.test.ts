/**
 * Compare proposals (the lead, 20 Nov 2026): the four-limit, one category at a time, and the category filter.
 */
import { describe, expect, it } from "vitest";
import { categoriesOf, inCategory, MAX_COMPARE, pickedItems, pickProblem, questCategory, roleCategory, togglePick, NO_CIRCLE, type CompareItem } from "./proposalCompare";

const item = (key: string, category: string, extra: Partial<CompareItem> = {}): CompareItem => ({
  key,
  kind: "role",
  way: "full",
  ref: key,
  who: key,
  whoKind: "person",
  title: "Garden steward",
  roleId: "r1",
  category,
  commitmentPct: 50,
  aim: "",
  deliverables: [],
  terms: null,
  dates: { earliestStart: null, startsOn: null, termStarts: null, termEnds: null, received: null },
  href: "/x",
  ...extra,
});

const garden = ["a", "b", "c", "d", "e"].map((k) => item(k, roleCategory("c-garden")));
const kitchen = item("k", roleCategory("c-kitchen"));
const all = [...garden, kitchen];

describe("ticking up to four of one category", () => {
  it("takes four and refuses a fifth with a reason, leaving the four as they were", () => {
    let keys: string[] = [];
    for (const i of garden.slice(0, MAX_COMPARE)) {
      const out = togglePick(keys, i, all);
      expect(out.problem).toBeNull();
      keys = out.keys;
    }
    expect(keys).toEqual(["a", "b", "c", "d"]);
    const fifth = togglePick(keys, garden[4], all);
    expect(fifth.problem).toBe("too-many");
    expect(fifth.keys).toEqual(keys);
  });

  it("CONTROL: the limit is four, so a fourth is taken where a fifth is refused", () => {
    expect(MAX_COMPARE).toBe(4);
    expect(pickProblem(garden.slice(0, 3), garden[3])).toBeNull();
    expect(pickProblem(garden.slice(0, 4), garden[4])).toBe("too-many");
  });

  it("refuses one from another category, and takes it once the others are unticked", () => {
    const keys = togglePick([], garden[0], all).keys;
    expect(togglePick(keys, kitchen, all)).toEqual({ keys: ["a"], problem: "other-category" });
    const cleared = togglePick(keys, garden[0], all);
    expect(cleared).toEqual({ keys: [], problem: null });
    expect(togglePick(cleared.keys, kitchen, all)).toEqual({ keys: ["k"], problem: null });
  });

  it("unticking always works, even at the limit", () => {
    const keys = ["a", "b", "c", "d"];
    expect(togglePick(keys, garden[1], all)).toEqual({ keys: ["a", "c", "d"], problem: null });
  });

  it("keeps the order the person ticked in, never a ranking, and drops one that left the list", () => {
    expect(pickedItems(["c", "a", "gone", "b"], all).map((i) => i.key)).toEqual(["c", "a", "b"]);
  });
});

describe("categories come from the data's own grouping", () => {
  it("files a role under its circle and a quest under its circle, with none read as no circle", () => {
    expect(roleCategory("c1")).toBe("circle:c1");
    expect(roleCategory(null)).toBe("circle:none");
    expect(questCategory("Garden ")).toBe("quest:garden");
    expect(questCategory("")).toBe(NO_CIRCLE);
    expect(questCategory(null)).toBe(NO_CIRCLE);
  });

  it("filters to one category in the list's own order, and lists categories with their counts", () => {
    const quest = item("q", questCategory("Garden"), { kind: "quest", way: "quest" });
    const list = [garden[0], kitchen, quest, garden[1]];
    expect(inCategory(list, roleCategory("c-garden")).map((i) => i.key)).toEqual(["a", "b"]);
    expect(inCategory(list, null).map((i) => i.key)).toEqual(["a", "k", "q", "b"]);
    expect(categoriesOf(list, (k) => k.toUpperCase())).toEqual([
      { key: "circle:c-garden", label: "CIRCLE:C-GARDEN", count: 2 },
      { key: "circle:c-kitchen", label: "CIRCLE:C-KITCHEN", count: 1 },
      { key: "quest:garden", label: "QUEST:GARDEN", count: 1 },
    ]);
  });
});
