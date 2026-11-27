// @vitest-environment jsdom
/**
 * THE PHONE'S TOP BAR: Paths, the bell, Menu (the lead, 27 Nov 2026: "The top menu should have one button for paths
 * to show the various paths and another button for menu to then open up the same thing that the bottom right more
 * button opens up"). Menu and the bar's More open ONE sheet (MoreSheet), and Paths lists the home page's own path
 * cards (lib/pathCards.ts), so neither can drift from its twin. A visitor who is not signed in gets both.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { Router } from "wouter";

let user: { id: string; name: string } | null = null;
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user, logout: vi.fn() }) }));
vi.mock("@/modules/ModuleProvider", () => ({ useModules: () => ({ modules: [], loaded: true, failed: false }) }));
vi.mock("@/lib/gameApi", async (orig) => ({
  ...(await orig<typeof import("@/lib/gameApi")>()),
  useGameConfig: () => ({ project: { name: "Willowbrook" }, images: {} }),
  useBrandImages: () => ({}),
  gameFetch: () => Promise.resolve(new Response("null", { status: 404 })),
}));
vi.mock("@/hooks/usePageContent", async (orig) => ({
  ...(await orig<typeof import("@/hooks/usePageContent")>()),
  usePageContent: () => ({
    paths: {
      hidden: false,
      fields: { eyebrow: "What brought you here?", heading: "Choose your path", intro: "" },
      lists: {
        cards: [
          { id: "investor", title: "Investor", subtitle: "Join the table", description: "" },
          { id: "steward", title: "Village Steward", subtitle: "Join the Core Team", description: "" },
          { id: "resident", title: "Resident", subtitle: "Make your home here", description: "" },
          { id: "prosperity", title: "Prosperity Creator", subtitle: "Grow your business here", description: "" },
        ],
      },
    },
  }),
}));
vi.mock("@/components/NotificationBell", () => ({ default: () => <span data-bell="" /> }));
vi.mock("@/components/NotificationToasts", () => ({ default: () => null }));
vi.mock("@/components/RewardMoment", () => ({ default: () => null }));
vi.mock("./mobile/MobileTabBar", () => ({ default: () => null, isBareRoute: () => false }));
vi.mock("./mobile/MobileFab", () => ({ default: () => null }));
vi.mock("./NextStepTrail", () => ({ default: () => null }));

import Layout from "./Layout";

beforeEach(() => {
  // A phone: MoreSheet and PathsSheet draw below `md` only.
  window.matchMedia = ((q: string) => ({ matches: true, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} })) as unknown as typeof window.matchMedia;
  globalThis.fetch = vi.fn(() => Promise.resolve(new Response(JSON.stringify({ on: false }), { status: 200 }))) as unknown as typeof fetch;
});
afterEach(() => {
  cleanup();
  user = null;
});

const shell = () =>
  render(
    <Router>
      <Layout>
        <p>page body</p>
      </Layout>
    </Router>,
  );

describe("the phone's top bar", () => {
  it("reads Paths, the bell, Menu for a member, in that order, each a 44px target", async () => {
    user = { id: "u1", name: "Mara Stone" };
    shell();
    const bar = document.querySelector("[data-header-paths]")!.parentElement as HTMLElement;
    // The bell loads on its own (lazy); wait for the phone bar's one.
    await waitFor(() => expect(bar.querySelector("[data-bell]")).toBeTruthy());
    const order = Array.from(bar.querySelectorAll("[data-header-paths], [data-bell], [data-header-menu]")).map((el) =>
      el.hasAttribute("data-header-paths") ? "paths" : el.hasAttribute("data-bell") ? "bell" : "menu",
    );
    expect(order).toEqual(["paths", "bell", "menu"]);
    for (const b of [screen.getByRole("button", { name: "Paths" }), screen.getByRole("button", { name: "Open menu" })]) {
      expect(b.className).toContain("min-h-11");
      // Shown on a phone: neither is hidden below md.
      expect(b.className.split(" ")).not.toContain("hidden");
    }
  });

  it("gives a visitor who is not signed in both buttons", () => {
    shell();
    expect(screen.getByRole("button", { name: "Paths" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Open menu" })).toBeTruthy();
  });

  it("opens the same sheet from Menu as from the bar's More", async () => {
    shell();
    fireEvent.click(screen.getByRole("button", { name: "Open menu" }));
    const fromMenu = await screen.findByRole("dialog", { name: "More" });
    expect(fromMenu.closest("[data-more-sheet]")).toBeTruthy();
    const items = Array.from(fromMenu.querySelectorAll("a[href]")).map((a) => a.getAttribute("href"));
    fireEvent.click(within(fromMenu).getByRole("button", { name: "Close More" }));
    expect(screen.queryByRole("dialog", { name: "More" })).toBeNull();
    // The bar's More sends this event (MobileTabBar.tsx).
    act(() => {
      window.dispatchEvent(new CustomEvent("open-mobile-menu"));
    });
    const fromMore = await screen.findByRole("dialog", { name: "More" });
    expect(Array.from(fromMore.querySelectorAll("a[href]")).map((a) => a.getAttribute("href"))).toEqual(items);
  });

  it("opens Paths on the home page's own path cards, each a link to its journey page", async () => {
    shell();
    fireEvent.click(screen.getByRole("button", { name: "Paths" }));
    const sheet = await screen.findByRole("dialog", { name: "Choose your path" });
    const doors = Array.from(sheet.querySelectorAll("[data-path-door]"));
    expect(doors.map((a) => [a.getAttribute("data-path-door"), a.getAttribute("href")])).toEqual([
      ["investor", "/investor"],
      ["steward", "/steward"],
      ["resident", "/resident"],
      ["prosperity", "/prosperity"],
    ]);
    expect(doors[0].textContent).toContain("Join the table");
    expect(doors[2].textContent).toContain("Make your home here");
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: "Choose your path" })).toBeNull();
  });
});
