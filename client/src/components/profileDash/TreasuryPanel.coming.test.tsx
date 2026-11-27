// @vitest-environment jsdom
/**
 * "Coming when you finish" opens the quest (the lead, 27 Nov 2026): each quest
 * in hand on the treasury is a link to its own page, where the member reads the
 * whole quest, turns it in or puts it back.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { Router } from "wouter";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@lingui/core";

i18n.load("en", {});
i18n.activate("en");

vi.mock("@/lib/gameApi", () => ({
  authToken: () => null,
  useGameConfig: () => ({ currency: { value: { slug: "village-token" } } }),
}));
vi.mock("@/hooks/useTokenNames", () => ({ useTokenName: () => "Cheers" }));
vi.mock("@/lib/workPay", () => ({ cashPayWords: () => null, linesWords: () => "25 Village Credits, 10 Village Voice", useDisplayRates: () => null }));
vi.mock("@/hooks/useAppWords", () => ({ useAppWords: () => () => null }));

import TreasuryPanel from "./TreasuryPanel";
import type { DashData } from "./useDashData";

afterEach(cleanup);

const data = {
  wallet: [],
  ledger: [],
  cycle: null,
  pastMoons: [],
  gratitude: null,
  cash: null,
  questPay: { "food-forest": { lines: [{ token: "credits", amount: 25 }] } },
} as unknown as DashData;

describe("coming when you finish", () => {
  it("is a link to the quest's own page, named by the quest and its reward", () => {
    render(
      <I18nProvider i18n={i18n}>
        <Router>
          <TreasuryPanel
            data={data}
            claimedQuests={[{ questId: "food-forest", questTitle: "Food Forest Tender" }]}
            particulars={null}
            redeemOn={false}
            seasonName={null}
          />
        </Router>
      </I18nProvider>,
    );
    const link = screen.getByRole("link", { name: /Food Forest Tender \(quest\)/ });
    expect(link.getAttribute("href")).toBe("/quests/food-forest");
    expect(link.textContent).toContain("25 Village Credits, 10 Village Voice");
  });
});
