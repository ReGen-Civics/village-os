import { describe, expect, it } from "vitest";
import { rosterOf } from "./roster";
import { orgChartOf } from "./orgChart";

describe("rosterOf: the roles held now, one card per person (Rye, 17 Nov 2026)", () => {
  it("shows a person with several roles once, every role listed in the order the roles came", () => {
    const r = rosterOf([
      { id: "tech", name: "Technical Operations Steward", holders: ["Rick"] },
      { id: "front", name: "Front-End Steward", holders: ["Rye"] },
      { id: "memory", name: "Living Memory Steward", holders: ["Rick"] },
    ]);
    expect(r.map((e) => e.key)).toEqual(["p:Rick", "p:Rye"]);
    expect(r[0].roles.map((x) => x.id)).toEqual(["tech", "memory"]);
  });
  it("orders people alphabetically, so the order says nothing about anyone", () => {
    expect(rosterOf([{ id: "a", name: "A", holders: ["rye"] }, { id: "b", name: "B", holders: ["Jessica"] }, { id: "c", name: "C", holders: ["Lexi"] }]).map((e) => e.name)).toEqual(["Jessica", "Lexi", "rye"]);
  });
  it("a role held by two people sits on both their cards; a full name shows by its first word only", () => {
    const r = rosterOf([{ id: "ops", name: "Ops", holders: ["Rye Ashby", "Jessica"] }]);
    expect(r.map((e) => [e.name, e.roles.map((x) => x.id)])).toEqual([
      ["Jessica", ["ops"]],
      ["Rye", ["ops"]],
    ]);
  });
  it("a role the village names nobody for keeps its own nameless card (control: never merged into one)", () => {
    const r = rosterOf([{ id: "x", name: "X", holders: [] }, { id: "y", name: "Y", holders: [] }]);
    expect(r.map((e) => [e.key, e.name])).toEqual([
      ["r:x", null],
      ["r:y", null],
    ]);
  });
  it("an agent gets one marked card per role, never one card for every agent", () => {
    const r = rosterOf([{ id: "x", name: "X", holders: ["An agent"] }, { id: "y", name: "Y", holders: ["An agent", "Rye"] }]);
    expect(r.map((e) => [e.key, e.agent])).toEqual([
      ["p:Rye", false],
      ["a:x", true],
      ["a:y", true],
    ]);
  });
});

describe("orgChartOf: the /circles drawing beside the roster (Rye, 16 Nov 2026)", () => {
  const circles = [{ id: "anchor", name: "Anchor Circle" }, { id: "kitchen", name: "Kitchen", parentCircleId: "anchor" }];
  const rows = [
    { id: "finance", circleId: "anchor", seats: 1, holderCount: 0 },
    { id: "ops", circleId: "anchor", seats: 1, holderCount: 1 },
    { id: "soon", circleId: "anchor", seats: 1, holderCount: 0, comingSoon: true },
    { id: "cook", circleId: "kitchen", seats: 1, holderCount: 0 },
  ];
  it("adds the held team roles a visitor's /api/org leaves out, and counts only the team circle", () => {
    const c = orgChartOf(circles, rows, "anchor", [{ id: "ops" }, { id: "tech" }, { id: "ai" }])!;
    expect(c.seats.map((s) => s.id)).toEqual(["finance", "ops", "soon", "cook", "tech", "ai"]);
    expect(c.seats.find((s) => s.id === "tech")).toEqual({ id: "tech", circleId: "anchor", seats: 1, holderCount: 1 });
    // ops is held (from /api/org) plus tech and ai; finance is open; a coming-soon role is drawn and never counted.
    expect(c.counts).toEqual({ circleId: "anchor", circleName: "Anchor Circle", held: 3, open: 1 });
  });
  it("draws nothing without circles or a team circle it can find", () => {
    expect(orgChartOf([], rows, "anchor", [])).toBeNull();
    expect(orgChartOf(circles, rows, null, [])).toBeNull();
    expect(orgChartOf(circles, rows, "gone", [])).toBeNull();
  });
});
