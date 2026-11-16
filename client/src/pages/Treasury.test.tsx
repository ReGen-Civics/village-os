// @vitest-environment jsdom
/**
 * The Treasury page (Rye, 2026-11-15): a `token.mint` holder who is not an
 * admin sees the hand mint and its grants, and nothing else of Admin; a member
 * holding none of the treasury's powers sees neither the mint nor the pay
 * queues. Which sections open is the server's answer (`GET /api/treasury/doors`),
 * stubbed here, because what is under test is that the page draws exactly that.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { Router } from "wouter";

const env = vi.hoisted(() => ({
  user: { id: "u-t", name: "Tara Treasurer", role: "member" } as any,
  doors: { mint: true, cashPay: false, pay: false } as Record<string, boolean>,
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: env.user, token: env.user ? "tok-treasurer" : null }),
}));
vi.mock("@/modules/ModuleProvider", () => ({
  useModules: () => ({ modules: [{ id: "moon-review", lifecycle: "members" }], loaded: true, failed: false }),
  useModuleOn: () => true,
}));
vi.mock("@/lib/gameApi", () => ({ authToken: () => (env.user ? "tok-treasurer" : null) }));
vi.mock("@/components/Layout", () => ({ default: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock("@/components/myMoon/ReviewQueue", () => ({ default: () => <p>review queue drawn</p> }));
vi.mock("@/components/admin/CashPayoutsTab", () => ({ default: () => <p>cash payouts drawn</p> }));

import Treasury from "./Treasury";
import { forgetTreasuryDoors } from "@/components/treasury/useTreasuryDoors";

const fetchMock = vi.fn();
const asked = () => fetchMock.mock.calls.map((c) => String(c[0]));

beforeEach(() => {
  forgetTreasuryDoors();
  env.user = { id: "u-t", name: "Tara Treasurer", role: "member" };
  env.doors = { mint: true, cashPay: false, pay: false };
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

const renderPage = () => render(<Router><Treasury /></Router>);

describe("the Treasury page", () => {
  it("shows a token.mint holder who is not an admin the hand mint, and no other Admin surface", async () => {
    renderPage();
    expect(await screen.findByRole("heading", { name: "Mint by hand" })).toBeInTheDocument();
    expect(await screen.findByRole("option", { name: "Ana Example (@ana)" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Village Voice" })).toBeInTheDocument();
    // None of the registry's other controls, and none of the pay queues this holder lacks.
    expect(screen.queryByText("Create a platform token")).toBeNull();
    expect(screen.queryByRole("heading", { name: "Tokens" })).toBeNull();
    expect(screen.queryByText("review queue drawn")).toBeNull();
    expect(screen.queryByText("cash payouts drawn")).toBeNull();
    // The picker is read from the treasury's own door, never the admin registry or roster.
    await waitFor(() => expect(asked()).toContain("/api/admin/mint-requests"));
    expect(asked()).toContain("/api/treasury/mint-options");
    expect(asked().some((u) => u.startsWith("/api/admin/tokens") || u.startsWith("/api/admin/players"))).toBe(false);
  });

  it("shows a member holding none of the powers neither the mint nor the pay queues", async () => {
    env.doors = { mint: false, cashPay: false, pay: false };
    renderPage();
    expect(await screen.findByText(/None of the treasury's powers are yours right now/)).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Mint by hand" })).toBeNull();
    expect(screen.queryByText("review queue drawn")).toBeNull();
    expect(screen.queryByText("cash payouts drawn")).toBeNull();
    expect(asked()).not.toContain("/api/treasury/mint-options");
    expect(asked()).not.toContain("/api/admin/mint-requests");
  });

  it("shows a cash.pay holder the End of Moon queue and the cash to pay out, and no mint", async () => {
    env.doors = { mint: false, cashPay: true, pay: true };
    renderPage();
    expect(await screen.findByText("review queue drawn")).toBeInTheDocument();
    expect(await screen.findByText("cash payouts drawn")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Mint by hand" })).toBeNull();
  });

  it("asks a visitor to sign in and asks the server nothing", async () => {
    env.user = null;
    renderPage();
    expect(await screen.findByText(/Sign in to see the parts of the treasury/)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
