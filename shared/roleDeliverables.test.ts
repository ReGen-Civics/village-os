import { describe, expect, it } from "vitest";
import { readDay, readDeliverables } from "./roleDeliverables";
import { deliverableLine, deliverablesFromText } from "./roleDeliverablesText";
import { ganttLayout } from "./roleDeliverablesGantt";
import { readSections } from "./roleCardSections";

describe("dated deliverables", () => {
  it("reads rows, makes a one-day row a milestone, and keeps the workstream", () => {
    const r = readDeliverables([
      { title: "Budget agreed", start: "2027-01-05", end: "2027-01-31", workstream: "Finance" },
      { title: "Accounts open", start: "2027-02-01", end: "2027-02-01" },
    ]);
    expect(r).toEqual({
      ok: true,
      value: [
        { title: "Budget agreed", start: "2027-01-05", end: "2027-01-31", workstream: "Finance" },
        { title: "Accounts open", start: "2027-02-01", end: "2027-02-01", milestone: true },
      ],
    });
  });

  it("refuses a bad date, an end before the start, too many rows and payment details", () => {
    expect(readDay("2027-02-30")).toBeNull();
    expect(readDeliverables([{ title: "x", start: "2027-02-30", end: "2027-03-01" }]).ok).toBe(false);
    expect(readDeliverables([{ title: "x", start: "2027-03-02", end: "2027-03-01" }]).ok).toBe(false);
    expect(readDeliverables(Array.from({ length: 13 }, (_, i) => ({ title: `t${i}`, start: "2027-01-01", end: "2027-01-02" }))).ok).toBe(false);
    expect(readDeliverables([{ title: "IBAN GB82WEST12345698765432", start: "2027-01-01" }]).ok).toBe(false);
  });

  it("reads the editor's text form and names the line it cannot read", () => {
    const rows = deliverablesFromText("2027-01-05 | 2027-01-31 | Budget agreed | Finance\n2027-02-01 | | Accounts open");
    expect(rows.ok && readDeliverables(rows.value)).toEqual({
      ok: true,
      value: [
        { title: "Budget agreed", start: "2027-01-05", end: "2027-01-31", workstream: "Finance" },
        { title: "Accounts open", start: "2027-02-01", end: "2027-02-01", milestone: true },
      ],
    });
    const bad = deliverablesFromText("2027-01-05 | 2027-01-31 | Fine\njust words");
    expect(bad).toMatchObject({ ok: false, line: 2 });
    // Text that never read into rows is refused by the one reader.
    expect(readDeliverables("just words").ok).toBe(false);
  });

  it("round-trips through the editor's line", () => {
    const rows = [{ title: "Budget agreed", start: "2027-01-05", end: "2027-01-31", workstream: "Finance" }];
    const text = deliverablesFromText(rows.map((d) => deliverableLine(d)).join("\n"));
    expect(text.ok && readDeliverables(text.value)).toEqual({ ok: true, value: rows });
  });

  it("is kept in the sections only once written, so an old card stores what it stored", () => {
    const empty = readSections({ qualities: ["Calm"] });
    expect(empty.ok && "deliverables" in empty.value).toBe(false);
    const full = readSections({ deliverables: [{ title: "x", start: "2027-01-01", end: "2027-01-09" }], onboarding: ["Meet the circle"] });
    expect(full.ok && full.value.deliverables?.length).toBe(1);
    expect(full.ok && full.value.onboarding).toEqual(["Meet the circle"]);
    const bad = readSections({ deliverables: "nonsense" });
    expect(!bad.ok && bad.field).toBe("sections.deliverables");
  });
});

describe("the timeline's geometry", () => {
  it("spans first start to last end, groups by role then workstream, and places today", () => {
    const g = ganttLayout(
      [
        { title: "A", start: "2027-01-01", end: "2027-01-10", workstream: "One", role: "R1" },
        { title: "B", start: "2027-01-11", end: "2027-01-20", workstream: "Two", role: "R1" },
        { title: "C", start: "2027-01-05", end: "2027-01-05", workstream: "One", role: "R1", milestone: true },
      ],
      "2027-01-11",
    )!;
    expect(g.first).toBe("2027-01-01");
    expect(g.last).toBe("2027-01-20");
    expect(g.bars.map((b) => b.title)).toEqual(["A", "C", "B"]);
    expect(g.bars[0].from).toBe(0);
    expect(g.bars[2].to).toBe(1);
    expect(g.today).toBeCloseTo(0.5);
    expect(g.months.map((m) => m.day)).toEqual(["2027-01-01"]);
  });

  it("leaves today out when it falls outside, and draws nothing for no rows", () => {
    expect(ganttLayout([{ title: "A", start: "2027-01-01", end: "2027-03-10" }], "2026-11-19")!.today).toBeNull();
    expect(ganttLayout([{ title: "A", start: "2027-01-15", end: "2027-03-10" }])!.months.map((m) => m.day)).toEqual(["2027-02-01", "2027-03-01"]);
    expect(ganttLayout([])).toBeNull();
  });
});

describe("where, in the card's own words", () => {
  it("is kept once written, capped, and stands in for the listing's label", async () => {
    const { roleCardView } = await import("./roleCardView");
    const r = readSections({ where: "Near the village (preferred) or remote (possible)" });
    expect(r.ok && r.value.where).toBe("Near the village (preferred) or remote (possible)");
    expect(readSections({ where: "x".repeat(121) }).ok).toBe(false);
    expect(roleCardView({ card: { whereWorked: "both", whereText: "On the land for site work" } }).rows.find((x) => x.id === "where")!.lines).toEqual(["On the land for site work"]);
    // Control: without the card's words, the listing's label.
    expect(roleCardView({ card: { whereWorked: "land" } }).rows.find((x) => x.id === "where")!.lines[0]).not.toBe("On the land for site work");
  });
});
