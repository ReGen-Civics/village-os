// @vitest-environment jsdom
/**
 * MY WORK, AFTER THE PORTAL'S NEXT MOVES (the lead, 27 Nov 2026: "yes").
 *
 * The quest board summary (GameDashboard's Quests card: the first four claims and "See the open work")
 * repeated the village's Quests page, and it is one door to that page now. The member's OWN quests stay,
 * in full: what they hold, what was turned in, what the village consented to, and what suits their roles.
 * A member who holds a role reads the door as there if they want it; quests are how others contribute.
 *
 * The page's heavy children are stubbed the way membersOnlyReads.test.tsx stubs them: the subject here is
 * which quest surfaces the profile draws on My work, read off the real Profile, YourQuests and QuestsDoor.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import { Router } from "wouter";
import type { ReactNode } from "react";

const session = vi.hoisted(() => ({ roles: [] as Array<{ id: string; name: string }> }));

vi.mock("@/components/Layout", () => ({ default: ({ children }: { children: ReactNode }) => <>{children}</> }));
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "u1", name: "Wren Calder", handle: "wren", paths: [], membershipGranted: true }, token: "a-token", loading: false }),
  useIsAdmin: () => false,
}));
vi.mock("@/lib/gameApi", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  authToken: () => "a-token",
  gameFetch: (url: string) => Promise.resolve(answer(String(url))),
}));
vi.mock("@/modules/ModuleProvider", () => ({
  useModules: () => ({ loaded: true, modules: [] }),
  useModule: (id: string) => ({ id, lifecycle: "public" }),
  useModuleOn: () => false,
  moduleIsOn: () => false,
}));
vi.mock("@/components/profileDash/MyRoleCards", () => ({ default: () => null }));
vi.mock("@/components/ProfileJourney", () => ({ default: () => null }));
vi.mock("@/components/NeedCard", () => ({ default: () => null }));
vi.mock("@/components/ProfileHero", () => ({ default: () => null }));
vi.mock("@/components/profile/PowersMap", () => ({ default: () => null }));
vi.mock("@/components/profile/SurfacedBanner", () => ({ default: () => null }));
vi.mock("@/components/profile/NightMotes", () => ({ default: () => null }));
vi.mock("@/components/NotifyPrefsPanel", () => ({ default: () => null }));
vi.mock("@/components/YourAgentPanel", () => ({ default: () => null }));
vi.mock("@/components/ProfileSheet", () => ({ default: () => null }));
vi.mock("@/components/OnchainCard", () => ({ default: () => null }));
vi.mock("@/components/WalletCard", () => ({ default: () => null }));
vi.mock("@/components/pay/PayDoor", () => ({ default: () => null }));
vi.mock("@/components/profile/MaturityLadder", () => ({ default: () => null }));
vi.mock("@/components/profile/PathsPanel", () => ({ default: () => null }));
vi.mock("@/components/profile/StandingRow", () => ({ default: () => null }));
vi.mock("@/components/profile/InvitePanel", () => ({ default: () => null }));
vi.mock("@/components/profile/PathFacts", () => ({ default: () => null }));
vi.mock("@/components/profile/TheVessel", () => ({ default: () => null }));
vi.mock("@/components/profile/MoonDock", () => ({ default: () => null }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

import Profile from "./Profile";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const claim = (id: string, title: string, status: string, extra: Record<string, unknown> = {}) => ({
  id: `c-${id}`, questId: id, questTitle: title, status, claimedAt: "2026-11-20T10:00:00.000Z", artifactUrl: "", note: "", ...extra,
});

const ME = {
  stage: { id: "s1", name: "Seedling" }, stageIndex: 0, stages: [{ id: "s1", name: "Seedling" }],
  gratitude: { balance: 0, decimals: 0, budget: { total: 0, spent: 0, remaining: 0, cycleId: "c", cap: 0, fullSends: 0 } },
  quests: [
    claim("seed", "Build a seed library shelf", "claimed"),
    claim("gate", "Mend the garden gate", "submitted"),
    claim("water", "Map the water lines", "consented", { resolvedAt: "2026-10-30T10:00:00.000Z" }),
    claim("old", "Clear the old path", "declined"),
  ],
  journeys: {}, membership: true, trainingComplete: true, consentedQuests: 1,
  nextAction: { id: "browse", label: "Find your next quest", href: "/quests" },
  lastAdvance: null,
};

function answer(url: string): Response {
  if (url.startsWith("/api/game/me")) return json(ME);
  if (url.startsWith("/api/game/progression"))
    return json({ stage: null, stageIndex: 0, consentedQuests: 1, capabilities: [], capabilityCatalogue: [], roles: session.roles, history: [], firsts: {}, signing: null });
  if (url.startsWith("/api/game/quests/suited")) return json({ quests: [{ id: "compost", title: "Turn the compost bays", circle: "Land and Food", why: "circle" }] });
  if (url.startsWith("/api/profile/prefs")) return json({ sawSections: {} });
  return json({});
}

beforeEach(() => {
  // fetchGameMe asks gameApi's own authToken, which the module mock cannot reach: the session is on disk.
  localStorage.setItem("village-auth-token", "a-token");
  vi.stubGlobal("fetch", vi.fn(async (url: unknown) => answer(String(url))));
});
afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
  session.roles = [];
});

const view = () => render(<Router><Profile /></Router>);

describe("My work", () => {
  it("draws no village board summary, one door to Quests, and the member's own quests in full", async () => {
    view();
    const own = await screen.findByRole("region", { name: "Your quests" });
    // The member's own: what they hold, what they turned in, what the village consented to, what suits their roles.
    for (const title of ["Build a seed library shelf", "Mend the garden gate", "Map the water lines"]) {
      expect(within(own).getByRole("link", { name: new RegExp(title) })).toBeTruthy();
    }
    await waitFor(() => expect(within(own).getByRole("link", { name: /Turn the compost bays/ }).getAttribute("href")).toBe("/quests/compost"));
    // A returned claim is no work of theirs to show.
    expect(screen.queryByText("Clear the old path")).toBeNull();

    // The door: one link to the village's Quests page.
    const door = screen.getByRole("region", { name: "The village's quests" });
    const links = within(door).getAllByRole("link");
    expect(links).toHaveLength(1);
    expect(links[0]!.getAttribute("href")).toBe("/quests");

    // The summary that repeated the board is gone: no "See the open work", and each quest is listed once.
    expect(screen.queryByText(/See the open work/)).toBeNull();
    expect(screen.getAllByText("Build a seed library shelf")).toHaveLength(1);
    expect(screen.getAllByText("Map the water lines")).toHaveLength(1);
  });

  it("asks nothing of a role holder: the door says the board is there if they want it, and stays last", async () => {
    session.roles = [{ id: "seat-garden", name: "Garden Steward" }];
    view();
    await waitFor(() => expect(document.querySelector("[data-quests-door]")?.getAttribute("data-quests-door")).toBe("role"));
    const door = screen.getByRole("region", { name: "The village's quests" });
    expect(door.textContent).toContain("Your roles carry your work.");
    // Last of the member's own quest surfaces: the door follows their quests, never leads them.
    const own = await screen.findByRole("region", { name: "Your quests" });
    expect(own.compareDocumentPosition(door) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("invites a member with no role to find a quest", async () => {
    view();
    await waitFor(() => expect(document.querySelector("[data-quests-door]")?.getAttribute("data-quests-door")).toBe("open"));
    expect(screen.getByRole("region", { name: "The village's quests" }).textContent).toContain("Quests are a way to take part");
  });
});
