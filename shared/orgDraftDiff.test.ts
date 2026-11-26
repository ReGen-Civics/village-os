import { describe, expect, it } from "vitest";
import { lineCounts, lineDiff, MAX_CELLS, wordDiff } from "./orgDraftDiff";

const join = (runs: Array<{ op: string; text: string }>, keep: string) => runs.filter((r) => r.op === "same" || r.op === keep).map((r) => r.text).join("");

describe("wordDiff", () => {
  it("marks the words that went and came, and both sides join back exactly", () => {
    const a = "Steward the land so the project grows within what the watershed can carry.";
    const b = "Steward the land so the village grows within what the watershed can carry, with homes built from local materials.";
    const runs = wordDiff(a, b);
    expect(join(runs, "del")).toBe(a);
    expect(join(runs, "add")).toBe(b);
    expect(runs.filter((r) => r.op === "del").map((r) => r.text)).toEqual(["project", "carry."]);
  });

  it("keeps a changed phrase as one run, removals before additions", () => {
    const runs = wordDiff("so the old shared project grows", "so the new village grows");
    expect(runs).toEqual([
      { op: "same", text: "so the " },
      { op: "del", text: "old shared project" },
      { op: "add", text: "new village" },
      { op: "same", text: " grows" },
    ]);
  });

  it("reads null as empty on either side", () => {
    expect(wordDiff(null, "New words")).toEqual([{ op: "add", text: "New words" }]);
    expect(wordDiff("Old words", null)).toEqual([{ op: "del", text: "Old words" }]);
    expect(wordDiff(null, null)).toEqual([]);
  });

  it("past the table limit, says the whole field was replaced", () => {
    const big = Array.from({ length: Math.ceil(Math.sqrt(MAX_CELLS)) + 10 }, (_, i) => `w${i}`).join(" ");
    expect(wordDiff(big, `${big} more`)).toEqual([{ op: "del", text: big }, { op: "add", text: `${big} more` }]);
  });
});

describe("lineDiff", () => {
  it("diffs a list by line, in the new list's order, and counts it", () => {
    const runs = lineDiff(["Keeps the plan.", "Signs off contracts.", "Holds permits."], ["Keeps the plan.", "Brings contracts over 5,000.", "Holds permits.", "Reports water use."]);
    expect(runs).toEqual([
      { op: "same", text: "Keeps the plan." },
      { op: "del", text: "Signs off contracts." },
      { op: "add", text: "Brings contracts over 5,000." },
      { op: "same", text: "Holds permits." },
      { op: "add", text: "Reports water use." },
    ]);
    expect(lineCounts(runs)).toEqual({ added: 2, removed: 1, kept: 2 });
  });
});
