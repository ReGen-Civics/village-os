import { describe, expect, it } from "vitest";
import { setupI18n } from "@lingui/core";
import { reviewExtras } from "./reviewExtras";

const i18n = setupI18n({ locale: "en", messages: { en: {} } });
const BASE = { termsStep: 3, valueStep: 2, ceiling: { amount: 13000, currency: "USD", per: "month" as const }, pct: 50, ask: null, notes: [] };

describe("the review's price line and the cap (lead, 17 Nov 2026)", () => {
  it("shows the applicant no cap amount by default", () => {
    const [price] = reviewExtras(i18n, BASE);
    expect(price.line).toBe("The suggested price, $6,500 a month");
    expect(price.line).not.toContain("Proposals up to");
    expect(price.line).not.toContain("$7,800");
  });
  it("keeps the cap for a reviewer or admin who asks for it (control)", () => {
    const [price] = reviewExtras(i18n, { ...BASE, showCap: true });
    expect(price.line).toBe("The suggested price, $6,500 a month · Proposals up to $7,800 a month");
  });
});
