// @vitest-environment jsdom
/**
 * The helpful not-found page offers only what the reader may open. The list runs through the menu's own test
 * (lib/menuVisible.ts), read from the same hooks the menu reads; these stand the hooks in for a visitor, a member and
 * an admin, with modules on and off, and read what the page offers each of them.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";

const who = vi.hoisted(() => ({
  user: null as null | { role: string },
  modules: [] as string[],
  newcomer: true,
  hidden: [] as string[],
  treasury: false,
}));

vi.mock("@/contexts/AuthContext", () => {
  const auth = () => ({ user: who.user, token: who.user ? "t" : null });
  return { useAuth: auth, useOptionalAuth: auth };
});
vi.mock("@/modules/ModuleProvider", () => ({ useModules: () => ({ modules: who.modules.map((id) => ({ id })) }) }));
vi.mock("@/lib/gameApi", () => ({ useGameConfig: () => null }));
vi.mock("@/hooks/useVillageMenu", () => ({ useVillageMenu: () => ({ hidden: who.hidden, labels: {}, groups: {} }) }));
vi.mock("@/hooks/useSiteMenuWords", () => ({ useSiteMenuWords: (m: unknown) => m }));
vi.mock("@/hooks/useTokenNames", () => ({ useTokenName: () => "Gratitude" }));
vi.mock("@/components/treasury/useTreasuryDoors", () => ({ useTreasuryDoors: () => null, anyTreasuryDoor: () => who.treasury }));
vi.mock("@/lib/newcomer", () => ({
  useNewcomerShows: () => ({
    newcomer: who.newcomer,
    shows: (e: { newcomers?: string }) => !who.newcomer || !e.newcomers,
    showsHref: () => true,
  }),
}));

import { NearestPageList, SearchLink, FIND_ANYTHING_HREF } from "./NearestPages";

function at(path: string) {
  const { hook } = memoryLocation({ path });
  return render(
    <Router hook={hook}>
      <NearestPageList />
      <SearchLink />
    </Router>,
  );
}
const offered = () => Array.from(document.querySelectorAll("[data-nearest]")).map((a) => a.getAttribute("data-nearest"));

beforeEach(() => {
  Object.assign(who, { user: null, modules: [], newcomer: true, hidden: [], treasury: false });
});
afterEach(cleanup);

describe("the nearest pages, as the reader's menu would draw them", () => {
  it("names each page and the menu group it lives in", () => {
    at("/quets");
    const link = screen.getByRole("link", { name: /Quests/ });
    expect(link.getAttribute("href")).toBe("/quests");
    expect(link.textContent).toContain("In Village; Govern, This season");
  });

  it("offers a stranger no page whose module is off", () => {
    at("/stays");
    expect(offered()).not.toContain("/stay");
    cleanup();
    who.modules = ["stays"];
    at("/stays");
    expect(offered()).toContain("/stay");
  });

  it("keeps a member's working area from a newcomer and offers it to a member", () => {
    who.modules = ["library"];
    at("/libary");
    expect(offered()).not.toContain("/library");
    cleanup();
    Object.assign(who, { newcomer: false, user: { role: "member" } });
    at("/libary");
    expect(offered()).toContain("/library");
  });

  it("offers an admin's pages to an admin only", () => {
    Object.assign(who, { newcomer: false, user: { role: "member" } });
    at("/village-setings");
    expect(offered()).not.toContain("/admin");
    cleanup();
    who.user = { role: "admin" };
    at("/village-setings");
    expect(offered()).toContain("/admin");
  });

  it("offers the treasury desk only to someone it opens for", () => {
    Object.assign(who, { newcomer: false, user: { role: "member" } });
    at("/treasury-desk");
    expect(offered()).not.toContain("/governance/treasury#desks");
    cleanup();
    who.treasury = true;
    at("/treasury-desk");
    expect(offered()).toContain("/governance/treasury#desks");
  });

  it("never offers a page the village hid from its menu", () => {
    Object.assign(who, { newcomer: false, user: { role: "member" }, hidden: ["/gratitude"] });
    at("/gratitud");
    expect(offered()).not.toContain("/gratitude");
  });

  it("draws no list at all when nothing is near, and still offers search", () => {
    at("/xyzzy-plugh");
    expect(screen.queryByTestId("nearest-pages")).toBeNull();
    expect(screen.getByRole("link", { name: "Search the village" }).getAttribute("href")).toBe(FIND_ANYTHING_HREF);
  });
});
