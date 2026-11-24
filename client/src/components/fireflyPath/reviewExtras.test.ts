import { describe, expect, it } from "vitest";
import { setupI18n } from "@lingui/core";
import { recordingsReview, reviewExtras } from "./reviewExtras";

const i18n = setupI18n({ locale: "en", messages: { en: {} } });
const BASE = { termsStep: 3, valueStep: 2, ceiling: { amount: 13000, currency: "USD", per: "month" as const }, pct: 50, ask: null, notes: [] };

describe("the review's price line and the cap (lead, 17 Nov 2026)", () => {
  it("shows the applicant no cap amount by default", () => {
    const [price] = reviewExtras(i18n, BASE);
    expect(price.line).toBe("The suggested compensation, $6,500 a month");
    expect(price.line).not.toContain("Proposals up to");
    expect(price.line).not.toContain("$7,800");
  });
  it("keeps the cap for a reviewer or admin who asks for it (control)", () => {
    const [price] = reviewExtras(i18n, { ...BASE, showCap: true });
    expect(price.line).toBe("The suggested compensation, $6,500 a month · Proposals up to $7,800 a month");
  });
});

describe("the recordings on Review & submit (applicant QA, 20 Nov 2026)", () => {
  it("says recordings without their tick are not sent, and how to send them", () => {
    expect(recordingsReview(i18n, { step: 1, recordings: 2, consent: false })).toEqual([{ step: 1, label: "Your recordings", line: "2 recordings, not sent. Tick the box under them to send them." }]);
    expect(recordingsReview(i18n, { step: 1, recordings: 1, consent: false })[0].line).toBe("1 recording, not sent. Tick the box under it to send it.");
  });
  it("says ticked recordings go, and says nothing when there are none (control)", () => {
    expect(recordingsReview(i18n, { step: 1, recordings: 3, consent: true })[0].line).toBe("3 recordings, sent with your application");
    expect(recordingsReview(i18n, { step: 1, recordings: 0, consent: false })).toEqual([]);
  });
});
