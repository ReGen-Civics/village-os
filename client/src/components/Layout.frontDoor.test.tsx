// @vitest-environment jsdom
/**
 * THE FRONT DOOR IN THE MENU (a reviewer's feedback, approved by the lead on
 * 24 Nov 2026). A visitor, and someone signed in whom the village has not
 * admitted, sees no area that would meet them as a sign-in wall, standing
 * examples or an empty page (config/nav.ts, `newcomers`). A member sees all of
 * them. An area waiting to be in use comes back for a newcomer once it is.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { Router } from "wouter";

let user: Record<string, unknown> | null = null;
let exampleModules: string[] = ["feed", "forum", "tools", "network"];
let places: unknown[] = [];
let events: unknown[] = [];

const MODULES = ["feed", "forum", "messaging", "introductions", "events", "sessions", "map", "tools", "crowdpool", "network", "governance"];
const STAGES = [{ id: "guest" }, { id: "member" }, { id: "steward" }];

vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user, token: user ? "t" : null, logout: vi.fn() }) }));
vi.mock("@/modules/ModuleProvider", () => ({
  useModules: () => ({ modules: MODULES.map((id) => ({ id, lifecycle: "public" })), loaded: true, failed: false }),
  moduleIsOn: (s: { modules: Array<{ id: string }> }, id: string) => s.modules.some((m) => m.id === id),
}));
vi.mock("@/lib/gameApi", () => ({
  useGameConfig: () => ({ project: { name: "Harbour" }, currency: { name: "Cheers" }, stages: STAGES, season: { seasons: [{ id: "s1" }] } }),
  useBrandImages: () => ({}),
  authToken: () => (user ? "t" : null),
  gameFetch: () => Promise.resolve(new Response("{}")),
}));
vi.mock("@/hooks/useTokenNames", () => ({ useTokenName: (f: string) => f }));
vi.mock("@/components/NotificationBell", () => ({ default: () => null }));
vi.mock("@/components/NotificationToasts", () => ({ default: () => null }));
vi.mock("@/components/RewardMoment", () => ({ default: () => null }));
vi.mock("@/components/mobile/MobileFab", () => ({ default: () => null }));
vi.mock("@/components/NextStepTrail", () => ({ default: () => null }));

import Layout from "@/components/Layout";
import { forgetAreasInUse } from "@/lib/areasInUseReads";

beforeEach(() => {
  forgetAreasInUse();
  user = null;
  exampleModules = ["feed", "forum", "tools", "network"];
  places = [];
  events = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      const body = url === "/api/examples" ? { modules: exampleModules } : url === "/api/places" ? { places } : url === "/api/events" ? { events } : url === "/api/crowdpool/campaigns" ? { campaigns: [] } : {};
      return new Response(JSON.stringify(body), { status: 200 });
    }),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

/** Every address the desktop bar offers, every dropdown opened in turn, and every folder in it (config/navNest.ts). */
async function menuHrefs(): Promise<string[]> {
  render(
    <Router>
      <Layout>
        <p>page</p>
      </Layout>
    </Router>,
  );
  // Let the in-use reads answer.
  await act(async () => {
    for (let i = 0; i < 5; i++) await Promise.resolve();
  });
  const nav = screen.getAllByRole("navigation")[0];
  const hrefs = new Set<string>();
  for (const b of within(nav).queryAllByRole("button")) {
    fireEvent.click(b);
    document.querySelectorAll<HTMLElement>("[data-nav-dropdown] [data-nav-folder] > button[aria-expanded='false']").forEach((f) => fireEvent.click(f));
    document.querySelectorAll("header a[href]").forEach((a) => hrefs.add(a.getAttribute("href") ?? ""));
  }
  document.querySelectorAll("header a[href]").forEach((a) => hrefs.add(a.getAttribute("href") ?? ""));
  return Array.from(hrefs);
}

const UNFINISHED = ["/feed", "/forum", "/messages", "/introductions", "/events", "/sessions", "/places", "/photographs", "/tools", "/governance/decisions", "/propose", "/campaigns", "/network"];

describe("a visitor's menu", () => {
  it("offers none of the unfinished areas, and keeps the ways in, the map and the quests", async () => {
    const hrefs = await menuHrefs();
    for (const h of UNFINISHED) expect(hrefs, h).not.toContain(h);
    // What We Look After is public since #1529, and the gratitude wall since #1528, so a visitor is offered both.
    for (const h of ["/map", "/quests", "/seasonal-festivals", "/feedback", "/powers", "/gratitude"]) expect(hrefs, h).toContain(h);
  });

  it("gets an area back once it is in real use: the feed with its examples retired, places with a photograph, an event ahead", async () => {
    exampleModules = ["forum", "tools", "network"];
    places = [{ id: "p1" }];
    events = [{ id: "e1", kind: "gathering", isExample: false, startsAt: "2999-01-01T10:00:00Z", endsAt: "2999-01-01T12:00:00Z" }];
    const hrefs = await menuHrefs();
    for (const h of ["/feed", "/places", "/photographs", "/events"]) expect(hrefs, h).toContain(h);
    // Still examples, still a member's own surface: still out.
    for (const h of ["/forum", "/tools", "/messages", "/governance/decisions"]) expect(hrefs, h).not.toContain(h);
  });
});

describe("a signed-in account the village has not admitted", () => {
  it("sees the same front door as a visitor, and none of the members' working pages", async () => {
    user = { id: "u2", name: "Ana Applicant", role: "member", stageGranted: "guest" };
    const hrefs = await menuHrefs();
    for (const h of [...UNFINISHED, "/season-plans", "/aligned", "/changes", "/governance/work", "/journey-to-launch"]) expect(hrefs, h).not.toContain(h);
    expect(hrefs).toContain("/quests");
  });
});

describe("a member's menu", () => {
  it("keeps every area, unfinished or not", async () => {
    user = { id: "u1", name: "Ora Vale", role: "member", membershipGranted: true };
    const hrefs = await menuHrefs();
    for (const h of UNFINISHED) expect(hrefs, h).toContain(h);
  });

  it("counts a stage granted at the admission rung as a member, the way the server does", async () => {
    user = { id: "u3", name: "Ida Fern", role: "member", stageGranted: "steward" };
    const hrefs = await menuHrefs();
    for (const h of ["/forum", "/gratitude", "/governance/decisions"]) expect(hrefs, h).toContain(h);
  });
});

describe("the footer", () => {
  const footerShows = async () => {
    render(
      <Router>
        <Layout>
          <p>page</p>
        </Layout>
      </Router>,
    );
    await act(async () => {
      for (let i = 0; i < 5; i++) await Promise.resolve();
    });
    return Array.from(document.querySelectorAll("footer a[href]"))
      .filter((a) => !a.closest("[hidden]"))
      .map((a) => a.getAttribute("href") ?? "");
  };

  it("leaves out the unfinished areas for a visitor", async () => {
    const hrefs = await footerShows();
    for (const h of ["/network", "/campaigns", "/tools", "/places", "/governance/work"]) expect(hrefs, h).not.toContain(h);
    // The gratitude wall is public since #1528 (first names only), so the footer offers it to a visitor;
    // the engine room's rules are for members.
    expect(hrefs).toContain("/gratitude");
    expect(hrefs).not.toContain("/governance/how#game-mechanics");
    expect(hrefs).toContain("/quests");
  });

  it("CONTROL: keeps them for a member", async () => {
    user = { id: "u1", name: "Ora Vale", role: "member", membershipGranted: true };
    const hrefs = await footerShows();
    for (const h of ["/gratitude", "/network", "/campaigns", "/tools", "/places", "/governance/work", "/governance/how#game-mechanics"]) expect(hrefs, h).toContain(h);
  });
});
