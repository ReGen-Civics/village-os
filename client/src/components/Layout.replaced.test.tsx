// @vitest-environment jsdom
/**
 * THE LIVE CHECK'S FINDING (27 Nov 2026): with the map on, a role page lit Village and marked nothing inside it,
 * because Roles folds into "Circles & Roles". The entry that took its place is marked; the trail keeps "Roles".
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";

vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: null, logout: vi.fn() }) }));
vi.mock("@/modules/ModuleProvider", () => ({ useModules: () => ({ modules: [{ id: "map", lifecycle: "public" }], loaded: true, failed: false }) }));
vi.mock("@/lib/gameApi", () => ({
  useGameConfig: () => ({ project: { name: "Willowbrook" }, images: {} }),
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

const at = (path: string) => {
  const { hook } = memoryLocation({ path, static: true });
  render(
    <Router hook={hook}>
      <Layout>
        <p>page body</p>
      </Layout>
    </Router>,
  );
};

describe("a circle page while the map runs", () => {
  // Since 27 Nov 2026 the open roles have their own entry under Join, so the fold that remains is Circles into
  // "Circles & Roles" (config/nav.ts, unlessModule).
  it("marks Circles & Roles in the open Village menu, as the way there and not as the page", () => {
    at("/circles/water");
    fireEvent.click(screen.getByRole("button", { name: /^Village/ }));
    const menu = within(document.getElementById("nav-menu-village")!);
    expect(menu.getByRole("link", { name: /Circles & Roles/ }).getAttribute("aria-current")).toBe("true");
  });

  it("keeps the trail on the page's own entry", () => {
    at("/circles/water");
    const trail = screen.getByRole("navigation", { name: "Breadcrumb" });
    expect(trail.textContent?.replace(/\s*\/\s*/g, " / ").trim()).toBe("Village / Circles");
    expect(within(trail).getByRole("link", { name: "Circles" }).getAttribute("href")).toBe("/circles");
  });
});

describe("a role page while the map runs", () => {
  it("lights Open Roles under Join, its own entry, with no fold in between", () => {
    at("/roles/gardener");
    const trail = screen.getByRole("navigation", { name: "Breadcrumb" });
    expect(trail.textContent?.replace(/\s*\/\s*/g, " / ").trim()).toBe("Join / Open Roles");
    fireEvent.click(screen.getByRole("button", { name: /^Join/ }));
    const menu = within(document.getElementById("nav-menu-join")!);
    expect(menu.getByRole("link", { name: /Open Roles/ }).getAttribute("aria-current")).toBe("true");
  });
});
