/**
 * THE HIDDEN MAP'S RULES. No database: the one visibility decision, opening,
 * grid snapping, coordinate validation, tile addresses and the village config.
 *
 * Every person and place here is invented.
 */
import { describe, expect, it } from "vitest";
import {
  DEFAULT_CONFIG, coarser, exportGeoJson, mayReadDetail, mayVisit, mayVouch, numberDots, opening, parsePinInput, project,
  readConfig, snap, tileUrl, unproject, validateConfig, validatePoint, visiblePin, visitMayPay,
  type PinRecord, type PinView, type Viewer,
} from "./hiddenMap";

const pin = (over: Partial<PinRecord> = {}): PinRecord => ({
  id: "p1",
  ownerUserId: "owner",
  layer: "planting",
  kind: "Garden",
  lat: 40.123456,
  lng: -105.654321,
  precision: "exact",
  title: "Corner bed",
  whatWentIn: "Three sisters",
  notes: "By the fence",
  stage: "seed",
  partnerState: null,
  plantedOn: "2026-11-01",
  native: false,
  hidden: false,
  createdAt: "2026-11-01T00:00:00Z",
  vouches: 0,
  vouchedByMe: false,
  photoIds: ["ph1"],
  ...over,
});

const viewer = (over: Partial<Viewer> = {}): Viewer => ({ userId: "someone", open: false, keeper: false, ...over });
const opts = { openLayers: [] as const, teaser: false };

describe("visiblePin: the one decision", () => {
  it("shows the owner their own pin in full, marked mine, with no owner field", () => {
    const v = visiblePin(viewer({ userId: "owner" }), pin(), opts);
    expect(v && "mine" in v && v.mine).toBe(true);
    expect(JSON.stringify(v)).not.toContain("ownerUserId");
    expect(JSON.stringify(v)).not.toContain('"owner"');
  });

  it("shows a member whose map is closed NOTHING of another member's pin", () => {
    expect(visiblePin(viewer(), pin(), opts)).toBeNull();
  });

  it("shows an open member every pin, never who made it", () => {
    const v = visiblePin(viewer({ open: true }), pin(), opts) as PinView;
    expect(v.mine).toBe(false);
    expect(v.lat).toBe(40.123456);
    expect(Object.keys(v)).not.toContain("ownerUserId");
  });

  it("hides a hidden pin from everybody except its owner", () => {
    expect(visiblePin(viewer({ open: true }), pin({ hidden: true }), opts)).toBeNull();
    expect(visiblePin(viewer({ userId: "owner" }), pin({ hidden: true }), opts)).not.toBeNull();
  });

  it("opens a layer the village lists as open to a closed map", () => {
    expect(visiblePin(viewer(), pin({ layer: "stop" }), { openLayers: ["stop"], teaser: false })).not.toBeNull();
    expect(visiblePin(viewer(), pin({ layer: "planting" }), { openLayers: ["stop"], teaser: false })).toBeNull();
  });

  it("shows a keeper whose map is closed only pins still waiting for a vouch, and only in the queue", () => {
    const k = viewer({ keeper: true });
    expect(visiblePin(k, pin({ vouches: 0 }), { ...opts, queue: true, vouchesPerPin: 1 })).not.toBeNull();
    expect(visiblePin(k, pin({ vouches: 1 }), { ...opts, queue: true, vouchesPerPin: 1 })).toBeNull();
    expect(visiblePin(k, pin({ vouches: 0 }), opts)).toBeNull();
  });

  it("puts only plantings in a keeper's queue: no other layer is vouched toward opening", () => {
    const k = viewer({ keeper: true });
    expect(visiblePin(k, pin({ layer: "stop", kind: "Overnight" }), { ...opts, queue: true, vouchesPerPin: 1 })).toBeNull();
    expect(visiblePin(k, pin({ layer: "partner", kind: "Farm" }), { ...opts, queue: true, vouchesPerPin: 1 })).toBeNull();
  });

  it("never gives a dot the pin's id, and numbers the dots of one answer", () => {
    const d = visiblePin(viewer(), pin({ id: "hmp-secret" }), { openLayers: [], teaser: true });
    expect(JSON.stringify(d)).not.toContain("hmp-secret");
    const mineView = visiblePin(viewer({ userId: "owner" }), pin(), opts)!;
    expect(numberDots([d!, mineView, d!]).map((v) => v.id)).toEqual(["dot-1", "p1", "dot-2"]);
  });

  it("with the teaser on, gives a closed map a dot no finer than about 1 km, with no words or photos", () => {
    const v = visiblePin(viewer(), pin({ precision: "exact" }), { openLayers: [], teaser: true });
    expect(v && "dot" in v).toBe(true);
    expect(mayReadDetail(v)).toBe(false);
    expect(JSON.stringify(v)).not.toContain("Corner bed");
    expect(JSON.stringify(v)).not.toContain("ph1");
    expect((v as any).lat).not.toBe(40.123456);
    expect((v as any).precision).toBe("km");
  });

  it("a region pin's teaser dot stays at region", () => {
    const v = visiblePin(viewer(), pin({ precision: "region" }), { openLayers: [], teaser: true }) as any;
    expect(v.precision).toBe("region");
  });
});

describe("vouching and visiting", () => {
  it("refuses a self-vouch with 409", () => {
    expect(mayVouch(viewer({ userId: "owner", open: true }), pin())).toMatchObject({ ok: false, status: 409 });
  });
  it("refuses a member not yet admitted, even with an open map or the keeper's power", () => {
    expect(mayVouch(viewer({ open: true, admitted: false }), pin())).toMatchObject({ ok: false, status: 403 });
    expect(mayVouch(viewer({ keeper: true, admitted: false }), pin())).toMatchObject({ ok: false, status: 403 });
    expect(mayVouch(viewer({ open: true, admitted: true }), pin())).toEqual({ ok: true });
  });
  it("refuses a member whose map is closed with 403, and lets a keeper through", () => {
    expect(mayVouch(viewer(), pin())).toMatchObject({ ok: false, status: 403 });
    expect(mayVouch(viewer({ keeper: true }), pin())).toEqual({ ok: true });
    expect(mayVouch(viewer({ open: true }), pin())).toEqual({ ok: true });
  });
  it("lets the owner or an open member visit, and nobody else", () => {
    expect(mayVisit(viewer({ userId: "owner" }), pin())).toBe(true);
    expect(mayVisit(viewer({ open: true }), pin())).toBe(true);
    expect(mayVisit(viewer({ keeper: true }), pin())).toBe(false);
    expect(mayVisit(viewer({ open: true }), pin({ hidden: true }))).toBe(false);
  });
  it("pays a visit only for an open member who is not the owner, once per window, when a quest is named", () => {
    const now = new Date("2026-11-15T00:00:00Z");
    const base = { viewer: viewer({ open: true }), pin: pin(), questId: "q1", lastPaidAt: null, now, windowDays: 30 };
    expect(visitMayPay(base)).toBe(true);
    expect(visitMayPay({ ...base, questId: null })).toBe(false);
    expect(visitMayPay({ ...base, viewer: viewer({ userId: "owner", open: true }) })).toBe(false);
    expect(visitMayPay({ ...base, viewer: viewer() })).toBe(false);
    expect(visitMayPay({ ...base, lastPaidAt: new Date("2026-11-01T00:00:00Z") })).toBe(false);
    expect(visitMayPay({ ...base, lastPaidAt: new Date("2026-10-01T00:00:00Z") })).toBe(true);
    expect(visitMayPay({ ...base, pin: pin({ ownerUserId: null }) })).toBe(false);
  });
});

describe("opening", () => {
  it("opens at N vouched pins and not before", () => {
    expect(opening(6, 7, false).open).toBe(false);
    expect(opening(7, 7, false).open).toBe(true);
  });
  it("stays open once opened, whatever the count or the dial does next", () => {
    expect(opening(0, 7, true).open).toBe(true);
    expect(opening(3, 50, true).open).toBe(true);
  });
  it("a dial of zero opens the map for everybody", () => {
    expect(opening(0, 0, false).open).toBe(true);
  });
});

describe("coordinates", () => {
  it("refuses NaN, a missing half and out-of-range pairs", () => {
    expect(validatePoint(NaN, 1).ok).toBe(false);
    expect(validatePoint(1, undefined).ok).toBe(false);
    expect(validatePoint("abc", 1).ok).toBe(false);
    expect(validatePoint(91, 0).ok).toBe(false);
    expect(validatePoint(0, -181).ok).toBe(false);
  });
  it("accepts numbers and numeric strings, rounded to six places", () => {
    expect(validatePoint("40.1234567", -105.1)).toEqual({ ok: true, point: { lat: 40.123457, lng: -105.1 } });
  });
  it("snaps to the centre of a fixed cell, so the same point always gives the same answer", () => {
    const p = { lat: 40.123456, lng: -105.654321 };
    expect(snap(p, "exact")).toEqual(p);
    expect(snap(p, "km")).toEqual({ lat: 40.125, lng: -105.655 });
    expect(snap(p, "region")).toEqual({ lat: 40.25, lng: -105.75 });
    expect(snap({ lat: 40.12999, lng: -105.65001 }, "km")).toEqual(snap(p, "km"));
  });
  it("keeps a snapped point on the earth", () => {
    expect(snap({ lat: 89.99, lng: 179.99 }, "region")).toEqual({ lat: 89.75, lng: 179.75 });
  });
  it("coarser picks the coarser of two", () => {
    expect(coarser("exact", "km")).toBe("km");
    expect(coarser("region", "km")).toBe("region");
  });
});

describe("tiles", () => {
  it("projects and unprojects", () => {
    const t = project({ lat: 0, lng: 0 }, 1);
    expect(t).toEqual({ x: 1, y: 1 });
    const back = unproject(t.x, t.y, 1);
    expect(back.lat).toBeCloseTo(0, 6);
    expect(back.lng).toBeCloseTo(0, 6);
  });
  it("refuses a NaN, a fraction, a zoom past the cap and a row off the world", () => {
    expect(tileUrl("osm", 3, NaN, 1, 13)).toBeNull();
    expect(tileUrl("osm", 3, 1.5, 1, 13)).toBeNull();
    expect(tileUrl("osm", 14, 1, 1, 13)).toBeNull();
    expect(tileUrl("osm", 3, 1, 8, 13)).toBeNull();
    expect(tileUrl("none", 3, 1, 1, 13)).toBeNull();
  });
  it("wraps columns round the world and orders Esri's z/y/x", () => {
    expect(tileUrl("osm", 3, 9, 2, 13)).toBe("https://tile.openstreetmap.org/3/1/2.png");
    expect(tileUrl("esri-imagery", 3, 1, 2, 13)).toBe(
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/3/2/1",
    );
  });
});

describe("config", () => {
  it("fills what a village did not set", () => {
    expect(readConfig(null)).toEqual(DEFAULT_CONFIG);
    expect(readConfig({ labels: { stop: "Harbours" } }).labels.stop).toBe("Harbours");
    expect(readConfig({ openLayers: ["stop", "nope"] }).openLayers).toEqual(["stop"]);
  });
  it("refuses an unknown layer, an empty kind list and a non-list of open layers", () => {
    expect(validateConfig({ labels: { boat: "x" } })).toMatch(/no layer/);
    expect(validateConfig({ kinds: { planting: [] } })).toMatch(/1 to 24/);
    expect(validateConfig({ openLayers: "stop" })).toMatch(/Open layers/);
    expect(validateConfig({ labels: { stop: "Harbours" }, openLayers: ["stop"] })).toBeNull();
  });
});

describe("pin input", () => {
  const body = { clientId: "abcdefgh12", layer: "planting", kind: "Garden", lat: 1, lng: 2 };
  it("takes a good pin and the village's default precision", () => {
    const r = parsePinInput(body, DEFAULT_CONFIG, "region");
    expect(r.ok && r.pin.precision).toBe("region");
  });
  it("refuses a kind the layer does not have, a bad client id and a partner with no state", () => {
    expect(parsePinInput({ ...body, kind: "Moon" }, DEFAULT_CONFIG, "region").ok).toBe(false);
    expect(parsePinInput({ ...body, clientId: "x" }, DEFAULT_CONFIG, "region").ok).toBe(false);
    expect(parsePinInput({ ...body, layer: "partner", kind: "Farm" }, DEFAULT_CONFIG, "region").ok).toBe(false);
    expect(parsePinInput({ ...body, layer: "partner", kind: "Farm", partnerState: "visited" }, DEFAULT_CONFIG, "region").ok).toBe(true);
  });
  it("keeps the native mark on plantings only", () => {
    const r = parsePinInput({ ...body, native: true }, DEFAULT_CONFIG, "region");
    expect(r.ok && r.pin.native).toBe(true);
    const stop = parsePinInput({ ...body, layer: "stop", kind: "Overnight", native: true }, DEFAULT_CONFIG, "region");
    expect(stop.ok && stop.pin.native).toBe(false);
  });
  it("refuses a date that is not a day", () => {
    expect(parsePinInput({ ...body, plantedOn: "yesterday" }, DEFAULT_CONFIG, "region").ok).toBe(false);
  });
});

describe("export", () => {
  it("never shows a pin finer than its own setting, and carries no owner or photos", () => {
    const views = [visiblePin(viewer({ open: true }), pin({ precision: "region" }), opts) as PinView];
    const out = exportGeoJson(views, "exact") as any;
    expect(out.features[0].properties.precision).toBe("region");
    expect(out.features[0].geometry.coordinates).toEqual([-105.75, 40.25]);
    expect(JSON.stringify(out)).not.toContain("ph1");
    expect(JSON.stringify(out)).not.toContain("mine");
  });
});

