// @vitest-environment jsdom
/**
 * THE FRONT DOOR (a reviewer's feedback, approved by the lead on 24 Nov 2026):
 * beside "Join the founding team" the hero offers "Learn about <village>",
 * the village's own main site, where it used to offer the members' map; and
 * the commons block (this season's goal count and goal names) is gone from
 * the landing while "What's built and what's coming" stays.
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

import { cleanup, render, screen } from "@testing-library/react";
import { Router } from "wouter";
import type { ReactNode } from "react";

let siteUrl = "https://willowbrook.example.org";
let storyPages = false;
let villageName = "Willowbrook";

vi.mock("@/components/Layout", () => ({ default: ({ children }: { children: ReactNode }) => <>{children}</> }));
vi.mock("@/components/BuildProgress", () => ({ default: () => <section data-build-progress="">What's built and what's coming</section> }));
vi.mock("@/components/SeasonBanner", () => ({ default: () => null }));
vi.mock("@/components/MapPeek", () => ({ default: () => null }));
vi.mock("@/modules/ModuleProvider", () => ({ useModule: (id: string) => (id === "map" ? { id: "map" } : null), useModules: () => ({ modules: [{ id: "map" }], loaded: true }) }));
vi.mock("@/lib/gameApi", () => ({
  useBrandImages: () => ({ hero: "" }),
  useGameConfig: () => ({ project: { name: villageName, tagline: "", location: "" }, currency: { name: "Thanks" }, brochurePages: storyPages }),
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

describe("the hero's second act: Learn about the village", () => {
  it("opens the village's main site in a new tab, named for the village, edged beside the gold act", async () => {
    renderHome();
    await screen.findByRole("link", { name: /Join the founding team/ });
    const about = screen.getByRole("link", { name: "Learn about Willowbrook" });
    expect(about.getAttribute("href")).toBe("https://willowbrook.example.org");
    expect(about.getAttribute("target")).toBe("_blank");
    expect(about.getAttribute("rel")).toContain("noopener");
    expect(about.className).not.toContain("bg-notice");
    expect(hero().contains(about)).toBe(true);
  });

  it("no longer offers the map in the hero, even with the map switched on", async () => {
    renderHome();
    await screen.findByRole("link", { name: /Join the founding team/ });
    expect(screen.queryByRole("link", { name: "Explore the map" })).toBeNull();
    expect(hero().querySelector('a[href="/map"]')).toBeNull();
  });

  it("with no main site set, opens How We Create while the story pages are served", async () => {
    siteUrl = "";
    storyPages = true;
    renderHome();
    await screen.findByRole("link", { name: /Join the founding team/ });
    expect(screen.getByRole("link", { name: "Learn about Willowbrook" }).getAttribute("href")).toBe("/how-we-create");
  });

  it("CONTROL: a main site that is not a web address is never a link, and with nowhere to go the act falls back to the paths", async () => {
    siteUrl = "javascript:alert(1)";
    renderHome();
    await screen.findByRole("link", { name: /Join the founding team/ });
    expect(screen.queryByRole("link", { name: /Learn about/ })).toBeNull();
    expect(hero().querySelector('a[href="#choose-path"]')).not.toBeNull();
  });

  it("says the village in general while it has no name yet", async () => {
    villageName = "";
    renderHome();
    await screen.findByRole("link", { name: /Join the founding team/ });
    expect(screen.getByRole("link", { name: "Learn about the village" })).toBeTruthy();
  });
});

describe("the commons block is gone from the landing", () => {
  it("draws no goal count and no goal names, and keeps What's built and what's coming", async () => {
    renderHome();
    await screen.findByRole("link", { name: /Join the founding team/ });
    await screen.findByText("What's built and what's coming");
    expect(document.querySelector('[data-testid="landing-commons"]')).toBeNull();
    expect(document.body.textContent).not.toMatch(/of 8 goals/);
    expect(document.body.textContent).not.toContain("Insider goal");
    expect(document.body.textContent).not.toContain("The commons");
  });
});
