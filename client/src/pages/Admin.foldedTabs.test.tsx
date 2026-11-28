// @vitest-environment jsdom
/**
 * AN OLD ADMIN ADDRESS, OPENED ON THE ADMIN PAGE ITSELF.
 *
 * adminTabAliases.test.ts holds the table: which key lands where. This file
 * renders `Admin()` and holds the two things only the page does with it:
 *
 *   THE REDIRECT   a key whose control left Admin (LEFT_ADMIN) sends the
 *                  visitor to that page, in place, BEFORE the sign-in gate:
 *                  the page it lands on has its own gate, and some of those
 *                  visitors are not admins (the holder of a granting role).
 *   THE SETTLE     a key whose control moved to another Admin tab (MOVED_TABS)
 *                  has its address rewritten in place, keeping the rest of the
 *                  address, with no new history entry, on arrival and on Back.
 *
 * The page is rendered signed out, so everything past the gate is not drawn:
 * what is held here happens before it.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: null, loading: false }), useOptionalAuth: () => ({ user: null, loading: false }) }));
vi.mock("@/components/admin/AdminGate", () => ({ default: () => <div data-testid="gate" /> }));

import Admin from "./Admin";
import { VISIT_PROGRAM_SETTING } from "@shared/adminSearch";
import { LEFT_ADMIN, MOVED_TABS } from "@/components/admin/adminTabAliases";

const here = () => `${window.location.pathname}${window.location.search}${window.location.hash}`;

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, status: 200, json: async () => ({}) })));
  vi.stubGlobal("scrollTo", vi.fn());
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

/** Leave to an address the way a browser's Back does: the address changes, then popstate fires. */
async function backTo(address: string) {
  await act(async () => {
    window.history.pushState({}, "", address);
    window.dispatchEvent(new PopStateEvent("popstate"));
  });
}

describe("Admin(): a key whose control left Admin redirects to that page", () => {
  it("every such key lands on its page, in place, and the sign-in gate is never drawn", async () => {
    expect(Object.keys(LEFT_ADMIN).length).toBeGreaterThanOrEqual(4);
    for (const [key, target] of Object.entries(LEFT_ADMIN)) {
      window.history.replaceState({}, "", `/admin?tab=${key}`);
      const entries = window.history.length;
      render(<Admin />);
      await waitFor(() => expect(here(), key).toBe(target));
      // In place: Back from the page it lands on does not come back to the old address.
      expect(window.history.length, key).toBe(entries);
      expect(screen.queryByTestId("gate"), key).toBeNull();
      cleanup();
    }
  });

  it("the finished-work tab lands on the review list filtered to that kind, and the role-access notice on the season's plan", async () => {
    window.history.replaceState({}, "", "/admin?tab=quest-claims");
    render(<Admin />);
    await waitFor(() => expect(here()).toBe("/admin/review?kind=claim"));
    cleanup();
    window.history.replaceState({}, "", "/admin?tab=org");
    render(<Admin />);
    await waitFor(() => expect(here()).toBe("/season#plan"));
  });

  it("Back to such an address redirects too", async () => {
    window.history.replaceState({}, "", "/admin?tab=reports");
    render(<Admin />);
    expect(await screen.findByTestId("gate")).toBeTruthy();
    await backTo("/admin?tab=budgets");
    await waitFor(() => expect(here()).toBe(LEFT_ADMIN.budgets));
    expect(screen.queryByTestId("gate")).toBeNull();
  });
});

describe("Admin(): a key whose control moved to another tab is settled in place", () => {
  it("every such key has its address rewritten to the tab that holds the control, with what the tab needs to open on it", async () => {
    for (const [key, moved] of Object.entries(MOVED_TABS)) {
      window.history.replaceState({}, "", `/admin?tab=${key}`);
      const entries = window.history.length;
      render(<Admin />);
      await waitFor(() => expect(new URLSearchParams(window.location.search).get("tab"), key).toBe(moved.tab));
      for (const [k, v] of Object.entries(moved.params ?? {})) expect(new URLSearchParams(window.location.search).get(k), key).toBe(v);
      // Still Admin's page, so the gate is what a signed-out visitor sees, and no history entry was added.
      expect(window.location.pathname, key).toBe("/admin");
      expect(screen.getByTestId("gate"), key).toBeTruthy();
      expect(window.history.length, key).toBe(entries);
      cleanup();
    }
  });

  it("the rest of the address is kept: the other parameters and the hash", async () => {
    window.history.replaceState({}, "", "/admin?tab=forum-moderation&from=launch#top");
    render(<Admin />);
    await waitFor(() => expect(here()).toBe("/admin?tab=reports&from=launch#top"));
    cleanup();
    window.history.replaceState({}, "", "/admin?tab=visit-config");
    render(<Admin />);
    await waitFor(() => expect(here()).toBe(`/admin?tab=pages&setting=${VISIT_PROGRAM_SETTING}`));
  });

  it("Back to an old address settles it again", async () => {
    window.history.replaceState({}, "", "/admin?tab=settings");
    render(<Admin />);
    expect(await screen.findByTestId("gate")).toBeTruthy();
    await backTo("/admin?tab=message-reports");
    await waitFor(() => expect(here()).toBe("/admin?tab=reports"));
    expect(screen.getByTestId("gate")).toBeTruthy();
  });

  it("a tab that did not move is left exactly as it was, and so is a word that is no tab's key", async () => {
    for (const address of ["/admin?tab=reports&from=launch#top", "/admin?tab=constructor", "/admin?tab=toString", "/admin"]) {
      window.history.replaceState({}, "", address);
      render(<Admin />);
      expect(await screen.findByTestId("gate"), address).toBeTruthy();
      expect(here(), address).toBe(address);
      cleanup();
    }
  });
});
