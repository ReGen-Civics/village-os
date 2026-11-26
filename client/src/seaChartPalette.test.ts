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
