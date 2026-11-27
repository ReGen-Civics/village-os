// @vitest-environment jsdom
/**
 * THE CASH BUDGET IS GOVERNANCE'S TREASURY VIEW (the lead, 27 Nov 2026: "why is there a cash budget page?! This can
 * just be built into the governance section under the treasury section"). Every member reads the same BudgetDesk
 * there; the desk opens its editor for whoever the server lets change the budget; /budget redirects; and no page
 * links the old address.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { Router } from "wouter";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@lingui/core";

i18n.load("en", {});
i18n.activate("en");

let user: { id: string } | null = { id: "u-1" };
let doors: { mint: boolean; cashPay: boolean; pay: boolean } | null = null;
const deskProps: Array<Record<string, unknown>> = [];

vi.mock("@/components/Layout", () => ({ default: ({ children }: { children: ReactNode }) => <>{children}</> }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user, token: user ? "tok-1" : null }) }));
vi.mock("@/lib/gameApi", () => ({ authToken: () => (user ? "tok-1" : null) }));
vi.mock("@/components/modules/ModuleGate", () => ({ SignInDoors: ({ next }: { next: string }) => <a href={`/login?next=${encodeURIComponent(next)}`}>Sign in</a> }));
vi.mock("@/components/treasury/useTreasuryDoors", () => ({
  useTreasuryDoors: () => doors,
  anyTreasuryDoor: (d: typeof doors) => !!d && (d.mint || d.cashPay || d.pay),
}));
vi.mock("@/components/budgets/BudgetDesk", () => ({
  default: (props: Record<string, unknown>) => {
    deskProps.push(props);
    return <div data-testid="budget-desk">desk</div>;
  },
}));

import GovernanceTreasury, { CASH_BUDGET_HREF } from "./GovernanceTreasury";

afterEach(() => {
  cleanup();
  user = { id: "u-1" };
  doors = null;
  deskProps.length = 0;
});

const draw = () =>
  render(
    <I18nProvider i18n={i18n}>
      <Router>
        <GovernanceTreasury />
      </Router>
    </I18nProvider>,
  );

describe("Governance's Treasury view", () => {
  it("shows a member the cash budget in its own section, with the Governance tabs", async () => {
    draw();
    expect(await screen.findByTestId("budget-desk")).toBeTruthy();
    expect(document.getElementById("cash-budget")?.textContent).toContain("What the village can pay in cash");
    expect(screen.getByRole("link", { name: "Treasury" }).getAttribute("aria-current")).toBe(null);
    expect(screen.getByRole("navigation", { name: "Governance views" })).toBeTruthy();
  });

  it("hands the desk the member's own bearer, so the server decides who may change the budget", async () => {
    draw();
    await screen.findByTestId("budget-desk");
    expect(deskProps[0]?.bearer).toBe("tok-1");
  });

  it("asks a signed-out reader to sign in, and comes back to the cash budget", () => {
    user = null;
    draw();
    expect(screen.queryByTestId("budget-desk")).toBeNull();
    expect(screen.getByRole("link", { name: "Sign in" }).getAttribute("href")).toBe(`/login?next=${encodeURIComponent(CASH_BUDGET_HREF)}`);
  });

  it("opens the door to the village's books for a holder of a treasury power only", async () => {
    draw();
    await screen.findByTestId("budget-desk");
    expect(document.querySelector('[data-governance-treasury="books"]')).toBeNull();
    cleanup();
    doors = { mint: false, cashPay: true, pay: false };
    draw();
    await screen.findByTestId("budget-desk");
    expect(document.querySelector('[data-governance-treasury="books"] a')?.getAttribute("href")).toBe("/treasury");
  });
});

describe("the old address", () => {
  const src = path.resolve(__dirname, "..");
  it("redirects /budget to the cash budget's section", () => {
    const app = readFileSync(path.join(src, "App.tsx"), "utf8");
    expect(app).toMatch(/<Route path="\/budget">\{\(\) => <Redirect to="\/governance\/treasury#cash-budget" replace \/>\}<\/Route>/);
    expect(CASH_BUDGET_HREF).toBe("/governance/treasury#cash-budget");
  });

  it("is linked from no page, component or Admin tab (the menu entry is the menu lane's)", () => {
    const hits: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const p = path.join(dir, name);
        if (statSync(p).isDirectory()) {
          if (name === "locales" || name === "node_modules") continue;
          walk(p);
        } else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) {
          const text = readFileSync(p, "utf8");
          if (/(href|to|next)=\{?["'`]\/budget["'`#?]/.test(text)) hits.push(path.relative(src, p));
        }
      }
    };
    walk(src);
    expect(hits).toEqual([]);
  });
});
