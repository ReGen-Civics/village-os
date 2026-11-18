/**
 * The divergence vote's pure arithmetic (Funding rounds S4): which held quests
 * a count funds, in its own order, and funding them while the money lasts.
 */
import { describe, expect, it } from "vitest";
import { DIVERGENCE_VOTE_DAYS, DIVERGENCE_VOTE_HOURS, fundInOrder, otherCount, sideOf } from "./fundingRounds";

describe("the divergence vote", () => {
  it("runs 48 hours, which the ballot engine opens as two whole days", () => {
    expect(DIVERGENCE_VOTE_HOURS).toBe(48);
    expect(DIVERGENCE_VOTE_DAYS).toBe(2);
    expect(Number.isInteger(DIVERGENCE_VOTE_DAYS)).toBe(true);
  });

  it("names the other count", () => {
    expect(otherCount("power")).toBe("people");
    expect(otherCount("people")).toBe("power");
  });

  it("takes only the held quests a count funded, in the order it funded them", () => {
    const count = { steps: [{ option: "well", cost: 100 }, { option: "shed", cost: 600 }, { option: "path", cost: 50 }] };
    expect(sideOf(count, ["path", "shed", "seeds"])).toEqual([{ id: "shed", cost: 600 }, { id: "path", cost: 50 }]);
    expect(sideOf(count, [])).toEqual([]);
  });

  it("funds in order while the money lasts, and still tries a smaller quest after one that no longer fits", () => {
    const side = [{ id: "a", cost: 500 }, { id: "b", cost: 400 }, { id: "c", cost: 100 }];
    expect(fundInOrder(side, 1000)).toEqual({ funded: ["a", "b", "c"], short: [], spent: 1000 });
    expect(fundInOrder(side, 600)).toEqual({ funded: ["a", "c"], short: ["b"], spent: 600 });
    expect(fundInOrder(side, 0)).toEqual({ funded: [], short: ["a", "b", "c"], spent: 0 });
    expect(fundInOrder(side, -5)).toEqual({ funded: [], short: ["a", "b", "c"], spent: 0 });
  });
});
