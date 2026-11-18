import { describe, expect, it } from "vitest";
import { readBudgetSheet, splitRecords } from "./budgetSheet";

describe("readBudgetSheet", () => {
  it("reads a CSV with headings into the cells the import route takes", () => {
    const r = readBudgetSheet("Period,Label,Category,Planned,Currency\n2026-11,Garden crew pay,role_pay,\"1,200.00\",USD\n");
    expect(r).toEqual({
      ok: true,
      columns: ["period", "label", "category", "planned", "currency"],
      ignored: [],
      rows: [{ period: "2026-11", label: "Garden crew pay", category: "role_pay", planned: "1,200.00", currency: "USD" }],
    });
  });

  it("reads cells pasted from a spreadsheet (tab separated), names the columns it ignores, and leaves blanks out", () => {
    const r = readBudgetSheet("label\tamount\tcolour\tnote\nSeeds\t40\tgreen\t\n");
    expect(r.ok && r.rows).toEqual([{ label: "Seeds", planned: "40" }]);
    expect(r.ok && r.ignored).toEqual(["colour"]);
  });

  it("keeps a quoted cell whole, with its delimiter, a newline and a doubled quote", () => {
    expect(splitRecords('a,"b, ""c""\nd"\r\n1,2', ",")).toEqual([["a", 'b, "c"\nd'], ["1", "2"]]);
  });

  it("names what is missing", () => {
    expect(readBudgetSheet("  ")).toEqual({ ok: false, problem: "empty" });
    expect(readBudgetSheet("colour,size\nred,1")).toEqual({ ok: false, problem: "no_columns" });
    expect(readBudgetSheet("period,planned\n2026-11,5")).toEqual({ ok: false, problem: "no_label" });
    expect(readBudgetSheet("label,planned\n")).toEqual({ ok: false, problem: "no_rows" });
  });
});
