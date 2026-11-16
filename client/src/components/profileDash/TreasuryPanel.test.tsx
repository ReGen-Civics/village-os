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

vi.mock("@/lib/gameApi", () => ({
  authToken: () => null,
  useGameConfig: () => ({ currency: { value: { slug: "village-token" } } }),
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
      <Router>
        <TreasuryPanel data={data} claimedQuests={[]} particulars={null} redeemOn={false} seasonName={null} />
      </Router>,
    );
    expect(screen.getByRole("heading", { name: "What you hold" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Harbour Tokens" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Voice" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Cheers" })).toBeInTheDocument();
    expect(page()).toMatch(/420/);
    expect(page()).toMatch(/37/);
    expect(page()).not.toMatch(MECHANICS);
  });

  it("reads the village's own headings where it set them (gap G7)", () => {
    villageWords = { heading: "Your hold", byMoon: "By tide" };
    try {
      render(
        <Router>
          <TreasuryPanel data={data} claimedQuests={[]} particulars={null} redeemOn={false} seasonName={null} />
        </Router>,
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
      <Router>
        <TreasuryPanel data={owed} claimedQuests={[]} particulars={null} redeemOn={false} seasonName={null} />
      </Router>,
    );
    // The purse and the moon's row both read it; whole numbers once rounded it to $6,109.
    expect(formatMoney(610867, "USD")).toBe("$6,108.67");
    const purse = screen.getByText("Cash owed to you").closest("li");
    expect(purse?.textContent).toContain("$6,108.67");
    expect(page()).toContain("$6,108.67 cash owed");
    expect(page()).not.toContain("$6,109");
  });
});
