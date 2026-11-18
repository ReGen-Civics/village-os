/**
 * The priorities contract's pure parts (shared/priorities.ts): weeks, the
 * stored documents read tolerantly, one line a week per member, the circle's
 * order from an agenda, and a place in line from a request body.
 */
import { describe, expect, it } from "vitest";
import {
  PRIORITY_LIMITS,
  PRIORITY_REFUSALS,
  addWeeks,
  boardOrderFromAgenda,
  cleanPlace,
  cleanWeekLine,
  currentLine,
  mondayOf,
  readBoardDoc,
  readPlacesDoc,
  readRaisedAsks,
  readWeekDoc,
  weeksBetween,
  withLine,
  withOutcome,
  withoutMember,
  type BoardItem,
  type WeekLine,
} from "./priorities";
import { DEFAULT_TEMPLATES, flowMinutes, isSectionKind } from "./sessionTemplates";

const line = (weekOf: string, text: string, extra: Partial<WeekLine> = {}): WeekLine => ({
  weekOf,
  text,
  servesGoalId: null,
  servesGoal: null,
  outcome: null,
  sessionId: null,
  setAt: "",
  ...extra,
});

describe("weeks", () => {
  it("finds the Monday of any day, and moves by whole weeks", () => {
    expect(mondayOf("2026-11-16")).toBe("2026-11-16"); // a Monday
    expect(mondayOf("2026-11-20")).toBe("2026-11-16"); // Friday
    expect(mondayOf("2026-11-22")).toBe("2026-11-16"); // Sunday
    expect(mondayOf("2026-01-01")).toBe("2025-12-29"); // across a year
    expect(mondayOf("not a day")).toBe("");
    expect(addWeeks("2026-11-16", 4)).toBe("2026-12-14");
    expect(addWeeks("2026-11-16", -1)).toBe("2026-11-09");
    expect(weeksBetween("2026-11-16", "2026-12-14")).toBe(4);
  });
});

describe("each person's top priority", () => {
  it("reads a stored document tolerantly, newest line first", () => {
    const doc = readWeekDoc({
      lines: {
        "7": [line("2026-11-09", "Older"), line("2026-11-16", "Newer"), { weekOf: "bad", text: "x" }, { weekOf: "2026-11-02", text: "" }],
        nope: [line("2026-11-16", "Not a member number")],
        "8": "not a list",
      },
    });
    expect(Object.keys(doc.lines)).toEqual(["7"]);
    expect(doc.lines["7"].map((l) => l.text)).toEqual(["Newer", "Older"]);
    expect(readWeekDoc(null)).toEqual({ lines: {} });
    expect(readWeekDoc("garbage")).toEqual({ lines: {} });
  });

  it("carries the newest line forward until it is replaced, and never reads a future week as now", () => {
    const lines = [line("2026-11-23", "Next week"), line("2026-11-09", "Two weeks back")];
    expect(currentLine(lines, "2026-11-16")?.text).toBe("Two weeks back");
    expect(currentLine(lines, "2026-11-23")?.text).toBe("Next week");
    expect(currentLine(undefined, "2026-11-16")).toBeNull();
  });

  it("keeps one line a week: setting it again replaces it, and the list keeps its newest", () => {
    let doc = withLine({ lines: {} }, 3, line("2026-11-16", "First"));
    doc = withLine(doc, 3, line("2026-11-16", "Second"));
    expect(doc.lines["3"].map((l) => l.text)).toEqual(["Second"]);
    for (let i = 1; i <= PRIORITY_LIMITS.linesKept + 3; i++) doc = withLine(doc, 3, line(addWeeks("2026-11-16", -i), `Back ${i}`));
    expect(doc.lines["3"]).toHaveLength(PRIORITY_LIMITS.linesKept);
    expect(doc.lines["3"][0].text).toBe("Second");
  });

  it("marks the current line, and refuses when there is none", () => {
    const doc = withLine({ lines: {} }, 3, line("2026-11-09", "Carried in"));
    const marked = withOutcome(doc, 3, "2026-11-16", "partly");
    expect(marked?.lines["3"][0].outcome).toBe("partly");
    expect(withOutcome(doc, 4, "2026-11-16", "done")).toBeNull();
    expect(withoutMember(doc, 3)).toEqual({ lines: {} });
  });

  it("cleans a line from a body: words are needed, and a goal must be the season's", () => {
    const goals = [{ id: "g-water", text: "Water for every home" }];
    expect(cleanWeekLine({ text: "  Fix the tank  ", servesGoalId: "g-water" }, goals)).toEqual({ ok: true, text: "Fix the tank", goal: goals[0] });
    expect(cleanWeekLine({ text: "Fix the tank" }, goals)).toEqual({ ok: true, text: "Fix the tank", goal: null });
    expect(cleanWeekLine({ text: "" }, goals)).toEqual({ ok: false, error: PRIORITY_REFUSALS.textNeeded });
    expect(cleanWeekLine({ text: "x", servesGoalId: "g-other" }, goals)).toEqual({ ok: false, error: PRIORITY_REFUSALS.goalUnknown });
  });
});

describe("the priority board", () => {
  const item = (id: number, extra: Partial<BoardItem> = {}): BoardItem => ({
    id,
    text: `Item ${id}`,
    servesGoalId: null,
    servesGoal: null,
    ownerRoleId: null,
    status: "not_started",
    voteSessionId: null,
    voteItemId: null,
    ...extra,
  });

  it("reads tolerantly and never hands out an id twice", () => {
    const doc = readBoardDoc({ nextId: 2, seasons: { s1: [item(5), { id: "x" }, item(3, { status: "weird" as any })] } });
    expect(doc.seasons.s1.map((i) => i.id)).toEqual([5, 3]);
    expect(doc.seasons.s1[1].status).toBe("not_started");
    expect(doc.nextId).toBe(6);
    expect(readBoardDoc(null)).toEqual({ nextId: 1, seasons: {} });
  });

  it("takes the circle's order from the agenda: voted items first in agenda order, the rest keep theirs", () => {
    const items = [item(1, { voteSessionId: 9, voteItemId: 101 }), item(2), item(3, { voteSessionId: 9, voteItemId: 103 }), item(4, { voteSessionId: 8, voteItemId: 104 }), item(5, { voteSessionId: 9, voteItemId: 105 })];
    const agenda = [
      { id: 103, position: 1, status: "waiting" },
      { id: 101, position: 2, status: "done" },
      { id: 105, position: 3, status: "parked" },
    ];
    expect(boardOrderFromAgenda(items, 9, agenda).map((i) => i.id)).toEqual([3, 1, 2, 4, 5]);
    // Another meeting's agenda moves nothing.
    expect(boardOrderFromAgenda(items, 7, agenda).map((i) => i.id)).toEqual([1, 2, 3, 4, 5]);
  });
});

describe("an ask's place in line", () => {
  it("cleans a place: a position, and a week counted from this one, kept as its Monday", () => {
    expect(cleanPlace({ position: 14, inWeeks: 4 }, "2026-11-16")).toEqual({ ok: true, place: { position: 14, expectWeek: "2026-12-14" } });
    expect(cleanPlace({ position: null, inWeeks: 0 }, "2026-11-16")).toEqual({ ok: true, place: { position: null, expectWeek: "2026-11-16" } });
    expect(cleanPlace({ position: 0 }, "2026-11-16")).toEqual({ ok: false, error: PRIORITY_REFUSALS.position });
    expect(cleanPlace({ position: 2.5 }, "2026-11-16")).toEqual({ ok: false, error: PRIORITY_REFUSALS.position });
    expect(cleanPlace({ inWeeks: PRIORITY_LIMITS.maxWeeksAhead + 1 }, "2026-11-16")).toEqual({ ok: false, error: PRIORITY_REFUSALS.inWeeks });
  });

  it("keeps the week already said when the body leaves it out, and clears it on null", () => {
    const before = { position: 3, expectWeek: "2026-12-07" };
    expect(cleanPlace({ position: 2 }, "2026-11-16", before)).toEqual({ ok: true, place: { position: 2, expectWeek: "2026-12-07" } });
    expect(cleanPlace({ position: 2, inWeeks: null }, "2026-11-16", before)).toEqual({ ok: true, place: { position: 2, expectWeek: null } });
  });

  it("reads places and asks tolerantly", () => {
    expect(readPlacesDoc({ "rt-1": { position: 2, expectWeek: "2026-12-07" }, "rt-2": { position: -1, expectWeek: "soon" }, "rt-3": "x" })).toEqual({
      "rt-1": { position: 2, expectWeek: "2026-12-07" },
    });
    const asks = readRaisedAsks([
      { id: "rt-1", role: "Water keeper", circle: "", text: "Leak", status: "taken", raisedOn: "2026-11-10", place: { position: 4, expectWeek: null } },
      { id: "rt-2", role: "Water keeper", text: "Answered", status: "answered", raisedOn: "2026-11-10" },
    ]);
    expect(asks).toEqual([{ id: "rt-1", role: "Water keeper", circle: null, text: "Leak", status: "taken", raisedOn: "2026-11-10", place: { position: 4, expectWeek: null } }]);
    expect(readRaisedAsks("nope")).toEqual([]);
  });
});

describe("the weekly templates carry the round and the read-back", () => {
  it("Monday names each person's top priority, Friday reads it back, both still an hour", () => {
    const monday = DEFAULT_TEMPLATES.find((t) => t.seedKey === "weekly-monday")!;
    const friday = DEFAULT_TEMPLATES.find((t) => t.seedKey === "weekly-friday")!;
    expect(monday.flow.map((s) => s.kind)).toContain("top_priorities");
    expect(friday.flow.map((s) => s.kind)).toContain("top_priorities_review");
    expect(flowMinutes(monday.flow)).toBe(monday.durationMin);
    expect(flowMinutes(friday.flow)).toBe(friday.durationMin);
    expect(isSectionKind("top_priorities")).toBe(true);
  });
});
