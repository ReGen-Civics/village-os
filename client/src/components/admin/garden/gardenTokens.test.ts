/**
 * THE GARDEN'S TOKENS, MEASURED. garden.css declares the night-first tokens on
 * `.garden`, each read off the night palette in client/src/index.css. This
 * file resolves every one to the colour a page paints and measures each pair
 * the garden draws: words want 4.5:1 (WCAG 1.4.3), and a mark that carries
 * meaning (a lantern, a stone, an edge, the focus ring) wants 3:1 (1.4.11).
 *
 * It also holds the two things a stylesheet can quietly lose: a literal colour
 * (which no village's night could re-tint), and motion outside the
 * reduced-motion guard.
 *
 * And the table of places: all ten keys, each with a name, a line and a spot.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { i18n } from "@lingui/core";
import { contrastRatio } from "@shared/brandTokens";
import { GARDEN_PLACE_KEYS, gardenArtFiles } from "@shared/gardenArt";
import { GARDEN_FRAME_TWO_COLUMNS_REM } from "./frame";
import { GARDEN_EXIT } from "./oldAdmin";
import { GARDEN_PLACES, PLACE_NAME_MAX, tidyPlaceName } from "./places";

const strip = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, "");
const gardenCss = strip(readFileSync(path.resolve(__dirname, "garden.css"), "utf8"));
const indexCss = readFileSync(path.resolve(__dirname, "../../../index.css"), "utf8");

/** The `.garden { ... }` block's custom properties, in the order written. */
function gardenBlock(): Record<string, string> {
  const open = gardenCss.indexOf(".garden {");
  if (open < 0) throw new Error("garden.css has no `.garden {` block");
  const block = gardenCss.slice(open, gardenCss.indexOf("\n}", open));
  const out: Record<string, string> = {};
  for (const m of block.matchAll(/(--[a-z0-9-]+):\s*([^;]+);/gi)) out[m[1]] = m[2].trim();
  return out;
}

/** index.css's palette block: every `--pal-*: #rrggbb;` line (the same reading modePalettes.test.ts makes). */
function palette(): Record<string, string> {
  const at = indexCss.indexOf("THE MODE PALETTES");
  const open = indexCss.indexOf(":root {", at);
  const block = indexCss.slice(open, indexCss.indexOf("\n}", open));
  const out: Record<string, string> = {};
  for (const m of block.matchAll(/(--pal-[a-z-]+):\s*(#[0-9a-f]{6})\s*;/gi)) out[m[1]] = m[2].toLowerCase();
  return out;
}

/** Split on the commas that are not inside brackets. */
function splitTop(s: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let from = 0;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === "(") depth++;
    else if (s[i] === ")") depth--;
    else if (s[i] === "," && depth === 0) {
      parts.push(s.slice(from, i));
      from = i + 1;
    }
  }
  parts.push(s.slice(from));
  return parts.map((p) => p.trim());
}

const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const hex = (c: number[]) => `#${c.map((n) => Math.round(n).toString(16).padStart(2, "0")).join("")}`;

const TOKENS = gardenBlock();
const SCOPE: Record<string, string> = { ...palette(), ...TOKENS };

/** The colour a value paints, for the two forms garden.css allows itself: var(--name, fallback) and color-mix(in srgb, A n%, B). */
function resolve(value: string, depth = 0): string {
  if (depth > 12) throw new Error(`"${value}" does not settle`);
  const v = value.trim();
  if (/^#[0-9a-f]{6}$/i.test(v)) return v.toLowerCase();
  if (v === "black") return "#000000";
  if (v === "white") return "#ffffff";
  const asVar = /^var\(([\s\S]*)\)$/.exec(v);
  if (asVar) {
    const [name, ...fallback] = splitTop(asVar[1]);
    if (SCOPE[name] !== undefined) return resolve(SCOPE[name], depth + 1);
    if (fallback.length > 0) return resolve(fallback.join(", "), depth + 1);
    throw new Error(`${name} is set nowhere and has no fallback`);
  }
  const asMix = /^color-mix\(in srgb,([\s\S]*)\)$/.exec(v);
  if (asMix) {
    const [first, second] = splitTop(asMix[1]);
    const weighted = /^([\s\S]*?)\s+(\d+(?:\.\d+)?)%$/.exec(first);
    if (!weighted || !second) throw new Error(`"${v}" is not "A n%, B"`);
    const share = Number(weighted[2]) / 100;
    const a = rgb(resolve(weighted[1], depth + 1));
    const b = rgb(resolve(second, depth + 1));
    return hex(a.map((n, i) => n * share + b[i] * (1 - share)));
  }
  throw new Error(`"${v}" is neither a var() nor a color-mix(in srgb, A n%, B)`);
}

const token = (name: string) => {
  const value = TOKENS[`--garden-${name}`];
  if (value === undefined) throw new Error(`garden.css declares no --garden-${name}`);
  return resolve(value);
};

const TEXT = 4.5;
const MARK = 3;
type Pair = [what: string, fg: string, bg: string, wanted: number];

/** Every surface the garden sets words on. Words on the land always sit on a plaque (wood), never on the land. */
const SURFACES = ["ground", "band", "surface", "raised", "wood", "warm"] as const;

const PAIRS: Pair[] = [
  ...SURFACES.flatMap((s): Pair[] => [
    [`text on ${s}`, "ink", s, TEXT],
    [`quiet text on ${s}`, "ink-soft", s, TEXT],
    [`gold words (a status label, an eyebrow, a link) on ${s}`, "gold", s, TEXT],
    [`a place's name on ${s}`, "gold-lit", s, TEXT],
    [`a lit lantern on ${s}`, "lantern-lit", s, MARK],
    [`a dark lantern on ${s}`, "lantern-dark", s, MARK],
    [`a walked stone's ring on ${s}`, "stone-walked", s, MARK],
    [`the stone you stand on, on ${s}`, "stone-current", s, MARK],
    [`a stone ahead on ${s}`, "stone-ahead", s, MARK],
    [`firefly light on ${s}`, "firefly", s, MARK],
    [`an edge or a field on ${s}`, "line", s, MARK],
    [`the focus ring on ${s}`, "gold-lit", s, MARK],
  ]),
  ["the main act's label, and the chosen lens's (ground on gold)", "ground", "gold", TEXT],
  ["an error on a panel", "warn", "surface", TEXT],
  ["an error on a tile", "warn", "raised", TEXT],
  ["held or done on a panel", "living", "surface", TEXT],
  ["held or done on a tile", "living", "raised", TEXT],
];

describe("the garden's tokens", () => {
  it("names every token the look is built from", () => {
    for (const name of ["ground", "surface", "raised", "ink", "ink-soft", "line", "lantern-lit", "lantern-dark", "stone-walked", "stone-current", "stone-ahead", "firefly"]) {
      expect(TOKENS[`--garden-${name}`], `--garden-${name}`).toBeDefined();
    }
  });

  it("derives every one from the night palette: each resolves, through var() and color-mix only", () => {
    for (const [name, value] of Object.entries(TOKENS)) {
      if (!name.startsWith("--garden-")) continue;
      expect(resolve(value), name).toMatch(/^#[0-9a-f]{6}$/);
    }
    // The base seven are the palette's own lines, with nothing mixed in.
    const P = palette();
    expect(token("ground")).toBe(P["--pal-night-ground"]);
    expect(token("surface")).toBe(P["--pal-night-panel"]);
    expect(token("raised")).toBe(P["--pal-night-panel-raised"]);
    expect(token("ink")).toBe(P["--pal-night-ink"]);
    expect(token("ink-soft")).toBe(P["--pal-night-ink-dim"]);
    expect(token("line")).toBe(P["--pal-night-edge"]);
    expect(token("gold")).toBe(P["--pal-night-accent"]);
  });

  it.each(PAIRS)("%s", (_what, fg, bg, wanted) => {
    const ratio = contrastRatio(token(fg), token(bg));
    expect(ratio, `${token(fg)} on ${token(bg)} is ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(wanted);
  });

  it("hands the page's own tokens the garden's, so semantic classes draw in its night", () => {
    expect(TOKENS["--background"]).toBe("var(--garden-ground)");
    expect(TOKENS["--foreground"]).toBe("var(--garden-ink)");
    expect(TOKENS["--card"]).toBe("var(--garden-surface)");
    expect(TOKENS["--muted"]).toBe("var(--garden-raised)");
    expect(TOKENS["--muted-foreground"]).toBe("var(--garden-ink-soft)");
    expect(TOKENS["--border"]).toBe("var(--garden-line)");
    expect(TOKENS["--sheet-notice"]).toBe("var(--garden-gold)");
  });

  it("carries no literal colour, so a village's night re-tints all of it", () => {
    expect(gardenCss).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(gardenCss).not.toMatch(/\b(?:rgb|rgba|hsl|hsla|oklch)\(/);
  });

  it("keeps the map's promise: a column of 26% of the land for each place", () => {
    expect(gardenCss).toContain("width: min(12rem, 26cqw);");
  });

  it("moves nothing outside the reduced-motion guard", () => {
    const at = gardenCss.indexOf("@media (prefers-reduced-motion: no-preference)");
    expect(at).toBeGreaterThan(0);
    const outside = gardenCss.slice(0, at);
    expect(outside).not.toMatch(/\b(?:transition|animation)(?:-[a-z-]+)?\s*:/);
    // The guard is the last block in the file, so nothing follows it unguarded.
    expect(gardenCss.slice(at).match(/@media/g)).toHaveLength(1);
  });
});

describe("the ten places", () => {
  i18n.loadAndActivate({ locale: "en", messages: {} });

  it("has a row for every key, and no other", () => {
    expect(Object.keys(GARDEN_PLACES).sort()).toEqual([...GARDEN_PLACE_KEYS].sort());
    expect(GARDEN_PLACE_KEYS).toEqual(["fire", "hall", "gate", "library", "greenhouse", "store", "tower", "spring", "stage", "ceiba"]);
  });

  it("names each place and says what it holds, with no two names the same", () => {
    const names = GARDEN_PLACE_KEYS.map((k) => i18n._(GARDEN_PLACES[k].name));
    expect(names).toEqual(["The Fire", "The Hall", "The Gate", "The Library", "The Greenhouse", "The Store", "The Tower", "The Spring", "The Stage", "The Ceiba"]);
    expect(new Set(names).size).toBe(10);
    for (const k of GARDEN_PLACE_KEYS) expect(i18n._(GARDEN_PLACES[k].holds).length, k).toBeGreaterThan(0);
  });

  it("puts each place on the land by percentage, inside it, each on a spot of its own", () => {
    const spots = new Set<string>();
    for (const k of GARDEN_PLACE_KEYS) {
      const { x, y, w } = GARDEN_PLACES[k];
      expect(x, k).toBeGreaterThan(0);
      expect(x, k).toBeLessThan(100);
      expect(y, k).toBeGreaterThanOrEqual(0);
      expect(y, k).toBeLessThan(80);
      expect(w, k).toBeGreaterThan(0);
      // garden.css gives each place a column at most 26% of the land wide, centred on x:
      // the building fits its column, and the column never leaves the land.
      expect(w, k).toBeLessThanOrEqual(26);
      expect(x, k).toBeGreaterThanOrEqual(13);
      expect(x, k).toBeLessThanOrEqual(87);
      spots.add(`${x},${y}`);
    }
    expect(spots.size).toBe(10);
  });

  it("has two paintings for every place in the art table", () => {
    for (const k of GARDEN_PLACE_KEYS) {
      expect(gardenArtFiles()).toContain(`${k}.webp`);
      expect(gardenArtFiles()).toContain(`${k}-scaffold.webp`);
    }
  });

  it("tidies a typed name: trimmed, one space, never past the longest allowed", () => {
    expect(tidyPlaceName("  The   Long\nHouse ")).toBe("The Long House");
    expect(tidyPlaceName("   ")).toBe("");
    expect(tidyPlaceName("x".repeat(90))).toHaveLength(PLACE_NAME_MAX);
  });
});

describe("what the garden's stylesheet promises a host page", () => {
  /** The first rule for one selector, as `property: value` pairs. */
  const rule = (selector: string): Record<string, string> => {
    const at = gardenCss.indexOf(`${selector} {`);
    expect(at, `${selector} has a rule`).toBeGreaterThanOrEqual(0);
    const body = gardenCss.slice(gardenCss.indexOf("{", at) + 1, gardenCss.indexOf("}", at));
    return Object.fromEntries(
      body
        .split(";")
        .map((d) => d.trim())
        .filter(Boolean)
        .map((d) => [d.slice(0, d.indexOf(":")).trim(), d.slice(d.indexOf(":") + 1).trim()]),
    );
  };

  it("paints its own ground, so its night ink never lands on a host page that is still light", () => {
    // Measured before this rule: a heading drawn straight on the scope read 1.01 to 1 on a white admin root.
    const garden = rule(".garden");
    expect(garden["background-color"]).toBe("var(--garden-ground)");
    expect(garden.color).toBe("var(--garden-ink)");
  });

  it("re-orders nothing: what is drawn is the document's own order, so the frame alone decides where the dock stands", () => {
    // No rule anywhere pulls a thing ahead or pushes it behind by `order`. Docked in two columns the dock used to be
    // drawn second while standing first in the document; the frame now puts it second in the document (frame.tsx).
    expect(gardenCss).not.toMatch(/(?:^|[\s;{])order\s*:/);
    // And the frame's own two-column rules place nothing by hand either: the grid fills in the document's order.
    const flat = gardenCss.replace(/\r\n/g, "\n");
    const wide = flat.slice(flat.indexOf(`@container (min-width: ${GARDEN_FRAME_TWO_COLUMNS_REM}rem)`));
    expect(wide).toContain('.gd-frame[data-dock="docked"] .gd-frame-body');
    expect(wide).not.toMatch(/grid-(?:column|row|area)(?:-start|-end)?\s*:|(?:row|column)-reverse|direction\s*:\s*rtl/);
  });

  it("lays the two columns out from the same width the frame orders the document by: one number, two readers", () => {
    const flat = gardenCss.replace(/\r\n/g, "\n");
    // The container rule that holds the docked columns, whatever its number is.
    const columns = flat.indexOf('.gd-frame[data-dock="docked"] .gd-frame-body');
    expect(columns).toBeGreaterThan(0);
    const open = flat.lastIndexOf("@container", columns);
    expect(flat.slice(open, flat.indexOf("{", open)).trim()).toBe(`@container (min-width: ${GARDEN_FRAME_TWO_COLUMNS_REM}rem)`);
    expect(GARDEN_FRAME_TWO_COLUMNS_REM).toBe(64);
    // Measured on the frame's own width, which is what the frame observes: never the window's.
    expect(rule(".gd-frame")["container-type"]).toBe("inline-size");
    // There is one such rule: no second width at which the layout changes without the document following.
    expect(flat.match(/@container \(min-width: 64rem\)/g)).toHaveLength(1);
  });

  it("fills and ticks a walked stone, so it never reads as an empty box", () => {
    expect(rule('[data-state="walked"] > .gd-stone')["background-color"]).toContain("var(--garden-stone-walked)");
    expect(rule('[data-state="walked"] > .gd-stone::after')["border-width"]).toBe("0 2px 2px 0");
  });

  /**
   * THE COMPACT GROUNDS (the overseer, for the founder: on a new village's first evening the land has to be seen as
   * land on a laptop). With the dock expanded what you see sits in two fifths of the width, where the full map has
   * no room; the compact one does.
   */
  describe("the compact grounds", () => {
    const COMPACT = ':is(.gd-grounds[data-compact="true"], .gd-frame[data-dock="expanded"] .gd-frame-main .gd-grounds)';
    // One line ending, whichever the checkout has.
    const flat = gardenCss.replace(/\r\n/g, "\n");
    const open = flat.indexOf("@container (min-width: 28rem)");
    const block = flat.slice(open, flat.indexOf("\n}\n", open));

    it("is asked for by hand or by the frame's expanded dock, and by a container query, never the window's width", () => {
      expect(open).toBeGreaterThan(0);
      // Every rule in the block is for the compact map and nothing else.
      const selectors = block.split("\n").filter((l) => /\{\s*$/.test(l) && !l.startsWith("@container"));
      expect(selectors.length).toBeGreaterThan(8);
      for (const line of selectors) expect(line.trim().startsWith(COMPACT), line).toBe(true);
      // Smaller than the full map's own threshold, so it draws where the full one cannot.
      expect(gardenCss.indexOf("@container (min-width: 38rem)")).toBeGreaterThan(0);
      expect(gardenCss.match(/@media/g)).toHaveLength(1);
    });

    it("puts each place on its own spot by the same percentages, in the same column of 26% of the land", () => {
      expect(block).toContain("left: calc(var(--gd-x) * 1%);");
      expect(block).toContain("top: calc(var(--gd-y) * 1%);");
      expect(block).toContain("width: min(12rem, 26cqw);");
      // The full map is tall by rule; the compact one takes the height its width gives it.
      expect(block).toMatch(/\.gd-land \{\s*aspect-ratio: 10 \/ 9;\s*min-height: 0;\s*max-height: none;/);
    });

    it("shows the name and the lantern on one line and nothing more, on the plaque's wood", () => {
      // The lantern keeps its own size while the words beside it take none; they are in the place's spoken name.
      expect(block).toMatch(/\.gd-place-line \{[^}]*font-size: 0;/);
      expect(block).toMatch(/\.gd-plaque > span:not\(\.gd-place-name, \.gd-place-line\) \{\s*display: none;/);
      expect(block).toMatch(/\.gd-plaque \{[^}]*flex-direction: row-reverse;[^}]*background-color: var\(--garden-wood\);/);
      // Never pulled ahead by order: the plaque's own direction puts the lantern first.
      expect(block).not.toMatch(/(?:^|[\s;{])order:/);
    });

    it("keeps a place a full finger tall", () => {
      expect(block).toMatch(/\.gd-place\[data-lens="grounds"\] \{[^}]*min-height: 2\.75rem;/);
    });
  });

  /**
   * THE DOCK'S PLACE AND THE MAP'S SIZE ARE THE FRAME'S (the overseer's review of the first photographs: the slot
   * gave the dock no height, so a host had to wrap it; and docked at 1440 by 900 the map's last row fell under the
   * fold).
   */
  describe("the dock's slot and the map's size", () => {
    const flat = gardenCss.replace(/\r\n/g, "\n");
    const wide = flat.slice(flat.indexOf("@container (min-width: 64rem)"));

    it("gives the dock's slot a bounded height in one column, so the places below it stay within reach", () => {
      expect(flat).toMatch(/\n\.gd-frame-dock \{\s*height: min\(36rem, 78dvh\);/);
    });

    it("fills the window under the band in two columns, never too short for the talk box, and stays put", () => {
      expect(wide).toMatch(
        /\.gd-frame-dock \{\s*position: sticky;\s*top: calc\(var\(--gd-frame-top, 0px\) \+ 0\.75rem\);\s*align-self: start;\s*height: max\(24rem, calc\(100dvh - var\(--gd-frame-top, 0px\) - var\(--gd-frame-above, 4\.5rem\) - 1\.5rem\)\);/,
      );
      // The allowance is a band of one row WITH its switches (72px): measured, a 56px one left the slot 3px under the fold.
    });

    it("gives the slot its own edge, so what is passed as the dock only has to fill it", () => {
      expect(flat).toMatch(/\n\.gd-frame-dock \{[^}]*overflow: hidden;[^}]*border-radius: 1rem;/);
    });

    it("bounds the map's WIDTH by the height the window has left, so the land keeps its shape and the whole map scales together", () => {
      expect(flat).toMatch(/\.gd-grounds \{\s*container-type: inline-size;\s*max-width: max\(44rem, calc\(\(100dvh - var\(--gd-grounds-above, 10rem\)\) \* 10 \/ 9\)\);\s*margin-inline: auto;/);
      // The land's own shape and the pictures' sizing are untouched: nothing is squeezed by height.
      expect(flat).toMatch(/\.gd-land \{\s*aspect-ratio: 10 \/ 9;\s*min-height: 44rem;/);
      expect(flat).toContain("calc(var(--gd-w) * 1cqw)");
    });

    it("draws the view switch only where the frame has two columns: nothing to switch where she is first and the places follow", () => {
      // Hidden by its own rule, and drawn inside the frame's two-column container rule, never by the window's width.
      expect(flat).toMatch(/\n\.gd-view \{\s*display: none;\s*\}/);
      expect(wide).toMatch(/\.gd-view \{\s*display: flex;\s*\}/);
      expect(flat.slice(0, flat.indexOf("@container (min-width: 64rem)"))).not.toMatch(/\.gd-view \{\s*display: flex;/);
    });

    it("does all of it with the window's own units and container rules: still one @media, the reduced-motion guard", () => {
      expect(gardenCss.match(/@media/g)).toHaveLength(1);
    });
  });

  /**
   * THE GROUND BEHIND THE PLACES, AND ITS PICKER (the founder, 28 Nov 2026). The land is never blank: its painted
   * colours are its own and no rule takes them away; the one picture is a layer over them. A picked ground is drawn,
   * and so fetched, only where the places are a map, and the picker is drawn only there too.
   */
  describe("the ground behind the places, and its picker", () => {
    const COMPACT = ':is(.gd-grounds[data-compact="true"], .gd-frame[data-dock="expanded"] .gd-frame-main .gd-grounds)';
    const flat = gardenCss.replace(/\r\n/g, "\n");
    /** One container rule's whole block, by its condition. */
    const containerBlock = (condition: string) => {
      const open = flat.indexOf(`@container (${condition})`);
      expect(open, condition).toBeGreaterThan(0);
      return flat.slice(open, flat.indexOf("\n}\n", open));
    };
    const fullMap = containerBlock("min-width: 38rem");
    const smallMap = containerBlock("min-width: 28rem");
    /** Everything that holds at every width: the stylesheet with its container rules and its one @media taken out. */
    const everywhere = flat.replace(/@(?:container|media)[^{]*\{[\s\S]*?\n\}\n/g, "");

    it("paints the land from the tokens alone: gradients over a solid ground, and no picture among them", () => {
      const land = /\n\.gd-land \{([^}]*)\}/.exec(everywhere)?.[1] ?? "";
      expect(land).toMatch(/background-color: var\(--garden-band\);/);
      expect(land).toMatch(/background-image:[^;]*linear-gradient\(var\(--garden-ground\), var\(--garden-ground\)\);/);
      expect(land).not.toContain("url(");
      expect(land).not.toContain("--gd-land-image");
      // No other rule anywhere gives the land a background, so nothing can take its colours away.
      const others = Array.from(flat.matchAll(/([^{}\n]*\.gd-land) \{([^}]*)\}/g)).filter((m) => /background/.test(m[2]));
      expect(others.map((m) => m[1].trim())).toEqual([".gd-land"]);
    });

    it("lays the one picture over the land as a layer of its own, at a little over half its strength", () => {
      const layer = /\n\.gd-land::before \{([^}]*)\}/.exec(everywhere)?.[1] ?? "";
      expect(layer).toMatch(/position: absolute;\s*inset: 0;/);
      expect(layer).toMatch(/background-size: cover;\s*background-position: center;/);
      expect(layer).toMatch(/pointer-events: none;/);
      // THE VEIL: the land's own night shows through the picture. One number, in one place.
      expect(layer).toMatch(/opacity: 0\.58;/);
      expect(gardenCss.match(/opacity:/g)).toHaveLength(2); // this, and the building under scaffolding
      // A picture that never arrives draws nothing: the layer has no colour of its own to leave behind.
      expect(layer).not.toMatch(/background-color|background:/);
    });

    it("names a picked ground only where the places are a map, so where they are rows it is neither drawn nor fetched", () => {
      // At every width the layer makes no box and names no picture...
      const layer = /\n\.gd-land::before \{([^}]*)\}/.exec(everywhere)?.[1] ?? "";
      expect(layer).toMatch(/content: none;/);
      expect(layer).not.toContain("--gd-land-image");
      // ...but for a village's own land art, drawn at every width as it always was.
      expect(everywhere).toMatch(/\n\.gd-land\[data-land="own"\]::before \{\s*content: "";\s*background-image: var\(--gd-land-image, none\);\s*\}/);
      expect(everywhere.match(/--gd-land-image/g)).toHaveLength(1);
      // The map's own container rules draw it: the full map, and the small one.
      expect(fullMap).toMatch(/\n  \.gd-land::before \{\s*content: "";\s*background-image: var\(--gd-land-image, none\);\s*\}/);
      expect(smallMap).toContain(`${COMPACT} .gd-land::before {\n    content: "";\n    background-image: var(--gd-land-image, none);\n  }`);
      expect(gardenCss.match(/--gd-land-image/g)).toHaveLength(3);
    });

    it("draws the picker only where a ground is drawn: never where the places are rows, and by container rules alone", () => {
      // Standing alone (a settings page) the picker is drawn; in the Grounds' own row it waits for the map.
      expect(everywhere).toMatch(/\n\.gd-ground-picker \{\s*display: flex;/);
      expect(everywhere).toMatch(/\n\.gd-grounds-head \.gd-ground-picker \{\s*display: none;\s*\}/);
      expect(fullMap).toMatch(/\n  \.gd-grounds-head \.gd-ground-picker \{\s*display: flex;\s*\}/);
      expect(smallMap).toContain(`${COMPACT} .gd-grounds-head .gd-ground-picker {\n    display: flex;\n  }`);
      // The window's width decides none of it.
      expect(gardenCss.match(/@media/g)).toHaveLength(1);
    });

    it("gives the land back the height the picker's line takes, so the picker never pushes the map under the fold", () => {
      expect(flat).toMatch(/\n\.gd-grounds\[data-picker="true"\] \{\s*max-width: max\(44rem, calc\(\(100dvh - var\(--gd-grounds-above, 10rem\) - 1\.75rem\) \* 10 \/ 9\)\);\s*\}/);
      // The row above the land: the heading where it starts, the picker where it ends, wrapping where there is no room.
      expect(everywhere).toMatch(/\n\.gd-grounds-head \{\s*display: flex;\s*flex-wrap: wrap;\s*align-items: flex-end;\s*justify-content: space-between;/);
    });
  });
});

/**
 * THE WAY TO THE OLD ADMIN, AND BACK (./oldAdmin.tsx). The way back is drawn OUTSIDE the garden's night, on the old
 * admin page, so it may read nothing of the garden's. Its words and their underline are the page's own text colour
 * (`text-foreground`), with no fill and no edge of its own. What must hold, then, is each page's own pair: its ink on
 * the surfaces it draws, in both mode palettes. In the band the same class is the garden's ink on the band.
 */
describe("the way to the old admin, and back: readable in the band and outside the garden", () => {
  const P = palette();

  it("draws from the page's own tokens: its text colour for the words, and nothing only the garden defines", () => {
    const classes = GARDEN_EXIT.split(" ");
    expect(classes).toContain("text-foreground");
    // No fill and no edge: nothing of its own to be unreadable against.
    expect(classes.filter((c) => /bg-|border/.test(c))).toEqual([]);
    expect(GARDEN_EXIT).not.toMatch(/gd-|--garden|var\(|notice/);
    // A full finger tall, with the journey button's focus ring, which is the page's own --ring.
    expect(classes).toEqual(expect.arrayContaining(["jw-btn", "min-h-11"]));
    expect(indexCss).toMatch(/\.jw-btn:focus-visible \{\s*outline: 2px solid var\(--ring\);/);
  });

  it.each([
    ["day, on the page", "--pal-day-ink", "--pal-day-ground"],
    ["day, on a panel", "--pal-day-ink", "--pal-day-panel"],
    ["day, on a tile", "--pal-day-ink", "--pal-day-panel-raised"],
    ["night, on the page", "--pal-night-ink", "--pal-night-ground"],
    ["night, on a panel", "--pal-night-ink", "--pal-night-panel"],
    ["night, on a tile", "--pal-night-ink", "--pal-night-panel-raised"],
    ["night, on the band", "--pal-night-ink", "--pal-night-band"],
  ])("outside the garden, the page's own ink is readable: %s", (_where, ink, ground) => {
    expect(P[ink], ink).toBeDefined();
    expect(P[ground], ground).toBeDefined();
    const ratio = contrastRatio(P[ink], P[ground]);
    expect(ratio, `${P[ink]} on ${P[ground]} is ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(TEXT);
  });

  it("in the band, the same class is the garden's ink on the band, and its focus ring the garden's gold", () => {
    expect(TOKENS["--foreground"]).toBe("var(--garden-ink)");
    expect(TOKENS["--ring"]).toBe("var(--garden-gold)");
    expect(contrastRatio(token("ink"), token("band"))).toBeGreaterThanOrEqual(TEXT);
    expect(contrastRatio(token("gold"), token("band"))).toBeGreaterThanOrEqual(MARK);
  });
});
