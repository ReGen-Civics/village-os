/**
 * PAY TO BE DETERMINED (the lead, 20 Nov 2026: "Leave the pay for both of these 'to be determined'").
 *
 * A paid role may open for applications with its amount still to be set. The kind is `tbd`: the terms' parser
 * takes it with no amount and refuses one, the card's gate and the listing gate count it as pay on offer, and
 * nothing that sums, invoices or pays money reads a figure from it.
 */
import { describe, expect, it } from "vitest";
import { MONEY_LINE, PAY_KINDS, PAY_TBD_WORDS, parseSeatSettings, settingsWords, type SeatSettings } from "./seatSettings";
import { payFromLines, payToLines, readPayGroup } from "./roleParameters";
import { payStatesRange, publicPayOf, publicPayWords } from "./rolePublicPay";
import { roleCardGate } from "./roleParams";
import { PAY_WORDS } from "./playerCardWords";
import { billedTotals, invoiceTotals, isPayableLine, linesFromTerms, termsCarryMoney, type TermsInForce } from "./moonRecap";
import { contractPriceWith } from "./contractPrice";

const TBD: SeatSettings = { v: 1, pay: { kind: "tbd" } };

const terms = (settings: SeatSettings | null): TermsInForce => ({
  applicationId: "app-tbd",
  firstSeatId: "seat-tbd",
  roleIds: ["r1"],
  roleNames: ["Builder"],
  settings,
  deliverables: null,
  daysHeld: 29,
});

describe("the terms' parser", () => {
  it("knows the kind", () => {
    expect(PAY_KINDS).toContain("tbd");
  });

  it("takes tbd with no amount and no currency", () => {
    const r = parseSeatSettings({ v: 1, pay: { kind: "tbd" } });
    expect(r.ok).toBe(true);
    expect(r.settings?.pay).toEqual({ kind: "tbd" });
  });

  it("takes a note beside it", () => {
    const r = parseSeatSettings({ v: 1, pay: { kind: "tbd", note: "Set when the budget is reset." } });
    expect(r.ok).toBe(true);
    expect(r.settings?.pay?.note).toBe("Set when the budget is reset.");
  });

  it("refuses an amount, so no figure can ride on it", () => {
    for (const extra of [{ amountMinor: 100000 }, { amountMinor: 0 }]) {
      const r = parseSeatSettings({ v: 1, pay: { kind: "tbd", currency: "USD", ...extra } });
      expect(r.ok).toBe(false);
      expect(r.problems.map((p) => p.path)).toContain("pay.amountMinor");
    }
    // A range's bounds belong to a range, whatever the kind.
    expect(parseSeatSettings({ v: 1, pay: { kind: "tbd", minMinor: 1, maxMinor: 2 } }).ok).toBe(false);
  });

  it("reads the card's pay line and writes it back", () => {
    for (const line of ["To be determined", "to be determined", "TBD", "To be determined. Note: until the budget is reset"]) {
      const r = payFromLines([line]);
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.value?.kind).toBe("tbd");
    }
    const back = payFromLines(payToLines({ kind: "tbd", note: "Funding-dependent" }));
    expect(back.ok && back.value).toEqual({ kind: "tbd", note: "Funding-dependent" });
    expect(payFromLines(["To be determined 1000 USD per month"]).ok).toBe(false);
    expect(readPayGroup({ kind: "tbd" })).toEqual({ ok: true, value: { kind: "tbd" } });
  });
});

describe("the words", () => {
  it("says Pay to be determined in the drawer, on the card and on the player card", () => {
    expect(PAY_TBD_WORDS).toBe("Pay to be determined");
    const row = settingsWords(TBD).find((r) => r.group === "pay")!;
    expect(row.headline).toBe("Pay to be determined");
    // Per or currency typed beside it change nothing: no figure, no "(currency not set)".
    const withPer = settingsWords({ v: 1, pay: { kind: "tbd", per: "month" } }).find((r) => r.group === "pay")!;
    expect(withPer.headline).toBe("Pay to be determined");
    // It is pay, paid outside the platform once set, so the money line stays.
    expect(row.moneyLine).toBe(MONEY_LINE);
    expect(publicPayWords({ kind: "tbd" }).headline).toBe("Pay to be determined");
    expect(PAY_WORDS.tbd).toBe("Pay to be determined");
  });
});

describe("the card's gate", () => {
  const base = {
    aim: "Build the homes.",
    domain: "The building site.",
    accountabilities: ["Keeping the site safe"],
    timeCommitment: "Full time",
    track: "contractor" as const,
    hasTerm: true,
    villageGoals: ["Homes"],
    selectionCriteria: ["a", "b", "c"],
    conversations: [{ roleId: "steward", minutes: 30 }] as never,
  };

  it("passes an open contractor card whose pay is to be determined", () => {
    const pay = publicPayOf(TBD);
    expect(payStatesRange(pay)).toBe(true);
    expect(roleCardGate({ ...base, payKind: pay!.kind, hasRange: payStatesRange(pay) })).toMatchObject({ complete: true, missing: [] });
  });

  it("still holds a contractor card with no pay at all (control)", () => {
    expect(roleCardGate({ ...base, payKind: null, hasRange: false }).missing).toEqual(["reward", "range"]);
  });
});

describe("money safety: tbd feeds no amount", () => {
  it("makes an End of Moon line with no cash, which pays and bills nothing", () => {
    const lines = linesFromTerms([terms(TBD)], { days: 29 }, { "app-tbd": 500000 }, { "app-tbd": 500000 });
    expect(lines).toHaveLength(1);
    const [l] = lines;
    expect(l).toMatchObject({ basis: "listed", listedAs: "tbd", currency: null, amountMinor: null, termsMinor: null, range: null, proposedMinor: null, finalMinor: null });
    expect(l.basisLine).toBe("Pay to be determined, no cash yet");
    expect(isPayableLine(l)).toBe(false);
    expect(invoiceTotals(lines)).toEqual([]);
    expect(billedTotals(lines)).toEqual([]);
  });

  it("adds nothing beside a paid line", () => {
    const fixed = terms({ v: 1, pay: { kind: "fixed", currency: "USD", amountMinor: 300000, per: "moon" } });
    const both = linesFromTerms([{ ...fixed, applicationId: "app-fixed" }, terms(TBD)], { days: 29 });
    const alone = linesFromTerms([{ ...fixed, applicationId: "app-fixed" }], { days: 29 });
    expect(invoiceTotals(both)).toEqual(invoiceTotals(alone));
    expect(billedTotals(both)).toEqual(billedTotals(alone));
  });

  it("does not open the invoice part on its own", () => {
    expect(termsCarryMoney([terms(TBD)])).toBe(false);
    // A currency typed beside it is still no money (it carries no amount either).
    expect(termsCarryMoney([terms({ v: 1, pay: { kind: "tbd", currency: "USD" } as never })])).toBe(false);
  });

  it("gives adoption no price: with no band the contract records no pay, whatever the ask", () => {
    expect(contractPriceWith(null, 50, { kind: "negotiate" }, null)).toBeNull();
    expect(contractPriceWith(null, 50, null, null)).toBeNull();
  });
});
