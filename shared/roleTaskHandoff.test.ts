/**
 * The handoff contract's pure rules: what a new task to a role must carry,
 * what counts as a suggested change, and the status the sender reads.
 */
import { describe, expect, it } from "vitest";
import {
  HANDOFF_EVENT, HANDOFF_REFUSALS, handoffDedupeKey, parseHandoffResponse, parseHandoffWords, readSentHandoffs, readWaitingHandoffs, sentStatusOf,
} from "./roleTaskHandoff";

const TODAY = "2026-11-16";

describe("a new task for a role", () => {
  it("needs words, keeps a note, and takes a day from today on", () => {
    expect(parseHandoffWords({ title: "  Count the till  ", note: "In the office.", dueOn: TODAY }, TODAY)).toEqual({
      ok: true, value: { title: "Count the till", note: "In the office.", dueOn: TODAY },
    });
    expect(parseHandoffWords({ title: "Count the till" }, TODAY)).toEqual({ ok: true, value: { title: "Count the till", note: null, dueOn: null } });
    expect(parseHandoffWords({ title: " " }, TODAY)).toEqual({ ok: false, error: HANDOFF_REFUSALS.noTitle });
    expect(parseHandoffWords({ title: "x", dueOn: "2026-11-15" }, TODAY)).toEqual({ ok: false, error: HANDOFF_REFUSALS.badDay });
    expect(parseHandoffWords({ title: "x", dueOn: "soon" }, TODAY)).toEqual({ ok: false, error: HANDOFF_REFUSALS.badDay });
  });
});

describe("a holder's answer", () => {
  const current = { title: "Count the till", note: null, dueOn: "2026-12-01" };
  it("accepts, declines only with a reason, and refuses anything else", () => {
    expect(parseHandoffResponse({ action: "accept" }, current, TODAY)).toEqual({ ok: true, value: { action: "accept" } });
    expect(parseHandoffResponse({ action: "decline" }, current, TODAY)).toEqual({ ok: false, error: HANDOFF_REFUSALS.noReason });
    expect(parseHandoffResponse({ action: "decline", reason: "Not ours." }, current, TODAY)).toEqual({ ok: true, value: { action: "decline", reason: "Not ours." } });
    expect(parseHandoffResponse({ action: "take" }, current, TODAY)).toEqual({ ok: false, error: HANDOFF_REFUSALS.badAction });
  });
  it("a suggestion must change something, and keeps what it does not name", () => {
    expect(parseHandoffResponse({ action: "suggest", title: "Count the till" }, current, TODAY)).toEqual({ ok: false, error: HANDOFF_REFUSALS.noChange });
    expect(parseHandoffResponse({ action: "suggest", note: "Both tills." }, current, TODAY)).toEqual({
      ok: true, value: { action: "suggest", words: { title: "Count the till", note: "Both tills.", dueOn: "2026-12-01" } },
    });
    expect(parseHandoffResponse({ action: "suggest", dueOn: null }, current, TODAY)).toEqual({
      ok: true, value: { action: "suggest", words: { title: "Count the till", note: null, dueOn: null } },
    });
    expect(parseHandoffResponse({ action: "suggest", dueOn: "2020-01-01" }, current, TODAY)).toEqual({ ok: false, error: HANDOFF_REFUSALS.badDay });
  });
});

describe("what the sender reads", () => {
  it("names each status from the row, the decline step and the accepted copy", () => {
    expect(sentStatusOf({ status: "waiting", declined: false, acceptedDone: false })).toBe("waiting");
    expect(sentStatusOf({ status: "taken", declined: false, acceptedDone: false })).toBe("accepted");
    expect(sentStatusOf({ status: "taken", declined: false, acceptedDone: true })).toBe("done");
    expect(sentStatusOf({ status: "dismissed", declined: true, acceptedDone: false })).toBe("declined");
    expect(sentStatusOf({ status: "dismissed", declined: false, acceptedDone: false })).toBe("withdrawn");
  });
  it("keeps one notice key per handoff and event, and per recipient where several hear", () => {
    expect(handoffDedupeKey("rq-1", "accepted")).toBe("role-task:rq-1:accepted");
    expect(handoffDedupeKey("rq-1", "handed", "m-a")).toBe("role-task:rq-1:handed:m-a");
    expect(handoffDedupeKey("rq-1", "handed", "m-a")).not.toBe(handoffDedupeKey("rq-1", "handed", "m-b"));
  });
  it("every step kind fits member_task_events.kind, 24 characters", () => {
    for (const k of Object.values(HANDOFF_EVENT)) expect(k.length).toBeLessThanOrEqual(24);
  });
  it("the client drops rows it cannot draw", () => {
    expect(readWaitingHandoffs({ waiting: [{ id: "rq-1" }, null] })).toEqual([]);
    expect(readSentHandoffs({ sent: [{ id: "rq-1", role: "R", title: "T", sentOn: TODAY, status: "lost" }] })).toEqual([]);
    expect(readSentHandoffs({ sent: [{ id: "rq-1", role: "R", title: "T", sentOn: TODAY, status: "waiting" }] })).toHaveLength(1);
  });
});
