import { describe, expect, it } from "vitest";
import { contractPriceOf, payGroupOf } from "./contractPrice";
import { parseSeatSettings } from "./seatSettings";

const BAND = { amount: 13000, currency: "USD", per: "month" as const };

describe("the contract's price at adoption (QA-1115 P0-1)", () => {
  it("takes the accepted ask, in minor units, at the agreed commitment", () => {
    expect(contractPriceOf(BAND, 50, { kind: "amount", monthly: 7000, per: "month" })).toMatchObject({ kind: "fixed", amountMinor: 700_000, currency: "USD", per: "month", source: "ask", capped: false, note: "From their price ask, at 50% commitment." });
  });
  it("holds an ask above the cap at it, and says so", () => {
    const p = contractPriceOf(BAND, 50, { kind: "amount", monthly: 9000, per: "month" });
    expect(p).toMatchObject({ amountMinor: 780_000, source: "ask", capped: true });
    expect(p?.note).toContain("held there");
  });
  it("with no ask, the suggested price: the band times the agreed commitment", () => {
    expect(contractPriceOf(BAND, 50, null)).toMatchObject({ amountMinor: 650_000, source: "suggested", capped: false });
    // No commitment recorded: the full role.
    expect(contractPriceOf(BAND, null, null)).toMatchObject({ amountMinor: 1_300_000 });
  });
  it("negotiate: the suggested price, and the note says it was negotiate", () => {
    const p = contractPriceOf(BAND, 30, { kind: "negotiate" });
    expect(p).toMatchObject({ amountMinor: 390_000, source: "negotiate" });
    expect(p?.note).toBe("They chose to negotiate on the first call. This is the suggested price at 30% commitment until a price is agreed.");
  });
  it("a yearly band becomes a monthly contract, a twelfth", () => {
    expect(contractPriceOf({ amount: 156000, currency: "USD", per: "year" }, 100, null)).toMatchObject({ amountMinor: 1_300_000, per: "month" });
  });
  it("an ask in another period than the band's is not read: the suggested price", () => {
    expect(contractPriceOf(BAND, 50, { kind: "amount", monthly: 7000, per: "year" })).toMatchObject({ amountMinor: 650_000, source: "suggested" });
  });
  it("no band, no figure", () => {
    expect(contractPriceOf(null, 50, { kind: "amount", monthly: 7000 })).toBeNull();
    expect(contractPriceOf({ amount: 0, currency: "USD", per: "month" }, 50, null)).toBeNull();
  });
  it("the pay group is one the terms reader accepts, so End of Moon can invoice it", () => {
    const group = payGroupOf(contractPriceOf(BAND, 50, { kind: "negotiate" })!);
    const read = parseSeatSettings({ v: 1, pay: group });
    expect(read.ok, JSON.stringify(read)).toBe(true);
  });
});
