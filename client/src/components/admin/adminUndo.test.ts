// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cancelUndo, holdUndo, pendingUndoLabel, undoWaitMs } from "./adminUndo";
import { isSnoozed, nextWeek, snoozeUntil, tomorrow } from "./adminSnooze";

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers();
});
afterEach(() => {
  cancelUndo();
  vi.useRealTimers();
});

describe("undo and snooze", () => {
  it("waits 10 seconds and Undo stops the action", () => {
    const work = vi.fn();
    holdUndo("Removing this request.", work);
    expect(pendingUndoLabel()).toMatch(/Removing/);
    vi.advanceTimersByTime(undoWaitMs() - 1);
    expect(work).not.toHaveBeenCalled();
    cancelUndo();
    vi.advanceTimersByTime(5);
    expect(work).not.toHaveBeenCalled();
  });

  it("runs the action when the wait ends", () => {
    const work = vi.fn();
    holdUndo("Marking this done.", work);
    vi.advanceTimersByTime(undoWaitMs());
    expect(work).toHaveBeenCalledOnce();
    expect(pendingUndoLabel()).toBeNull();
  });

  // A SECOND HELD ACTION USED TO DROP THE FIRST WITHOUT A WORD: mark one request done, mark the next done inside ten
  // seconds, and the first was never sent. Each held action is sent now.
  it("a second action sends the one still waiting at once, and takes the wait itself", () => {
    const first = vi.fn();
    const second = vi.fn();
    holdUndo("Marking this done.", first, "task:a");
    vi.advanceTimersByTime(3_000);
    holdUndo("Removing this task.", second, "task:b");
    // The first went without the rest of its wait; the second is the one the bar names.
    expect(first).toHaveBeenCalledOnce();
    expect(second).not.toHaveBeenCalled();
    expect(pendingUndoLabel()).toBe("Removing this task.");
    // The first's own timer is gone: it is never sent twice.
    vi.advanceTimersByTime(undoWaitMs());
    expect(first).toHaveBeenCalledOnce();
    expect(second).toHaveBeenCalledOnce();
    expect(pendingUndoLabel()).toBeNull();
  });

  it("Undo after a second action stops only the second: the first was already sent", () => {
    const first = vi.fn();
    const second = vi.fn();
    holdUndo("Marking this done.", first);
    holdUndo("Marking this done.", second);
    cancelUndo();
    vi.advanceTimersByTime(undoWaitMs());
    expect(first).toHaveBeenCalledOnce();
    expect(second).not.toHaveBeenCalled();
  });

  it("the same subject pressed again takes the earlier hold's place: one subject is sent once", () => {
    const done = vi.fn();
    const remove = vi.fn();
    holdUndo("Marking this done.", done, "task:a");
    vi.advanceTimersByTime(4_000);
    holdUndo("Removing this task.", remove, "task:a");
    expect(done).not.toHaveBeenCalled();
    // The wait starts over for the one that took its place.
    vi.advanceTimersByTime(undoWaitMs() - 1);
    expect(remove).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(remove).toHaveBeenCalledOnce();
    expect(done).not.toHaveBeenCalled();
  });

  it("a send that throws does not lose the action held after it", () => {
    const second = vi.fn();
    holdUndo("Marking this done.", () => { throw new Error("offline"); });
    expect(() => holdUndo("Removing this task.", second)).toThrow("offline");
    expect(pendingUndoLabel()).toBe("Removing this task.");
    vi.advanceTimersByTime(undoWaitMs());
    expect(second).toHaveBeenCalledOnce();
  });

  it("hides a request until tomorrow without telling anyone", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const now = new Date(2026, 10, 3, 21, 0);
    snoozeUntil("s1", tomorrow(now));
    expect(isSnoozed("s1", now)).toBe(true);
    expect(isSnoozed("s1", nextWeek(now))).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
