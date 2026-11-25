// @vitest-environment jsdom
/**
 * THE PATH SLOT (the lead, 25 Nov 2026): the bar's fourth slot is the reader's
 * own path, drawn by that path's glyph and named in the village's words, and
 * it leads back to that path's card and ladder on the profile. With no path
 * yet it offers the choice, with the seed.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { Router } from "wouter";
import { CHOOSE_PATH_HREF, PATH_GLYPHS, PATH_SLOT, TAB_SLOTS, pathProgressHref } from "@/config/mobileNav";
import { GAME_CONFIG } from "@shared/gameConfig";

let user: { id: number; paths: string[]; membershipGranted: boolean } | null = null;
let served: { id: string; label: string; role: string; route: string }[] | undefined;

vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user }) }));
vi.mock("@/modules/ModuleProvider", () => ({ useModules: () => ({ modules: [], loaded: true, failed: false }), moduleIsOn: () => false }));
vi.mock("@/lib/gameApi", () => ({ useGameConfig: () => (served ? { paths: served } : null) }));
vi.mock("@/hooks/useVillageMenu", () => ({ useVillageMenu: () => ({ labels: {}, hidden: [], groups: {}, tabs: [] }) }));
vi.mock("@/hooks/useTokenNames", () => ({ useTokenName: (f: string) => f }));
vi.mock("@/lib/newcomer", () => ({ useNewcomerShows: () => ({ newcomer: false, shows: () => true }) }));

import MobileTabBar, { pathTab } from "./MobileTabBar";

afterEach(() => {
  cleanup();
  user = null;
  served = undefined;
});

const slotLink = () => document.querySelector<HTMLAnchorElement>("a[data-path-slot]");

describe("the path slot, worked out", () => {
  const nameOf = (id: string) => `name of ${id}`;

  it("THE DEFAULT ORDER, before any visit data, for everyone: Home, Your path, Roles, Quests, More (the lead, 25 Nov 2026)", () => {
    expect(TAB_SLOTS.map((s) => s.path ?? s.event)).toEqual(["/", "/path", "/roles", "/quests", "open-mobile-menu"]);
    expect(TAB_SLOTS.map((s) => s.label)).toEqual(["Home", "Your path", "Roles", "Quests", "More"]);
  });

  it("sits second, next to Home (the lead, 25 Nov 2026), and Circles is no longer a tab", () => {
    expect(TAB_SLOTS[1]).toBe(PATH_SLOT);
    expect(TAB_SLOTS.some((s) => s.path === "/circles")).toBe(false);
  });

  it("gives every path the platform knows its own glyph, no two alike", () => {
    const ids = GAME_CONFIG.paths.map((p) => p.id);
    for (const id of ids) expect(PATH_GLYPHS[id], id).toBeTruthy();
    expect(new Set(ids.map((id) => PATH_GLYPHS[id])).size).toBe(ids.length);
    for (const id of ids) expect(PATH_GLYPHS[id]).not.toBe(PATH_SLOT.Icon);
  });

  it("draws the FIRST claimed path only, and leads to its card", () => {
    const tab = pathTab(["steward", "investor"], true, nameOf, "Your path");
    expect(tab).toEqual({ href: pathProgressHref("steward"), label: "name of steward", Icon: PATH_GLYPHS.steward, pathId: "steward" });
  });

  it("offers the choice with the seed when there is no path: the profile's paths signed in, the front page's ways for a visitor", () => {
    expect(pathTab([], true, nameOf, "Your path")).toEqual({ href: CHOOSE_PATH_HREF.signedIn, label: "Your path", Icon: PATH_SLOT.Icon, pathId: null });
    expect(pathTab(undefined, false, nameOf, "Your path").href).toBe(CHOOSE_PATH_HREF.visitor);
  });

  it("CONTROL: a path this build has no glyph for still gets a slot, with the seed", () => {
    expect(pathTab(["a-fork-path"], true, nameOf, "Your path").Icon).toBe(PATH_SLOT.Icon);
  });
});

describe("the path slot, in the bar", () => {
  const bar = () =>
    render(
      <Router>
        <MobileTabBar />
      </Router>,
    );

  it("a member on the resident path sees the seed-pod home, the short name, and a door to that path's card", () => {
    user = { id: 1, paths: ["resident", "investor"], membershipGranted: true };
    bar();
    const a = slotLink();
    expect(a?.getAttribute("href")).toBe("/profile#path-resident");
    expect(a?.dataset.pathSlot).toBe("resident");
    expect(a?.textContent).toBe("Resident");
    expect(a?.querySelectorAll("svg.living").length).toBe(1);
    expect(a?.querySelector("svg")?.getAttribute("class")).toContain("living-seed-pod-home");
  });

  it("says the village's own name for a path it renamed, as the village wrote it", () => {
    user = { id: 1, paths: ["steward"], membershipGranted: true };
    served = GAME_CONFIG.paths.map((p) => ({ ...p, label: p.id === "steward" ? "Keeper" : p.label }));
    bar();
    expect(slotLink()?.textContent).toBe("Keeper");
  });

  it("CONTROL: a name the village left alone is the bar's short one, never cut off mid-word", () => {
    user = { id: 1, paths: ["steward"], membershipGranted: true };
    served = GAME_CONFIG.paths.map((p) => ({ ...p }));
    bar();
    expect(slotLink()?.textContent).toBe("Steward");
  });

  it("a visitor sees the seed and is asked to choose, by a name that starts with the label they see", () => {
    bar();
    const a = slotLink();
    expect(a?.dataset.pathSlot).toBe("");
    // The whole-path page, which every village has; the front page's four ways exist only with brochure pages on.
    expect(a?.getAttribute("href")).toBe("/path");
    expect(a?.getAttribute("aria-label")).toBe("Your path: choose one");
    expect(a?.getAttribute("aria-label")?.startsWith(a?.textContent ?? "")).toBe(true);
    expect(a?.querySelector("svg")?.getAttribute("class")).toContain("living-seed");
  });

  it("is lit on the profile, where its door leads", () => {
    user = { id: 1, paths: ["resident"], membershipGranted: true };
    window.history.replaceState(null, "", "/profile");
    bar();
    expect(slotLink()?.getAttribute("aria-current")).toBe("page");
    window.history.replaceState(null, "", "/");
  });

  it("CONTROL: and not on another page", () => {
    user = { id: 1, paths: ["resident"], membershipGranted: true };
    window.history.replaceState(null, "", "/quests");
    bar();
    expect(slotLink()?.getAttribute("aria-current")).toBeNull();
    window.history.replaceState(null, "", "/");
  });

  it("a signed-in member with no visit data sees exactly Home, Your path, Roles, Quests, More: no Gratitude by default", () => {
    user = { id: 1, paths: [], membershipGranted: true };
    bar();
    const labels = Array.from(document.querySelectorAll("[data-mobile-tabbar] a, [data-mobile-tabbar] button")).map((e) => e.textContent?.trim());
    expect(labels).toEqual(["Home", "Your path", "Roles", "Quests", "More"]);
  });

  it("never draws Circles in the bar", () => {
    user = { id: 1, paths: ["investor"], membershipGranted: true };
    bar();
    expect(document.querySelector('[data-mobile-tabbar] a[href="/circles"]')).toBeNull();
  });
});

describe("More says whether the menu it opens is open (the five-reviewer QA pass, 25 Nov 2026)", () => {
  it("is aria-expanded false, then true once the drawer says it opened, then false again", async () => {
    const { act } = await import("@testing-library/react");
    user = { id: 1, paths: [], membershipGranted: true };
    render(
      <Router>
        <MobileTabBar />
      </Router>,
    );
    const more = document.querySelector<HTMLButtonElement>('button[aria-controls="mobile-menu"]');
    expect(more?.getAttribute("aria-label")).toBe("More");
    expect(more?.getAttribute("aria-expanded")).toBe("false");
    act(() => {
      window.dispatchEvent(new CustomEvent("mobile-menu-state", { detail: { open: true } }));
    });
    expect(more?.getAttribute("aria-expanded")).toBe("true");
    act(() => {
      window.dispatchEvent(new CustomEvent("mobile-menu-state", { detail: { open: false } }));
    });
    expect(more?.getAttribute("aria-expanded")).toBe("false");
  });
});

