import { describe, expect, it } from "vitest";
import { creditsInUse } from "./payGate";

describe("creditsInUse", () => {
  it("is false where the village offers no credit to send, whatever else is true", () => {
    expect(creditsInUse({ tokens: [] }, { people: [{}] })).toBe(false);
    expect(creditsInUse(null, null)).toBe(false);
  });

  it("is true once this member holds a credit", () => {
    expect(creditsInUse({ tokens: [{ balance: 0 }, { balance: 3 }] }, { people: [] })).toBe(true);
  });

  it("is true once this member has paid or been paid, even at a balance of nothing", () => {
    expect(creditsInUse({ tokens: [{ balance: 0 }] }, { people: [{ handle: "ana" }] })).toBe(true);
  });

  it("is false for a member who has never touched them", () => {
    expect(creditsInUse({ tokens: [{ balance: 0 }] }, { people: [] })).toBe(false);
    expect(creditsInUse({ tokens: [{ balance: 0 }] }, null)).toBe(false);
  });
});
