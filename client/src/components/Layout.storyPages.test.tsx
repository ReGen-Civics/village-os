// @vitest-environment jsdom
/**
 * A story page switched off on its own (Admin, Pages, "Show this page") leaves
 * the menu and the footer, and every other story page stays.
 *
 * Rendered rather than read off config/nav.ts, for the reason nav.test.tsx
 * gives: the data decides nothing, `visible()` in Layout.tsx does. Housing
 * sits in the Village dropdown and in the footer's Resources column, so both
 * doors are checked. Visit is the control: it is a story page too, served by
 * the same switch, and it must still be there.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { Router } from "wouter";

const switches = { brochurePages: true, brochureHidden: [] as string[] };

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: null, loading: false, logout: vi.fn() }),
}));
vi.mock("@/modules/ModuleProvider", () => ({
  useModules: () => ({ modules: [], loaded: true, failed: false }),
}));
vi.mock("@/lib/gameApi", () => ({
  useGameConfig: () => ({
    project: { name: "Willowbrook", tagline: "", memberName: "", location: "", adminPath: "/admin" },
    images: {} as Record<string, string>,
    ...switches,
  }),
  altOr: (value: string | undefined, fallback: string) => (typeof value === "string" ? value : fallback),
}));
vi.mock("@/components/NotificationBell", () => ({ default: () => null }));
vi.mock("@/components/NotificationToasts", () => ({ default: () => null }));
vi.mock("@/components/mobile/MobileTabBar", () => ({ default: () => null, isBareRoute: () => false }));
vi.mock("@/components/mobile/MobileFab", () => ({ default: () => null }));
vi.mock("@/components/NextStepTrail", () => ({ default: () => null }));

import Layout from "@/components/Layout";

const linksTo = (href: string) => Array.from(document.querySelectorAll(`a[href="${href}"]`));
const footer = () => document.querySelector("footer")!;
const footerLinksTo = (href: string) => Array.from(footer().querySelectorAll(`a[href="${href}"]`));

/**
 * The shell, with the Village dropdown opened the way a visitor opens it, and its "Places and homes" folder, where
 * Housing sits since round 2 (27 Nov 2026), opened where it is a folder.
 */
function openVillage() {
  render(
    <Router>
      <Layout>
        <p>page body</p>
      </Layout>
    </Router>,
  );
  const before = { housing: linksTo("/housing").length };
  fireEvent.click(screen.getAllByRole("button", { name: /Village/i })[0]!);
  const folder = screen.queryAllByRole("button", { name: /Places and homes/ });
  if (folder[0]) fireEvent.click(folder[0]);
  return { addedHousing: linksTo("/housing").length - before.housing };
}

describe("a story page switched off on its own", () => {
  beforeEach(() => {
    switches.brochurePages = true;
    switches.brochureHidden = [];
  });

  it("is in the menu and the footer while it is on, the control for the cases below", () => {
    const { addedHousing } = openVillage();
    expect(addedHousing).toBe(1);
    expect(footerLinksTo("/housing")).toHaveLength(1);
  });

  it("drops from the menu and the footer, and the other story pages stay", () => {
    switches.brochureHidden = ["/housing"];
    const { addedHousing } = openVillage();

    expect(addedHousing).toBe(0);
    expect(linksTo("/housing")).toHaveLength(0);
    expect(footerLinksTo("/visit")).toHaveLength(1);
    expect(footerLinksTo("/team")).toHaveLength(1);
  });

  it("takes a chapter's entry with it: Good Neighbor's switch still governs /rights#good-neighbor (fold 3, #1857)", () => {
    // The menu's entry and the footer's link, both to the chapter since the footer follows the menu (QA round 2).
    openVillage();
    expect(linksTo("/rights#good-neighbor")).toHaveLength(2);
    expect(footerLinksTo("/rights#good-neighbor")).toHaveLength(1);
    cleanup();
    switches.brochureHidden = ["/good-neighbor"];
    openVillage();
    expect(linksTo("/rights#good-neighbor")).toHaveLength(0);
    expect(linksTo("/housing").length).toBeGreaterThan(0);
  });

  it("drops from the phone's menu drawer too", () => {
    switches.brochureHidden = ["/housing"];
    render(
      <Router>
        <Layout>
          <p>page body</p>
        </Layout>
      </Router>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Open menu" }));
    const drawer = document.getElementById("mobile-menu")!;
    const group = (label: string) =>
      Array.from(drawer.querySelectorAll("button")).find((b) => b.textContent?.trim() === label)!;
    // The drawer opens one group at a time.
    fireEvent.click(group("Village"));
    expect(drawer.querySelectorAll('a[href="/quests"]')).toHaveLength(1);
    expect(drawer.querySelectorAll('a[href="/housing"]')).toHaveLength(0);
    fireEvent.click(group("Join"));
    // Plan a Visit is a row of Join again since round 2 (the Love Letter moved to Community).
    expect(drawer.querySelectorAll('a[href="/visit"]')).toHaveLength(1);
  });

  it("takes its story-page folders with it once every story page in them is off, and keeps the rest", () => {
    // The four journeys and the other Join pages are all story pages. With them off, Join keeps what is not a story
    // page (27 Nov 2026): Open Roles, and Become a partner and Propose a quest in their folder. The module-gated
    // entries are off here.
    switches.brochureHidden = ["/investor", "/steward", "/resident", "/prosperity", "/opportunities", "/visit", "/love-letter", "/work-with-us"];
    render(
      <Router>
        <Layout>
          <p>page body</p>
        </Layout>
      </Router>,
    );
    fireEvent.click(screen.getAllByRole("button", { name: /^Join/i })[0]!);
    const join = document.getElementById("nav-menu-join")!;
    expect(Array.from(join.querySelectorAll("[data-nav-folder]")).map((f) => f.getAttribute("data-nav-folder"))).toEqual(["Build with us"]);
    fireEvent.click(within(join).getByRole("button", { name: /Build with us/ }));
    expect(Array.from(join.querySelectorAll("a[href]")).map((a) => a.getAttribute("href"))).toEqual(["/roles", "/partner", "/propose-quest"]);
  });
});
