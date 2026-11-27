import { describe, expect, it } from "vitest";
import { percent, rowsFor, seasonsOf, span, type ServedRow } from "./measuresView";

const share = { eligible: 0, yes: 0, share: null };
const r = (seasonId: string | null, circleId: string | null, circleName: string | null): ServedRow => ({
  seasonId,
  circleId,
  circleName,
  applications: { count: 1, answered: share, medianHoursToReply: null, medianHoursToInterview: null, medianHoursToDecision: null },
  holders: { count: 0, pathCompleteBy30: share, stillInRoleAt90: share, renewed: share },
});

describe("measuresView", () => {
  it("puts the current season first, then the newest, and no season last", () => {
    const rows = [r(null, "a", "A"), r("2026-1", "a", "A"), r("2026-3", "a", "A"), r("2026-2", "a", "A")];
    expect(seasonsOf(rows, "2026-2")).toEqual(["2026-2", "2026-3", "2026-1", null]);
    expect(seasonsOf(rows, null)).toEqual(["2026-3", "2026-2", "2026-1", null]);
  });

  it("orders a season's circles by name with roles in no circle last, and filters to one circle", () => {
    const rows = [r("s", null, null), r("s", "b", "Bees"), r("s", "a", "Anchor"), r("t", "a", "Anchor")];
    expect(rowsFor(rows, "s").map((x) => x.circleId)).toEqual(["a", "b", null]);
    expect(rowsFor(rows, "s", "b").map((x) => x.circleId)).toEqual(["b"]);
  });

  it("keeps no data (null) apart from a real zero, and reads time in hours under two days", () => {
    expect(percent({ eligible: 0, yes: 0, share: null })).toBeNull();
    expect(percent({ eligible: 2, yes: 0, share: 0 })).toBe(0);
    expect(percent({ eligible: 1, yes: 1, share: 1 })).toBe(100);
    expect(percent({ eligible: 4, yes: 3, share: 0.75 })).toBe(75);
    expect(span(null)).toBeNull();
    expect(span(0)).toEqual({ unit: "hours", n: 0 });
    // Eighteen minutes is under an hour, never 0.
    expect(span(0.3)).toEqual({ unit: "under-an-hour", n: 0 });
    expect(span(0.99)).toEqual({ unit: "under-an-hour", n: 0 });
    expect(span(1)).toEqual({ unit: "hours", n: 1 });
    expect(span(47.4)).toEqual({ unit: "hours", n: 47 });
    expect(span(100)).toEqual({ unit: "days", n: 4 });
  });
});
