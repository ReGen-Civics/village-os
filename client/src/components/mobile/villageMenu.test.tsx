// @vitest-environment jsdom
/**
 * A VILLAGE'S OWN MENU AND PHONE TABS (gap G5): the document is cleaned, a
 * chosen tab keeps its place only while its page is open, and the Layout
 * reads the village's labels, hidden entries and group names while every gate
 * still decides who sees what.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { Router } from "wouter";
import { menuDocIsEmpty, menuDocOf, menuDocProblem } from "@shared/menuDoc";
import { TAB_SLOTS } from "@/config/mobileNav";

let menu: unknown = null;
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { id: 1, name: "Ora Vale", role: "member", membershipGranted: true }, logout: vi.fn() }) }));
vi.mock("@/modules/ModuleProvider", () => ({
  useModules: () => ({ modules: [{ id: "forum", lifecycle: "public" }], loaded: true, failed: false }),
  moduleIsOn: (s: { modules: Array<{ id: string }> }, id: string) => s.modules.some((m) => m.id === id),
}));
vi.mock("@/lib/gameApi", () => ({
  useGameConfig: () => ({ project: { name: "Harbour" }, currency: { name: "Cheers" }, menu }),
  useBrandImages: () => ({}),
  authToken: () => "t",
  gameFetch: () => Promise.resolve(new Response("{}")),
}));
vi.mock("@/hooks/useTokenNames", () => ({ useTokenName: (f: string) => f }));
vi.mock("@/components/NotificationBell", () => ({ default: () => null }));
vi.mock("@/components/NotificationToasts", () => ({ default: () => null }));
vi.mock("@/components/RewardMoment", () => ({ default: () => null }));
vi.mock("@/components/mobile/MobileFab", () => ({ default: () => null }));
vi.mock("@/components/NextStepTrail", () => ({ default: () => null }));

import { responsiveSlots, villageSlots } from "./MobileTabBar";

afterEach(cleanup);

describe("the menu document", () => {
  it("keeps addresses, clipped labels and four tabs, and drops the rest", () => {
    const d = menuDocOf({
      labels: { "/forum": "Crew Talk", "javascript:x": "no", "/feed": "   " },
      hidden: ["/feed", "nope", "/feed"],
      groups: { Community: "Aboard" },
      tabs: ["/", "/quests", "/forum", "/map", "/extra"],
    });
    expect(d).toEqual({ labels: { "/forum": "Crew Talk" }, hidden: ["/feed"], groups: { Community: "Aboard" }, folders: {}, tabs: ["/", "/quests", "/forum", "/map"] });
    expect(menuDocIsEmpty(menuDocOf(null))).toBe(true);
    expect(menuDocProblem({ tabs: ["/", "/a", "/b", "/c", "/d"] })).toMatch(/up to 4/);
    expect(menuDocProblem({ labels: { "/forum": "x".repeat(40) } })).toMatch(/32 characters/);
    expect(menuDocProblem({ labels: { "/forum": "Crew Talk" }, tabs: ["/forum"] })).toBeNull();
  });
});

describe("the phone tabs", () => {
  const open = (m?: string) => !m || m === "forum";

  it("are the platform's when the village chose none", () => {
    expect(villageSlots([], {}, [], open)).toBe(TAB_SLOTS);
  });

  it("put each chosen tab in its place, with the village's word, and keep More last", () => {
    const slots = villageSlots(["/", "/quests", "/forum"], { "/forum": "Crew Talk" }, [], open);
    expect(slots.map((s) => s.path ?? s.event)).toEqual(["/", "/quests", "/forum", TAB_SLOTS[3].path, "open-mobile-menu"]);
    expect(slots[2].label).toBe("Crew Talk");
  });

  it("keep the platform's tab where the chosen page is not open, hidden, or not an entry", () => {
    const slots = villageSlots(["/feed", "/forum", "/not-a-page"], {}, ["/forum"], open);
    expect(slots.map((s) => s.path ?? s.event)).toEqual(TAB_SLOTS.map((s) => s.path ?? s.event));
  });
});

describe("the responsive phone tabs", () => {
  const open = (m?: string) => !m || m === "forum";
  const paths = (slots: ReturnType<typeof responsiveSlots>) => slots.map((s) => s.path ?? s.event);
  const fixed = (slots: ReturnType<typeof responsiveSlots>) => [slots[0], slots[1], slots[4]];

  it("fill only the two moving places, and Home, the path place and More never move", () => {
    const slots = responsiveSlots(["/forum", "/gratitude"], {}, [], open);
    // The path is second since 25 Nov 2026 (the lead), so the two moving places are the third and fourth.
    expect(paths(slots)).toEqual(["/", TAB_SLOTS[1].path, "/forum", "/gratitude", "open-mobile-menu"]);
    expect(fixed(slots)).toEqual(fixed(TAB_SLOTS));
  });

  it("never show a page twice, and keep the platform's tab in a place left empty", () => {
    // A fixed page, a closed one and a repeat are skipped; the empty place keeps the platform's tab.
    const slots = paths(responsiveSlots(["/", String(TAB_SLOTS[1].path), "/feed", "/forum", "/forum"], {}, [], open));
    expect(slots).toEqual(["/", TAB_SLOTS[1].path, "/forum", TAB_SLOTS[2].path, "open-mobile-menu"]);
    expect(paths(responsiveSlots([], {}, [], open))).toEqual(paths(TAB_SLOTS));
  });
});

describe("the menu", () => {
  it("reads the village's labels and group names, leaves out what it hid, and keeps every gate", async () => {
    menu = { labels: { "/forum": "Crew Talk", "/quests": "Quest Board" }, hidden: ["/seasonal-festivals"], groups: { Community: "Aboard" } };
    const { default: Layout } = await import("@/components/Layout");
    render(
      <Router>
        <Layout>
          <p>page</p>
        </Layout>
      </Router>,
    );
    const nav = screen.getAllByRole("navigation")[0];
    const text = nav.textContent ?? "";
    expect(text).toContain("Aboard");
    expect(text).not.toContain("Community");
    // Open the renamed group: the village's word is there, the hidden entry is not,
    // and an entry whose module is off stays out whatever the document says.
    fireEvent.click(within(nav).getByRole("button", { name: /Aboard/ }));
    // The forum sits in Community's Conversations folder since round 2 (27 Nov 2026); a folder left with one entry
    // draws as that entry, so open it only where it is a folder.
    const folder = within(document.body).queryAllByRole("button", { name: /Conversations/ });
    if (folder[0]) fireEvent.click(folder[0]);
    const body = document.body.textContent ?? "";
    expect(body).toContain("Crew Talk");
    expect(body).not.toContain("Seasonal Festivals");
    expect(within(document.body).queryByRole("menuitem", { name: "Feed" })).toBeNull();
  });
});
