// @vitest-environment jsdom
/**
 * THE PLACES FOLD (26 Nov 2026): /places, /places/:key and /photographs are one
 * page. The shelf opens first, every photo is the #photos view, the curators'
 * queue is the #reports view and only a curator sees it, and the acts on a
 * photo live in one viewer.
 *
 * Round 2 of the fold's QA holds the fixes: the viewer stays on its photo
 * through a reload and says what an act did, the views follow every move of
 * the address, a curator reaches the queue on an empty shelf, a takedown is a
 * real second question that a double click cannot answer, and the tabs take
 * the arrow keys.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
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
import { SUBJECT_FILED } from "@shared/placePhotos";

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
  heroAt: null as string | null,
  hiddenAt: null,
  hiddenBy: null,
  hiddenReason: null,
  createdAt: "2026-11-01T00:00:00Z",
  ...over,
});

let curate = false;
let shelfEmpty = false;
let kitchen = [photo(0, "community-kitchen", { heroAt: "2026-11-02T00:00:00Z" }), photo(1), photo(2)];
const calls: Array<{ url: string; method: string }> = [];

beforeEach(() => {
  curate = false;
  shelfEmpty = false;
  kitchen = [photo(0, "community-kitchen", { heroAt: "2026-11-02T00:00:00Z" }), photo(1), photo(2)];
  calls.length = 0;
  window.history.replaceState(null, "", "/");
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => setTimeout(() => cb(0), 0));
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      const method = init?.method ?? "GET";
      calls.push({ url, method });
      const body = (o: unknown) => new Response(JSON.stringify(o), { status: 200 });
      if (url === "/api/places")
        return body({
          places: shelfEmpty
            ? []
            : [
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
      if (url.startsWith("/api/places/community-kitchen/hero")) {
        const { photoId } = JSON.parse(String(init?.body));
        const chosen = kitchen.find((p) => p.id === photoId)!;
        kitchen = [{ ...chosen, heroAt: "2026-11-03T00:00:00Z" }, ...kitchen.filter((p) => p.id !== photoId).map((p) => ({ ...p, heroAt: null }))];
        return body({ success: true });
      }
      if (url.endsWith("/subject-request")) {
        const id = decodeURIComponent(url.split("/")[4]);
        // A reader who cannot see hidden photos loses it from the list.
        if (!curate) kitchen = kitchen.filter((p) => p.id !== id);
        return body({ success: true, fresh: true, hidden: true });
      }
      if (method === "DELETE") {
        const id = decodeURIComponent(url.split("/").pop()!);
        kitchen = kitchen.filter((p) => p.id !== id);
        return body({ success: true });
      }
      if (url.startsWith("/api/places/community-kitchen/photos"))
        return body({ structureKey: "community-kitchen", photos: kitchen, canContribute: true, canCurate: curate, viewerId: "me", signedIn: true, perPlace: 60, remaining: 57, maxMb: 12 });
      return body({});
    }),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
  window.history.replaceState(null, "", "/");
});

function at(path: string) {
  const { hook } = memoryLocation({ path });
  return render(
    <Router hook={hook}>
      <Places />
    </Router>,
  );
}

const viewerTitle = () => document.querySelector('[data-slot="dialog-title"]')?.textContent ?? null;

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

describe("the shelf and its views", () => {
  it("opens on one card per place, each a door to its own address", async () => {
    at("/places");
    const card = await screen.findByRole("link", { name: /Community kitchen/ });
    expect(card.getAttribute("href")).toBe("/places/community-kitchen");
    expect(screen.getByRole("tab", { name: "By place" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.queryByRole("tab", { name: /Reports/ })).toBeNull();
  });

  it("sends a member without the curator's key who follows #reports to the shelf", async () => {
    window.history.replaceState(null, "", "/places#reports");
    at("/places");
    await screen.findByRole("link", { name: /Community kitchen/ });
    expect(calls.some((c) => c.url.startsWith("/api/places/reports"))).toBe(false);
  });

  it("gives a curator the Reports view, and a press is a step Back can undo", async () => {
    curate = true;
    window.history.replaceState(null, "", "/places");
    at("/places");
    const tab = await screen.findByRole("tab", { name: /Reports/ });
    expect(tab.textContent).toContain("2");
    expect(calls.some((c) => c.url.startsWith("/api/places/reports"))).toBe(false);
    const before = window.history.length;
    fireEvent.click(tab);
    await waitFor(() => expect(calls.some((c) => c.url.startsWith("/api/places/reports"))).toBe(true));
    expect(window.location.hash).toBe("#reports");
    expect(window.history.length).toBe(before + 1);
  });

  it("follows a link from the bell to #reports while the page is already open", async () => {
    curate = true;
    window.history.replaceState(null, "", "/places");
    at("/places");
    await screen.findByRole("tab", { name: /Reports/ });
    act(() => {
      window.history.pushState(null, "", "/places#reports");
      window.dispatchEvent(new Event("pushState"));
    });
    await waitFor(() => expect(screen.getByRole("tab", { name: /Reports/ }).getAttribute("aria-selected")).toBe("true"));
  });

  it("keeps the queue in reach of a curator while the shelf is empty", async () => {
    curate = true;
    shelfEmpty = true;
    window.history.replaceState(null, "", "/places");
    at("/places");
    expect(await screen.findByText("Coming soon")).toBeTruthy();
    fireEvent.click(screen.getByRole("tab", { name: /Reports/ }));
    await waitFor(() => expect(calls.some((c) => c.url.startsWith("/api/places/reports"))).toBe(true));
  });

  it("moves between views with the arrow keys, and keeps one tab in the Tab order", async () => {
    window.history.replaceState(null, "", "/places");
    at("/places");
    const byPlace = await screen.findByRole("tab", { name: "By place" });
    const all = screen.getByRole("tab", { name: "All photos" });
    expect(byPlace.getAttribute("tabindex")).toBe("0");
    expect(all.getAttribute("tabindex")).toBe("-1");
    fireEvent.keyDown(byPlace, { key: "ArrowRight" });
    await waitFor(() => expect(screen.getByRole("tab", { name: "All photos" }).getAttribute("aria-selected")).toBe("true"));
    expect(document.activeElement).toBe(screen.getByRole("tab", { name: "All photos" }));
    fireEvent.keyDown(screen.getByRole("tab", { name: "All photos" }), { key: "Home" });
    await waitFor(() => expect(screen.getByRole("tab", { name: "By place" }).getAttribute("aria-selected")).toBe("true"));
  });

  it("shows every photo with its place in the All photos view, and no cover mark there", async () => {
    window.history.replaceState(null, "", "/places#photos");
    at("/places");
    expect(await screen.findByText(/Is one of these of you/)).toBeTruthy();
    expect(screen.getAllByText("Community kitchen").length).toBeGreaterThan(0);
    expect(screen.queryByText("Cover")).toBeNull();
  });
});

describe("one place", () => {
  it("names the place and opens the form with the location line", async () => {
    at("/places/community-kitchen");
    expect(await screen.findByRole("heading", { level: 1, name: "Community kitchen" })).toBeTruthy();
    fireEvent.click(await screen.findByRole("button", { name: "Add a photo" }));
    expect(screen.getByText("Location data is removed before it is stored.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Add it to this place" }).hasAttribute("disabled")).toBe(true);
  });

  it("asks a real second question before a member's own photo goes, and a double click cannot answer it", async () => {
    at("/places/community-kitchen");
    fireEvent.click(await screen.findByRole("button", { name: /Open the photo: The north wall, view 1/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Remove my photo" }));
    const keep = await screen.findByRole("button", { name: "Keep it" });
    await waitFor(() => expect(document.activeElement).toBe(keep));
    expect(screen.getAllByText(/Remove it for good\?/).length).toBeGreaterThan(0);
    // The second half of a double click lands at once: ignored.
    fireEvent.click(screen.getByRole("button", { name: "Yes, remove it" }));
    expect(calls.some((c) => c.method === "DELETE")).toBe(false);
    // An answer given after a pause is an answer.
    const now = Date.now();
    vi.spyOn(Date, "now").mockReturnValue(now + 1000);
    fireEvent.click(screen.getByRole("button", { name: "Yes, remove it" }));
    await waitFor(() => expect(calls.some((c) => c.method === "DELETE" && c.url === "/api/places/photo/p1")).toBe(true));
    // The viewer shuts and the page's line says what happened, with focus on it.
    await waitFor(() => expect(viewerTitle()).toBeNull());
    const line = await screen.findByText("Taken down. The file and its description are gone.");
    await waitFor(() => expect(document.activeElement).toBe(line));
    vi.restoreAllMocks();
  });

  it("keeps the viewer on its photo when a new cover reorders the list, and says so", async () => {
    curate = true;
    at("/places/community-kitchen");
    fireEvent.click(await screen.findByRole("button", { name: /Open the photo: The north wall, view 2/ }));
    expect(viewerTitle()).toBe("The north wall, view 2");
    fireEvent.click(await screen.findByRole("button", { name: "Make it the cover" }));
    await waitFor(() => expect(screen.getAllByText("This place opens with that one now.").length).toBeGreaterThan(0));
    // The list now leads with p2, and the viewer is still on it.
    await waitFor(() => expect(screen.getAllByText("1 of 3").length).toBeGreaterThan(0));
    expect(viewerTitle()).toBe("The north wall, view 2");
  });

  it("shuts the viewer and keeps the line when 'This is me' takes the photo out of a reader's list", async () => {
    at("/places/community-kitchen");
    fireEvent.click(await screen.findByRole("button", { name: /Open the photo: The north wall, view 2/ }));
    fireEvent.click(await screen.findByRole("button", { name: "This is me, take it down" }));
    await waitFor(() => expect(viewerTitle()).toBeNull());
    const line = await screen.findByText(SUBJECT_FILED);
    await waitFor(() => expect(document.activeElement).toBe(line));
    expect(screen.queryByRole("button", { name: /Open the photo: The north wall, view 2/ })).toBeNull();
  });

  it("gives the close button a 44px target and returns focus to the tile it opened from", async () => {
    at("/places/community-kitchen");
    const tile = await screen.findByRole("button", { name: /Open the photo: The north wall, view 2/ });
    fireEvent.click(tile);
    const close = await screen.findByRole("button", { name: "Close the photo" });
    expect(close.className).toContain("size-11");
    fireEvent.click(close);
    await waitFor(() => expect(viewerTitle()).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("button", { name: /Open the photo: The north wall, view 2/ })));
  });
});
