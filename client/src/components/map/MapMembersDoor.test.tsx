// @vitest-environment jsdom
/**
 * The living map's door (components/map/MapMembersDoor.tsx): the map when the server opens it,
 * the members-only page (pointing to the circles) when the server says members only.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

vi.mock("@/contexts/AuthContext", () => ({ useOptionalAuth: () => ({ user: null, loading: false }) }));
vi.mock("@/components/Layout", () => ({ default: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));

import MapMembersDoor from "./MapMembersDoor";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function answer(status: number, body: unknown) {
  vi.stubGlobal("fetch", vi.fn(async () => ({ status, ok: status < 400, json: async () => body }) as Response));
}

describe("the living map's door", () => {
  it("shows the map when the server opens it", async () => {
    answer(200, { map: true });
    render(<MapMembersDoor><p data-testid="map">map</p></MapMembersDoor>);
    expect(await screen.findByTestId("map")).toBeInTheDocument();
  });

  it("sends a reader below the rung to the circles", async () => {
    answer(403, { error: "members_only" });
    render(<MapMembersDoor><p data-testid="map">map</p></MapMembersDoor>);
    const link = await screen.findByRole("link", { name: "See the circles" });
    expect(link).toHaveAttribute("href", "/circles");
    expect(screen.queryByTestId("map")).toBeNull();
  });

  it("lets the page meet any other refusal itself", async () => {
    answer(404, { error: "module_disabled" });
    render(<MapMembersDoor><p data-testid="map">map</p></MapMembersDoor>);
    expect(await screen.findByTestId("map")).toBeInTheDocument();
  });
});
