// @vitest-environment jsdom
/**
 * D-01 (go-live design pass): the landing's first screen. While the village
 * has its founding team section on, "Join the founding team" is the hero's one
 * gold act, the map sits beside it edged, the hero says the founding team is forming, and
 * the founding card leads the ways in with the gold edge. Off, the hero keeps
 * its own door to the paths and says nothing of a founding team.
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
import { resolveVillagePathWords, servedPaths } from "@shared/villagePaths";
import { pageVarsFrom } from "@shared/pageContent/vars";

let foundingOn = true;
let mapOn = true;
let brandImages: Record<string, string> = { hero: "" };
let withPaths = false;
const PATHS = servedPaths(resolveVillagePathWords(null), pageVarsFrom({ project: { name: "Willowbrook", tagline: "", location: "" } }));

vi.mock("@/components/Layout", () => ({ default: ({ children }: { children: ReactNode }) => <>{children}</> }));
vi.mock("@/components/BuildProgress", () => ({ default: () => null }));
vi.mock("@/components/SeasonBanner", () => ({ default: () => null }));
vi.mock("@/components/VillagePulse", () => ({ default: () => null }));
vi.mock("@/components/MapPeek", () => ({ default: () => null }));
vi.mock("@/modules/ModuleProvider", () => ({ useModule: (id: string) => (id === "map" && mapOn ? { id: "map" } : null) }));
vi.mock("@/lib/gameApi", () => ({
  useBrandImages: () => brandImages,
  useGameConfig: () => ({ project: { name: "Willowbrook", tagline: "", location: "" }, currency: { name: "Thanks" }, ...(withPaths ? { paths: PATHS, brochurePages: true, brochureHidden: [] } : {}) }),
  useVillageLinks: () => ({ siteUrl: "", eventsUrl: "", contactEmail: "", mailTo: () => "" }),
  altOr: (value: string | undefined, fallback: string) => (typeof value === "string" ? value : fallback),
}));
vi.mock("@/hooks/useVillageContent", () => ({ readVillageSection: () => Promise.resolve(null) }));

import Home from "./Home";

beforeEach(() => {
  foundingOn = true;
  brandImages = { hero: "" };
  withPaths = false;
  mapOn = true;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) =>
      url === "/api/org/founding-team"
        ? new Response(JSON.stringify(foundingOn ? { on: true, roleIds: ["finance-steward"] } : { on: false, roleIds: [] }), { status: 200 })
        : new Response("{}", { status: 404 }),
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

describe("the landing's first screen with the founding team on", () => {
  it("makes Join the founding team the hero's one gold act, with the map beside it edged", async () => {
    renderHome();
    const join = await screen.findByRole("link", { name: /Join the founding team/ });
    expect(join.getAttribute("href")).toBe("/roles");
    expect(join.className).toContain("bg-notice");
    const map = screen.getByRole("link", { name: "Explore the map" });
    expect(map.className).not.toContain("bg-notice");
    // One gold act in the hero.
    expect(hero().querySelectorAll("a.bg-notice")).toHaveLength(1);
    expect(hero().textContent).toContain("the people who'll take the village from idea to home, season by season");
    expect(hero().textContent).not.toContain("multi-year");
  });

  it("leads the ways in with the founding card, on the gold edge", async () => {
    renderHome();
    await screen.findByRole("link", { name: /Join the founding team/ });
    const ways = Array.from(document.querySelectorAll("#choose-path a"));
    expect(ways[0].getAttribute("data-way")).toBe("founding");
    expect(ways[0].className).toContain("border-notice/60");
    expect(ways.slice(1).every((a) => !a.className.includes("border-2"))).toBe(true);
  });

  it("CONTROL: with the section off, the hero keeps its door to the paths and names no founding team", async () => {
    foundingOn = false;
    renderHome();
    await screen.findByRole("heading", { level: 1 });
    await new Promise((r) => setTimeout(r, 0));
    expect(screen.queryByRole("link", { name: /Join the founding team/ })).toBeNull();
    const act = hero().querySelector('[data-hero-act="paths"]') as HTMLElement;
    expect(act.getAttribute("href")).toBe("#choose-path");
    expect(act.className).toContain("bg-notice");
    expect(hero().textContent).not.toContain("season by season");
    expect(document.querySelector('[data-way="founding"]')).toBeNull();
  });
});

describe("the pictures on the ways in", () => {
  it("gives the founding card a painting in the same frame as the path cards, and cuts each photo at its focal point", async () => {
    brandImages = {
      hero: "",
      investorHero: "/api/uploads/ridge.webp",
      investorHeroFocus: "50% 80%",
      stewardHero: "/api/uploads/planting.webp",
    };
    withPaths = true;
    renderHome();
    await screen.findByRole("link", { name: /Join the founding team/ });
    const founding = document.querySelector('[data-way="founding"]') as HTMLElement;
    const painting = founding.querySelector("img") as HTMLImageElement;
    expect(painting.getAttribute("src")).toMatch(/^\/images\/nature\//);
    const investor = await waitFor(() => {
      const img = document.querySelector('#choose-path a[href="/investor"] img') as HTMLImageElement | null;
      expect(img).not.toBeNull();
      return img as HTMLImageElement;
    });
    expect(investor.parentElement?.className).toBe(painting.parentElement?.className);
    expect(investor.style.objectPosition).toBe("50% 80%");
    expect(investor.getAttribute("srcset") ?? "").toContain("?w=800");
    expect(investor.getAttribute("srcset") ?? "").not.toContain("crop=band");
    const steward = document.querySelector('#choose-path a[href="/steward"] img') as HTMLImageElement;
    expect(steward.style.objectPosition).toBe("50% 40%");
    expect(painting.parentElement?.className).toContain("aspect-square");
    expect(painting.parentElement?.className).toContain("lg:aspect-[4/5]");
    expect(painting.className).toContain("object-cover");
  });
});
