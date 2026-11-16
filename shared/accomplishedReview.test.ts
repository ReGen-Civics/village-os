/**
 * Agreed beside delivered, the far-off flag and a Treasurer's proposed amount
 * (Rye, 14 Nov 2026). Pure: no database. Every name here is invented.
 */
import { describe, expect, it } from "vitest";
import {
  ACCOMPLISHED_WORDS, ADJUST_REFUSALS, FAR_OFF_DEFAULT, FAR_OFF_MIN_GOALS, FAR_OFF_MIN_TASKS, accomplishedComparison, adjustUnconfirmed, adjustsFrom, applyAdjusts, confirmAdjustLines,
  farOffOf, parseAdjustInput, parseAdjustReply, ADJUST_AMOUNT_MAX,
} from "./accomplishedReview";
import { linesFromTerms, scaleBySplit, type InvoiceLine, type MoonGoal, type RecapItem, type TermsInForce } from "./moonRecap";

const DAYS = { days: 29 };
const term = (applicationId: string, roleId: string, roleName: string, amountMinor: number, allowance = 0): TermsInForce => ({
  applicationId, firstSeatId: `a-${roleId}`, roleIds: [roleId], roleNames: [roleName], deliverables: null, daysHeld: 29,
  settings: {
    v: 1, pay: { kind: "fixed", currency: "USD", amountMinor, per: "moon" },
    ...(allowance ? { allowance: { kind: "flat", currency: "USD", amountMinor: allowance, per: "moon" } } : {}),
  } as any,
});
const LINES = linesFromTerms([term("app-water", "r-water", "Water keeper", 80000, 5000), term("app-garden", "r-garden", "Garden keeper", 40000)], DAYS);
const ROLES = [{ roleId: "r-water", name: "Water keeper" }, { roleId: "r-garden", name: "Garden keeper" }];
const goals = (...s: MoonGoal["status"][]) => s.map((status) => ({ status }));
type It = Pick<RecapItem, "state" | "taskStatus" | "roleId">;
const done = (roleId: string | null, n = 1): It[] => Array.from({ length: n }, () => ({ state: "kept", taskStatus: "done", roleId }));
const PROPOSAL = { adjustedMinor: 100000, reason: "Covered the kitchen for two weeks.", proposedBy: "m-fin", proposedAt: "2026-11-21T10:00:00.000Z" };

describe("agreed beside delivered", () => {
  it("counts goals by status, tasks done per role and outside the roles, and says it in one sentence", () => {
    const v = accomplishedComparison({
      lines: LINES, roles: ROLES, farOffPct: 25,
      goals: goals("done", "done", "partly", "carried"),
      items: [...done("r-water", 3), ...done("r-garden"), ...done(null, 3), { state: "kept", taskStatus: "carry", roleId: "r-water" }, { state: "dropped", taskStatus: "done", roleId: null }, { state: "suggested", taskStatus: "done", roleId: null }],
    });
    expect(v.agreed.lines).toEqual([
      { roleNames: ["Water keeper"], amountMinor: 80000, currency: "USD" },
      { roleNames: ["Garden keeper"], amountMinor: 40000, currency: "USD" },
    ]);
    expect(v.agreed.totals).toEqual([{ currency: "USD", minor: 120000 }]);
    expect(v.goals).toEqual({ done: 2, partly: 1, carried: 1, letGo: 0, open: 0, total: 4 });
    expect(v.tasks).toEqual({ done: 7, outside: 3, byRole: [{ roleId: "r-water", name: "Water keeper", count: 3 }, { roleId: "r-garden", name: "Garden keeper", count: 1 }] });
    expect(v.sentence).toBe("Agreed: US$1,200 for 4 goals. Delivered: 2 of 4 goals done, 1 partly, plus 7 other tasks (3 outside your roles).");
  });

  it("leaves allowances out of what was agreed, and reads a proposal's base as the agreement", () => {
    const adjusted = applyAdjusts(LINES, { "app-water": PROPOSAL });
    const v = accomplishedComparison({ lines: adjusted, roles: ROLES, farOffPct: 25, goals: [], items: [] });
    expect(v.agreed.totals).toEqual([{ currency: "USD", minor: 120000 }]);
  });

  it("counts a kept item with no status as a task done, the way a hand-added item is written", () => {
    const v = accomplishedComparison({ lines: LINES, roles: ROLES, farOffPct: 25, goals: [], items: [{ state: "kept", taskStatus: null, roleId: "r-garden" }] });
    expect(v.tasks.done).toBe(1);
  });

  it("says plainly when there are no goals and no tasks, and raises no flag", () => {
    const v = accomplishedComparison({ lines: LINES, roles: ROLES, farOffPct: 25, goals: [], items: [] });
    expect(v.sentence).toBe("Agreed: US$1,200 for 0 goals. Delivered: 0 other tasks.");
    expect(v.farOff).toBeNull();
  });

  it("carries counts and words only: no percent, band or reading of the person", () => {
    const v = accomplishedComparison({ lines: LINES, roles: ROLES, farOffPct: 25, goals: goals("done"), items: done("r-water") });
    expect(Object.keys(v).sort()).toEqual(["agreed", "farOff", "goals", "sentence", "tasks"]);
    expect(JSON.stringify(v)).not.toMatch(/"(pct|band|reading|score)"/);
  });
});

describe("the far-off flag", () => {
  const g = (d: number, p: number, c: number, open = 0, letGo = 0) => ({ done: d, partly: p, carried: c, letGo, open, total: d + p + c + open + letGo });
  const t = (doneN: number, outside: number) => ({ done: doneN, outside });

  it("flags under when goal progress is below 100 minus the dial, and not exactly at the edge", () => {
    expect(farOffOf({ goals: g(3, 0, 1), tasks: t(0, 0) }, 25)).toBeNull(); // 75%: at the edge
    expect(farOffOf({ goals: g(2, 1, 1), tasks: t(0, 0) }, 25)).toMatchObject({ under: true, over: false, lines: [ACCOMPLISHED_WORDS.under(75, { done: 2, partly: 1, of: 4 })] }); // 62.5%
    expect(ACCOMPLISHED_WORDS.under(75, { done: 2, partly: 1, of: 4 })).toBe("Goal progress is under 75%: 2 of 4 goals done, 1 partly.");
  });

  it("flags over when the dial's share or more of the tasks done sat outside the roles, at the edge too", () => {
    expect(farOffOf({ goals: g(4, 0, 0), tasks: t(4, 1) }, 25)).toMatchObject({ under: false, over: true, lines: [ACCOMPLISHED_WORDS.over(1, 4)] });
    expect(farOffOf({ goals: g(4, 0, 0), tasks: t(5, 1) }, 25)).toBeNull(); // 20%
  });

  it("flags both, and follows the dial", () => {
    expect(farOffOf({ goals: g(1, 0, 3), tasks: t(4, 2) }, 25)).toMatchObject({ under: true, over: true });
    expect(farOffOf({ goals: g(2, 1, 1), tasks: t(0, 0) }, 40)).toBeNull(); // 62.5% is above 60%
    expect(farOffOf({ goals: g(4, 0, 0), tasks: t(4, 1) }, 50)).toBeNull();
  });

  it("counts a goal still open at End of Moon as not done, and leaves a goal let go out (QA F4)", () => {
    // 1 done and 3 still open read 25%, not 100%.
    expect(farOffOf({ goals: g(1, 0, 0, 3), tasks: t(0, 0) }, 25)).toMatchObject({ under: true, lines: [ACCOMPLISHED_WORDS.under(75, { done: 1, partly: 0, of: 4 })] });
    // A goal let go by agreement is responsiveness, so it neither helps nor hurts.
    expect(farOffOf({ goals: g(3, 0, 0, 0, 3), tasks: t(0, 0) }, 25)).toBeNull();
    expect(farOffOf({ goals: g(0, 0, 0, 0, 5), tasks: t(0, 0) }, 25)).toBeNull();
  });

  it("needs a real sample before either side flags (QA F5)", () => {
    expect(FAR_OFF_MIN_GOALS).toBe(2);
    expect(FAR_OFF_MIN_TASKS).toBe(4);
    expect(farOffOf({ goals: g(0, 1, 0), tasks: t(0, 0) }, 25)).toBeNull(); // one partly goal
    expect(farOffOf({ goals: g(0, 0, 0), tasks: t(1, 1) }, 25)).toBeNull(); // one task, outside
    expect(farOffOf({ goals: g(0, 0, 0), tasks: t(3, 3) }, 25)).toBeNull(); // three tasks, all outside
    expect(farOffOf({ goals: g(0, 1, 1), tasks: t(0, 0) }, 25)).toMatchObject({ under: true }); // two scored goals
    expect(farOffOf({ goals: g(0, 0, 0), tasks: t(4, 4) }, 25)).toMatchObject({ over: true, lines: [ACCOMPLISHED_WORDS.over(4, 4)] });
  });

  it("reads a dial outside 5 to 100 as the default, so a typo never hides the flag", () => {
    for (const bad of [0, 4, 101, Number.NaN, 2.5]) expect(farOffOf({ goals: g(2, 1, 1), tasks: t(0, 0) }, bad)?.pct).toBe(FAR_OFF_DEFAULT);
  });
});

describe("a Treasurer's proposed amount", () => {
  it("fails closed: with no proposal the lines are exactly the draft", () => {
    expect(applyAdjusts(LINES, {})).toEqual(LINES);
    expect(adjustUnconfirmed(LINES)).toBe(false);
  });

  it("sets the amount on the pay line, keeps the base, and leaves allowances and other lines alone", () => {
    const out = applyAdjusts(LINES, { "app-water": PROPOSAL }, "Thank you.");
    const pay = out.find((l) => l.key === "app-water") as InvoiceLine;
    expect(pay.amountMinor).toBe(100000);
    expect(pay.adjust).toEqual({ baseMinor: 80000, adjustedMinor: 100000, reason: PROPOSAL.reason, proposedBy: "m-fin", proposedAt: PROPOSAL.proposedAt, reply: "Thank you.", confirmedBy: null, confirmedAt: null });
    expect(out.find((l) => l.key === "app-water:allowance")?.adjust).toBeUndefined();
    expect(out.find((l) => l.key === "app-garden")?.amountMinor).toBe(40000);
  });

  it("goes up or down with no cap", () => {
    expect(applyAdjusts(LINES, { "app-garden": { ...PROPOSAL, adjustedMinor: 10_000_000 } }).find((l) => l.key === "app-garden")?.amountMinor).toBe(10_000_000);
    expect(applyAdjusts(LINES, { "app-garden": { ...PROPOSAL, adjustedMinor: 0 } }).find((l) => l.key === "app-garden")?.amountMinor).toBe(0);
  });

  it("sits on top of the split: the base is the scaled amount", () => {
    const split = scaleBySplit(LINES, [{ roleId: "r-water", share: 50 }, { roleId: "r-garden", share: 50 }], ["r-water", "r-garden"], { totalPct: 100, pricedPct: { "app-water": 100, "app-garden": 100 } });
    const out = applyAdjusts(split, { "app-water": PROPOSAL });
    expect(out.find((l) => l.key === "app-water")?.adjust?.baseMinor).toBe(40000);
  });

  it("drops a proposal for a line that is gone or listed", () => {
    const listed = linesFromTerms([{ ...term("app-x", "r-x", "Honorary", 1), settings: { v: 1, pay: { kind: "honorary" } } as any }], DAYS);
    expect(applyAdjusts(listed, { "app-x": PROPOSAL })[0].adjust).toBeUndefined();
    expect(applyAdjusts(LINES, { "app-gone": PROPOSAL })).toEqual(LINES);
  });

  it("refuses to pay until confirmed, and again if the amount moved after", () => {
    const out = applyAdjusts(LINES, { "app-water": PROPOSAL });
    expect(adjustUnconfirmed(out)).toBe(true);
    const ok = confirmAdjustLines(out, "m-treas", "2026-11-22T09:00:00.000Z");
    expect(adjustUnconfirmed(ok)).toBe(false);
    expect(ok.find((l) => l.key === "app-water")?.adjust).toMatchObject({ confirmedBy: "m-treas" });
    expect(adjustUnconfirmed(ok.map((l) => (l.adjust ? { ...l, amountMinor: 1 } : l)))).toBe(true);
  });

  it("carries a proposal from a voided revision to the next send", () => {
    expect(adjustsFrom(applyAdjusts(LINES, { "app-water": PROPOSAL }))).toEqual({ "app-water": PROPOSAL });
    expect(adjustsFrom(LINES)).toEqual({});
  });

  it("reads the Treasurer's request: a reason always, a whole amount or null to withdraw", () => {
    expect(parseAdjustInput({ applicationId: "app-water", amountMinor: 90000, reason: "  Fewer   goals done. " })).toEqual({ ok: true, applicationId: "app-water", amountMinor: 90000, reason: "Fewer goals done." });
    expect(parseAdjustInput({ applicationId: "app-water", amountMinor: null, reason: "Talked it through." })).toMatchObject({ ok: true, amountMinor: null });
    expect(parseAdjustInput({ applicationId: "app-water", amountMinor: 90000, reason: "" })).toEqual({ ok: false, error: ADJUST_REFUSALS.reason });
    expect(parseAdjustInput({ applicationId: "app-water", amountMinor: 1.5, reason: "x" })).toEqual({ ok: false, error: ADJUST_REFUSALS.amount });
    expect(parseAdjustInput({ amountMinor: 1, reason: "x" })).toEqual({ ok: false, error: ADJUST_REFUSALS.noLine });
    expect(parseAdjustInput({ applicationId: "a", amountMinor: 1, reason: "x".repeat(501) })).toEqual({ ok: false, error: ADJUST_REFUSALS.reasonLong });
  });

  it("refuses an absurd amount: past the ceiling a role's terms carry, and past what a number holds exactly", () => {
    expect(ADJUST_AMOUNT_MAX).toBeLessThanOrEqual(Number.MAX_SAFE_INTEGER);
    expect(parseAdjustInput({ applicationId: "a", amountMinor: ADJUST_AMOUNT_MAX, reason: "x" })).toMatchObject({ ok: true, amountMinor: ADJUST_AMOUNT_MAX });
    for (const amountMinor of [ADJUST_AMOUNT_MAX + 1, Number.MAX_SAFE_INTEGER, 1e21, "1e21"]) {
      expect(parseAdjustInput({ applicationId: "a", amountMinor, reason: "x" }), String(amountMinor)).toEqual({ ok: false, error: ADJUST_REFUSALS.amountTooLarge });
    }
  });

  it("keeps the member's reply to one clipped line of their own words", () => {
    expect(parseAdjustReply("  Thank   you. ")).toBe("Thank you.");
    expect(parseAdjustReply("")).toBeNull();
    expect(parseAdjustReply(7)).toBeNull();
    expect(parseAdjustReply("y".repeat(900))?.length).toBe(500);
  });
});
