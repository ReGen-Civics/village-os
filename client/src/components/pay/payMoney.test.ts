import { describe, expect, it } from "vitest";
import { amountProblem, creditsWords, initialsOf, moneyBeside, padPress, primaryCurrency, typedMinor } from "./payMoney";

/** One credit is one US dollar (the lead, 23 Nov 2026), at two decimals. */
const credits = { decimals: 2, face: { currency: "USD", minorPerToken: 100 } };
/** A day's rates, base EUR: one euro is 1.1 dollars and 560 colones. */
const rates = { USD: 1.1, CRC: 560 };

describe("money beside a credit amount", () => {
  it("shows the face value itself for a member reading dollars", () => {
    expect(moneyBeside(2550, credits, "USD", rates)).toEqual({ text: "$25.50", converted: false });
  });

  it("shows the colon equivalent for a member set to CRC, marked as converted", () => {
    const got = moneyBeside(2500, credits, "CRC", rates);
    expect(got?.converted).toBe(true);
    // 25 USD at 560/1.1 colones a dollar is about 12,727.27 colones.
    expect(got?.text).toContain("12,727");
  });

  it("falls back to the face currency when no rate reaches the member's", () => {
    expect(moneyBeside(2500, credits, "CRC", { USD: 1.1 })).toEqual({ text: "$25.00", converted: false });
  });

  it("says nothing in money when the village has given credits no value", () => {
    expect(moneyBeside(2500, { decimals: 2, face: null }, "CRC", rates)).toBeNull();
    expect(moneyBeside(0, credits, "USD", rates)).toBeNull();
  });

  it("writes the figure the reader's way", () => {
    expect(moneyBeside(2500000, credits, "USD", rates, "es")?.text).toMatch(/25\.000,00/);
  });
});

describe("the member's currency", () => {
  it("prefers this device's choice, then the account's, then the village's, then the face", () => {
    expect(primaryCurrency({ chosenHere: "crc", saved: "EUR", village: "USD", face: "USD" })).toBe("CRC");
    expect(primaryCurrency({ chosenHere: "", saved: "EUR", village: "USD", face: "USD" })).toBe("EUR");
    expect(primaryCurrency({ chosenHere: "", saved: null, village: "CRC", face: "USD" })).toBe("CRC");
    expect(primaryCurrency({ chosenHere: "", saved: null, village: "", face: "USD" })).toBe("USD");
    expect(primaryCurrency({ chosenHere: "", saved: null, village: null, face: null })).toBeNull();
  });
});

describe("the amount pad", () => {
  const press = (keys: string[], decimals = 2) => keys.reduce((cur, k) => padPress(cur, k, decimals), "");

  it("types credits with at most the token's decimals", () => {
    expect(press(["2", "5", ".", "5", "0", "9"])).toBe("25.50");
    expect(press([".", "5"])).toBe("0.5");
    expect(press(["0", "7"])).toBe("7");
    expect(press(["4", ".", "2"], 0)).toBe("42");
  });

  it("deletes and clears", () => {
    expect(padPress("25.5", "back", 2)).toBe("25.");
    expect(padPress("25.5", "clear", 2)).toBe("");
  });

  it("stops at seven whole digits", () => {
    expect(press(["9", "9", "9", "9", "9", "9", "9", "9"])).toBe("999999");
  });

  it("reads what was typed as minor units, and nothing payable as zero", () => {
    expect(typedMinor("25.5", 2)).toBe(2550);
    expect(typedMinor("", 2)).toBe(0);
    expect(typedMinor("0.", 2)).toBe(0);
  });

  it("names what stops a send", () => {
    expect(amountProblem(0, 1000)).toBe("empty");
    expect(amountProblem(1001, 1000)).toBe("too_much");
    expect(amountProblem(1000, 1000)).toBeNull();
  });
});

describe("words", () => {
  it("writes credits without trailing zeros and grouped", () => {
    expect(creditsWords(2550, 2)).toBe("25.5");
    expect(creditsWords(125000, 2)).toBe("1,250");
  });

  it("makes initials for the tile that stands in for a photo", () => {
    expect(initialsOf("Ana Lucía Mora")).toBe("AM");
    expect(initialsOf("jo")).toBe("JO");
    expect(initialsOf("")).toBe("?");
  });
});
