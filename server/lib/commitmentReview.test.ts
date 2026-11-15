/**
 * The commitment a decider's figures are worked at (QA 15 Nov 2026, Treasurer audit): the one the adoption signs.
 */
import { describe, expect, it } from "vitest";
import { commitmentInForce } from "./commitmentReview";

describe("commitmentInForce", () => {
  const rev = (n: number, to: string | null) => ({ n, at: "2026-11-15T10:00:00Z", byId: "s-1", by: "Steward", changes: [{ key: "commitment" as const, from: "50", to }] });
  it("is theirs with no counter-offer, the latest revision's with one, and theirs again when a revision clears it", () => {
    expect(commitmentInForce({ card: { commitmentPct: 50 } })).toBe(50);
    expect(commitmentInForce({ card: { commitmentPct: 50 }, counterOffer: { revisions: [rev(1, "40"), rev(2, "30")], replies: {} } })).toBe(30);
    expect(commitmentInForce({ card: { commitmentPct: 50 }, counterOffer: { revisions: [rev(1, "30"), rev(2, null)], replies: {} } })).toBe(50);
    expect(commitmentInForce({})).toBeNull();
  });
});
