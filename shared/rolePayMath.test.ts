import { describe, expect, it } from "vitest";
import { capAt, ceilingAt } from "./commitmentRange";
import { capOf, payForTime, ROLE_PAY_CAP_PCT } from "./rolePayMath";

describe("one role's pay for the time given to it (Rye, 15 Nov 2026)", () => {
  it("is price x given / priced, so a commitment is applied once", () => {
    // The application: the band is the full role, priced at 100%.
    expect(payForTime(13000, 50, 100)).toBe(6500);
    expect(ceilingAt(13000, 50)).toBe(payForTime(13000, 50, 100));
    // The End of Moon: a 50% agreement given 50% of the person pays its terms, never half of them again.
    expect(payForTime(6500, 50, 50)).toBe(6500);
    expect(payForTime(6500, 100 * 50 / 100, 50) * 2).toBe(13000);
  });
  it("answers 0 for anything unreadable", () => {
    for (const [p, g, d] of [[0, 50, 100], [100, 0, 100], [100, 50, 0], [Number.NaN, 50, 100], [-1, 50, 100]]) expect(payForTime(p, g, d)).toBe(0);
  });
  it("caps at 120% of the listed price, and the application's cap is the same rule at the commitment", () => {
    expect(ROLE_PAY_CAP_PCT).toBe(120);
    expect(capOf(13000)).toBe(15600);
    expect(capAt(13000, 100)).toBe(capOf(ceilingAt(13000, 100)));
    expect(capAt(13000, 50)).toBe(capOf(ceilingAt(13000, 50)));
  });
});
