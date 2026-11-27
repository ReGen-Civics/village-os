import { describe, expect, it } from "vitest";
import { MEASURE_KEYS, NO_DATA, buildMeasures, circlesLed, measuresScope, median, rowsInScope, type ApplicationFact, type HolderFact } from "./roleMeasures";

const H = 3_600_000;
const D = 86_400_000;
const T0 = Date.UTC(2026, 0, 1);
const app = (reply: number | null, interview: number | null, decided: number | null, circleId = "c1"): ApplicationFact => ({
  seasonId: "s1",
  circleId,
  confirmedAt: T0,
  firstReplyAt: reply === null ? null : T0 + reply * H,
  firstInterviewAt: interview === null ? null : T0 + interview * H,
  decidedAt: decided === null ? null : T0 + decided * H,
});
const holder = (o: Partial<HolderFact> = {}): HolderFact => ({
  seasonId: "s1",
  circleId: "c1",
  startedAt: T0,
  endedAt: null,
  pathOpenedAt: T0,
  pathDoneAt: T0 + 20 * D,
  firstQuestDoneAt: T0 + 10 * D,
  renewalsDue: 2,
  renewalsRenewed: 2,
  ...o,
});

describe("buildMeasures", () => {
  it("computes medians and shares per season and circle", () => {
    const apps = [app(2, 24, 100), app(4, 48, 200), app(6, null, 300), app(null, null, null)];
    const holders = [holder(), holder(), holder({ pathDoneAt: T0 + 40 * D, firstQuestDoneAt: null }), holder({ endedAt: T0 + 30 * D, renewalsRenewed: 1 })];
    const [row] = buildMeasures(apps, holders, T0 + 200 * D);
    // Two interviews recorded: their median shows (it was withheld under three before 27 Nov 2026).
    expect(row.applications).toMatchObject({ count: 4, medianHoursToReply: 4, medianHoursToInterview: 36, medianHoursToDecision: 200 });
    expect(row.applications.answered).toEqual({ eligible: 4, yes: 3, share: 0.75 });
    expect(row.holders.pathCompleteBy30).toEqual({ eligible: 4, yes: 3, share: 0.75 });
    expect(row.holders.firstQuestBy14).toEqual({ eligible: 4, yes: 3, share: 0.75 });
    expect(row.holders.stillInRoleAt90).toEqual({ eligible: 4, yes: 3, share: 0.75 });
    expect(row.holders.renewed).toEqual({ eligible: 8, yes: 7, share: 0.88 });
  });
  it("shows numbers built from one or two people, and does not count a window still open", () => {
    const [row] = buildMeasures([app(1, 1, 1), app(2, 2, 2)], [holder(), holder({ pathOpenedAt: T0 + 100 * D })], T0 + 110 * D);
    expect(row.applications.medianHoursToReply).toBe(1.5);
    expect(row.applications.answered).toEqual({ eligible: 2, yes: 2, share: 1 });
    expect(row.holders.pathCompleteBy30).toEqual({ eligible: 1, yes: 1, share: 1 });
    expect(median([7])).toBe(7);
    expect(median([1, 2, 3, 4])).toBe(2.5);
  });
  it("keeps a real zero apart from no data", () => {
    const [row] = buildMeasures([app(null, null, null), app(null, null, null)], [], T0);
    // Two applications, none answered: 0, a measured zero.
    expect(row.applications.answered).toEqual({ eligible: 2, yes: 0, share: 0 });
    // No reply was ever recorded: no data, never 0.
    expect(row.applications.medianHoursToReply).toBe(NO_DATA);
    expect(median([])).toBe(NO_DATA);
    // Nobody seated: a count of 0, and every share with nobody to count is no data.
    expect(row.holders.count).toBe(0);
    expect(row.holders.renewed).toEqual({ eligible: 0, yes: 0, share: NO_DATA });
    expect(NO_DATA).toBeNull();
  });
  it("splits by circle", () => {
    expect(buildMeasures([app(1, 1, 1, "c1"), app(1, 1, 1, "c2")], [], T0)).toHaveLength(2);
  });
  it("carries exactly the declared key set and no name, id of a person or ref", () => {
    const rows = buildMeasures([app(1, 1, 1), app(2, 2, 2), app(3, 3, 3)], [holder(), holder(), holder()], T0 + 200 * D);
    const r = rows[0];
    expect(Object.keys(r).sort()).toEqual([...MEASURE_KEYS.row].sort());
    expect(Object.keys(r.applications).sort()).toEqual([...MEASURE_KEYS.applications].sort());
    expect(Object.keys(r.holders).sort()).toEqual([...MEASURE_KEYS.holders].sort());
    expect(Object.keys(r.holders.pathCompleteBy30).sort()).toEqual([...MEASURE_KEYS.share].sort());
    expect(JSON.stringify(rows)).not.toMatch(/user|email|name|ref|assignment/i);
  });
});

describe("who reads which circle", () => {
  const kept = { leadActive: true, leadIsExample: false };
  const circles = [
    { id: "c1", leadRoleId: "lead-1", ...kept },
    { id: "c2", leadRoleId: "lead-2", ...kept },
    { id: "c3", leadRoleId: null, ...kept },
    { id: "c4", leadRoleId: "lead-4", leadActive: false, leadIsExample: false },
    { id: "c5", leadRoleId: "lead-5", leadActive: true, leadIsExample: true },
  ];
  const rows = [{ circleId: "c1" }, { circleId: "c2" }, { circleId: null }];
  it("a lead reads the circles whose lead seat they sit in, and no other", () => {
    expect(circlesLed(circles, ["lead-2", "planter"])).toEqual(["c2"]);
    expect(circlesLed(circles, ["planter"])).toEqual([]);
    // A rested lead seat and an example lead seat open nothing.
    expect(circlesLed(circles, ["lead-4", "lead-5"])).toEqual([]);
    const scope = measuresScope(false, ["c2"]);
    expect(rowsInScope(rows, scope)).toEqual([{ circleId: "c2" }]);
    expect(rowsInScope(rows, scope, "c1")).toEqual([]);
  });
  it("an admin reads the village, the rows in no circle included", () => {
    expect(rowsInScope(rows, measuresScope(true, []))).toHaveLength(3);
    expect(rowsInScope(rows, measuresScope(true, []), "c1")).toEqual([{ circleId: "c1" }]);
  });
  it("anybody else reads nothing", () => {
    expect(measuresScope(false, [])).toEqual({ kind: "none" });
    expect(rowsInScope(rows, measuresScope(false, []))).toEqual([]);
  });
});
