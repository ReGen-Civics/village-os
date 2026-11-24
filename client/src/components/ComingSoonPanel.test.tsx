// @vitest-environment jsdom
/**
 * COMING SOON IN PLACE OF AN EMPTY PAGE (24 Nov 2026): a member who opens an
 * area the village has not filled yet reads that it is coming, what will be
 * there, and where to go meanwhile.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { Router } from "wouter";
import type { ReactNode } from "react";

let places: unknown[] = [];
vi.mock("@/components/Layout", () => ({ default: ({ children }: { children: ReactNode }) => <>{children}</> }));
vi.mock("@/modules/ModuleProvider", () => ({ useModule: () => ({ id: "map" }), useModules: () => ({ modules: [{ id: "map" }], loaded: true }) }));
vi.mock("@/lib/gameApi", () => ({ authToken: () => "t" }));

import ComingSoonPanel from "./ComingSoonPanel";
import Places from "@/pages/Places";
import Photographs from "@/pages/Photographs";

beforeEach(() => {
  places = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) =>
      new Response(JSON.stringify(url.startsWith("/api/places") ? { places, photos: [], canContribute: true, canCurate: false, openReports: 0, perPlace: 60 } : {}), { status: 200 }),
    ),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("the coming-soon panel", () => {
  it("says Coming soon over the area's name, what will be there, and offers the door", () => {
    render(
      <Router>
        <ComingSoonPanel title="Photographs of the land" body="They gather here." door={{ href: "/map", label: "Open the map" }} />
      </Router>,
    );
    expect(screen.getByText("Coming soon")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Photographs of the land" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Open the map" }).getAttribute("href")).toBe("/map");
  });
});

describe("an empty places page", () => {
  it("shows Coming soon in place of 'No photographs yet.'", async () => {
    render(
      <Router>
        <Places />
      </Router>,
    );
    expect(await screen.findByText("Coming soon")).toBeTruthy();
    expect(screen.queryByText("No photographs yet.")).toBeNull();
    expect(screen.getByRole("link", { name: "Open the map" })).toBeTruthy();
  });

  it("the photographs page does the same", async () => {
    render(
      <Router>
        <Photographs />
      </Router>,
    );
    expect(await screen.findByText("Coming soon")).toBeTruthy();
    expect(screen.queryByText("No photographs yet.")).toBeNull();
  });
});
