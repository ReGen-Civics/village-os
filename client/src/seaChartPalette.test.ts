/**
 * THE SEA CHART'S PALETTE, MEASURED (client/src/seaChart.css). The look re-points the day palette's
 * tokens, so every pair a light page draws from them is held here to the same floors as the day
 * palette itself (lib/modePalettes.test.ts): text 4.5:1 (WCAG 1.4.3), edges and the focus ring 3:1
 * (1.4.11). The texture is laid behind the content and the cards keep a light paper wash, so the
 * flat colours are the honest floor; the darkest the mottle gets is measured too.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { contrastRatio } from "@shared/brandTokens";

const css = readFileSync(path.resolve(__dirname, "seaChart.css"), "utf8");
const pal: Record<string, string> = {};
for (const m of css.matchAll(/--pal-day-([a-z-]+):\s*(#[0-9a-f]{6})\s*;/gi)) pal[m[1]] = m[2].toLowerCase();
const c = (role: string) => {
  const v = pal[role];
  if (!v) throw new Error(`seaChart.css sets no --pal-day-${role}`);
  return v;
};

/**
 * The ground under the mottle's darkest blotch: the ground with the mottle's brown at a quarter. The
 * mottle's alpha is 1.4 x noise - 0.55 at half opacity, so a quarter is where its noise reaches about
 * 0.79, past which a fractal noise of three octaves seldom goes.
 */
function blend(top: string, bottom: string, alpha: number): string {
  const p = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [t, b] = [p(top), p(bottom)];
  return "#" + t.map((v, i) => Math.round(v * alpha + b[i] * (1 - alpha)).toString(16).padStart(2, "0")).join("");
}
const MOTTLE = "#73420f";
const darkestGround = () => blend(MOTTLE, c("ground"), 0.25);

describe("the Sea chart's palette", () => {
  const surfaces: Array<[string, () => string]> = [
    ["ground", () => c("ground")],
    ["panel", () => c("panel")],
    ["tile", () => c("panel-raised")],
    ["ground under the darkest mottle", darkestGround],
  ];
  for (const [name, bg] of surfaces) {
    it(`reads on the ${name}`, () => {
      expect(contrastRatio(c("ink"), bg())).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(c("ink-dim"), bg())).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(c("accent"), bg())).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(c("heading"), bg())).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(c("living"), bg())).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(c("warn"), bg())).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(c("edge"), bg())).toBeGreaterThanOrEqual(3);
      // The brand teal as link text (text-teal-deep, for a village with no brand colour set).
      expect(contrastRatio(c("brand"), bg())).toBeGreaterThanOrEqual(4.5);
    });
  }

  it("keeps white text on the brand teal's buttons", () => {
    expect(contrastRatio("#ffffff", c("brand"))).toBeGreaterThanOrEqual(4.5);
  });

  it("draws the lit branch's rule on the band and the lit entry's edge on a menu's panel at 3:1 (Layout.tsx, MoreSheet.tsx)", () => {
    expect(contrastRatio(c("accent"), c("band"))).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(c("accent"), c("panel"))).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(c("accent"), c("panel-raised"))).toBeGreaterThanOrEqual(3);
  });

  it("keeps the header band's ink readable", () => {
    expect(contrastRatio(c("band-ink"), c("band"))).toBeGreaterThanOrEqual(4.5);
  });

  it("keeps the wayfinding legible on the header band: the lit branch's teal and its compass marks", () => {
    // The lit branch's label (accent) and the rhumb line with its compass point (edge) sit on the band.
    expect(contrastRatio(c("accent"), c("band"))).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(c("edge"), c("band"))).toBeGreaterThanOrEqual(3);
  });

  it("draws its paper and torn edges: no raw # inside an SVG data URL", () => {
    // A raw # ends a data URL and starts its fragment, so the browser gets a cut-off SVG, refuses it,
    // and the card falls back to a plain border. That shipped in 1.3.81 with every texture missing.
    const uris = [...css.matchAll(/url\("(data:image\/svg\+xml,[^"]+)"\)/g)].map((m) => m[1]);
    expect(uris.length).toBeGreaterThanOrEqual(4);
    for (const u of uris) expect(u).not.toContain("#");
  });

  it("is scoped to light mode on a village that chose it, and steps aside for Admin", () => {
    const selectors = css.replace(/\/\*[\s\S]*?\*\//g, "").match(/(^|[{};])\s*([^{}@;]+)\{/g) ?? [];
    const lists = selectors.map((s) => s.replace(/^[{};]/, "").replace(/\{$/, "").trim()).filter(Boolean);
    expect(lists.length).toBeGreaterThan(5);
    for (const list of lists) {
      // Top-level commas only: the commas inside :is(...) and :not(...) belong to one selector.
      let depth = 0, part = "";
      const parts: string[] = [];
      for (const ch of list) {
        if (ch === "(") depth++;
        if (ch === ")") depth--;
        if (ch === "," && depth === 0) { parts.push(part); part = ""; } else part += ch;
      }
      parts.push(part);
      for (const p of parts) expect(p).toContain(':root[data-mode="light"][data-paper="sea-chart"]:not(:has(.admin-root))');
    }
  });
});

/*
 * THE WEATHERED MAP (the lead, 27 Nov 2026): "I don't want the square lines just the feel that it's a
 * weathered old map look and boxes and elements are weathered pages with random (not the same by each
 * other always a different look when side-by side so we'd need multiple edges of the page looks for the
 * whole site)".
 */
describe("the weathered map", () => {
  const svgs = [...css.matchAll(/url\("data:image\/svg\+xml,([^"]+)"\)/g)].map((m) => decodeURIComponent(m[1]));

  it("rules no lines on the paper: no grid tile anywhere", () => {
    // The first build ruled a 64px chart grid (one horizontal and one vertical line on a small tile).
    for (const svg of svgs) expect(svg).not.toMatch(/M0 0\.5H\d+M0\.5 0V\d+/);
    expect(svgs.some((svg) => /width=['"]64['"]/.test(svg))).toBe(false);
  });

  it("tears its pages at least six different ways, dealt on cycles that share no factor", () => {
    const tears = [...css.matchAll(/:nth-child\(7n\+(\d)\)\s*\{\s*--wm-tear:\s*(url\("[^"]*"\))/g)];
    expect(tears.map((m) => Number(m[1])).sort()).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(new Set(tears.map((m) => m[2])).size).toBeGreaterThanOrEqual(6);
    const cycles = [...new Set([...css.matchAll(/:nth-child\((\d)n\+\d\)/g)].map((m) => Number(m[1])))].sort();
    expect(cycles).toEqual([3, 5, 7]);
    const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);
    for (const a of cycles) for (const b of cycles) if (a !== b) expect(gcd(a, b)).toBe(1);
    // A card takes the dealt edge as a mask and its burnt line as a border image.
    expect(css).toMatch(/mask-border:\s*var\(--wm-tear\)/);
    expect(css).toMatch(/border-image:\s*var\(--wm-burn\)/);
  });

  // The foxing on the paper is a brown at most 6% over the darkest mottle; the stain and the foxing spot
  // on a card are at most 13% and 16% over the card's own wash.
  it("keeps every text colour at 4.5:1 on the paper under the darkest mottle and a foxing spot", () => {
    const bg = blend("#8c571f", darkestGround(), 0.06);
    for (const role of ["ink", "ink-dim", "accent", "heading", "living", "warn", "brand"]) expect(contrastRatio(c(role), bg)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(c("edge"), bg)).toBeGreaterThanOrEqual(3);
  });

  it("keeps every text colour at 4.5:1 on a card under a stain and a foxing spot", () => {
    const wash = blend("#eed6a8", c("panel"), 0.66);
    const bg = blend("#965c22", blend("#a86e2c", wash, 0.13), 0.16);
    for (const role of ["ink", "ink-dim", "accent", "heading", "living", "warn", "brand"]) expect(contrastRatio(c(role), bg)).toBeGreaterThanOrEqual(4.5);
  });
});
