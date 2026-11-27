// @vitest-environment jsdom
/**
 * THE TREASURY NAMES A TOKEN AND ITS NUMBER, NOTHING MORE (Rye, 2026-10-22:
 * copy never says what a token does; each village sets its own rules). The
 * Voice purse used to read "Your weight when the village votes. Earned by
 * showing up, never bought." and the heading "What you have earned", both
 * claims about how a token is gained. This renders the panel with every token
 * purse filled and reads what a member sees.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { Router } from "wouter";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@lingui/core";

i18n.load("en", {});
i18n.activate("en");

let config: Record<string, unknown> = { currency: { value: { slug: "village-token" } } };
vi.mock("@/lib/gameApi", () => ({
  authToken: () => null,
  useGameConfig: () => config,
}));
vi.mock("@/hooks/useTokenNames", () => ({ useTokenName: () => "Cheers" }));
vi.mock("@/lib/workPay", () => ({ cashPayWords: () => null, linesWords: () => "", useDisplayRates: () => null }));
let villageWords: Record<string, string> = {};
vi.mock("@/hooks/useAppWords", () => ({ useAppWords: () => (_section: string, key: string) => villageWords[key] ?? null }));

import TreasuryPanel from "./TreasuryPanel";
import { formatMoney } from "@shared/money";
import type { DashData } from "./useDashData";

afterEach(cleanup);

const data = {
  wallet: [
    { token: "village-token", name: "Harbour Tokens", kind: "value", role: "village", decimals: 0, heldUnits: 420 },
    { token: "village-voice", name: "Voice", kind: "voice", role: "village", decimals: 0, heldUnits: 37 },
  ],
  ledger: [],
  cycle: { id: "m1", cycleNumber: 3, startsAt: "2026-11-01T00:00:00Z", endsAt: "2026-11-29T00:00:00Z", daysRemaining: 12 },
  pastMoons: [],
  gratitude: { receivedThisCycle: 4, remaining: 6, total: 10 },
  cash: null,
} as unknown as DashData;

/** What a member reads, as one string. */
const page = () => document.body.textContent ?? "";
/** A sentence that says what a token does or how it is gained. */
const MECHANICS = /earn|never bought|bought|showing up|weight when|from the pool|only counts|worth|pays you in|redeemable/i;

describe("the treasury", () => {
  it("names each token and its number, and says nothing about what a token does", () => {
    render(
      <I18nProvider i18n={i18n}>
      <Router>
        <TreasuryPanel data={data} claimedQuests={[]} particulars={null} redeemOn={false} seasonName={null} />
      </Router>
      </I18nProvider>,
    );
    expect(screen.getByRole("heading", { name: "What you hold" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Harbour Tokens" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Voice" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Cheers" })).toBeInTheDocument();
    expect(page()).toMatch(/420/);
    expect(page()).toMatch(/37/);
    expect(page()).not.toMatch(MECHANICS);
  });

  it("puts the gratitude purse first, above cash and every token (the lead, 26 Nov 2026)", () => {
    render(
      <I18nProvider i18n={i18n}>
      <Router>
        <TreasuryPanel data={data} claimedQuests={[]} particulars={null} redeemOn={false} seasonName={null} />
      </Router>
      </I18nProvider>,
    );
    const purses = Array.from(document.querySelectorAll("#treasury ul > li h3, #treasury ul > li [role=heading]")).map((h) => h.textContent);
    expect(purses[0]).toBe("Cheers");
  });

  it("reads the village's own headings where it set them (gap G7)", () => {
    villageWords = { heading: "Your hold", byMoon: "By tide" };
    try {
      render(
        <I18nProvider i18n={i18n}>
      <Router>
          <TreasuryPanel data={data} claimedQuests={[]} particulars={null} redeemOn={false} seasonName={null} />
        </Router>
      </I18nProvider>,
      );
      expect(screen.getByRole("heading", { name: "Your hold" })).toBeInTheDocument();
      expect(page()).not.toMatch(MECHANICS);
    } finally {
      villageWords = {};
    }
  });

  it("writes cash owed with its cents, the way the Treasurer's Pay by member writes it (Rye, 16 Nov 2026)", () => {
    const owed = {
      ...data,
      cash: [{ id: "c1", workKind: "moon", workRef: "r1", workTitle: "End of Moon", amountMinor: 610867, currency: "USD", state: "owed", owedAt: "2026-11-10T12:00:00Z", claimedAt: null, paidAt: null, paidNote: null }],
    } as unknown as DashData;
    render(
      <I18nProvider i18n={i18n}>
      <Router>
        <TreasuryPanel data={owed} claimedQuests={[]} particulars={null} redeemOn={false} seasonName={null} />
      </Router>
      </I18nProvider>,
    );
    // The purse and the moon's row both read it; whole numbers once rounded it to $6,109.
    expect(formatMoney(610867, "USD")).toBe("$6,108.67");
    const purse = screen.getByText("Cash owed to you").closest("li");
    expect(purse?.textContent).toContain("$6,108.67");
    expect(page()).toContain("$6,108.67 cash owed");
    expect(page()).not.toContain("$6,109");
  });
});

describe("the contribution token in the treasury (the lead, 19 Nov 2026)", () => {
  const renderWith = (d: DashData) =>
    render(
      <I18nProvider i18n={i18n}>
      <Router>
        <TreasuryPanel data={d} claimedQuests={[]} particulars={null} redeemOn={false} seasonName={null} />
      </Router>
      </I18nProvider>,
    );
  afterEach(() => {
    config = { currency: { value: { slug: "village-token" } } };
  });

  it("is a holding even at zero, under the platform's neutral name, with its tip", () => {
    const { container } = renderWith(data);
    const heading = screen.getByRole("heading", { name: "Contribution tokens" });
    expect(heading.closest("li")?.textContent).toMatch(/0/);
    expect(heading.querySelector(".tip-word > [tabindex]")).not.toBeNull();
    expect(container.textContent).not.toMatch(/equity/i);
  });

  it("shows the village's own name and what the member holds", () => {
    config = { currency: { value: { slug: "village-token" }, names: { "earned-equity": "Harbour" } } };
    renderWith({ ...data, wallet: [...(data.wallet ?? []), { token: "earned-equity", name: "Harbour", kind: "equity", role: "village", decimals: 0, heldUnits: 2600 }] } as unknown as DashData);
    const heading = screen.getByRole("heading", { name: "Harbour" });
    expect(heading.closest("li")?.textContent).toMatch(/2,?600/);
  });

  it("is not drawn while the village has the token switched off", () => {
    config = { currency: { value: { slug: "village-token" }, unused: ["earned-equity"] } };
    renderWith(data);
    expect(screen.queryByRole("heading", { name: "Contribution tokens" })).toBeNull();
  });
});
