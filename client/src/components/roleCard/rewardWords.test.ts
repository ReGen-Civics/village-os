import { describe, expect, it } from "vitest";
import { setupI18n } from "@lingui/core";
import { ceilingShares } from "@shared/roleCardSections";
import { notSaidTwice, paysInTokens, rewardWords, splitNotRestated, splitHeadline, TOKEN_TERMS_ALWAYS } from "./rewardWords";
import { bandWords } from "./payBandWords";

const i18n = setupI18n({ locale: "en", messages: { en: {} } });
const BAND = { amount: 9000, currency: "USD", per: "month" as const };
const FIRST_MONTH = "Your first moon starts lower and follows what you deliver.";
const TERMS = "Equity and credit terms are still being written and are subject to legal review.";

describe("the role card's footnote (Rye, 15 Nov 2026)", () => {
  it("says the first month with no figure, and the equity and credits clause when the split pays a token share", () => {
    const w = rewardWords(i18n, BAND, 30, "", [{ label: "Cash", pct: 40 }, { label: "Equity", pct: 55 }, { label: "Credits", pct: 5 }]);
    expect(w.footnote).toBe(`*At 100% commitment. ${FIRST_MONTH} ${TERMS}`);
    expect(w.footnote).not.toMatch(/\$\d/);
  });
  it("shows the clause for now on every card, an all-cash or empty split too (Rye, 15 Nov 2026: leave them on)", () => {
    expect(TOKEN_TERMS_ALWAYS).toBe(true);
    expect(rewardWords(i18n, BAND, 30, "", [{ label: "Cash", pct: 100 }]).footnote).toBe(`*At 100% commitment. ${FIRST_MONTH} ${TERMS}`);
    expect(rewardWords(i18n, BAND, 30, "", [{ label: "Cash", pct: 100 }, { label: "Equity", pct: 0 }, { label: "Credits", pct: 0 }]).footnote).toContain(TERMS);
    expect(rewardWords(i18n, BAND, 30).footnote).toBe(`*At 100% commitment. ${FIRST_MONTH} ${TERMS}`);
    // Kept for later: the test the clause will follow when the constant is set false.
    expect(paysInTokens([{ label: "Cash", pct: 100 }])).toBe(false);
  });
  it("credits alone are enough, and the village's note follows", () => {
    expect(paysInTokens([{ label: "Cash", pct: 95 }, { label: "Village credits", pct: 5 }])).toBe(true);
    expect(paysInTokens([{ label: "Cash", pct: 100 }])).toBe(false);
    expect(rewardWords(i18n, BAND, 30, "*Indicative.", [{ label: "Earned equity", pct: 10 }]).footnote).toBe(`*At 100% commitment. ${FIRST_MONTH} ${TERMS} Indicative.`);
  });
});

describe("the headline, one figure or each share as its own amount (founding team, 16 Nov 2026)", () => {
  const SHAPE = [
    { label: "Cash", pct: 40 },
    { label: "Equity", pct: 60 },
  ];
  it("keeps today's listed price when no split is asked", () => {
    expect(rewardWords(i18n, BAND, 30, "", SHAPE).headline).toBe("Listed price: $9,000 a month for the full role*");
  });
  it("names each share's amount from the ceiling when the card splits it", () => {
    const w = rewardWords(i18n, BAND, 30, "", SHAPE, ceilingShares(BAND, SHAPE));
    expect(w.headline).toBe("Up to $3,600 in cash and $5,400 in equity a month for the full role*");
    expect(w.headline).not.toMatch(/—|–/);
    expect(w.footnote).toContain("*At 100% commitment.");
  });
  it("reads a year and a moon in their own words, and three shares as a list", () => {
    const three = [
      { label: "Cash", amount: 100 },
      { label: "Equity", amount: 200 },
      { label: "Credits", amount: 50 },
    ];
    expect(splitHeadline(i18n, { ...BAND, per: "year" }, three)).toBe("Up to $100 in cash, $200 in equity, and $50 in credits a year for the full role*");
    expect(splitHeadline(i18n, { ...BAND, per: "moon" }, [{ label: "Cash", amount: 100 }])).toBe("Up to $100 in cash a moon for the full role*");
  });
});

describe("the pay band under the listed price", () => {
  const RANGE = { kind: "range", currency: "USD", minMinor: 962300, maxMinor: 1202900, per: "month" } as const;
  it("says the band as one line, in total comp", () => {
    expect(bandWords(i18n, RANGE, true)).toBe("Band: $9,623 to $12,029 a month in total comp");
    expect(bandWords(i18n, { ...RANGE, per: "moon" }, true)).toBe("Band: $9,623 to $12,029 a moon in total comp");
    expect(bandWords(i18n, { ...RANGE, per: undefined }, true)).toBe("Band: $9,623 to $12,029 in total comp");
  });
  it("draws nothing while the village hides pay ranges, whatever the payload carries", () => {
    expect(bandWords(i18n, RANGE, false)).toBeNull();
  });
  it("draws nothing for a fixed amount, a missing figure, a missing currency or a band upside down", () => {
    expect(bandWords(i18n, { kind: "fixed", currency: "USD", amountMinor: 900000, per: "month" }, true)).toBeNull();
    expect(bandWords(i18n, null, true)).toBeNull();
    expect(bandWords(i18n, { ...RANGE, maxMinor: undefined }, true)).toBeNull();
    expect(bandWords(i18n, { ...RANGE, currency: undefined }, true)).toBeNull();
    expect(bandWords(i18n, { ...RANGE, minMinor: 1202900, maxMinor: 962300 }, true)).toBeNull();
  });
  it("keeps the listed price and says no 120% cap (lead, 17 Nov 2026)", () => {
    for (const min of [100, 30]) {
      const w = rewardWords(i18n, BAND, min);
      expect(w.headline).toBe("Listed price: $9,000 a month for the full role*");
      expect("cap" in w).toBe(false);
      const all = Object.values(w).filter(Boolean).join(" ");
      expect(all).not.toContain("Proposals up to");
      expect(all).not.toContain("120%");
    }
  });
});

describe("one footnote (production check of 1.3.24)", () => {
  it("a note that repeats the first moon, the legal review or the split says only what is new", () => {
    expect(notSaidTwice("*Your first month starts lower. Equity and credit terms are subject to legal review. Default split: 60% Cash, 40% Equity, 0% Credits. 60% cash, 40% equity. Ask us anything.")).toBe("Ask us anything.");
    expect(rewardWords(i18n, BAND, 30, "*Your first month starts lower. Equity terms are subject to legal review.", [{ label: "Equity", pct: 40 }]).footnote).toBe(
      "*At 100% commitment. Your first moon starts lower and follows what you deliver. Equity and credit terms are still being written and are subject to legal review.",
    );
    expect(splitNotRestated("60% cash, 40% equity. Settled together.")).toBe("Settled together.");
    // CONTROL: a note saying something new stays whole.
    expect(notSaidTwice("Indicative only.")).toBe("Indicative only.");
  });
});
