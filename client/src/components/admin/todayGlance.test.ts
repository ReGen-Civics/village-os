// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { connectionRows, glanceSentence, readLastGlance, rememberGlance, sinceLastVisit } from "./todayGlance";

beforeEach(() => localStorage.clear());

describe("today in one glance", () => {
  it("says what is waiting and what a connection needs", () => {
    const rows = connectionRows({ emailConfigured: true, stripeConfigured: false, cards: [{ module: "saberra", health: [{ verdict: "failing" }] }] });
    expect(rows.find((r) => r.id === "email")?.word).toBe("Needs you");
    expect(rows.find((r) => r.id === "email")?.detail).toBe("A key is saved. It has not been confirmed.");
    expect(rows.find((r) => r.id === "payments")?.word).toBe("Needs you");
    expect(rows.find((r) => r.id === "sera")?.state).toBe("broken");
    expect(glanceSentence(3, rows)).toBe("3 decisions, 1 connection is broken right now.");
    expect(glanceSentence(1, rows)).toBe("1 decision, 1 connection is broken right now.");
    expect(glanceSentence(0, connectionRows({}))).toBe("Every connection needs you.");
    expect(connectionRows({ cards: [{ module: "saberra" }] }).find((r) => r.id === "sera")?.word).toBe("Needs you");
    expect(connectionRows({ cards: [{ module: "saberra", health: [{ verdict: "never-confirmed" }] }] }).find((r) => r.id === "sera")?.word).toBe("Needs you");
    expect(connectionRows({ cards: [{ module: "saberra", health: [{ verdict: "working" }, { verdict: "stale" }] }] }).find((r) => r.id === "sera")?.state).toBe("needs");
    const fine = connectionRows({
      cards: [
        { module: "email", health: [{ verdict: "working" }] },
        { module: "payments", health: [{ verdict: "quiet" }] },
        { module: "events", health: [{ verdict: "quiet" }] },
        { module: "saberra", health: [{ verdict: "working" }] },
      ],
    });
    expect(fine.every((r) => r.state === "working")).toBe(true);
    expect(glanceSentence(0, fine)).toBe("Nothing is waiting, and every connection is fine.");
    // A count that did not load is said, and never read as nothing waiting.
    expect(glanceSentence(null, fine)).toBe("The count of decisions did not load, everything else is fine.");
    // No decisions, and the list still holds a blocked row or an application: "nothing is waiting" is not said.
    expect(glanceSentence(0, fine, 2)).toBe("0 decisions, everything else is fine.");
  });

  it("keeps the last look on this device and never calls the network", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    expect(sinceLastVisit(null, 2)).toBe("First look on this device.");
    rememberGlance(2, 0, "ana", new Date("2026-11-03T12:00:00"));
    const prev = readLastGlance("ana");
    expect(prev?.decisions).toBe(2);
    expect(sinceLastVisit(prev, 4)).toMatch(/2 more decisions since/);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("never carries a count from one person to the next on a shared device", () => {
    rememberGlance(7, 0, "ana", new Date("2026-11-03T12:00:00"));
    // Ben opens Home on the same device: Ana's look is no look of his.
    expect(readLastGlance("ben")).toBeNull();
    expect(sinceLastVisit(readLastGlance("ben"), 1)).toBe("First look on this device.");
    // A look kept before the one count (it held `requests`) is no look either.
    localStorage.setItem("admin.lastGlance", JSON.stringify({ at: "2026-11-03T12:00:00.000Z", requests: 23, needs: 0 }));
    expect(readLastGlance("ana")).toBeNull();
  });
});
