/**
 * THE MODE PALETTES, MEASURED. index.css's palette block (`--pal-day-*`,
 * `--pal-night-*`) is the one place light and dark mode take their colours
 * from. Change a line there and this file says whether every page still reads:
 * each pair below is one a page actually draws, with the role that draws it.
 *
 * Text wants 4.5:1 (WCAG 1.4.3). Edges, the focus ring and the logo want 3:1
 * (1.4.11). The ratio is WCAG 2.x's relative luminance, on the hex as written.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { contrastRatio } from "@shared/brandTokens";
import { MODE_PALETTE } from "@shared/modePalette";

const css = readFileSync(path.resolve(__dirname, "../index.css"), "utf8");
const shell = readFileSync(path.resolve(__dirname, "../../index.html"), "utf8");

/** The palette block: every `--pal-*: #rrggbb;` line inside it. */
function palette(): Record<string, string> {
  const at = css.indexOf("THE MODE PALETTES");
  if (at < 0) throw new Error("index.css has no palette block");
  const open = css.indexOf(":root {", at);
  const block = css.slice(open, css.indexOf("\n}", open));
  const out: Record<string, string> = {};
  for (const line of block.split("\n")) {
    const m = /^\s*--pal-([a-z-]+):\s*(#[0-9a-f]{6})\s*;/i.exec(line);
    if (m) out[m[1]] = m[2].toLowerCase();
  }
  return out;
}

const P = palette();
const TEXT = 4.5;
const EDGE = 3;

type Pair = [what: string, fg: string, bg: string, wanted: number];

function pairs(mode: "day" | "night"): Pair[] {
  const c = (role: string) => {
    const v = P[`${mode}-${role}`];
    if (!v) throw new Error(`index.css's palette has no --pal-${mode}-${role}`);
    return v;
  };
  const surfaces = ["ground", "panel", "panel-raised"] as const;
  const out: Pair[] = [];
  for (const s of surfaces) {
    out.push([`text on the ${s}`, c("ink"), c(s), TEXT]);
    out.push([`quiet text on the ${s}`, c("ink-dim"), c(s), TEXT]);
    out.push([`links and eyebrows on the ${s}`, c("accent"), c(s), TEXT]);
    out.push([`held/done green on the ${s}`, c("living"), c(s), TEXT]);
    out.push([`an error on the ${s}`, c("warn"), c(s), TEXT]);
    out.push([`an edge or field on the ${s}`, c("edge"), c(s), EDGE]);
    out.push([`the focus ring on the ${s}`, c("accent"), c(s), EDGE]);
  }
  // A village with no brand colour: white on the brand tones (the footer, white-text buttons, the welcome's hero band).
  out.push(["the footer's white text, no brand set", "#ffffff", c("brand"), TEXT]);
  out.push(["a white-text button's hover, no brand set", "#ffffff", c("brand-hover"), TEXT]);
  out.push(["the welcome hero's white text, no brand set", "#ffffff", c("brand-band"), TEXT]);
  // BTN_PRIMARY: bg-notice (the accent) with text-background (the ground).
  out.push(["the main button's label", c("ground"), c("accent"), TEXT]);
  // The header band and the phone's tab bar.
  out.push(["the header's text on the band", mode === "day" ? c("band-ink") : c("ink"), c("band"), TEXT]);
  out.push(["the active tab on the tab bar", c("accent"), mode === "day" ? c("panel") : c("band"), TEXT]);
  // Focus on the band and the tab bar takes the band's accent (index.css, "Focus on the band").
  out.push(["the focus ring on the header band", c("accent"), c("band"), EDGE]);
  out.push(["the focus ring on the tab bar", c("accent"), mode === "day" ? c("panel") : c("band"), EDGE]);
  out.push(["a tab's label on the tab bar", mode === "day" ? c("band-ink") : c("ink"), mode === "day" ? c("panel") : c("band"), TEXT]);
  if (mode === "day") {
    out.push(["page titles on the ground", c("heading"), c("ground"), TEXT]);
    out.push(["page titles on a panel", c("heading"), c("panel"), TEXT]);
    out.push(["the repainted logo on the band", c("logo"), c("band"), EDGE]);
    out.push(["page titles under the sky", c("heading"), c("sky"), TEXT]);
    for (const s of surfaces) {
      out.push([`gratitude on the dashboard, on the ${s}`, c("thanks"), c(s), TEXT]);
      out.push([`a live session on the dashboard, on the ${s}`, c("session"), c(s), TEXT]);
    }
  }
  return out;
}

describe.each(["day", "night"] as const)("the %s palette", (mode) => {
  it.each(pairs(mode))("%s", (_what, fg, bg, wanted) => {
    expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(wanted);
  });
});

describe("sand dialogue in dark mode", () => {
  it("is the day palette inside the night, so it reads as the day palette does", () => {
    const at = css.indexOf("DIALOGUE IS SAND");
    const rule = css.slice(at, css.indexOf("}", at));
    expect(rule).toContain("var(--day-ground, var(--pal-day-ground))");
    expect(rule).toContain("var(--day-ink, var(--pal-day-ink))");
  });
});

describe("the first paint", () => {
  it("paints the two grounds the palette names, so a mode never flashes another colour", () => {
    expect(shell).toContain(`light = "${P["day-ground"]}"`);
    expect(shell).toContain(`dark = "${P["night-ground"]}"`);
  });
});

describe("the palette block is the only source", () => {
  it("leaves no colour literal in the mode rules outside it", () => {
    const from = css.indexOf("THE PICKED LOOK FOR EACH MODE");
    const to = css.indexOf("THE DARK SCHEME (gap G1");
    const rules = css.slice(from, to).replace(/\/\*[\s\S]*?\*\//g, "");
    expect(rules.match(/#[0-9a-f]{3,8}\b/gi) ?? []).toEqual([]);
  });
});

describe("shared/modePalette.ts, the server's copy", () => {
  it("is the palette block's four lines, so the install manifest matches the page", () => {
    expect(MODE_PALETTE).toEqual({ dayGround: P["day-ground"], dayBand: P["day-band"], nightGround: P["night-ground"], nightBand: P["night-band"] });
  });
});
