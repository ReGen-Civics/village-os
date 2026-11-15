import { describe, expect, it } from "vitest";
import { setupI18n } from "@lingui/core";
import { paysInTokens, rewardWords } from "./rewardWords";

const i18n = setupI18n({ locale: "en", messages: { en: {} } });
const BAND = { amount: 9000, currency: "USD", per: "month" as const };
const FIRST_MONTH = "Your first month often starts lower and follows what you deliver.";
const TERMS = "Equity and credit terms are still being written and are subject to legal review.";

describe("the role card's footnote (Rye, 15 Nov 2026)", () => {
  it("says the first month with no figure, and the equity and credits clause when the split pays a token share", () => {
    const w = rewardWords(i18n, BAND, 30, "", [{ label: "Cash", pct: 40 }, { label: "Equity", pct: 55 }, { label: "Credits", pct: 5 }]);
    expect(w.footnote).toBe(`*At 100% commitment. ${FIRST_MONTH} ${TERMS}`);
    expect(w.footnote).not.toMatch(/\$\d/);
  });
  it("leaves the clause out for a split all in cash, or with equity and credits at 0%", () => {
    expect(rewardWords(i18n, BAND, 30, "", [{ label: "Cash", pct: 100 }]).footnote).toBe(`*At 100% commitment. ${FIRST_MONTH}`);
    expect(rewardWords(i18n, BAND, 30, "", [{ label: "Cash", pct: 100 }, { label: "Equity", pct: 0 }, { label: "Credits", pct: 0 }]).footnote).not.toContain(TERMS);
    // No split written at all: no clause.
    expect(rewardWords(i18n, BAND, 30).footnote).toBe(`*At 100% commitment. ${FIRST_MONTH}`);
  });
  it("credits alone are enough, and the village's note follows", () => {
    expect(paysInTokens([{ label: "Cash", pct: 95 }, { label: "Village credits", pct: 5 }])).toBe(true);
    expect(paysInTokens([{ label: "Cash", pct: 100 }])).toBe(false);
    expect(rewardWords(i18n, BAND, 30, "*Indicative.", [{ label: "Earned equity", pct: 10 }]).footnote).toBe(`*At 100% commitment. ${FIRST_MONTH} ${TERMS} Indicative.`);
  });
});
