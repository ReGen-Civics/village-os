import { describe, expect, it } from "vitest";
import { goalOf, nextDeliverables } from "./roleOneMinute";
import type { Deliverable } from "./roleDeliverables";

describe("the role in one minute", () => {
  it("lifts the role's own Goal: line, in any case and after a bullet, and leaves the rest", () => {
    expect(goalOf(["Your part: the budget", "- goal:  a funded first season", "By March: accounts open"])).toEqual({ goal: "a funded first season", rest: ["Your part: the budget", "By March: accounts open"] });
  });

  it("has no goal when no line says Goal:, and keeps every line (control)", () => {
    expect(goalOf(["Goals we share: many", "Your part: the budget"])).toEqual({ goal: "", rest: ["Goals we share: many", "Your part: the budget"] });
  });

  const rows: Deliverable[] = [
    { title: "Report", start: "2027-03-01", end: "2027-03-31" },
    { title: "Budget", start: "2027-01-05", end: "2027-01-31" },
    { title: "Gate", start: "2027-02-01", end: "2027-02-01", milestone: true },
    { title: "Accounts", start: "2027-01-20", end: "2027-02-20" },
  ];

  it("takes the next three by date, the running ones included", () => {
    expect(nextDeliverables(rows, "2027-01-25").map((d) => d.title)).toEqual(["Budget", "Accounts", "Gate"]);
    expect(nextDeliverables(rows, "2027-02-10").map((d) => d.title)).toEqual(["Accounts", "Report"]);
  });

  it("says the last three when every one has passed, and nothing for none", () => {
    expect(nextDeliverables(rows, "2028-01-01").map((d) => d.title)).toEqual(["Accounts", "Gate", "Report"]);
    expect(nextDeliverables([], "2027-01-01")).toEqual([]);
  });
});
