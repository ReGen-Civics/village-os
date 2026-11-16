// @vitest-environment jsdom
/**
 * The hidden map's page, built to the onboarding lane's screens 08 and 10.
 *
 * A closed map: the meter counts the member's own plantings (vouched, waiting,
 * still to log), the rest of the map is named as secret, and the only thing
 * shown about everybody else's pins is one count. The page draws what the
 * server sent; these tests feed it a closed member's answer, which carries
 * only their own pins.
 *
 * The opening moment: shown once per member and opening on this device, with
 * the meter full and the counts, and gone after "Explore the map".
 *
 * Every person and place is invented.
 */
import type { ReactNode } from "react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

vi.mock("@/components/Layout", () => ({ default: ({ children }: { children: ReactNode }) => <>{children}</> }));
let modulesFailed = false;
vi.mock("@/modules/ModuleProvider", () => ({
  useModules: () =>
    modulesFailed
      ? { loaded: true, failed: true, modules: [] }
      : { loaded: true, failed: false, modules: [{ id: "hidden-map", lifecycle: "members" }] },
}));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { id: "u-ash", name: "Ash Example" }, loading: false }) }));

let me: any;
let pins: any[];
let noSignal = false;
vi.mock("@/lib/hiddenMapApi", async (orig) => ({
  ...(await orig<typeof import("@/lib/hiddenMapApi")>()),
  getMe: async () => { if (noSignal) throw new TypeError("Failed to fetch"); return me; },
  getPins: async () => { if (noSignal) throw new TypeError("Failed to fetch"); return { pins, open: me.open }; },
  getQueue: async () => ({ pins: [], mayVouch: false }),
  photoUrl: async () => "blob:x",
}));

import HiddenMap from "./HiddenMap";

beforeAll(() => {
  (globalThis as any).ResizeObserver ??= class { observe() {} disconnect() {} };
});

const base = {
  vouchedCount: 3,
  needed: 7,
  ownPins: 4,
  allPins: 63,
  planters: 10,
  keeper: false,
  mayApproveExports: false,
  title: "Our map",
  kindPrompts: { planting: "What went in?", partner: "What kind of place?", stop: "What kind of stop?" },
  labels: { planting: "Plantings", partner: "Partner places", stop: "Stops" },
  kinds: { planting: ["Seeds", "Trees"], partner: ["Farm"], stop: ["Overnight"] },
  openLayers: [],
  basemap: "none",
  maxZoom: 13,
  defaultPrecision: "region",
  teaser: false,
  precisions: ["exact", "km", "region"],
  vouchesPerPin: 1,
  plantingPays: false, vouchWays: ["in-person", "call", "photos"], vouchRule: "Vouch for what you know.",
  openedAt: null,
  openedBefore: 0,
};

const pin = (id: string, vouches: number, mine = true) => ({
  id, mine, layer: "planting", kind: "Seeds", lat: 40 + Number(id.slice(-1)) / 100, lng: -105, precision: "region",
  title: `Bed ${id}`, whatWentIn: null, notes: null, stage: "seed", partnerState: null, plantedOn: null, native: false,
  hidden: false, createdAt: "2026-11-15T00:00:00Z", vouches, vouchedByMe: false, photoIds: [],
});

beforeEach(() => {
  window.localStorage.clear();
  noSignal = false;
  modulesFailed = false;
});
afterEach(cleanup);

describe("a closed map (screen 08)", () => {
  beforeEach(() => {
    me = { ...base, open: false };
    pins = [pin("p1", 1), pin("p2", 1), pin("p3", 1), pin("p4", 0)];
  });

  it("draws the meter from the member's own plantings, at the village's dial", async () => {
    render(<HiddenMap />);
    const meter = await screen.findByRole("list", { name: "3 of 7 vouched" });
    const slots = meter.querySelectorAll("li");
    expect(slots).toHaveLength(7);
    expect(meter.textContent).toContain("vouched");
    expect(screen.getByText("3 vouched")).toBeTruthy();
    expect(screen.getByText(/4 logged/)).toBeTruthy();
  });

  it("names the rest of the map as secret and shows one count about everybody else's pins", async () => {
    render(<HiddenMap />);
    expect(await screen.findByText("The rest of the map is secret.")).toBeTruthy();
    expect(screen.getByText("63")).toBeTruthy();
    expect(screen.getByText(/Plantings logged by members so far/)).toBeTruthy();
    expect(screen.getByText("Waiting for a vouch")).toBeTruthy();
  });

  it("shows no opening moment", async () => {
    render(<HiddenMap />);
    await screen.findByText("The rest of the map is secret.");
    expect(screen.queryByText("The map is yours!")).toBeNull();
  });
});

describe("the map opens (screen 10)", () => {
  beforeEach(() => {
    me = { ...base, open: true, vouchedCount: 7, openedAt: "2026-11-15T12:00:00Z", openedBefore: 6 };
    pins = [pin("p1", 1), pin("p9", 2, false)];
  });

  it("shows the moment once, with the counts, and never again on this device after Explore", async () => {
    const first = render(<HiddenMap />);
    expect(await screen.findByText("The map is yours!")).toBeTruthy();
    expect(screen.getByText("6 members opened the map before you.")).toBeTruthy();
    expect(screen.getByText("7")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Explore the map" }));
    expect(screen.queryByText("The map is yours!")).toBeNull();
    first.unmount();
    render(<HiddenMap />);
    await screen.findByRole("tablist");
    expect(screen.queryByText("The map is yours!")).toBeNull();
  });
});

describe("opening with no signal (P6-2)", () => {
  it("opens to logging a place from the words snapshot, with no pin and the map's other views gone", async () => {
    me = { ...base, open: false };
    pins = [pin("p1", 1)];
    const online = render(<HiddenMap />);
    await screen.findByText("The rest of the map is secret.");
    online.unmount();

    noSignal = true;
    render(<HiddenMap />);
    expect(await screen.findByText("No signal here")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Log a place" })).toBeTruthy();
    expect(screen.queryByRole("tab", { name: "Map" })).toBeNull();
    expect(screen.queryByText("Bed p1")).toBeNull();
  });

  it("opens from the snapshot even when the module list cannot be read (P6-2)", async () => {
    me = { ...base, open: false };
    pins = [];
    const online = render(<HiddenMap />);
    await screen.findByText("The rest of the map is secret.");
    online.unmount();

    noSignal = true;
    modulesFailed = true;
    render(<HiddenMap />);
    expect(await screen.findByText("No signal here")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Log a place" })).toBeTruthy();
  });

  it("says the map could not be read when there is no snapshot", async () => {
    me = { ...base, open: false };
    noSignal = true;
    render(<HiddenMap />);
    expect(await screen.findByText(/this phone has not opened the map before/)).toBeTruthy();
  });
});
