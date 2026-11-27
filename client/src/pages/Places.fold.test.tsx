// @vitest-environment jsdom
/**
 * THE PLACES FOLD (26 Nov 2026): /places, /places/:key and /photographs are one
 * page. The shelf opens first, every photo is the #photos view, the curators'
 * queue is the #reports view and only a curator sees it, and the acts on a
 * photo live in one viewer where a takedown asks twice.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import type { ReactNode } from "react";

vi.mock("@/components/Layout", () => ({ default: ({ children }: { children: ReactNode }) => <>{children}</> }));
vi.mock("@/modules/ModuleProvider", () => ({ useModule: () => ({ id: "map" }), useModules: () => ({ modules: [{ id: "map" }], loaded: true }) }));
vi.mock("@/lib/gameApi", () => ({ authToken: () => "t" }));
vi.mock("@/components/journey/nature/Fireflies", () => ({ default: ({ children }: { children: ReactNode }) => <>{children}</> }));

import Places, { viewOf } from "@/pages/Places";
import { placeName } from "@/components/places/placesApi";
import { isFresh } from "@/components/places/PlaceCard";

const photo = (i: number, key = "community-kitchen", over: Record<string, unknown> = {}) => ({
  id: `p${i}`,
  structureKey: key,
  url: `/api/uploads/p${i}.webp`,
  thumbUrl: null,
  altText: `The north wall, view ${i}`,
  caption: null,
  takenOn: null,
  width: 800,
  height: 600,
  bytes: 1000,
  contributorId: i === 1 ? "me" : "someone",
  contributorName: i === 1 ? "Me Myself" : "Sol",
  heroAt: null,
  hiddenAt: null,
  hiddenBy: null,
  hiddenReason: null,
  createdAt: "2026-11-01T00:00:00Z",
  ...over,
});

let curate = false;
const calls: Array<{ url: string; method: string }> = [];

beforeEach(() => {
  curate = false;
  calls.length = 0;
  window.location.hash = "";
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, method: init?.method ?? "GET" });
      const body = (o: unknown) => new Response(JSON.stringify(o), { status: 200 });
      if (url === "/api/places")
        return body({
          places: [
            { structureKey: "community-kitchen", photoCount: 3, coverUrl: "/api/uploads/p0.webp", coverThumbUrl: null, coverAltText: "The kitchen", latestAt: "2026-11-01T00:00:00Z" },
            { structureKey: "ridge_a", photoCount: 1, coverUrl: "/api/uploads/p9.webp", coverThumbUrl: null, coverAltText: "The ridge", latestAt: "2026-10-01T00:00:00Z" },
          ],
          canContribute: true,
          canCurate: curate,
          openReports: curate ? 2 : 0,
          perPlace: 60,
        });
      if (url.startsWith("/api/places/photos")) return body({ photos: [photo(0), photo(1)], nextBefore: null, canCurate: curate, viewerId: "me", signedIn: true });
      if (url.startsWith("/api/places/reports")) return body({ reports: [], status: "open" });
      if (url.startsWith("/api/places/community-kitchen/photos"))
        return body({ structureKey: "community-kitchen", photos: [photo(0, "community-kitchen", { heroAt: "2026-11-02T00:00:00Z" }), photo(1), photo(2)], canContribute: true, canCurate: curate, viewerId: "me", signedIn: true, perPlace: 60, remaining: 57, maxMb: 12 });
      return body({});
    }),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.location.hash = "";
});

function at(path: string) {
  const { hook } = memoryLocation({ path });
  return render(
    <Router hook={hook}>
      <Places />
    </Router>,
  );
}

describe("the pieces", () => {
  it("reads the view from the hash, and anything unknown is the shelf", () => {
    expect(viewOf("")).toBe("places");
    expect(viewOf("#photos")).toBe("photos");
    expect(viewOf("#reports")).toBe("reports");
    expect(viewOf("#elsewhere")).toBe("places");
  });

  it("respaces a map key and never invents a name", () => {
    expect(placeName("community-kitchen")).toBe("Community kitchen");
    expect(placeName("ridge_a")).toBe("Ridge a");
    expect(placeName("ridgeA")).toBe("RidgeA");
  });

  it("marks a place New only for a photo added in the last two weeks", () => {
    const now = Date.parse("2026-11-10T00:00:00Z");
    expect(isFresh("2026-11-01T00:00:00Z", now)).toBe(true);
    expect(isFresh("2026-10-01T00:00:00Z", now)).toBe(false);
    expect(isFresh("not a date", now)).toBe(false);
  });
});

describe("the shelf", () => {
  it("opens on one card per place, each a door to its own address", async () => {
    at("/places");
    const card = await screen.findByRole("link", { name: /Community kitchen/ });
    expect(card.getAttribute("href")).toBe("/places/community-kitchen");
    expect(screen.getByRole("tab", { name: "By place" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByRole("tab", { name: "All photos" })).toBeTruthy();
    expect(screen.queryByRole("tab", { name: /Reports/ })).toBeNull();
  });

  it("sends a member without the curator's key who follows #reports to the shelf", async () => {
    window.location.hash = "#reports";
    at("/places");
    await screen.findByRole("link", { name: /Community kitchen/ });
    expect(calls.some((c) => c.url.startsWith("/api/places/reports"))).toBe(false);
  });

  it("gives a curator the Reports view with the open count, and reads the queue only there", async () => {
    curate = true;
    at("/places");
    const tab = await screen.findByRole("tab", { name: /Reports/ });
    expect(tab.textContent).toContain("2");
    expect(calls.some((c) => c.url.startsWith("/api/places/reports"))).toBe(false);
    fireEvent.click(tab);
    await waitFor(() => expect(calls.some((c) => c.url.startsWith("/api/places/reports"))).toBe(true));
    expect(window.location.hash).toBe("#reports");
  });

  it("shows every photo, with its place, in the All photos view", async () => {
    window.location.hash = "#photos";
    at("/places");
    expect(await screen.findByText(/Is one of these of you/)).toBeTruthy();
    expect(screen.getAllByText("Community kitchen").length).toBeGreaterThan(0);
  });
});

describe("one place", () => {
  it("names the place, counts its photos and opens the form with the location line", async () => {
    at("/places/community-kitchen");
    expect(await screen.findByRole("heading", { level: 1, name: "Community kitchen" })).toBeTruthy();
    fireEvent.click(await screen.findByRole("button", { name: "Add a photo" }));
    expect(screen.getByText("Location data is removed before it is stored.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Add it to this place" }).hasAttribute("disabled")).toBe(true);
  });

  it("asks twice before a member's own photo comes down for good", async () => {
    at("/places/community-kitchen");
    fireEvent.click(await screen.findByRole("button", { name: /Open the photo: The north wall, view 1/ }));
    const first = await screen.findByRole("button", { name: "Remove my photo" });
    fireEvent.click(first);
    expect(calls.some((c) => c.method === "DELETE")).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Press again to remove it for good" }));
    await waitFor(() => expect(calls.some((c) => c.method === "DELETE" && c.url === "/api/places/photo/p1")).toBe(true));
  });

  it("keeps the ask-it-down act in the viewer for every signed-in reader", async () => {
    at("/places/community-kitchen");
    fireEvent.click(await screen.findByRole("button", { name: /Open the photo: The north wall, view 2/ }));
    expect(await screen.findByRole("button", { name: "This is me, take it down" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Remove my photo" })).toBeNull();
    expect(screen.queryByText("Curator")).toBeNull();
  });
});
