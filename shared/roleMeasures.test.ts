import { describe, expect, it } from "vitest";
import { MEASURE_KEYS, NO_DATA, buildMeasures, circlesLed, measuresScope, median, rightNow, rowsInScope, type ApplicationFact, type HolderFact } from "./roleMeasures";

const H = 3_600_000;
const D = 86_400_000;
const T0 = Date.UTC(2026, 0, 1);
const app = (reply: number | null, interview: number | null, decided: number | null, circleId = "c1", o: Partial<ApplicationFact> = {}): ApplicationFact => ({
  seasonId: "s1",
  circleId,
  door: "open",
  confirmedAt: T0,
  firstReplyAt: reply === null ? null : T0 + reply * H,
  firstInterviewAt: interview === null ? null : T0 + interview * H,
  decidedAt: decided === null ? null : T0 + decided * H,
  outcome: decided === null ? null : "declined",
  shortlistYesAt: null,
  refsAskedAt: null,
  refsAllFollowedUpAt: null,
  interviews: [],
  countered: false,
  ...o,
});
const talk = (o: { final?: boolean; opened?: number | null; booked?: number | null; scored?: number | null; skipped?: boolean } = {}) => ({
  final: o.final ?? false,
  openedAt: o.opened === undefined ? T0 : o.opened === null ? null : T0 + o.opened * H,
  bookedAt: o.booked == null ? null : T0 + o.booked * H,
  scoredAt: o.scored == null ? null : T0 + o.scored * H,
  skipped: o.skipped ?? false,
});
const holder = (o: Partial<HolderFact> = {}): HolderFact => ({
  seasonId: "s1",
  circleId: "c1",
  startedAt: T0,
  endedAt: null,
  pathOpenedAt: T0,
  pathDoneAt: T0 + 20 * D,
  renewalsDue: 2,
  renewalsRenewed: 2,
  ...o,
});

describe("buildMeasures", () => {
  it("computes medians and shares per season and circle", () => {
    const apps = [app(2, 24, 100), app(4, 48, 200), app(6, null, 300), app(null, null, null)];
    const holders = [holder(), holder(), holder({ pathDoneAt: T0 + 40 * D }), holder({ endedAt: T0 + 30 * D, renewalsRenewed: 1 })];
    const [row] = buildMeasures(apps, holders, T0 + 200 * D);
    // Two interviews recorded: their median shows (it was withheld under three before 27 Nov 2026).
    expect(row.applications).toMatchObject({ count: 4, medianHoursToReply: 4, medianHoursToInterview: 36, medianHoursToDecision: 200 });
    expect(row.applications.answered).toEqual({ eligible: 4, yes: 3, share: 0.75 });
    expect(row.holders.pathCompleteBy30).toEqual({ eligible: 4, yes: 3, share: 0.75 });
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
  it("has no quest step in holding the role (the lead, 27 Nov 2026: roles don't do quests normally)", () => {
    expect([...MEASURE_KEYS.holders]).toEqual(["count", "pathCompleteBy30", "stillInRoleAt30", "stillInRoleAt90", "renewed"]);
    const [row] = buildMeasures([], [holder()], T0 + 200 * D);
    expect(Object.keys(row.holders).some((k) => /quest/i.test(k))).toBe(false);
  });
  it("counts conversations booked and held, references followed up, offers, counters and how applications end", () => {
    const apps = [
      // Reached the final conversation, adopted after a counter-offer.
      app(1, 2, 200, "c1", {
        outcome: "adopted",
        countered: true,
        refsAskedAt: T0 + 10 * H,
        refsAllFollowedUpAt: T0 + 40 * H,
        interviews: [talk({ booked: 1, scored: 5 }), talk({ final: true, opened: 100, booked: 101, scored: 150 })],
      }),
      // Reached the final conversation, declined; a conversation booked and never written up.
      app(1, null, 300, "c1", { outcome: "declined", interviews: [talk({ booked: 2 }), talk({ final: true, opened: 120 })] }),
      // Withdrawn, and one closed after 90 quiet days; a conversation opened and never booked.
      app(null, null, 50, "c1", { outcome: "withdrawn", interviews: [talk()] }),
      app(null, null, 90 * 24, "c1", { outcome: "closed" }),
      // Still in flight: its booked conversation has not ended, so it is not counted as held or missed.
      app(3, null, null, "c1", { interviews: [talk({ booked: 4 })] }),
    ];
    const [row] = buildMeasures(apps, [], T0);
    expect(row.conversations.booked).toEqual({ eligible: 6, yes: 4, share: 0.67 });
    expect(row.conversations.held).toEqual({ eligible: 3, yes: 2, share: 0.67 });
    expect(row.references.medianHoursToFollowUp).toBe(30);
    expect(row.outcomes.offer).toEqual({ eligible: 2, yes: 1, share: 0.5 });
    expect(row.outcomes.countered).toEqual({ eligible: 1, yes: 1, share: 1 });
    expect(row.outcomes.withdrawn).toEqual({ eligible: 5, yes: 1, share: 0.2 });
    expect(row.outcomes.declined).toEqual({ eligible: 5, yes: 1, share: 0.2 });
    expect(row.outcomes.closed).toEqual({ eligible: 5, yes: 1, share: 0.2 });
    // Nobody started yet: no data.
    expect(row.start.medianHoursToStart).toBe(NO_DATA);
  });
  it("times adoption to start, and who is still in the role at day 30 and day 90", () => {
    const starts = [{ seasonId: "s1", circleId: "c1", adoptedAt: T0, startedAt: T0 + 24 * H }];
    const holders = [holder(), holder({ endedAt: T0 + 40 * D })];
    const [row] = buildMeasures([], holders, T0 + 100 * D, starts);
    expect(row.start.medianHoursToStart).toBe(24);
    expect(row.holders.stillInRoleAt30).toEqual({ eligible: 2, yes: 2, share: 1 });
    expect(row.holders.stillInRoleAt90).toEqual({ eligible: 2, yes: 1, share: 0.5 });
  });
  it("takes the median time at each stage from the one stage clock", () => {
    const a = app(1, null, 100, "c1", { shortlistYesAt: T0 + 10 * H, interviews: [talk({ opened: 10, scored: 30 }), talk({ final: true, opened: 60, scored: 80 })] });
    const [row] = buildMeasures([a], [], T0);
    expect(row.stages).toEqual({ review: 30, references: 30, final_interview: 20, agreement: 20 });
  });
  it("counts right now: undecided applications at each stage, per circle and door, with the oldest wait", () => {
    const apps = [app(null, null, null, "c1"), app(null, null, null, "c1", { door: "member", confirmedAt: T0 - 10 * H }), app(null, null, 5, "c1")];
    expect(rightNow(apps, T0 + 2 * H)).toEqual([{ circleId: "c1", stage: "review", count: 2, open: 1, member: 1, oldestHours: 12 }]);
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
    expect(Object.keys(r.stages).sort()).toEqual([...MEASURE_KEYS.stages].sort());
    expect(Object.keys(r.conversations).sort()).toEqual([...MEASURE_KEYS.conversations].sort());
    expect(Object.keys(r.references).sort()).toEqual([...MEASURE_KEYS.references].sort());
    expect(Object.keys(r.outcomes).sort()).toEqual([...MEASURE_KEYS.outcomes].sort());
    expect(Object.keys(r.start).sort()).toEqual([...MEASURE_KEYS.start].sort());
    expect(Object.keys(r.holders.pathCompleteBy30).sort()).toEqual([...MEASURE_KEYS.share].sort());
    // Every key in the tree is a declared one, and the only words in it are the season's and the circle's ids:
    // no name, no person's id, no application ref anywhere. (A substring scan would catch "references" itself.)
    const declared = new Set<string>(Object.values(MEASURE_KEYS).flat());
    const strings: string[] = [];
    const walk = (v: unknown): void => {
      if (typeof v === "string") strings.push(v);
      else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) (expect(declared.has(k), k).toBe(true), walk(x));
    };
    rows.forEach(walk);
    expect(new Set(strings)).toEqual(new Set(["s1", "c1"]));
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
