// @vitest-environment jsdom
/**
 * THE BRANCH YOU ARE ON (the lead's team call, 26 Nov 2026): the bar lights the group the page belongs to, read from
 * the menu as the village set it (config/navBearings.ts), and the entry itself once its dropdown is open.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";

const cfg: { current: Record<string, unknown> } = { current: {} };
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: null, logout: vi.fn() }) }));
vi.mock("@/modules/ModuleProvider", () => ({
  useModules: () => ({ modules: [{ id: "governance", lifecycle: "public" }], loaded: true, failed: false }),
}));
vi.mock("@/lib/gameApi", () => ({
  useGameConfig: () => cfg.current,
  altOr: (value: string | undefined, fallback: string) => (typeof value === "string" ? value : fallback),
}));
vi.mock("@/components/NotificationBell", () => ({ default: () => null }));
vi.mock("@/components/NotificationToasts", () => ({ default: () => null }));
vi.mock("@/components/RewardMoment", () => ({ default: () => null }));
vi.mock("./mobile/MobileTabBar", () => ({ default: ({ inMenu }: { inMenu?: boolean }) => <p data-testid="bar">{String(!!inMenu)}</p>, isBareRoute: () => false }));
vi.mock("./mobile/MobileFab", () => ({ default: () => null }));
vi.mock("./NextStepTrail", () => ({ default: () => null }));

import Layout from "./Layout";

afterEach(cleanup);

const at = (path: string, menu?: Record<string, unknown>) => {
  cfg.current = { project: { name: "Willowbrook" }, images: {}, ...(menu ? { menu } : {}) };
  const { hook } = memoryLocation({ path, static: true });
  return render(
    <Router hook={hook}>
      <Layout>
        <p>page body</p>
      </Layout>
    </Router>,
  );
};

// Inside the open dropdown: a deeper page also draws the entry in its breadcrumb.
const dropdown = () => within(document.getElementById("nav-menu-decide")!);
const group = (name: string) => screen.getByRole("button", { name: new RegExp(`^${name}`) });

describe("the branch the page belongs to", () => {
  it("is lit on the group, and only that group", () => {
    at("/decisions/42");
    expect(group("Decide").getAttribute("aria-current")).toBe("true");
    expect(group("Decide").querySelector("[data-lit-rule]")).toBeTruthy();
    expect(group("Community").getAttribute("aria-current")).toBeNull();
    expect(group("Community").querySelector("[data-lit-rule]")).toBeNull();
  });

  it("marks the entry in the open dropdown: the page itself, or the entry above a deeper page", () => {
    at("/powers");
    fireEvent.click(group("Decide"));
    expect(dropdown().getByRole("link", { name: "What We Look After" }).getAttribute("aria-current")).toBe("page");
    expect(document.getElementById("nav-menu-decide")?.hasAttribute("data-nav-dropdown")).toBe(true); // a Sea chart hook
    cleanup();
    at("/powers/water");
    fireEvent.click(group("Decide"));
    expect(dropdown().getByRole("link", { name: "What We Look After" }).getAttribute("aria-current")).toBe("true");
  });

  it("lights the group for a page whose entry this reader is not offered, and marks no entry", () => {
    at("/decisions/42"); // Decisions is a member's door: a visitor's Decide has no such entry
    fireEvent.click(group("Decide"));
    expect(group("Decide").getAttribute("aria-current")).toBe("true");
    expect(dropdown().queryByRole("link", { name: "Decisions" })).toBeNull();
    expect(document.querySelector('#nav-menu-decide [aria-current]')).toBeNull();
  });

  it("follows the village's own name for the group", () => {
    at("/decisions/42", { groups: { Decide: "Choose together" } });
    expect(group("Choose together").getAttribute("aria-current")).toBe("true");
  });

  it("lights nothing for a page the village hid from its menu", () => {
    at("/decisions/42", { hidden: ["/decisions"] });
    expect(document.querySelector("[data-lit-rule]")).toBeNull();
    expect(screen.getByTestId("bar").textContent).toBe("false");
  });

  it("lights nothing on a page in no entry, and tells the phone bar so", () => {
    at("/admin");
    expect(document.querySelector('[aria-current="true"], [aria-current="page"]')).toBeNull();
    expect(screen.getByTestId("bar").textContent).toBe("false");
    cleanup();
    at("/decisions/42");
    expect(screen.getByTestId("bar").textContent).toBe("true");
  });
});
