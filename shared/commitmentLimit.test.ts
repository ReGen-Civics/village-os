/**
 * A role's limit is its commitment (the lead, 20 Nov 2026): under, at and over the limit, a holder with no written
 * commitment counted as one place's share, a newcomer with none counted by places, and the lead's exact words.
 */
import { describe, expect, it } from "vitest";
import { limitFor, OVER_LIMIT_WORDS, overLimitOf, overridden, placeShare, targetOf } from "./commitmentLimit";

const ROLE = { commitmentTarget: 100, seats: 1 };

describe("the commitment limit", () => {
  it("under the limit: three people at 30% fit a one-place role that needs 100%", () => {
    expect(limitFor(ROLE, [30, 30], 30)).toEqual({ byPlaces: false, target: 100, used: 60, adding: 30, after: 90, over: false });
  });

  it("at the limit: exactly the role's need fits", () => {
    expect(limitFor(ROLE, [60, 30], 10)).toMatchObject({ after: 100, over: false });
  });

  it("over the limit: one point above is over", () => {
    expect(limitFor(ROLE, [60, 30], 20)).toMatchObject({ used: 90, adding: 20, after: 110, over: true });
  });

  it("reads the role's own need, 100 when it sets none, and above 100 for a role of several whole people", () => {
    expect(targetOf({ commitmentTarget: null, seats: 2 })).toBe(100);
    expect(limitFor({ commitmentTarget: 300, seats: 3 }, [100, 100], 100).over).toBe(false);
    expect(limitFor({ commitmentTarget: 300, seats: 3 }, [100, 100, 100], 10).over).toBe(true);
  });

  it("counts a holder with no written commitment as one place's share, so such a role fills as it did by places", () => {
    expect(placeShare({ commitmentTarget: 100, seats: 2 })).toBe(50);
    expect(limitFor({ commitmentTarget: 100, seats: 2 }, [null, null], 10).over).toBe(true);
    expect(limitFor({ commitmentTarget: 100, seats: 2 }, [null], 50).over).toBe(false);
  });

  it("counts a newcomer with no commitment by places, as before", () => {
    expect(limitFor({ commitmentTarget: 100, seats: 2 }, [10], null)).toMatchObject({ byPlaces: true, over: false });
    expect(limitFor({ commitmentTarget: 100, seats: 2 }, [10, 10], null)).toMatchObject({ byPlaces: true, over: true });
  });

  it("asks in the lead's exact words", () => {
    expect(OVER_LIMIT_WORDS.ask).toBe("This is above the limit set for this role, continue anyway?");
  });
});

describe("a person's choice to go above the limit", () => {
  const stamp = { roleId: "r1", by: "u-hal", at: "2026-11-20T10:00:00.000Z", used: 90, adding: 30, target: 100 };
  it("is read back whole, and only for the role it names", () => {
    const read = overLimitOf([stamp, { roleId: "", by: "x", at: "y", used: 1, adding: 1, target: 1 }, "junk", { ...stamp, used: "lots" }]);
    expect(read).toEqual([stamp]);
    expect(overridden(read, "r1")).toBe(true);
    expect(overridden(read, "r2")).toBe(false);
    expect(overLimitOf(null)).toEqual([]);
  });
});
