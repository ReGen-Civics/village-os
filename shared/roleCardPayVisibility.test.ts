/**
 * WHO READS A ROLE'S CEILING, AND HOW IT READS (founding team, 16 Nov 2026).
 *
 * Made-up figures only. A card's own choice beats the village's switch both ways; a card that never chose
 * follows it. The split names each share's amount from the ceiling and the shares in force.
 */
import { describe, expect, it } from "vitest";
import { cardPay, ceilingShares, readsCeiling, readSections, sectionsForReader, SECTION_PROBLEMS, splitCeilingLine, splitsAmounts, villagePayFrom, type PayReader } from "./roleCardSections";

const PRICED = {
  qualities: ["Owns the whole domain"],
  paid: true,
  payShape: [
    { label: "Cash", pct: 40 },
    { label: "Equity", pct: 60 },
  ],
  payCeiling: { amount: 1000, currency: "USD", per: "month" },
};

const readers: Record<string, PayReader> = {
  visitor: { villageShows: false, readsTerms: false, edits: false },
  visitorSwitchOn: { villageShows: true, readsTerms: false, edits: false },
  termsReader: { villageShows: false, readsTerms: true, edits: false },
  editor: { villageShows: false, readsTerms: true, edits: true },
};

function held(extra: Record<string, unknown> = {}) {
  const r = readSections({ ...PRICED, ...extra });
  if (!r.ok) throw new Error(r.problem);
  return r.value;
}

describe("payVisibility and payWording on the sections", () => {
  it("absent and \"village\" store nothing, so a card that never chose reads exactly as before", () => {
    const before = held();
    const village = held({ payVisibility: "village", payWording: "village" });
    expect("payVisibility" in before).toBe(false);
    expect("payWording" in village).toBe(false);
    expect(village).toEqual(before);
  });

  it("keeps show, hide, total and split, and refuses anything else with its own field", () => {
    expect(held({ payVisibility: "hide" }).payVisibility).toBe("hide");
    expect(held({ payVisibility: "show" }).payVisibility).toBe("show");
    expect(held({ payWording: "split" }).payWording).toBe("split");
    expect(held({ payWording: "total" }).payWording).toBe("total");
    expect(readSections({ ...PRICED, payVisibility: "members" })).toEqual({ ok: false, problem: SECTION_PROBLEMS.visibility, field: "sections.payVisibility" });
    expect(readSections({ ...PRICED, payWording: 3 })).toEqual({ ok: false, problem: SECTION_PROBLEMS.wording, field: "sections.payWording" });
  });
});

describe("readsCeiling and sectionsForReader: the one gate", () => {
  it("a card that follows the village: off, only terms readers and editors; on, everyone", () => {
    expect(readsCeiling(held(), readers.visitor)).toBe(false);
    expect(readsCeiling(held(), readers.termsReader)).toBe(true);
    expect(readsCeiling(held(), readers.editor)).toBe(true);
    expect(readsCeiling(held(), readers.visitorSwitchOn)).toBe(true);
    const out = sectionsForReader(held(), readers.visitor);
    expect("payCeiling" in out).toBe(false);
    expect(out.payShape).toEqual(PRICED.payShape);
  });

  it("show opens it to a visitor while the village keeps pay hidden", () => {
    expect(readsCeiling(held({ payVisibility: "show" }), readers.visitor)).toBe(true);
    expect(sectionsForReader(held({ payVisibility: "show" }), readers.visitor).payCeiling).toEqual(PRICED.payCeiling);
  });

  it("hide closes it to everyone but its editors, even with the village switch on and to a terms reader", () => {
    for (const r of [readers.visitor, readers.visitorSwitchOn, readers.termsReader]) {
      expect(readsCeiling(held({ payVisibility: "hide" }), r)).toBe(false);
      const out = sectionsForReader(held({ payVisibility: "hide" }), r);
      expect("payCeiling" in out).toBe(false);
      expect(JSON.stringify(out)).not.toContain("1000");
    }
    expect(sectionsForReader(held({ payVisibility: "hide" }), readers.editor).payCeiling).toEqual(PRICED.payCeiling);
  });

  it("the card's choice itself reaches only its editors", () => {
    expect("payVisibility" in sectionsForReader(held({ payVisibility: "show" }), readers.visitor)).toBe(false);
    expect(sectionsForReader(held({ payVisibility: "show" }), readers.editor).payVisibility).toBe("show");
  });
});

describe("each share as its own amount", () => {
  const village = (splitAmounts: boolean) => villagePayFrom({ shape: "", atRisk: "", note: "", splitAmounts });

  it("shares the ceiling by the shares in force, whole units, leaving out a share at 0%", () => {
    expect(ceilingShares({ amount: 1000, currency: "USD", per: "month" }, [{ label: "Cash", pct: 40 }, { label: "Equity", pct: 60 }, { label: "Credits", pct: 0 }])).toEqual([
      { label: "Cash", amount: 400 },
      { label: "Equity", amount: 600 },
    ]);
    expect(ceilingShares({ amount: 1001, currency: "USD", per: "month" }, [{ label: "Cash", pct: 33 }])).toEqual([{ label: "Cash", amount: 330 }]);
  });

  it("the default keeps today's one figure", () => {
    expect(splitsAmounts(held(), village(false))).toBe(false);
    expect(cardPay(held(), village(false))?.ceiling).toBe("Total compensation up to $1,000 a month");
    expect(cardPay(held(), village(false))?.shares).toEqual([]);
  });

  it("the village switch splits every card that follows it, and a card's own choice wins both ways", () => {
    expect(cardPay(held(), village(true))?.ceiling).toBe("Up to $400 in cash and $600 in equity a month");
    expect(cardPay(held({ payWording: "total" }), village(true))?.ceiling).toBe("Total compensation up to $1,000 a month");
    expect(cardPay(held({ payWording: "split" }), village(false))?.ceiling).toBe("Up to $400 in cash and $600 in equity a month");
    expect(cardPay(held({ payWording: "split" }), village(false))?.shares).toEqual([
      { label: "Cash", amount: 400 },
      { label: "Equity", amount: 600 },
    ]);
  });

  it("splits by the village's shares when the card writes none of its own", () => {
    const noShape = held({ payShape: [], payWording: "split" });
    const v = villagePayFrom({ shape: "Cash 50, Equity 50", atRisk: "", note: "" });
    expect(cardPay(noShape, v)?.ceiling).toBe("Up to $500 in cash and $500 in equity a month");
  });

  it("three shares read as a list, and a card with no paying share keeps the one figure", () => {
    const yearly = { amount: 1000, currency: "USD", per: "year" as const };
    expect(splitCeilingLine(yearly, [{ label: "Cash", amount: 400 }, { label: "Equity", amount: 550 }, { label: "Credits", amount: 50 }])).toBe("Up to $400 in cash, $550 in equity and $50 in credits a year");
    expect(cardPay(held({ payShape: [], payWording: "split" }), village(false))?.ceiling).toBe("Total compensation up to $1,000 a month");
  });

  it("the village's split switch rides in villagePayFrom only when on", () => {
    expect("splitAmounts" in village(false)).toBe(false);
    expect(village(true).splitAmounts).toBe(true);
  });
});
