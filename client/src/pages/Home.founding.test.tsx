// @vitest-environment jsdom
/**
 * The landing's founding team (the lead's landing round, 24 Nov 2026): the hero
 * holds no buttons and no founding line; the paths row is the four paths, with
 * the Village Steward card as the founding team's door while the section is on
 * (option B); and the gold founding card leads the four ways at the foot of the
 * page. Off, the four ways start with Join the team in the same card.
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
let hiddenPages: string[] = [];
const PATHS = servedPaths(resolveVillagePathWords(null), pageVarsFrom({ project: { name: "Willowbrook", tagline: "", location: "" } }));

vi.mock("@/components/Layout", () => ({ default: ({ children }: { children: ReactNode }) => <>{children}</> }));
vi.mock("@/components/BuildProgress", () => ({ default: () => null }));
vi.mock("@/components/SeasonBanner", () => ({ default: () => null }));
vi.mock("@/components/MapPeek", () => ({ default: () => null }));
vi.mock("@/modules/ModuleProvider", () => ({ useModule: (id: string) => (id === "map" && mapOn ? { id: "map" } : null) }));
vi.mock("@/lib/gameApi", () => ({
  useBrandImages: () => brandImages,
  useGameConfig: () => ({ project: { name: "Willowbrook", tagline: "", location: "" }, currency: { name: "Thanks" }, brochureHidden: hiddenPages, ...(withPaths ? { paths: PATHS, brochurePages: true } : {}) }),
  useVillageLinks: () => ({ siteUrl: "https://willowbrook.example.org", eventsUrl: "", contactEmail: "", mailTo: () => "" }),
  altOr: (value: string | undefined, fallback: string) => (typeof value === "string" ? value : fallback),
}));
vi.mock("@/hooks/useVillageContent", () => ({ readVillageSection: () => Promise.resolve(null) }));

import Home from "./Home";

beforeEach(() => {
  foundingOn = true;
  brandImages = { hero: "" };
  withPaths = false;
  hiddenPages = [];
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
  it("draws no buttons and no founding line in the hero", async () => {
    renderHome();
    await waitFor(() => expect(document.querySelector("[data-four-ways]")).not.toBeNull());
    expect(hero().querySelectorAll("a, button")).toHaveLength(0);
    expect(hero().textContent).not.toContain("season by season");
    expect(screen.queryByRole("link", { name: "Explore the map" })).toBeNull();
  });

  it("puts the gold founding card at the head of the four ways at the foot of the page, never in the paths row", async () => {
    hiddenPages = ["/steward"];
    renderHome();
    const card = await waitFor(() => {
      const a = document.querySelector('[data-four-ways] a[data-way="founding"]') as HTMLAnchorElement | null;
      expect(a).not.toBeNull();
      return a as HTMLAnchorElement;
    });
    expect(card.getAttribute("href")).toBe("/roles#founding-team");
    expect(card.className).toContain("border-notice/60");
    expect(card.textContent).toContain("Roles with rewards");
    expect(card.textContent).toContain("See the open roles");
    expect(document.querySelector('#choose-path [data-way="founding"]')).toBeNull();
    const doors = Array.from(document.querySelectorAll("[data-four-ways] [data-route-door]")).map((a) => [a.getAttribute("data-route-door"), a.getAttribute("href")]);
    // A visitor with the venture form off: the open ventures on /roles, never the member's new-role door (25 Nov 2026).
    expect(doors).toEqual([["team", "/roles#founding-team"], ["venture", "/roles#open-ventures"], ["partner", "/partner"], ["quest", "/propose-quest"]]);
    // The four ways are the last section of the landing.
    const sections = Array.from(document.querySelectorAll("[data-landing-hero] ~ section, section"));
    expect(sections[sections.length - 1]?.hasAttribute("data-four-ways")).toBe(true);
  });

  it("makes the Village Steward card the founding team's door, with a Paid role label, and draws no separate founding card (option B)", async () => {
    withPaths = true;
    renderHome();
    const steward = await waitFor(() => {
      const a = document.querySelector('#choose-path a[data-way="core-team"]') as HTMLAnchorElement | null;
      expect(a).not.toBeNull();
      return a as HTMLAnchorElement;
    });
    expect(steward.getAttribute("href")).toBe("/roles#founding-team");
    expect(steward.querySelector("h3")?.textContent).toBe("Village Steward");
    expect(steward.querySelector("[data-paid-role]")?.textContent).toBe("Paid role");
    expect(steward.textContent).toContain("The founding team who hold the village's core domains.");
    expect(document.querySelector('#choose-path [data-way="founding"]')).toBeNull();
    expect(document.querySelectorAll("[data-paid-role]")).toHaveLength(1);
    expect(document.querySelector('#choose-path a[href="/investor"]')).not.toBeNull();
  });

  it("CONTROL: with the section off, the steward card is the steward path again, with no label", async () => {
    foundingOn = false;
    withPaths = true;
    renderHome();
    await waitFor(() => expect(document.querySelector('#choose-path a[href="/steward"]')).not.toBeNull());
    expect(document.querySelector("[data-paid-role]")).toBeNull();
    expect(document.querySelector('[data-way="core-team"]')).toBeNull();
    expect(document.body.textContent).not.toContain("core domains");
  });

  it("CONTROL: with the section off, the four ways start with Join the team in the same card, with no gold edge", async () => {
    foundingOn = false;
    renderHome();
    const card = await waitFor(() => {
      const a = document.querySelector('[data-four-ways] a[data-way="team"]') as HTMLAnchorElement | null;
      expect(a).not.toBeNull();
      return a as HTMLAnchorElement;
    });
    expect(card.querySelector("h3")?.textContent).toBe("Join the Core Team");
    expect(card.className).not.toContain("border-notice/60");
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
    hiddenPages = ["/steward"];
    renderHome();
    const founding = await waitFor(() => {
      const el = document.querySelector('[data-way="founding"]') as HTMLElement | null;
      expect(el).not.toBeNull();
      return el as HTMLElement;
    });
    const painting = founding.querySelector("img") as HTMLImageElement;
    expect(painting.getAttribute("src")).toMatch(/^\/images\/nature\//);
    const frame = painting.parentElement?.className;
    cleanup();
    hiddenPages = [];
    withPaths = true;
    renderHome();
    const investor = await waitFor(() => {
      const img = document.querySelector('#choose-path a[href="/investor"] img') as HTMLImageElement | null;
      expect(img).not.toBeNull();
      return img as HTMLImageElement;
    });
    expect(investor.parentElement?.className).toBe(frame);
    expect(investor.style.objectPosition).toBe("50% 80%");
    expect(investor.getAttribute("srcset") ?? "").toContain("?w=800");
    expect(investor.getAttribute("srcset") ?? "").not.toContain("crop=band");
    const steward = document.querySelector('#choose-path a[data-way="core-team"] img') as HTMLImageElement;
    expect(steward.style.objectPosition).toBe("50% 40%");
    expect(painting.parentElement?.className).toContain("aspect-square");
    expect(painting.parentElement?.className).toContain("lg:aspect-[4/5]");
    expect(painting.className).toContain("object-cover");
  });
});
