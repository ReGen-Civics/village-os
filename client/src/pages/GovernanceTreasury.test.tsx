// @vitest-environment jsdom
/**
 * THE VILLAGE'S ONE TREASURY (the lead, 27 Nov 2026: fold /treasury, /cash-payouts and /pricing into Govern >
 * Treasury, beside the cash budget #1843 put there). Every member reads the cash budget; each treasurer's desk is
 * drawn only for whoever the server says holds its power; the old addresses redirect to their sections, keeping a
 * hash a notice already carried; and no page links an old address.
 *
 * Which desks open is the server's answer (`GET /api/treasury/doors`, and the budget read's door for role.pay),
 * stubbed here, because what is under test is that the page draws exactly that.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { Router } from "wouter";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@lingui/core";

i18n.load("en", {});
i18n.activate("en");

const env = vi.hoisted(() => ({
  user: { id: "u-t", name: "Tara Treasurer", role: "member" } as { id: string; name: string; role: string } | null,
  doors: { mint: false, cashPay: false, pay: false } as Record<string, boolean>,
  mayWriteBudget: false,
  deskProps: [] as Array<Record<string, unknown>>,
  cashProps: [] as Array<Record<string, unknown>>,
}));

vi.mock("@/components/Layout", () => ({ default: ({ children }: { children: ReactNode }) => <>{children}</> }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: env.user, token: env.user ? "tok-1" : null }) }));
vi.mock("@/lib/gameApi", () => ({
  authToken: () => (env.user ? "tok-1" : null),
  gameFetch: (url: string, init?: RequestInit) => fetch(url, init),
}));
vi.mock("@/modules/ModuleProvider", () => ({
  useModules: () => ({ modules: [{ id: "moon-review", lifecycle: "members" }], loaded: true, failed: false }),
  useModuleOn: () => true,
}));
vi.mock("@/components/modules/ModuleGate", () => ({ SignInDoors: ({ next }: { next: string }) => <a href={`/login?next=${encodeURIComponent(next)}`}>Sign in</a> }));
vi.mock("@/components/budgets/BudgetDesk", async () => {
  const { useEffect } = await import("react");
  return {
    default: (props: { onRead?: (read: unknown) => void } & Record<string, unknown>) => {
      env.deskProps.push(props);
      useEffect(() => {
        props.onRead?.({
          moon: { id: "c-11", startsOn: "2026-11-20", endsOn: "2026-12-19", days: 30 },
          villageCurrency: "USD",
          lines: [],
          figure: { plannedMinor: 640000, committedMinor: 415000, leftMinor: 225000, currency: "USD", working: { notCounted: [] } },
          note: null,
          door: { mayWrite: env.mayWriteBudget },
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, []);
      return <div data-testid="budget-desk">desk</div>;
    },
  };
});
vi.mock("@/components/myMoon/ReviewQueue", () => ({ default: () => <p>review queue drawn</p> }));
vi.mock("@/components/myMoon/PayBoard", async () => {
  const { useEffect, useState } = await import("react");
  // Its section (#pay-board) draws a moment after the page, as the real lazy board does once its read is back.
  return {
    default: () => {
      const [shown, setShown] = useState(false);
      useEffect(() => {
        const t = setTimeout(() => setShown(true), 400);
        return () => clearTimeout(t);
      }, []);
      return shown ? <section id="pay-board"><h3 data-section-focus tabIndex={-1}>Pay by member</h3><p>pay by member drawn</p></section> : null;
    },
  };
});
vi.mock("@/components/admin/CashPayoutsTab", () => ({
  default: (props: { withPayBoard?: boolean } & Record<string, unknown>) => {
    env.cashProps.push(props);
    return <p>cash payouts drawn{props.withPayBoard === false ? "" : " with its own pay board"}</p>;
  },
}));
vi.mock("@/components/valuation/PricingDesk", () => ({ default: ({ bare }: { bare?: boolean }) => <p>pricing desk drawn{bare ? " bare" : ""}</p> }));

import GovernanceTreasury, { CASH_BUDGET_HREF, openDesks } from "./GovernanceTreasury";
import { forgetTreasuryDoors } from "@/components/treasury/useTreasuryDoors";
import { oldTreasuryAddress, TREASURY_SECTIONS } from "@/lib/treasuryAddress";

const fetchMock = vi.fn();
const asked = () => fetchMock.mock.calls.map((c) => String(c[0]));

beforeEach(() => {
  forgetTreasuryDoors();
  env.user = { id: "u-t", name: "Tara Treasurer", role: "member" };
  env.doors = { mint: false, cashPay: false, pay: false };
  env.mayWriteBudget = false;
  env.deskProps.length = 0;
  env.cashProps.length = 0;
  fetchMock.mockReset();
  fetchMock.mockImplementation(async (url: string) => {
    const u = String(url);
    if (u === "/api/treasury/doors") return new Response(JSON.stringify(env.doors), { status: 200 });
    if (u === "/api/treasury/mint-options") {
      return new Response(JSON.stringify({
        tokens: [{ slug: "village-voice", name: "Village Voice", decimals: 0 }],
        members: [{ id: "u-ana", name: "Ana Example", handle: "ana" }],
        mintCapPerCycle: 500,
      }), { status: 200 });
    }
    if (u === "/api/admin/mint-requests") return new Response(JSON.stringify({ requests: [], cosignOver: 0 }), { status: 200 });
    return new Response(JSON.stringify({ error: "auth_required" }), { status: 401 });
  });
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const draw = () =>
  render(
    <I18nProvider i18n={i18n}>
      <Router>
        <GovernanceTreasury />
      </Router>
    </I18nProvider>,
  );

describe("a member who holds no treasury power", () => {
  it("reads the cash budget in its own section, with the Governance tabs", async () => {
    draw();
    expect(await screen.findByTestId("budget-desk")).toBeTruthy();
    expect(document.getElementById("cash-budget")?.textContent).toContain("What the village can pay in cash");
    expect(screen.getByRole("navigation", { name: "Governance views" })).toBeTruthy();
    expect(env.deskProps[0]?.bearer).toBe("tok-1");
  });

  it("opens on the moon's purse, read once: the desk below draws no second figure", async () => {
    draw();
    await waitFor(() => expect(document.querySelector("[data-treasury-purses]")).not.toBeNull());
    const purses = document.querySelector("[data-treasury-purses]")!;
    expect(purses.textContent).toContain("Planned");
    expect(purses.textContent).toContain("Already promised");
    expect(document.querySelector("[data-budget-left]")?.textContent).toContain("2,250");
    expect(env.deskProps[0]?.showFigure).toBe(false);
    expect(screen.getByRole("link", { name: "Read the budget, line by line" }).getAttribute("href")).toBe("#cash-budget");
  });

  it("sees no desk and no desk board, and is told who keeps the books", async () => {
    draw();
    await waitFor(() => expect(document.querySelector('[data-governance-treasury="keepers"]')).not.toBeNull());
    expect(document.querySelector('[data-governance-treasury="keepers"] a')?.getAttribute("href")).toBe("/powers");
    for (const s of ["end-of-moon", "cash", "prices", "mint"]) expect(document.getElementById(s), s).toBeNull();
    expect(screen.queryByRole("navigation", { name: "Your desks" })).toBeNull();
    expect(screen.getByText("The village's cash, in the open")).toBeTruthy();
    expect(asked()).not.toContain("/api/treasury/mint-options");
    expect(asked()).not.toContain("/api/admin/mint-requests");
  });
});

describe("a holder of a treasury power", () => {
  it("token.mint: the hand mint from the treasury's own read, and no other Admin surface", async () => {
    env.doors = { mint: true, cashPay: false, pay: false };
    draw();
    expect(await screen.findByRole("heading", { name: "Mint by hand" })).toBeTruthy();
    expect(await screen.findByRole("option", { name: "Ana Example (@ana)" })).toBeTruthy();
    expect(screen.queryByText("review queue drawn")).toBeNull();
    expect(screen.queryByText(/cash payouts drawn/)).toBeNull();
    expect(screen.queryByText("pay by member drawn")).toBeNull();
    expect(asked()).toContain("/api/treasury/mint-options");
    expect(asked().some((u) => u.startsWith("/api/admin/tokens") || u.startsWith("/api/admin/players"))).toBe(false);
  });

  it("cash.pay: End of Moon pay with Pay by member once, and the cash desk under its own heading", async () => {
    env.doors = { mint: false, cashPay: true, pay: true };
    draw();
    expect(await screen.findByText("review queue drawn")).toBeTruthy();
    expect(await screen.findAllByText("pay by member drawn")).toHaveLength(1);
    expect(await screen.findByText("cash payouts drawn")).toBeTruthy();
    expect(env.cashProps[0]).toMatchObject({ withPayBoard: false, withHeading: false });
    expect(screen.queryByRole("heading", { name: "Mint by hand" })).toBeNull();
  });

  it("moon.approve_alone without cash.pay: Pay by member and no cash desk", async () => {
    env.doors = { mint: false, cashPay: false, pay: true };
    draw();
    expect(await screen.findByText("pay by member drawn")).toBeTruthy();
    expect(screen.queryByText(/cash payouts drawn/)).toBeNull();
  });

  it("role.pay: the pricing desk opens for whoever the budget's own door lets write, and for nobody else", async () => {
    env.mayWriteBudget = true;
    draw();
    expect(await screen.findByText("pricing desk drawn bare")).toBeTruthy();
    cleanup();
    env.mayWriteBudget = false;
    draw();
    await screen.findByTestId("budget-desk");
    expect(screen.queryByText(/pricing desk drawn/)).toBeNull();
  });

  it("says the village gave the powers and draws one door per desk, most used first, the budget last", async () => {
    env.doors = { mint: true, cashPay: true, pay: true };
    env.mayWriteBudget = true;
    draw();
    const board = await screen.findByRole("navigation", { name: "Your desks" });
    await waitFor(() => expect(board.querySelectorAll("[data-treasury-door]").length).toBe(5));
    expect(Array.from(board.querySelectorAll("[data-treasury-door]")).map((a) => a.getAttribute("href"))).toEqual(["#end-of-moon", "#cash", "#prices", "#mint", "#cash-budget"]);
    expect(screen.getByText("Your treasury desks")).toBeTruthy();
    expect(document.querySelector("[data-treasury-keys]")?.textContent).toBe("The village gave you the powers behind these 4 desks by its vote.");
  });

  it("lands on the section an old address named once its desk has drawn, and focuses its heading", async () => {
    env.doors = { mint: false, cashPay: true, pay: true };
    // A notice already sent to /cash-payouts#pay-board arrives here as /governance/treasury#pay-board.
    window.history.replaceState(null, "", "/governance/treasury#pay-board");
    try {
      draw();
      await waitFor(() => expect(document.activeElement?.textContent).toBe("Pay by member"), { timeout: 3000 });
    } finally {
      window.history.replaceState(null, "", "/");
    }
  });

  it("openDesks reads only the server's answers", () => {
    expect(openDesks(null, false)).toEqual({ endOfMoon: false, cash: false, prices: false, mint: false });
    expect(openDesks({ mint: true, cashPay: false, pay: true }, true)).toEqual({ endOfMoon: true, cash: false, prices: true, mint: true });
  });
});

describe("signed out", () => {
  it("asks for a sign-in that comes back to the treasury, and asks the server nothing", () => {
    env.user = null;
    draw();
    expect(screen.queryByTestId("budget-desk")).toBeNull();
    expect(screen.getByRole("link", { name: "Sign in" }).getAttribute("href")).toBe(`/login?next=${encodeURIComponent("/governance/treasury")}`);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("the old addresses", () => {
  const src = path.resolve(__dirname, "..");
  const app = readFileSync(path.join(src, "App.tsx"), "utf8");

  it("redirect to their sections", () => {
    expect(app).toMatch(/<Route path="\/budget">\{\(\) => <Redirect to="\/governance\/treasury#cash-budget" replace \/>\}<\/Route>/);
    expect(app).toMatch(/<Route path="\/pricing">\{\(\) => <Redirect to=\{oldTreasuryAddress\(TREASURY_SECTIONS\.prices, window\.location\.hash\)\} replace \/>\}<\/Route>/);
    expect(app).toMatch(/<Route path="\/cash-payouts">\{\(\) => <Redirect to=\{oldTreasuryAddress\(TREASURY_SECTIONS\.cash, window\.location\.hash\)\} replace \/>\}<\/Route>/);
    expect(app).toMatch(/<Route path="\/treasury">\{\(\) => <Redirect to=\{oldTreasuryAddress\(TREASURY_SECTIONS\.desks, window\.location\.hash\)\} replace \/>\}<\/Route>/);
    expect(CASH_BUDGET_HREF).toBe("/governance/treasury#cash-budget");
  });

  it("keep a hash that names a section, so a notice sent to /cash-payouts#pay-board still lands", () => {
    expect(oldTreasuryAddress(TREASURY_SECTIONS.cash, "#pay-board")).toBe("/governance/treasury#pay-board");
    expect(oldTreasuryAddress(TREASURY_SECTIONS.cash, "")).toBe("/governance/treasury#cash");
    expect(oldTreasuryAddress(TREASURY_SECTIONS.prices, "#nothing-here")).toBe("/governance/treasury#prices");
    expect(oldTreasuryAddress(TREASURY_SECTIONS.desks, "#%E0%A4%A")).toBe("/governance/treasury#desks");
  });

  it("are linked from no page, component or Admin tab (the menu entries are the menu lane's)", () => {
    const hits: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const p = path.join(dir, name);
        if (statSync(p).isDirectory()) {
          if (name === "locales" || name === "node_modules") continue;
          walk(p);
        } else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) {
          const text = readFileSync(p, "utf8");
          if (/(href|to|next)=\{?["'`]\/(budget|treasury|cash-payouts|pricing)["'`#?]/.test(text)) hits.push(path.relative(src, p));
        }
      }
    };
    walk(src);
    expect(hits).toEqual([]);
  });
});
