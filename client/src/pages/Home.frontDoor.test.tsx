// @vitest-environment jsdom
/**
 * THE FRONT DOOR (24 Nov 2026): the hero's words come from Identity when the
 * village sets them (`project.heroHeadline`, `project.heroBody`), else from
 * Pages, Home; the hero holds no buttons; the four ways are said once, at the
 * foot of the page; and the commons block (this season's goal count and goal
 * names) is gone while "What's built and what's coming" stays.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
class NoopIntersectionObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}
vi.stubGlobal("IntersectionObserver", NoopIntersectionObserver);

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { Router } from "wouter";
import type { ReactNode } from "react";

let siteUrl = "https://willowbrook.example.org";
let storyPages = false;
let villageName = "Willowbrook";
let heroHeadline = "";
let heroBody = "";

vi.mock("@/components/Layout", () => ({ default: ({ children }: { children: ReactNode }) => <>{children}</> }));
vi.mock("@/components/BuildProgress", () => ({ default: () => <section data-build-progress="">What's built and what's coming</section> }));
vi.mock("@/components/SeasonBanner", () => ({ default: () => null }));
vi.mock("@/components/MapPeek", () => ({ default: () => null }));
vi.mock("@/modules/ModuleProvider", () => ({ useModule: (id: string) => (id === "map" ? { id: "map" } : null), useModules: () => ({ modules: [{ id: "map" }], loaded: true }) }));
vi.mock("@/lib/gameApi", () => ({
  useBrandImages: () => ({ hero: "" }),
  useGameConfig: () => ({ project: { name: villageName, tagline: "A valley that remembers", location: "", heroHeadline, heroBody }, currency: { name: "Thanks" }, brochurePages: storyPages }),
  useVillageLinks: () => ({ siteUrl, eventsUrl: "", contactEmail: "", mailTo: () => "" }),
  // A live season with eight goals, none reached: what the commons block used to draw on the landing.
  useSeason: () => ({ current: { id: "s1", name: "Season of Foundations", startsOn: "2026-06-21", endsOn: "2026-12-31", goals: Array.from({ length: 8 }, (_, i) => ({ id: `g${i}`, text: `Insider goal ${i}`, reached: false })) }, upcoming: null }),
  altOr: (value: string | undefined, fallback: string) => (typeof value === "string" ? value : fallback),
}));
vi.mock("@/hooks/useVillageContent", () => ({ readVillageSection: () => Promise.resolve(null) }));

import Home from "./Home";

beforeEach(() => {
  siteUrl = "https://willowbrook.example.org";
  storyPages = false;
  villageName = "Willowbrook";
  heroHeadline = "";
  heroBody = "";
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) =>
      url === "/api/org/founding-team" ? new Response(JSON.stringify({ on: true, roleIds: ["finance-steward"] }), { status: 200 }) : new Response("{}", { status: 404 }),
    ),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.stubGlobal("IntersectionObserver", NoopIntersectionObserver);
});

const renderHome = () =>
  render(
    <Router>
      <Home />
    </Router>,
  );
const hero = () => document.querySelector("[data-landing-hero]") as HTMLElement;

const ready = () => waitFor(() => expect(document.querySelector("[data-four-ways]")).not.toBeNull());

describe("the hero's words, editable in Identity (the lead, 24 Nov 2026)", () => {
  it("draws the Identity headline and sentence when the village sets them", async () => {
    heroHeadline = "Community-centered living in harmony with nature";
    heroBody = "A village where families **steward** the land together.";
    renderHome();
    await ready();
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Community-centered living in harmony with nature");
    expect(hero().textContent).toContain("A village where families steward the land together.");
    expect(hero().querySelector("strong")?.textContent).toBe("steward");
  });

  it("CONTROL: blank Identity keeps the neutral words of Pages, Home, with no founding team line", async () => {
    renderHome();
    await ready();
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("A valley that remembers");
    expect(hero().textContent).toContain("growing with everyone who joins it");
    expect(hero().textContent).not.toMatch(/founding team|belong and thrive|Willowbrook/);
  });

  it("holds no buttons: no Join the founding team, no map, no Learn about", async () => {
    renderHome();
    await ready();
    expect(hero().querySelectorAll("a, button")).toHaveLength(0);
    expect(screen.queryByRole("link", { name: /Join the founding team|Explore the map|Learn about/ })).toBeNull();
  });
});

describe("the four ways, once, at the foot of the page", () => {
  it("draws one four-ways section, the last on the page, each card a painting with its own animal", async () => {
    renderHome();
    await ready();
    expect(document.querySelectorAll("[data-four-ways]")).toHaveLength(1);
    const cards = Array.from(document.querySelectorAll("[data-four-ways] [data-route]"));
    expect(cards.map((c) => c.getAttribute("data-route"))).toEqual(["team", "venture", "partner", "quest"]);
    const art = cards.map((c) => c.querySelector("img")?.getAttribute("src") ?? "");
    expect(art.every((src) => src.startsWith("/images/nature/"))).toBe(true);
    expect(new Set(art).size).toBe(4);
    for (const c of cards.slice(1)) {
      expect(c.textContent).toContain("You bring");
      expect(c.textContent).toContain("You get back");
    }
    expect(document.querySelector("[data-four-ways] [data-route-promise]")).toBeNull();
    expect(document.body.textContent).not.toMatch(/hear within/);
  });

  it("sends Start a venture to the venture form while the village serves it", async () => {
    storyPages = true;
    renderHome();
    await ready();
    expect(document.querySelector('[data-four-ways] [data-route-door="venture"]')?.getAttribute("href")).toBe("/work-with-us?kind=venture");
  });
});

describe("the commons block is gone from the landing", () => {
  it("draws no goal count and no goal names, and keeps What's built and what's coming", async () => {
    renderHome();
    await ready();
    await screen.findByText("What's built and what's coming");
    expect(document.querySelector('[data-testid="landing-commons"]')).toBeNull();
    expect(document.body.textContent).not.toMatch(/of 8 goals/);
    expect(document.body.textContent).not.toContain("Insider goal");
    expect(document.body.textContent).not.toContain("The commons");
  });
});
