/**
 * THE HIDDEN MAP: the rules, for the browser and the server both.
 *
 * A members-only map of places the members log, with photos and return visits.
 * Each member sees only their own pins until enough of them are vouched, then
 * the whole map opens. Module `hidden-map`; the doc is docs/modules/hidden-map.md.
 *
 * ── WHY ONE VISIBILITY FUNCTION ──────────────────────────────────────────
 *
 * `visiblePin` is the only place that decides what a viewer may read about a
 * pin. Every read calls it: the list, a pin's detail, a photo, the vouch
 * queue, the export. A second decision anywhere is a second place to get it
 * wrong, and on this map getting it wrong puts a person beside a place they
 * planted without asking.
 *
 * ── WHY A GRID AND NEVER JITTER ──────────────────────────────────────────
 *
 * A coarse point is snapped to the centre of a fixed grid cell. Random jitter
 * looks kinder and leaks: read the same pin a thousand times and the average of
 * the jittered answers is the real point. A cell centre is the same answer every
 * time, so a thousand reads tell nobody more than one.
 *
 * No village's words live here. Layer labels and kinds are module config, so a
 * village names its own.
 */

export const MODULE_ID = "hidden-map";

// ── Words ───────────────────────────────────────────────────────────────────

export const LAYERS = ["planting", "partner", "stop"] as const;
export type Layer = (typeof LAYERS)[number];

/** A planting's life on the map. `lost` is "didn't make it", and a later visit can bring it back. */
export const STAGES = ["seed", "sprout", "sapling", "tree", "lost"] as const;
export type Stage = (typeof STAGES)[number];

export const PRECISIONS = ["exact", "km", "region"] as const;
export type Precision = (typeof PRECISIONS)[number];

export const PARTNER_STATES = ["connected", "visited", "planted"] as const;
export type PartnerState = (typeof PARTNER_STATES)[number];

export const BASEMAPS = ["none", "osm", "esri-imagery"] as const;

/** How a voucher saw a planting. A village chooses which of these count (module settings `vouchWays`). */
export const VOUCH_WAYS = ["in-person", "call", "photos"] as const;
export type VouchWay = (typeof VOUCH_WAYS)[number];
export const isVouchWay = (v: unknown): v is VouchWay => (VOUCH_WAYS as readonly unknown[]).includes(v);
export type Basemap = (typeof BASEMAPS)[number];

export const isLayer = (v: unknown): v is Layer => (LAYERS as readonly unknown[]).includes(v);
export const isStage = (v: unknown): v is Stage => (STAGES as readonly unknown[]).includes(v);
export const isPrecision = (v: unknown): v is Precision => (PRECISIONS as readonly unknown[]).includes(v);
export const isPartnerState = (v: unknown): v is PartnerState => (PARTNER_STATES as readonly unknown[]).includes(v);
export const isBasemap = (v: unknown): v is Basemap => (BASEMAPS as readonly unknown[]).includes(v);

// ── Limits ──────────────────────────────────────────────────────────────────

export const MAX_TITLE = 120;
export const MAX_WHAT = 2000;
export const MAX_NOTES = 4000;
export const MAX_KIND = 48;
export const MAX_CLIENT_ID = 64;
/** Photos one pin may carry. A planting's story is a handful of visits, never an album. */
export const MAX_PHOTOS_PER_PIN = 24;
/** Photos one upload may carry. */
export const MAX_PHOTOS_PER_UPLOAD = 4;

// ── The village's config (module_settings.config) ──────────────────────────

export interface HiddenMapConfig {
  /** What the village calls the map. */
  title: string;
  /** The question above each layer's kinds ("What kind of place?"). A village asks in its own words. */
  kindPrompts: Record<Layer, string>;
  /** The quest a planting opens a claim on once it is vouched. Null means plantings pay nothing by themselves. */
  plantingQuestId: string | null;
  /** The ways of seeing a planting that this village accepts for a vouch. */
  vouchWays: VouchWay[];
  /** The rule a voucher reads, in the village's words. */
  vouchRule: string;
  /** What a member reads for each layer. A village names its own. */
  labels: Record<Layer, string>;
  /** The kinds a pin may take, per layer. */
  kinds: Record<Layer, string[]>;
  /** Layers a member sees in full before their own map has opened. Empty means every layer is locked. */
  openLayers: Layer[];
  /** The quest a return visit opens a claim on. Null means visits pay nothing. */
  returnVisitQuestId: string | null;
}

export const DEFAULT_CONFIG: HiddenMapConfig = {
  title: "Hidden map",
  kindPrompts: { planting: "What kind of place?", partner: "What kind of place?", stop: "What kind of stop?" },
  plantingQuestId: null,
  vouchWays: ["in-person", "call", "photos"],
  vouchRule: "Vouch only for a place you know is real: you were there, or the photos leave no doubt.",
  labels: { planting: "Plantings", partner: "Partner places", stop: "Places to stop" },
  kinds: {
    planting: ["Land project", "Garden", "Public place", "Roadside", "Wild land", "Our own garden"],
    partner: ["Land project", "Village", "Farm", "Garden"],
    stop: ["Overnight", "Long stay", "Water", "Power"],
  },
  openLayers: [],
  returnVisitQuestId: null,
};

/** The config a village has, with every missing part filled from the default. */
export function readConfig(raw: unknown): HiddenMapConfig {
  const c = (raw && typeof raw === "object" ? raw : {}) as Partial<HiddenMapConfig>;
  const labels = { ...DEFAULT_CONFIG.labels };
  const kindPrompts = { ...DEFAULT_CONFIG.kindPrompts };
  const kinds = { ...DEFAULT_CONFIG.kinds };
  for (const l of LAYERS) {
    const prompt = (c.kindPrompts as any)?.[l];
    if (typeof prompt === "string" && prompt.trim()) kindPrompts[l] = prompt.trim().slice(0, 80);
    const label = (c.labels as any)?.[l];
    if (typeof label === "string" && label.trim()) labels[l] = label.trim();
    const list = (c.kinds as any)?.[l];
    if (Array.isArray(list) && list.length) kinds[l] = list.map((k) => String(k).trim()).filter(Boolean);
  }
  const openLayers = Array.isArray(c.openLayers) ? c.openLayers.filter(isLayer) : [];
  const q = c.returnVisitQuestId;
  const title = typeof c.title === "string" && c.title.trim() ? c.title.trim().slice(0, 40) : DEFAULT_CONFIG.title;
  const pq = c.plantingQuestId;
  const ways = Array.isArray(c.vouchWays) ? c.vouchWays.filter(isVouchWay) : [];
  const rule = typeof c.vouchRule === "string" && c.vouchRule.trim() ? c.vouchRule.trim().slice(0, 300) : DEFAULT_CONFIG.vouchRule;
  return {
    title,
    kindPrompts,
    plantingQuestId: typeof pq === "string" && pq.trim() ? pq.trim() : null,
    vouchWays: ways.length ? ways : [...DEFAULT_CONFIG.vouchWays],
    vouchRule: rule,
    labels,
    kinds,
    openLayers,
    returnVisitQuestId: typeof q === "string" && q.trim() ? q.trim() : null,
  };
}

/**
 * Structural check before a config write. A human sentence, or null when it is fine.
 * It lives in shared/modules.ts, beside the registry entry, because the intake
 * scripts transpile that file on its own and it may import no other value.
 * shared/hiddenMap.test.ts pins its copy of the rules to the ones here.
 */
export { validateHiddenMapConfig as validateConfig } from "./modules";

// ── Coordinates ─────────────────────────────────────────────────────────────

export interface Point { lat: number; lng: number }

/**
 * Validate a pair before it is ever written. The INPUT is what gets checked:
 * an imagery endpoint answers 200 to a NaN box, so nothing downstream can tell
 * a picture of the place from a picture of nowhere.
 */
export function validatePoint(lat: unknown, lng: unknown): { ok: true; point: Point } | { ok: false; error: string } {
  const a = typeof lat === "string" ? Number(lat) : lat;
  const b = typeof lng === "string" ? Number(lng) : lng;
  if (typeof a !== "number" || typeof b !== "number" || !Number.isFinite(a) || !Number.isFinite(b)) {
    return { ok: false, error: "A place needs a latitude and a longitude, both numbers." };
  }
  if (a < -90 || a > 90) return { ok: false, error: "Latitude runs from -90 to 90." };
  if (b < -180 || b > 180) return { ok: false, error: "Longitude runs from -180 to 180." };
  // Six decimals is about 11 cm, finer than any phone knows.
  return { ok: true, point: { lat: round(a, 6), lng: round(b, 6) } };
}

function round(n: number, places: number): number {
  const f = 10 ** places;
  return Math.round(n * f) / f;
}

/** Degrees per grid cell for each coarse precision. 0.01 degree of latitude is 1.1 km. */
export const GRID_DEGREES: Record<Exclude<Precision, "exact">, number> = { km: 0.01, region: 0.5 };

/** A point snapped to the centre of its grid cell. The same point always gives the same answer. */
export function snap(point: Point, precision: Precision): Point {
  if (precision === "exact") return point;
  const g = GRID_DEGREES[precision];
  const cell = (v: number, lo: number, hi: number) => {
    const c = Math.floor(v / g) * g + g / 2;
    return round(Math.min(hi, Math.max(lo, c)), 6);
  };
  return { lat: cell(point.lat, -90, 90), lng: cell(point.lng, -180, 180) };
}

const PRECISION_RANK: Record<Precision, number> = { exact: 0, km: 1, region: 2 };

/** The coarser of two precisions. An export never shows a pin finer than its own setting. */
export function coarser(a: Precision, b: Precision): Precision {
  return PRECISION_RANK[a] >= PRECISION_RANK[b] ? a : b;
}

// ── Opening the map ─────────────────────────────────────────────────────────

export interface Opening {
  open: boolean;
  vouchedCount: number;
  needed: number;
}

/**
 * Whether a member's map is open. `alreadyOpen` is the recorded unlock: once
 * open, always open, so raising the dial or a withdrawn vouch never closes the
 * map on somebody it opened for.
 */
export function opening(vouchedCount: number, needed: number, alreadyOpen: boolean): Opening {
  const n = Math.max(0, Math.floor(needed));
  return { open: alreadyOpen || vouchedCount >= n, vouchedCount, needed: n };
}

// ── Visibility: the one decision ────────────────────────────────────────────

export interface Viewer {
  userId: string;
  open: boolean;
  /**
   * Whether the member has been admitted, where the village marks admission
   * (a rite, an oath). Absent means the village marks none, which is admitted.
   */
  admitted?: boolean;
  /** Holds `hiddenmap.keep`: may vouch before opening, and sees the queue only. */
  keeper: boolean;
}

/** A pin as the server holds it. The owner never leaves the server. */
export interface PinRecord {
  id: string;
  ownerUserId: string | null;
  layer: Layer;
  kind: string;
  lat: number;
  lng: number;
  precision: Precision;
  title: string | null;
  whatWentIn: string | null;
  notes: string | null;
  stage: Stage | null;
  partnerState: PartnerState | null;
  plantedOn: string | null;
  native: boolean;
  hidden: boolean;
  createdAt: string;
  vouches: number;
  vouchedByMe: boolean;
  photoIds: string[];
}

/** Everything a viewer may read about a pin. No owner, ever: `mine` is the whole of it. */
export interface PinView {
  id: string;
  mine: boolean;
  layer: Layer;
  kind: string;
  lat: number;
  lng: number;
  precision: Precision;
  title: string | null;
  whatWentIn: string | null;
  notes: string | null;
  stage: Stage | null;
  partnerState: PartnerState | null;
  plantedOn: string | null;
  native: boolean;
  hidden: boolean;
  createdAt: string;
  vouches: number;
  vouchedByMe: boolean;
  photoIds: string[];
}

/** What a member whose map is closed sees of somebody else's pin with the teaser on: a dot, nothing more. */
export interface PinDot {
  id: string;
  layer: Layer;
  lat: number;
  lng: number;
  precision: Precision;
  dot: true;
}

export interface VisibilityOptions {
  openLayers: readonly Layer[];
  teaser: boolean;
  /** Reading the vouch queue, where a keeper whose own map is closed may see a pin awaiting a vouch. */
  queue?: boolean;
  /** Vouches one pin needs before it counts. A pin at or above it has left the queue. */
  vouchesPerPin?: number;
}

function full(pin: PinRecord, mine: boolean): PinView {
  return {
    id: pin.id,
    mine,
    layer: pin.layer,
    kind: pin.kind,
    lat: pin.lat,
    lng: pin.lng,
    precision: pin.precision,
    title: pin.title,
    whatWentIn: pin.whatWentIn,
    notes: pin.notes,
    stage: pin.stage,
    partnerState: pin.partnerState,
    plantedOn: pin.plantedOn,
    native: pin.native,
    hidden: pin.hidden,
    createdAt: pin.createdAt,
    vouches: pin.vouches,
    vouchedByMe: pin.vouchedByMe,
    photoIds: pin.photoIds,
  };
}

/**
 * THE decision. Null means the viewer learns nothing about this pin: not its
 * place, its words, its photos, nor that it exists.
 */
export function visiblePin(viewer: Viewer, pin: PinRecord, opts: VisibilityOptions): PinView | PinDot | null {
  const mine = pin.ownerUserId !== null && pin.ownerUserId === viewer.userId;
  // The owner still sees a pin a keeper hid, marked hidden, so it never just vanishes on them.
  if (mine) return full(pin, true);
  if (pin.hidden) return null;
  if (viewer.open) return full(pin, false);
  if (opts.openLayers.includes(pin.layer)) return full(pin, false);
  // The queue is plantings only: no other layer is ever vouched toward opening. A keeper vouching
  // sees the exact place, which the capture screen says (QA pass 6, P6-1).
  if (opts.queue && viewer.keeper && pin.layer === "planting" && pin.vouches < Math.max(1, opts.vouchesPerPin ?? 1)) {
    return full(pin, false);
  }
  if (opts.teaser && !opts.queue) {
    const p = snap({ lat: pin.lat, lng: pin.lng }, coarser(pin.precision, "km"));
    // A dot never carries the pin's id: the caller numbers dots per answer (`numberDots`), so a
    // closed map cannot follow one pin across answers or ask for it by id (QA pass 6, P6-9).
    return { id: "", layer: pin.layer, lat: p.lat, lng: p.lng, precision: coarser(pin.precision, "km"), dot: true };
  }
  return null;
}

/** Give each dot in one answer its own throwaway id, in order. Full views keep their ids. */
export function numberDots<T extends PinView | PinDot>(views: T[]): T[] {
  let n = 0;
  return views.map((v) => ("dot" in v ? { ...v, id: `dot-${++n}` } : v));
}

/** Whether a viewer may read a pin's photos and detail: only a full view carries them. */
export function mayReadDetail(view: PinView | PinDot | null): view is PinView {
  return view !== null && !("dot" in view);
}

/** Who may vouch: an open member, or a keeper (the bootstrap). Never the owner. */
export function mayVouch(viewer: Viewer, pin: PinRecord): { ok: true } | { ok: false; status: 403 | 409; error: string } {
  if (pin.ownerUserId !== null && pin.ownerUserId === viewer.userId) {
    return { ok: false, status: 409, error: "A vouch means somebody else." };
  }
  if (viewer.admitted === false) {
    return { ok: false, status: 403, error: "You can vouch once you have been admitted to the village." };
  }
  if (!viewer.open && !viewer.keeper) {
    return { ok: false, status: 403, error: "You can vouch once your own map has opened." };
  }
  return { ok: true };
}

/** Who may add a return visit: the owner, or anybody whose map is open. */
export function mayVisit(viewer: Viewer, pin: PinRecord): boolean {
  if (pin.ownerUserId !== null && pin.ownerUserId === viewer.userId) return true;
  return viewer.open && !pin.hidden;
}

/** A visit opens a paid claim only for an open member who is not the owner, once per window. */
export function visitMayPay(input: {
  viewer: Viewer;
  pin: PinRecord;
  questId: string | null;
  lastPaidAt: Date | null;
  now: Date;
  windowDays: number;
}): boolean {
  if (!input.questId) return false;
  if (!input.viewer.open) return false;
  if (input.pin.ownerUserId === null || input.pin.ownerUserId === input.viewer.userId) return false;
  if (!input.lastPaidAt) return true;
  return input.now.getTime() - input.lastPaidAt.getTime() >= Math.max(0, input.windowDays) * 86_400_000;
}

// ── The basemap ─────────────────────────────────────────────────────────────

export interface BasemapDef {
  id: Exclude<Basemap, "none">;
  /** The tile template; {z}, {x} and {y} are integers we compute. */
  template: string;
  attribution: string;
  /** The deepest zoom the provider serves. */
  maxZoom: number;
}

/**
 * Tiles load straight into an `<img>` from the provider, on the member's
 * device. Nothing is fetched to the server, cached there, or served again, so
 * no provider's caching term is touched. The provider does see which tiles the
 * device asked for, which is why the zoom is capped (`hiddenmap.basemap_max_zoom`).
 */
export const BASEMAP_DEFS: Record<Exclude<Basemap, "none">, BasemapDef> = {
  osm: {
    id: "osm",
    template: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: "Map data (c) OpenStreetMap contributors",
    maxZoom: 19,
  },
  "esri-imagery": {
    id: "esri-imagery",
    template: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution: "Imagery (c) Esri and its imagery contributors",
    maxZoom: 18,
  },
};

/** The world in tile units at a zoom: x and y run 0 to 2^z, fractional. */
export function project(point: Point, z: number): { x: number; y: number } {
  const n = 2 ** z;
  const lat = Math.max(-85.0511, Math.min(85.0511, point.lat));
  const rad = (lat * Math.PI) / 180;
  const x = ((point.lng + 180) / 360) * n;
  const y = ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * n;
  return { x, y };
}

/** The inverse of `project`. */
export function unproject(x: number, y: number, z: number): Point {
  const n = 2 ** z;
  const lng = (x / n) * 360 - 180;
  const lat = (Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / n))) * 180) / Math.PI;
  return { lat, lng };
}

/**
 * One tile's address, or null when any part is not a whole number in range.
 * Null is the answer for a NaN, so a broken centre can never ask a provider for
 * a picture of nowhere.
 */
export function tileUrl(basemap: Basemap, z: number, x: number, y: number, maxZoom: number): string | null {
  if (basemap === "none") return null;
  const def = BASEMAP_DEFS[basemap];
  if (!def) return null;
  if (![z, x, y].every((v) => Number.isInteger(v))) return null;
  if (z < 0 || z > Math.min(def.maxZoom, maxZoom)) return null;
  const n = 2 ** z;
  if (y < 0 || y >= n) return null;
  const wx = ((x % n) + n) % n;
  return def.template.replace("{z}", String(z)).replace("{x}", String(wx)).replace("{y}", String(y));
}

// ── Export ──────────────────────────────────────────────────────────────────

export const EXPORT_STATES = ["pending", "approved", "declined", "withdrawn", "expired", "downloaded"] as const;
export type ExportState = (typeof EXPORT_STATES)[number];

/**
 * The export file: GeoJSON, no names, no owner, no photos. Each point is shown
 * at the coarser of the asked precision and the pin's own setting.
 */
export function exportGeoJson(pins: readonly PinView[], asked: Precision): Record<string, unknown> {
  return {
    type: "FeatureCollection",
    features: pins.map((p) => {
      const precision = coarser(asked, p.precision);
      const at = snap({ lat: p.lat, lng: p.lng }, precision);
      return {
        type: "Feature",
        geometry: { type: "Point", coordinates: [at.lng, at.lat] },
        properties: {
          layer: p.layer,
          kind: p.kind,
          precision,
          title: p.title,
          whatWentIn: p.whatWentIn,
          stage: p.stage,
          partnerState: p.partnerState,
          plantedOn: p.plantedOn,
          vouches: p.vouches,
        },
      };
    }),
  };
}

// ── The access log ──────────────────────────────────────────────────────────

export const ACCESS_ACTIONS = [
  "map.read",
  "pin.read",
  "queue.read",
  "vouch",
  "vouch.withdraw",
  "pin.hide",
  "export.ask",
  "export.approve",
  "export.download",
  "log.read",
] as const;
export type AccessAction = (typeof ACCESS_ACTIONS)[number];

// ── Input shapes ────────────────────────────────────────────────────────────

export interface PinInput {
  clientId: string;
  layer: Layer;
  kind: string;
  point: Point;
  precision: Precision;
  title: string | null;
  whatWentIn: string | null;
  notes: string | null;
  partnerState: PartnerState | null;
  plantedOn: string | null;
  /** What went in belongs to this place. Plantings only. */
  native: boolean;
}

const text = (v: unknown, max: number): string | null => {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s ? s.slice(0, max) : null;
};

/** A client id is a device-made token: letters, digits, dashes and underscores. */
export function isClientId(v: unknown): v is string {
  return typeof v === "string" && v.length >= 8 && v.length <= MAX_CLIENT_ID && /^[A-Za-z0-9_-]+$/.test(v);
}

/** Read a pin from a request body, against the village's config. */
export function parsePinInput(
  body: any,
  config: HiddenMapConfig,
  defaultPrecision: Precision,
): { ok: true; pin: PinInput } | { ok: false; error: string } {
  const b = body ?? {};
  if (!isClientId(b.clientId)) return { ok: false, error: "A pin needs the id the device made for it." };
  if (!isLayer(b.layer)) return { ok: false, error: `Choose a layer: ${LAYERS.join(", ")}.` };
  const kind = String(b.kind ?? "").trim();
  if (!config.kinds[b.layer as Layer].includes(kind)) {
    return { ok: false, error: `Choose a kind for this layer: ${config.kinds[b.layer as Layer].join(", ")}.` };
  }
  const at = validatePoint(b.lat, b.lng);
  if (!at.ok) return at;
  const precision = b.precision === undefined || b.precision === null ? defaultPrecision : b.precision;
  if (!isPrecision(precision)) return { ok: false, error: `Shown precision is one of ${PRECISIONS.join(", ")}.` };
  let partnerState: PartnerState | null = null;
  if (b.layer === "partner") {
    if (!isPartnerState(b.partnerState)) return { ok: false, error: `A partner place is ${PARTNER_STATES.join(", ")}.` };
    partnerState = b.partnerState;
  }
  let plantedOn: string | null = null;
  if (b.plantedOn !== undefined && b.plantedOn !== null && b.plantedOn !== "") {
    if (typeof b.plantedOn !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(b.plantedOn) || Number.isNaN(Date.parse(b.plantedOn))) {
      return { ok: false, error: "The planting date is a day, written 2026-11-15." };
    }
    plantedOn = b.plantedOn;
  }
  return {
    ok: true,
    pin: {
      clientId: b.clientId,
      layer: b.layer,
      kind,
      point: at.point,
      precision,
      title: text(b.title, MAX_TITLE),
      whatWentIn: text(b.whatWentIn, MAX_WHAT),
      notes: text(b.notes, MAX_NOTES),
      partnerState,
      plantedOn,
      native: b.layer === "planting" && b.native === true,
    },
  };
}
