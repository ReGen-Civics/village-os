import { describe, expect, it } from "vitest";
import { readDeliverables } from "./roleDeliverables";
import { deliverableLine, deliverablesFromText } from "./roleDeliverablesText";
import { ganttLayout, splitGates } from "./roleDeliverablesGantt";

describe("what a deliverable feeds (the lead, 20 Nov 2026)", () => {
  it("keeps up to 80 characters, refuses more, and round-trips through the editor's text form", () => {
    const ok = readDeliverables([{ title: "Budget", start: "2027-01-05", end: "2027-01-31", feeds: "  the  first moon's  plan " }]);
    expect(ok).toEqual({ ok: true, value: [{ title: "Budget", start: "2027-01-05", end: "2027-01-31", feeds: "the first moon's plan" }] });
    expect(readDeliverables([{ title: "Budget", start: "2027-01-05", feeds: "x".repeat(81) }]).ok).toBe(false);
    const line = deliverableLine({ title: "Budget", start: "2027-01-05", end: "2027-01-31", feeds: "the plan" });
    expect(line).toBe("2027-01-05 | 2027-01-31 | Budget |  | the plan");
    const back = deliverablesFromText(line);
    expect(back.ok && readDeliverables(back.value)).toEqual({ ok: true, value: [{ title: "Budget", start: "2027-01-05", end: "2027-01-31", feeds: "the plan" }] });
    // Control: a row with nothing after its title writes no trailing columns.
    expect(deliverableLine({ title: "Budget", start: "2027-01-05", end: "2027-01-31" })).toBe("2027-01-05 | 2027-01-31 | Budget");
  });
});

describe("three roles, one timeline: the gates", () => {
  const rows = [
    { role: "Finance", title: "Budget", start: "2027-01-05", end: "2027-01-31" },
    { role: "Finance", title: "Land closes", start: "2027-02-01", end: "2027-02-01", milestone: true },
    { role: "Build", title: "land closes", start: "2027-02-01", end: "2027-02-01", milestone: true },
    { role: "Build", title: "Permits filed", start: "2027-02-01", end: "2027-02-01", milestone: true },
    { role: "People", title: "Permits filed", start: "2027-02-01", end: "2027-02-01", milestone: true },
    { role: "People", title: "Team retreat", start: "2027-03-10", end: "2027-03-10", milestone: true },
  ];

  it("makes a one-day row two or more roles share a gate, and leaves one role's milestone in its lane", () => {
    const { rows: lanes, gates } = splitGates(rows);
    expect(gates.map((g) => `${g.role}:${g.title}`)).toEqual(["Finance:Land closes", "Build:land closes", "Build:Permits filed", "People:Permits filed"]);
    expect(lanes.map((r) => r.title)).toEqual(["Budget", "Team retreat"]);
  });

  it("labels gates that fall on one day once, with each title once, and keeps them out of the bars", () => {
    const layout = ganttLayout(rows, "2027-01-20")!;
    expect(layout.gates).toHaveLength(1);
    expect(layout.gates[0]).toMatchObject({ day: "2027-02-01", titles: ["Land closes", "Permits filed"], roles: ["Finance", "Build", "People"] });
    expect(layout.gates[0].at).toBeGreaterThan(0);
    expect(layout.gates[0].at).toBeLessThan(1);
    expect(layout.bars.map((b) => b.title)).toEqual(["Budget", "Team retreat"]);
    expect(layout.today).not.toBeNull();
  });

  it("draws no gates on one role's chart (control)", () => {
    expect(ganttLayout(rows.map(({ role: _r, ...d }) => d))!.gates).toEqual([]);
  });
});
