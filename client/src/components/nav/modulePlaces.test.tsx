// @vitest-environment jsdom
/**
 * A MODULE ENTRY THE VILLAGE RENAMED AND MOVED SHOWS SO EVERYWHERE THE MENU IS READ (the lead, 27 Nov 2026): the
 * desktop bar, the phone's More sheet, the breadcrumb and the browser tab all say the village's name, in the village's
 * place, and the entry's old place no longer holds it.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import { documentTitle } from "@shared/pageTitles";

const state = vi.hoisted(() => ({ menu: null as unknown }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { id: 1, name: "Ora Vale", role: "member", membershipGranted: true }, logout: vi.fn() }) }));
vi.mock("@/modules/ModuleProvider", () => ({
  useModules: () => ({ modules: [{ id: "forum", lifecycle: "public" }, { id: "map", lifecycle: "public" }, { id: "feed", lifecycle: "public" }], loaded: true, failed: false }),
  useModule: () => null,
  moduleIsOn: (s: { modules: Array<{ id: string }> }, id: string) => s.modules.some((m) => m.id === id),
}));
vi.mock("@/lib/gameApi", () => ({
  useGameConfig: () => ({ project: { name: "Harbour" }, currency: { name: "Cheers" }, menu: state.menu }),
  useBrandImages: () => ({}),
  useSeason: () => null,
  authToken: () => "t",
  gameFetch: () => Promise.resolve(new Response("{}", { status: 404 })),
  fetchGameMe: () => Promise.resolve(null),
}));
vi.mock("@/hooks/useTokenNames", () => ({ useTokenName: (f: string) => f }));
vi.mock("@/components/NotificationBell", () => ({ default: () => null }));
vi.mock("@/components/mobile/MobileFab", () => ({ default: () => null }));
vi.mock("@/components/NextStepTrail", () => ({ default: () => null }));
vi.mock("@/components/MemberMoments", () => ({ default: () => null }));
vi.mock("@/lib/navVisits", () => ({ mostVisited: () => [], recentPages: () => ["/forum"], recordVisit: () => {} }));

afterEach(cleanup);

const MENU = { labels: { "/forum": "Crew Talk" }, places: { "/forum": { group: "Village", sub: "Maps" } } };

async function draw(path: string) {
  state.menu = MENU;
  const { default: Layout } = await import("@/components/Layout");
  render(
    <Router hook={memoryLocation({ path }).hook}>
      <Layout>
        <p>page</p>
      </Layout>
    </Router>,
  );
  // The placing code loads after the first paint (hooks/useVillageMenu.ts, usePlacedMenu): let it land.
  await act(async () => {
    await import("@/config/navPlaces");
    await new Promise((r) => setTimeout(r, 0));
  });
}

describe("a renamed and moved module entry", () => {
  it("is in its new group and folder on the desktop bar, under its new name, and gone from the old one", async () => {
    await draw("/");
    const nav = screen.getAllByRole("navigation")[0]!;
    fireEvent.click(within(nav).getByRole("button", { name: /^Village/ }));
    const maps = within(document.body).queryAllByRole("button", { name: /Maps/ });
    if (maps[0]) fireEvent.click(maps[0]);
    expect(within(document.body).getAllByRole("link", { name: /Crew Talk/ }).length).toBeGreaterThan(0);
    // Community keeps its Conversations folder, without the forum in it.
    fireEvent.click(within(nav).getByRole("button", { name: /^Community/ }));
    const talk = within(document.body).queryAllByRole("button", { name: /Conversations/ });
    if (talk[0]) fireEvent.click(talk[0]);
    expect(within(document.body).queryByRole("link", { name: /^Forum$/ })).toBeNull();
  });

  it("names the village's place in the breadcrumb of a page below it", async () => {
    await draw("/forum/42");
    const crumbs = screen.getByRole("navigation", { name: /breadcrumb|where you are/i });
    const text = crumbs.textContent ?? "";
    expect(text).toContain("Village");
    expect(text).toContain("Maps");
    expect(text).toContain("Crew Talk");
    expect(text).not.toContain("Community");
  });

  it("sits in the village's place on the phone's More sheet, and Recent says its new name", async () => {
    // A phone: the sheet draws below md (MoreSheet.tsx).
    window.matchMedia = ((q: string) => ({ matches: true, media: q, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia;
    await draw("/");
    await act(async () => {
      window.dispatchEvent(new Event("open-mobile-menu"));
    });
    const sheet = await screen.findByRole("dialog", {}, { timeout: 10000 });
    expect(sheet.textContent ?? "").toContain("Crew Talk");
    expect(sheet.textContent ?? "").not.toMatch(/\bForum\b/);
  });

  it("gives the browser tab the village's name for the page", () => {
    expect(documentTitle("/forum", "Harbour", { names: MENU.labels })).toBe("Crew Talk · Harbour");
    expect(documentTitle("/forum/42", "Harbour", { names: MENU.labels })).not.toContain("Crew Talk");
    expect(documentTitle("/feed", "Harbour", { names: MENU.labels })).toBe("Feed · Harbour");
  });
});
