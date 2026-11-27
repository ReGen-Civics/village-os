// @vitest-environment jsdom
/**
 * Who the header offers the Launch Plan to.
 *
 * WHY THIS RENDERS THE SHELL INSTEAD OF READING THE CONFIG. `NAV` is data and
 * the data alone decides nothing: `visible()` in Layout.tsx is what turns a
 * `roles` list into a link a person can see, and asserting on the array would
 * only prove that this file still says what it says. So the assertions below
 * are about anchors in a rendered menu, opened the way a member opens it.
 *
 * THE CONTROL IS THE POINT. The Command Centre sits directly beneath the
 * Launch Plan in the same group and stays team-only, so every case here checks
 * both hrefs. A change that opened the whole Decide group, or that broke
 * `visible()` into a pass-everything, would show up as the Command Centre
 * appearing for a member, and these tests would say so.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Router } from "wouter";

const authMock = vi.fn();
/**
 * Whether this village serves the brochure pages (shared/brochure.ts). The
 * Command Centre is one of them, so every case below runs as the first
 * village, which serves them, except the last, which is a new village.
 */
const brochure = { on: true };
/** The modules this village runs. Empty is a fresh village. */
const running: { modules: { id: string; lifecycle?: string }[] } = { modules: [] };

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => authMock(),
}));
vi.mock("@/modules/ModuleProvider", () => ({
  useModules: () => ({ modules: running.modules, loaded: true, failed: false }),
}));
vi.mock("@/lib/gameApi", () => ({
  useGameConfig: () => ({
    project: { name: "Willowbrook", tagline: "", memberName: "", location: "", adminPath: "/admin" },
    images: {} as Record<string, string>,
    brochurePages: brochure.on,
  }),
  altOr: (value: string | undefined, fallback: string) =>
    typeof value === "string" ? value : fallback,
}));
vi.mock("@/components/NotificationBell", () => ({ default: () => null }));
vi.mock("@/components/NotificationToasts", () => ({ default: () => null }));
vi.mock("@/components/RewardMoment", () => ({ default: () => null }));
vi.mock("@/components/mobile/MobileTabBar", () => ({
  default: () => null,
  isBareRoute: () => false,
}));
vi.mock("@/components/mobile/MobileFab", () => ({ default: () => null }));
vi.mock("@/components/NextStepTrail", () => ({ default: () => null }));

import Layout from "@/components/Layout";

const LAUNCH_PLAN = '/journey-to-launch';
const COMMAND_CENTRE = '/project-history';

/**
 * Render the shell as `who`, then open the account menu and its "Running the village" folder, where the Launch
 * Plan and the Command Centre live since the menu by membership (27 Nov 2026), because the desktop menus mount
 * their items only while open. A folder with one link for this reader draws as that link (config/navNest.ts), so
 * there may be no folder to open. `null` is a signed-out visitor, who has no account menu at all.
 */
function openDecide(who: { id: string; name: string; role?: string; membershipGranted?: boolean } | null) {
  authMock.mockReturnValue({ user: who, loading: false, logout: vi.fn() });
  render(
    <Router>
      <Layout>
        <p>page body</p>
      </Layout>
    </Router>,
  );
  const account = screen.queryAllByRole("button", { name: /Your account/i });
  if (account[0]) fireEvent.click(account[0]);
  const folder = screen.queryAllByRole("button", { name: /Running the village/i });
  if (folder[0]) fireEvent.click(folder[0]);
}

/** Every anchor in the whole shell pointing at `href`, header and footer both. */
function linksTo(href: string) {
  return Array.from(document.querySelectorAll(`a[href="${href}"]`));
}

describe("the Launch Plan entry in the header", () => {
  beforeEach(() => {
    authMock.mockReset();
    brochure.on = true;
  });

  it("is there for a signed-in member holding no admin role", () => {
    // R12: any member may run the village's test run, so any member has to be
    // able to find the page that offers it.
    openDecide({ id: "u-wren", name: "Wren Ash", role: "member", membershipGranted: true });

    expect(linksTo(LAUNCH_PLAN).length).toBeGreaterThan(0);
    // The control: the neighbouring entry is still shut, so this is the one
    // gate that moved and not the group.
    expect(linksTo(COMMAND_CENTRE)).toHaveLength(0);
  });

  it("is not offered to a signed-in account the village has not admitted (the front door, 24 Nov 2026)", () => {
    openDecide({ id: "u-ana", name: "Ana Applicant", role: "member" });
    expect(linksTo(LAUNCH_PLAN)).toHaveLength(0);
  });

  it("is still there for an admin, who did not lose the door they had", () => {
    openDecide({ id: "u-admin", name: "Ada Stone", role: "admin" });

    expect(linksTo(LAUNCH_PLAN).length).toBeGreaterThan(0);
    expect(linksTo(COMMAND_CENTRE).length).toBeGreaterThan(0);
  });

  it("is still there for a founder", () => {
    openDecide({ id: "u-founder", name: "Fen Oak", role: "founder" });

    expect(linksTo(LAUNCH_PLAN).length).toBeGreaterThan(0);
    expect(linksTo(COMMAND_CENTRE).length).toBeGreaterThan(0);
  });

  it("is not offered to a stranger, who would only meet a sign-in wall", () => {
    // JourneyToLaunch answers a signed-out visitor with a lock and a Sign in
    // button. A menu entry onto that is a locked door in a public menu, which
    // is the defect the Command Centre entry was written to avoid, so opening
    // this one to members had to stop short of opening it to everyone.
    openDecide(null);

    expect(linksTo(LAUNCH_PLAN)).toHaveLength(0);
    expect(linksTo(COMMAND_CENTRE)).toHaveLength(0);
  });

  it("keeps the Launch Plan for a founder of a new village, which has no Command Centre to offer", () => {
    // The Command Centre is the first village's build history, a brochure
    // page. A village that does not serve those has none, so its founder
    // keeps the Launch Plan and meets no door onto a missing page.
    brochure.on = false;
    openDecide({ id: "u-founder", name: "Fen Oak", role: "founder" });

    expect(linksTo(LAUNCH_PLAN).length).toBeGreaterThan(0);
    expect(linksTo(COMMAND_CENTRE)).toHaveLength(0);
  });
});

/*
 * /governance was renamed "How we work together" on 2026-09-28 and kept its
 * route (now /governance/how), so every link to it, header and footer, must carry
 * the new name and still point at the old address. Since 27 Nov 2026 it sits with
 * Governance's other views, in the "More in Governance" folder.
 */
describe("the How we work together entry", () => {
  beforeEach(() => {
    authMock.mockReset();
  });

  /** Render the shell as `who`, then open Governance and its "More in Governance" folder. `null` is a visitor. */
  function openAbout(who: { id: string; name: string; role?: string } | null) {
    authMock.mockReturnValue({ user: who, loading: false, logout: vi.fn() });
    render(
      <Router>
        <Layout>
          <p>page body</p>
        </Layout>
      </Router>,
    );
    fireEvent.click(screen.getAllByRole("button", { name: /^Governance/i })[0]!);
    fireEvent.click(screen.getAllByRole("button", { name: /More in Governance/i })[0]!);
  }

  for (const [who, user] of [
    ["a visitor", null],
    ["a member", { id: "u-wren", name: "Wren Ash", role: "member" }],
  ] as const) {
    it(`reads "How we work together" for ${who}, in the menu and the footer, and opens /governance/how`, () => {
      openAbout(user);
      const links = linksTo("/governance/how");
      // One in the Governance menu, one in the footer.
      expect(links.length).toBeGreaterThanOrEqual(2);
      for (const a of links) expect(a.textContent?.trim()).toBe("How we work together");
      // Nothing is still called Governance and pointing there.
      expect(Array.from(document.querySelectorAll("a")).some((a) => a.textContent?.trim() === "Governance")).toBe(false);
    });
  }
});

describe("the menu restructure (Rye, 2026-10-09)", () => {
  beforeEach(() => {
    authMock.mockReset();
    brochure.on = true;
    running.modules = [];
  });

  /**
   * Links the dropdown ADDS when it opens. The footer carries some of the same
   * hrefs (/roles among them), so counting the whole shell would pass with the
   * menu entry gone; the difference is the menu alone.
   */
  function addedByOpening(label: RegExp, hrefs: string[], folder?: RegExp) {
    authMock.mockReturnValue({ user: { id: "u-wren", name: "Wren Ash", role: "member", membershipGranted: true }, loading: false, logout: vi.fn() });
    render(
      <Router>
        <Layout>
          <p>page body</p>
        </Layout>
      </Router>,
    );
    const before = hrefs.map((h) => linksTo(h).length);
    fireEvent.click(screen.getAllByRole("button", { name: label })[0]!);
    if (folder) fireEvent.click(screen.getAllByRole("button", { name: folder })[0]!);
    return Object.fromEntries(hrefs.map((h, i) => [h, linksTo(h).length - before[i]!]));
  }

  it("puts Quests under Village", () => {
    expect(addedByOpening(/Village/i, ["/quests"])["/quests"]).toBe(1);
  });

  it("gives the plain Circles page back its own entry on a village with no map", () => {
    // The mocked village runs no modules, so the map view is hidden and the plain page must still have a door.
    const added = addedByOpening(/^Village/i, ["/circles", "/map/circles"]);
    expect(added).toEqual({ "/circles": 1, "/map/circles": 0 });
  });

  it("folds Circles into the map view where the map runs", () => {
    running.modules = [{ id: "map", lifecycle: "public" }];
    const added = addedByOpening(/^Village/i, ["/circles", "/map/circles"]);
    expect(added).toEqual({ "/circles": 0, "/map/circles": 1 });
  });

  it("offers the open roles under Join, with or without a map (27 Nov 2026)", () => {
    expect(addedByOpening(/^Join/i, ["/roles"])["/roles"]).toBe(1);
    cleanup();
    running.modules = [{ id: "map", lifecycle: "public" }];
    expect(addedByOpening(/^Join/i, ["/roles"])["/roles"]).toBe(1);
  });

  it("offers Your work and the powers page in Governance's More folder, and the Treasury on its first level", () => {
    expect(addedByOpening(/^Governance/i, ["/governance/work", "/powers", "/governance/treasury"])).toEqual({ "/governance/work": 0, "/powers": 0, "/governance/treasury": 1 });
    cleanup();
    expect(addedByOpening(/^Governance/i, ["/governance/work", "/powers"], /More in Governance/i)).toEqual({ "/governance/work": 1, "/powers": 1 });
  });
});

/*
 * The Module Library: last of all, under About, for every reader (the lead, 27 Nov 2026: "module library at the
 * bottom"). It left the member's bar so the bar keeps five entries.
 */
describe("the Module Library at the bottom", () => {
  beforeEach(() => {
    authMock.mockReset();
    brochure.on = true;
    running.modules = [];
  });

  function shell(who: { id: string; name: string; role?: string; membershipGranted?: boolean } | null) {
    authMock.mockReturnValue({ user: who, loading: false, logout: vi.fn() });
    render(
      <Router>
        <Layout>
          <p>page body</p>
        </Layout>
      </Router>,
    );
  }

  for (const [who, user] of [
    ["a visitor", null],
    ["a signed-in applicant", { id: "u-ana", name: "Ana Applicant", role: "member" }],
    ["a member", { id: "u-wren", name: "Wren Ash", role: "member", membershipGranted: true }],
  ] as const) {
    it(`keeps it off the bar for ${who}, and offers it as About's last entry`, () => {
      shell(user);
      expect(linksTo("/modules").length).toBe(0);
      fireEvent.click(screen.getAllByRole("button", { name: /^About/i })[0]!);
      const about = document.querySelector("[data-nav-dropdown]") as HTMLElement;
      const links = Array.from(about.querySelectorAll(":scope > a, :scope > div > a, :scope > [data-nav-folder] > button"));
      expect(links.at(-1)?.getAttribute("href")).toBe("/modules");
    });
  }
});
