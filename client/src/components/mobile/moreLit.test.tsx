// @vitest-environment jsdom
/**
 * MORE LIGHTS FOR ITS BRANCH (the lead's team call, 26 Nov 2026): on a page the menu knows and no slot owns, the bar
 * lights More, because More is where that page's branch is. A slot's own page keeps its slot lit, and More stays dark.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";

vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: null }) }));
vi.mock("@/modules/ModuleProvider", () => ({ useModules: () => ({ modules: [], loaded: true, failed: false }), moduleIsOn: () => false }));
vi.mock("@/lib/gameApi", () => ({ useGameConfig: () => null }));
vi.mock("@/hooks/useVillageMenu", () => ({ useVillageMenu: () => ({ labels: {}, hidden: [], groups: {}, tabs: [] }) }));
vi.mock("@/hooks/useTokenNames", () => ({ useTokenName: (f: string) => f }));
vi.mock("@/lib/newcomer", () => ({ useNewcomerShows: () => ({ newcomer: false, shows: () => true }) }));

import MobileTabBar from "./MobileTabBar";

afterEach(cleanup);

const bar = (path: string, inMenu: boolean) => {
  const { hook } = memoryLocation({ path, static: true });
  render(
    <Router hook={hook}>
      <MobileTabBar inMenu={inMenu} />
    </Router>,
  );
};
const more = () => screen.getByRole("button", { name: "More" });

describe("More on the phone's bar", () => {
  it("lights on a page in the menu that no slot owns", () => {
    bar("/decisions/42", true);
    expect(more().getAttribute("aria-current")).toBe("true");
    expect(document.querySelectorAll("[aria-current]")).toHaveLength(1);
  });

  it("stays dark where a slot owns the page, and the slot is lit", () => {
    bar("/roles/gardener", true);
    expect(more().getAttribute("aria-current")).toBeNull();
    expect(screen.getByRole("link", { name: "Roles" }).getAttribute("aria-current")).toBe("page");
  });

  it("stays dark on a page the menu does not know", () => {
    bar("/admin", false);
    expect(more().getAttribute("aria-current")).toBeNull();
  });
});
