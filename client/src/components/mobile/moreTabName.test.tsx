// @vitest-environment jsdom
/**
 * More's spoken name carries the waiting count (the menu's QA, round 2): its visible word names it, so the dot's
 * hidden words join the name instead of being drowned by an aria-label.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";

vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { id: "u-more", name: "Wren Ash" } }) }));
vi.mock("@/modules/ModuleProvider", () => ({ useModules: () => ({ modules: [], loaded: true, failed: false }), moduleIsOn: () => false }));
vi.mock("@/lib/gameApi", () => ({
  useGameConfig: () => null,
  authToken: () => "t",
  gameFetch: vi.fn(async () => new Response(JSON.stringify({ items: [{ decideAt: "/review" }, { decideAt: "/governance/work#approvals" }, { decideAt: "/decisions/1" }] }), { status: 200 })),
}));
vi.mock("@/hooks/useVillageMenu", () => ({ useVillageMenu: () => ({ labels: {}, hidden: [], groups: {}, folders: {}, tabs: [] }) }));
vi.mock("@/hooks/useTokenNames", () => ({ useTokenName: (f: string) => f }));
vi.mock("@/lib/newcomer", () => ({ useNewcomerShows: () => ({ newcomer: false, shows: () => true }) }));

import MobileTabBar from "./MobileTabBar";

afterEach(cleanup);

describe("More's name", () => {
  it("says how many things wait on the member, after its own word", async () => {
    render(
      <Router hook={memoryLocation({ path: "/", static: true }).hook}>
        <MobileTabBar inMenu={false} />
      </Router>,
    );
    await act(async () => {
      await new Promise((done) => setTimeout(done, 20));
    });
    expect(await screen.findByRole("button", { name: "More, 2 waiting on you" })).toBeTruthy();
  });
});
