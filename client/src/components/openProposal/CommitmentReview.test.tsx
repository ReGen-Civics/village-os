// @vitest-environment jsdom
/**
 * THE DECIDER'S FIGURES FOLLOW A COUNTER-OFFER (QA 15 Nov 2026, Treasurer audit). When the people deciding counter
 * an applicant's 50% with 30%, the contract records 30%, so "the role pays up to" and the coverage are worked at 30%
 * and the page says both numbers. With no counter-offer the page reads as before.
 */
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import CommitmentReview, { type CommitmentReviewData } from "./CommitmentReview";

i18n.load("en", {});
i18n.activate("en");
const wrap = (data: CommitmentReviewData) => render(<I18nProvider i18n={i18n}><CommitmentReview data={data} roles={[{ id: "role-gate", name: "Gate Steward" }]} /></I18nProvider>);
const full = { amount: 13000, currency: "USD", per: "month" as const };

describe("CommitmentReview after a counter-offer", () => {
  it("shows what they proposed and the counter-offer, and works the ceiling at the counter-offer", () => {
    wrap({ pct: 50, offeredPct: 30, ask: null, roles: [{ roleId: "role-gate", full, atCommitment: 3900, heldPct: 0, targetPct: 100, withThisPct: 30 }] });
    const box = screen.getByTestId("commitment-review");
    expect(box.querySelector("[data-commitment-pct]")?.textContent).toBe("50%");
    expect(box.querySelector("[data-commitment-offered]")?.textContent).toBe("30%");
    expect(box.textContent).toContain("At 30%, the role pays up to $3,900");
    expect(box.textContent).not.toContain("At 50%");
  });

  it("with no counter-offer, shows no second figure and works the ceiling at their commitment", () => {
    wrap({ pct: 50, ask: null, roles: [{ roleId: "role-gate", full, atCommitment: 6500, heldPct: 0, targetPct: 100, withThisPct: 50 }] });
    const box = screen.getByTestId("commitment-review");
    expect(box.querySelector("[data-commitment-offered]")).toBeNull();
    expect(box.textContent).toContain("At 50%, the role pays up to $6,500");
  });
});
