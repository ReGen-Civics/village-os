// @vitest-environment jsdom
/**
 * "Treasury" in the account menu, shown only when the gate opens one of the
 * treasury's powers to the signed-in member (GET /api/treasury/doors). A
 * Treasurer who is not an admin finds it; a member holding none never does.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { Router } from "wouter";

const env = vi.hoisted(() => ({ doors: { mint: true, cashPay: false, pay: false } as Record<string, boolean> }));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "u1", name: "Ada Lovelace", role: "member" }, token: `t-${JSON.stringify(env.doors)}`, logout: vi.fn() }),
}));
vi.mock("@/modules/ModuleProvider", () => ({
  useModules: () => ({ modules: [], loaded: true, failed: false }),
}));
vi.mock("@/lib/gameApi", () => ({
  useGameConfig: () => ({ project: { name: "Willowbrook" }, images: {} }),
  altOr: (value: string | undefined, fallback: string) => (typeof value === "string" ? value : fallback),
  authToken: () => "t",
  gameFetch: (path: string, init: RequestInit = {}) => fetch(path, { ...init, headers: { Authorization: "Bearer t" } }),
}));
vi.mock("@/hooks/useTokenNames", () => ({ useTokenName: (f: string) => f }));
vi.mock("@/components/NotificationBell", () => ({ default: () => null }));
vi.mock("@/components/NotificationToasts", () => ({ default: () => null }));
vi.mock("@/components/RewardMoment", () => ({ default: () => null }));
vi.mock("./mobile/MobileTabBar", () => ({ default: () => null, isBareRoute: () => false }));
vi.mock("./mobile/MobileFab", () => ({ default: () => null }));
vi.mock("./NextStepTrail", () => ({ default: () => null }));

import Layout from "./Layout";
import { forgetTreasuryDoors } from "@/components/treasury/useTreasuryDoors";

const fetchMock = vi.fn();
beforeEach(() => {
  forgetTreasuryDoors();
  fetchMock.mockReset();
  fetchMock.mockImplementation(async (url: string) =>
    String(url) === "/api/treasury/doors"
      ? new Response(JSON.stringify(env.doors), { status: 200 })
      : new Response("{}", { status: 200 }),
  );
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

async function openAccountMenu() {
  render(<Router><Layout><p>page body</p></Layout></Router>);
  await act(async () => {});
  fireEvent.click(screen.getByRole("button", { name: "Your account, Ada" }));
}

describe("Treasury in the account menu", () => {
  it("is offered to a token.mint holder who is not an admin, with no Village Settings beside it", async () => {
    env.doors = { mint: true, cashPay: false, pay: false };
    await openAccountMenu();
    const link = await screen.findByRole("link", { name: "Treasury" });
    expect(link.getAttribute("href")).toBe("/treasury");
    expect(screen.queryByRole("link", { name: "Village Settings" })).toBeNull();
  });

  it("is offered to a cash.pay holder", async () => {
    env.doors = { mint: false, cashPay: true, pay: true };
    await openAccountMenu();
    expect(await screen.findByRole("link", { name: "Treasury" })).toBeInTheDocument();
  });

  it("is not offered to a member who holds none of the treasury's powers", async () => {
    env.doors = { mint: false, cashPay: false, pay: false };
    await openAccountMenu();
    await act(async () => {});
    expect(screen.getByRole("link", { name: "My Profile" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Treasury" })).toBeNull();
  });
});
