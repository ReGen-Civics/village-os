// @vitest-environment jsdom
/**
 * THE ENTRANCE'S HEADER SCROLLS AWAY ON A PHONE (the lead, 26 Nov 2026: "Header is following me on mobile on the
 * entrance gate"). Every other page keeps the sticky header; a wide screen keeps it on the entrance too.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { Router } from "wouter";

vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: null, logout: vi.fn() }) }));
vi.mock("@/modules/ModuleProvider", () => ({ useModules: () => ({ modules: [], loaded: true, failed: false }) }));
vi.mock("@/lib/gameApi", () => ({
  useGameConfig: () => ({ project: { name: "Willowbrook", siteUrl: "https://willowbrook.example" }, images: {} }),
  altOr: (value: string | undefined, fallback: string) => (typeof value === "string" ? value : fallback),
}));
vi.mock("@/components/NotificationBell", () => ({ default: () => null }));
vi.mock("@/components/NotificationToasts", () => ({ default: () => null }));
vi.mock("@/components/RewardMoment", () => ({ default: () => null }));
vi.mock("./mobile/MobileTabBar", () => ({ default: () => null, isBareRoute: () => false }));
vi.mock("./mobile/MobileFab", () => ({ default: () => null }));
vi.mock("./NextStepTrail", () => ({ default: () => null }));

import Layout from "./Layout";

afterEach(cleanup);

const header = (headerScrollsOnPhone?: boolean) => {
  render(
    <Router>
      <Layout headerScrollsOnPhone={headerScrollsOnPhone}>
        <p>page body</p>
      </Layout>
    </Router>,
  );
  return screen.getByRole("banner");
};

describe("the header on a phone", () => {
  it("sticks to the top on every page by default", () => {
    expect(header().className).toBe("sticky top-0 z-50");
  });

  it("scrolls away on a phone and sticks from a wide screen up, where the page asks (the entrance)", () => {
    const h = header(true);
    expect(h.className.split(" ")).toEqual(["relative", "z-50", "sm:sticky", "sm:top-0"]);
    expect(h.hasAttribute("data-header-scrolls-on-phone")).toBe(true);
  });
});
