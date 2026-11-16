/**
 * A world map with no map library: square tiles placed by Web Mercator
 * arithmetic, or a plain grid of latitude and longitude when the village chose
 * no picture. Pins are drawn on top at their real positions.
 *
 * TILES LOAD ON THIS DEVICE, straight from the provider, as plain images, with
 * the provider's credit always on screen. Nothing goes through the village's
 * server. The tile zoom stops at the village's cap (`hiddenmap.basemap_max_zoom`)
 * and the last tiles are drawn larger beyond it, so the provider never learns a
 * square smaller than the cap allows. Every tile address comes from `tileUrl`,
 * which refuses a NaN.
 *
 * The grid invents nothing: no coastline, no names, only the lines of the
 * earth's own coordinates.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Minus, Plus } from "lucide-react";
import { useLingui } from "@lingui/react/macro";
import {
  BASEMAP_DEFS, isBasemap, project, tileUrl, unproject, type Basemap, type Layer, type PinDot, type PinView, type Point,
} from "@shared/hiddenMap";

const TILE = 256;
const MIN_ZOOM = 1;
const MAX_ZOOM = 18;

export interface WorldMapProps {
  pins: ReadonlyArray<PinView | PinDot>;
  basemap: string;
  maxTileZoom: number;
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  /** When set, a tap on empty ground answers the point there (placing a pin). */
  onTap?: (p: Point) => void;
  /** A point to show as the one being placed. */
  placing?: Point | null;
  labels: Record<Layer, string>;
  height?: number;
}

const LAYER_FILL: Record<Layer, string> = {
  planting: "bg-notice",
  partner: "bg-primary",
  stop: "bg-ring",
};

function fitAll(pins: ReadonlyArray<{ lat: number; lng: number }>, w: number, h: number): { center: Point; zoom: number } {
  if (!pins.length) return { center: { lat: 20, lng: 0 }, zoom: 2 };
  const lats = pins.map((p) => p.lat);
  const lngs = pins.map((p) => p.lng);
  const box = { n: Math.max(...lats), s: Math.min(...lats), e: Math.max(...lngs), w: Math.min(...lngs) };
  const center = { lat: (box.n + box.s) / 2, lng: (box.e + box.w) / 2 };
  for (let z = 14; z >= MIN_ZOOM; z--) {
    const a = project({ lat: box.n, lng: box.w }, z);
    const b = project({ lat: box.s, lng: box.e }, z);
    if (Math.abs(b.x - a.x) * TILE < w * 0.8 && Math.abs(b.y - a.y) * TILE < h * 0.8) return { center, zoom: z };
  }
  return { center, zoom: MIN_ZOOM };
}

/** A grid step in degrees that draws a handful of lines at this zoom. */
function gridStep(zoom: number): number {
  const steps = [30, 15, 10, 5, 2, 1, 0.5, 0.2, 0.1, 0.05, 0.02, 0.01, 0.005, 0.002, 0.001];
  return steps[Math.min(steps.length - 1, Math.max(0, zoom - 1))]!;
}

export default function WorldMap({ pins, basemap, maxTileZoom, selectedId, onSelect, onTap, placing, labels, height = 420 }: WorldMapProps) {
  const { t } = useLingui();
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 640, h: height });
  const [view, setView] = useState<{ center: Point; zoom: number } | null>(null);
  const drag = useRef<{ x: number; y: number; cx: number; cy: number; moved: boolean } | null>(null);
  const bm: Basemap = isBasemap(basemap) ? basemap : "none";

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth || 640, h: el.clientHeight || height }));
    ro.observe(el);
    setSize({ w: el.clientWidth || 640, h: el.clientHeight || height });
    return () => ro.disconnect();
  }, [height]);

  // Frame every pin once, on the first answer that has any.
  const framed = useRef(false);
  useEffect(() => {
    if (framed.current || size.w < 10) return;
    if (pins.length || !view) {
      setView(fitAll(pins, size.w, size.h));
      if (pins.length) framed.current = true;
    }
  }, [pins, size.w, size.h, view]);

  const v = view ?? { center: { lat: 20, lng: 0 }, zoom: 2 };
  const c = project(v.center, v.zoom);
  const cx = c.x * TILE;
  const cy = c.y * TILE;

  const toScreen = useCallback(
    (p: { lat: number; lng: number }) => {
      const t = project(p, v.zoom);
      return { x: t.x * TILE - cx + size.w / 2, y: t.y * TILE - cy + size.h / 2 };
    },
    [v.zoom, cx, cy, size.w, size.h],
  );

  const tiles = useMemo(() => {
    if (bm === "none") return [];
    const def = BASEMAP_DEFS[bm];
    const tz = Math.max(0, Math.min(v.zoom, maxTileZoom, def.maxZoom));
    const scale = 2 ** (v.zoom - tz);
    const span = TILE * scale;
    const n = 2 ** tz;
    const left = cx - size.w / 2;
    const top = cy - size.h / 2;
    const out: Array<{ key: string; src: string; x: number; y: number; s: number }> = [];
    for (let ty = Math.floor(top / span); ty <= Math.floor((top + size.h) / span); ty++) {
      if (ty < 0 || ty >= n) continue;
      for (let tx = Math.floor(left / span); tx <= Math.floor((left + size.w) / span); tx++) {
        const src = tileUrl(bm, tz, tx, ty, maxTileZoom);
        if (src) out.push({ key: `${tz}/${tx}/${ty}`, src, x: tx * span - left, y: ty * span - top, s: span });
      }
    }
    return out;
  }, [bm, v.zoom, maxTileZoom, cx, cy, size.w, size.h]);

  const grid = useMemo(() => {
    if (bm !== "none") return null;
    const step = gridStep(v.zoom);
    const nw = unproject((cx - size.w / 2) / TILE, (cy - size.h / 2) / TILE, v.zoom);
    const se = unproject((cx + size.w / 2) / TILE, (cy + size.h / 2) / TILE, v.zoom);
    const lines: Array<{ key: string; x1: number; y1: number; x2: number; y2: number; label: string }> = [];
    for (let lng = Math.ceil(nw.lng / step) * step; lng <= se.lng && lines.length < 80; lng += step) {
      const x = toScreen({ lat: 0, lng }).x;
      lines.push({ key: `lng${lng}`, x1: x, y1: 0, x2: x, y2: size.h, label: `${Number(lng.toFixed(3))}°` });
    }
    for (let lat = Math.ceil(se.lat / step) * step; lat <= nw.lat && lines.length < 160; lat += step) {
      const y = toScreen({ lat, lng: 0 }).y;
      lines.push({ key: `lat${lat}`, x1: 0, y1: y, x2: size.w, y2: y, label: `${Number(lat.toFixed(3))}°` });
    }
    return lines;
  }, [bm, v.zoom, cx, cy, size.w, size.h, toScreen]);

  const zoomBy = (d: number) => setView({ center: v.center, zoom: Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, v.zoom + d)) });

  const down = (e: ReactPointerEvent<HTMLDivElement>) => {
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, cx, cy, moved: false };
  };
  const move = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (Math.abs(dx) + Math.abs(dy) > 4) d.moved = true;
    if (!d.moved) return;
    const center = unproject((d.cx - dx) / TILE, (d.cy - dy) / TILE, v.zoom);
    setView({ center: { lat: Math.max(-85, Math.min(85, center.lat)), lng: ((center.lng + 540) % 360) - 180 }, zoom: v.zoom });
  };
  const up = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    drag.current = null;
    if (!d || d.moved || !onTap || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    const p = unproject((cx - size.w / 2 + (e.clientX - r.left)) / TILE, (cy - size.h / 2 + (e.clientY - r.top)) / TILE, v.zoom);
    onTap({ lat: Math.round(p.lat * 1e6) / 1e6, lng: Math.round(p.lng * 1e6) / 1e6 });
  };

  const attribution = bm === "none" ? t`Latitude and longitude grid` : BASEMAP_DEFS[bm].attribution;

  return (
    <div className="relative overflow-hidden rounded-xl border border-border bg-muted" style={{ height }}>
      <div
        ref={ref}
        className="absolute inset-0 touch-none select-none"
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={() => { drag.current = null; }}
        onWheel={(e) => zoomBy(e.deltaY < 0 ? 1 : -1)}
        role="application"
        aria-label={onTap ? t`Map. Tap to place the pin.` : t`Map`}
      >
        {tiles.map((t) => (
          <img
            key={t.key}
            src={t.src}
            alt=""
            draggable={false}
            referrerPolicy="no-referrer"
            className="pointer-events-none absolute max-w-none"
            style={{ left: t.x, top: t.y, width: t.s, height: t.s }}
          />
        ))}
        {grid && (
          <svg className="pointer-events-none absolute inset-0" width={size.w} height={size.h} aria-hidden="true">
            {grid.map((l) => (
              <g key={l.key}>
                <line x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} className="stroke-border" strokeWidth={1} />
                <text x={l.x1 === 0 ? 4 : l.x1 + 3} y={l.y1 === 0 ? 12 : l.y1 - 3} className="fill-muted-foreground" fontSize={10}>
                  {l.label}
                </text>
              </g>
            ))}
          </svg>
        )}
        {pins.map((p) => {
          const s = toScreen(p);
          if (s.x < -20 || s.y < -20 || s.x > size.w + 20 || s.y > size.h + 20) return null;
          const dot = "dot" in p;
          const chosen = p.id === selectedId;
          return (
            <button
              key={p.id}
              type="button"
              disabled={dot || !onSelect}
              onPointerDown={(e) => e.stopPropagation()}
              onPointerUp={(e) => e.stopPropagation()}
              onClick={() => onSelect?.(p.id)}
              className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-background shadow-sm ${
                dot ? "size-3 bg-muted-foreground/70" : `size-5 ${LAYER_FILL[p.layer]}`
              } ${chosen ? "ring-2 ring-ring ring-offset-2" : ""}`}
              style={{ left: s.x, top: s.y }}
              aria-label={dot ? t`A pin somewhere near here (${labels[p.layer]})` : t`${(p as PinView).title || (p as PinView).kind}, ${labels[p.layer]}`}
            />
          );
        })}
        {placing && (() => {
          const s = toScreen(placing);
          return <span className="pointer-events-none absolute size-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-4 border-notice bg-background/60" style={{ left: s.x, top: s.y }} aria-hidden="true" />;
        })()}
      </div>
      <div className="absolute right-2 top-2 flex flex-col gap-1">
        <button type="button" onClick={() => zoomBy(1)} className="flex size-11 items-center justify-center rounded-lg border border-border bg-card text-foreground shadow-sm hover:bg-muted" aria-label={t`Zoom in`}>
          <Plus className="size-4" aria-hidden="true" />
        </button>
        <button type="button" onClick={() => zoomBy(-1)} className="flex size-11 items-center justify-center rounded-lg border border-border bg-card text-foreground shadow-sm hover:bg-muted" aria-label={t`Zoom out`}>
          <Minus className="size-4" aria-hidden="true" />
        </button>
      </div>
      <p className="absolute bottom-0 right-0 rounded-tl-md bg-card/90 px-2 py-0.5 text-[11px] text-muted-foreground">{attribution}</p>
    </div>
  );
}
