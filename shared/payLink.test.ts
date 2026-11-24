import { describe, expect, it } from "vitest";
import { amountToMinor, normaliseHandle, parseAmount, parsePayLink, parseTarget, payLinkPath, payLinkUrl, PAY_NOTE_MAX } from "./payLink";

describe("request links", () => {
  it("round-trips a member, an amount and a note through the link it builds", () => {
    const url = payLinkUrl("https://village.example/", { to: { kind: "member", ref: "ana" }, amount: "12.5", note: "Two jars" });
    expect(url).toBe("https://village.example/pay?to=%40ana&amount=12.50&note=Two+jars");
    expect(parsePayLink(url)).toEqual({ to: { kind: "member", ref: "ana" }, amount: "12.50", note: "Two jars" });
  });

  it("reads a path, a bare query, and a bare handle", () => {
    expect(parsePayLink("/pay?to=@Ana&amount=3").to).toEqual({ kind: "member", ref: "ana" });
    expect(parsePayLink("?to=ana").to).toEqual({ kind: "member", ref: "ana" });
    expect(parsePayLink("@ana")).toEqual({ to: { kind: "member", ref: "ana" }, amount: null, note: null });
  });

  it("names an org by its slug and writes it back the same way", () => {
    expect(parseTarget("org:Garden-Coop")).toEqual({ kind: "org", ref: "garden-coop" });
    expect(payLinkPath({ to: { kind: "org", ref: "garden-coop" } })).toBe("/pay?to=org%3Agarden-coop");
  });

  it("opens empty on a link it cannot read, never on a guess", () => {
    expect(parsePayLink("")).toEqual({ to: null, amount: null, note: null });
    expect(parsePayLink("https://x/pay?to=<script>").to).toBeNull();
    expect(parsePayLink("https://x/pay?to=ana&amount=-5").amount).toBeNull();
    expect(parsePayLink("not a link at all").to).toBeNull();
  });

  it("caps a note at the ledger column's width and keeps it on one line", () => {
    const long = "a".repeat(PAY_NOTE_MAX + 40);
    expect(parsePayLink(`/pay?to=ana&note=${long}`).note).toHaveLength(PAY_NOTE_MAX);
    expect(parsePayLink("/pay?to=ana&note=two%0Alines").note).toBe("two lines");
  });

  it("reads handles the way the platform makes them", () => {
    expect(normaliseHandle(" @Jo ")).toBe("jo");
    expect(normaliseHandle("maria-luz_2")).toBe("maria-luz_2");
    expect(normaliseHandle("a b")).toBeNull();
    expect(normaliseHandle("-lead")).toBeNull();
  });
});

describe("amounts in credits", () => {
  it("accepts a point or a comma and canonicalises to two places", () => {
    expect(parseAmount("12")).toBe("12");
    expect(parseAmount("12.5")).toBe("12.50");
    expect(parseAmount("12,5")).toBe("12.50");
    expect(parseAmount("007.25")).toBe("7.25");
  });

  it("refuses zero, negatives, three decimals, thousands separators and the absurd", () => {
    for (const bad of ["0", "0.00", "-1", "1.234", "1,000.00", "abc", "", "99999999"]) expect(parseAmount(bad)).toBeNull();
  });

  it("turns credits into minor units at the token's own scale", () => {
    expect(amountToMinor("25.50", 2)).toBe(2550);
    expect(amountToMinor("25", 2)).toBe(2500);
    expect(amountToMinor("25", 0)).toBe(25);
    expect(amountToMinor("0.05", 2)).toBe(5);
  });
});
