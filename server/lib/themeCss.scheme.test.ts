/**
 * THE DARK SCHEME AND A VILLAGE'S OWN COLOURS (gap G1), end to end through the
 * stylesheet, the shell and the install manifest.
 *
 * The first test is the promise every other village relies on: a village that
 * sets neither `theme.mode` nor `theme.overrides` gets theme.css byte for byte
 * as it was. The fingerprint below was computed by origin/main's own
 * buildThemeCss (5fc1b94) over the same 120 seed, card and accent combinations,
 * so a change to the light derivation fails here by name.
 */
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { contrastRatio, deriveTheme, LIGHT_STATUS_INKS, OVERRIDE_SLOTS, sanitizeOverrides } from "../../shared/brandTokens";
import { buildThemeCss, darkScheme, installBackground, installThemeColour, withScheme } from "./themeCss";
import fs from "node:fs";
import path from "node:path";

const SEEDS = ["#16342a", "#0b1a1e", "#e9b84a", "#157f7d", "#6e7376", "#262626", "#ff00aa", "#1e3a8a", "#f5f5f5", "#7c2d12"];
const CARDS = ["quiet", "handmade", "field", "woven", "coastal", "civic"];

/** The target values a dark village loads (a night sea, deck-green panels, a gold primary with dark ink). */
const DARK_TARGET = {
  background: "#0b1a1e", foreground: "#f4ead4", card: "#173a2a", popover: "#173a2a", sidebar: "#173a2a",
  "card-foreground": "#f4ead4", muted: "#1f4a35", "muted-foreground": "#a9babc", secondary: "#e3793b",
  "secondary-foreground": "#2a1a05", "chart-2": "#8ec5ff", "chart-3": "#8fdc84", destructive: "#ff8a7a",
  "tone-cream": "#f4ead4", primary: "#e9b84a", "primary-foreground": "#2a1a05", "primary-hover": "#d9a73a",
  "tone-brand-soft": "#f6d27d", ring: "#e9b84a", radius: "1rem",
};

describe("a village that sets neither mode nor overrides", () => {
  it("gets main's theme.css byte for byte, across 120 seeds, cards and accents", () => {
    const out: Record<string, string> = {};
    for (const s of SEEDS) for (const c of CARDS) for (const a of ["", "#e9b84a"]) {
      const css = buildThemeCss({ seed: s, character: c, accent: a, fontDisplay: '"IM Fell English", Georgia, serif' });
      out[`${s}|${c}|${a}`] = createHash("sha1").update(css).digest("hex").slice(0, 12);
    }
    expect(createHash("sha1").update(JSON.stringify(out)).digest("hex")).toBe("b968dd4bf690b9e3b43501022bbe2f4b20e52372");
  });

  it("reads the same with an explicit light mode and an empty override map", () => {
    for (const s of SEEDS) for (const c of CARDS) {
      expect(buildThemeCss({ seed: s, character: c, mode: "light", overrides: {} })).toBe(buildThemeCss({ seed: s, character: c }));
      expect(buildThemeCss({ seed: s, character: c, mode: "nonsense" as string })).toBe(buildThemeCss({ seed: s, character: c }));
    }
  });

  it("leaves the shell and the install manifest exactly as they were", () => {
    const shell = '<html lang="en"><meta name="theme-color" content="#0d1411" /><style>html{background-color:#0d1411;color-scheme:dark}</style>';
    expect(withScheme(shell, darkScheme({ seed: "#16342a", character: "woven" }))).toBe(shell);
    expect(installBackground({ seed: "#16342a" })).toBe("#ffffff");
    expect(installThemeColour({ seed: "#16342a" })).toBe(buildThemeCss({ seed: "#16342a" }).match(/--tone-brand: (#[0-9a-f]{6})/)![1]);
    expect(installBackground(null)).toBe("#ffffff");
  });
});

describe("the dark scheme, derived from a seed alone", () => {
  it("passes every measured pair for every seed and card", () => {
    for (const s of SEEDS) for (const c of CARDS) {
      const d = deriveTheme(s, c, null, { mode: "dark" })!;
      const failing = d.contrast.pairs.filter((p) => p.verdict === "fail").map((p) => `${p.name} ${p.ratio}`);
      expect(failing, `${s} ${c}`).toEqual([]);
      expect(d.mode).toBe("dark");
      // A dark page: the ground is darker than its ink.
      expect(contrastRatio(d.vars["--background"], "#000000")).toBeLessThan(contrastRatio(d.vars["--foreground"], "#000000"));
    }
  });

  it("keeps the brand fill carrying white, and gives the brand a text colour that reads on the night", () => {
    for (const s of SEEDS) {
      const d = deriveTheme(s, "woven", null, { mode: "dark" })!;
      expect(contrastRatio("#ffffff", d.vars["--tone-brand"])).toBeGreaterThanOrEqual(4.5);
      for (const g of ["--background", "--card", "--muted"]) expect(contrastRatio(d.vars["--tone-brand-text"], d.vars[g])).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("hovers the primary darker, still carrying its ink", () => {
    for (const s of SEEDS) {
      const v = deriveTheme(s, "quiet", null, { mode: "dark" })!.vars;
      expect(contrastRatio(v["--primary-foreground"], v["--primary-hover"])).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(v["--primary-hover"], "#000000")).toBeLessThanOrEqual(contrastRatio(v["--primary"], "#000000"));
    }
  });

  it("emits the scheme, the marker and Admin's light zone", () => {
    const css = buildThemeCss({ seed: "#0b1a1e", character: "woven", mode: "dark" });
    expect(css).toMatch(/:root:root \{\n  color-scheme: dark;\n  --village-scheme: dark;/);
    const admin = css.slice(css.indexOf(".admin-root:not(.sheet-night) {"));
    expect(admin).toMatch(/color-scheme: light;/);
    // Admin keeps the light derivation and the status inks index.css ships.
    const light = deriveTheme("#0b1a1e", "woven")!.vars;
    expect(admin).toContain(`--background: ${light["--background"]};`);
    for (const [k, v] of Object.entries(LIGHT_STATUS_INKS)) expect(admin).toContain(`${k}: ${v};`);
    expect(admin).toContain(`--primary-hover: ${light["--tone-brand-hover"]};`);
  });

  it("marks the shell, paints its first frame in the village's ground, and gives the installer that ground", () => {
    const theme = { seed: "#0b1a1e", character: "woven", mode: "dark" };
    const ground = deriveTheme("#0b1a1e", "woven", null, { mode: "dark" })!.vars["--background"];
    const shell = '<!doctype html>\n<html lang="en">\n<meta name="theme-color" content="#0d1411" />\n<style>html{background-color:#0d1411;color-scheme:dark}</style>';
    const out = withScheme(shell, darkScheme(theme));
    expect(out).toContain('<html lang="en" data-scheme="dark">');
    expect(out).toContain(`<meta name="theme-color" content="${ground}" />`);
    expect(out).toContain(`<style>html{background-color:${ground};color-scheme:dark}</style>`);
    // Idempotent: a shell marked twice carries one mark.
    expect(withScheme(out, darkScheme(theme)).match(/data-scheme/g)).toHaveLength(1);
    expect(installBackground(theme)).toBe(ground);
    expect(installThemeColour(theme)).toBe(ground);
  });
});

describe("a village's own colours", () => {
  it("loads the dark target and passes every pair, with dark ink on the gold primary", () => {
    const d = deriveTheme("#0b1a1e", "woven", "#e9b84a", { mode: "dark", overrides: DARK_TARGET })!;
    expect(d.contrast.pairs.filter((p) => p.verdict === "fail")).toEqual([]);
    expect(d.vars["--primary"]).toBe("#e9b84a");
    expect(d.vars["--primary-foreground"]).toBe("#2a1a05");
    expect(d.vars["--background"]).toBe("#0b1a1e");
    expect(d.vars["--radius"]).toBe("1rem");
  });

  it("chooses the primary's ink by measured contrast when only the primary is set", () => {
    const light = deriveTheme("#16342a", "woven", null, { overrides: { primary: "#e9b84a" } })!;
    expect(contrastRatio(light.vars["--primary-foreground"], "#e9b84a")).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(light.vars["--primary-foreground"], "#000000")).toBeLessThan(contrastRatio("#ffffff", "#000000") / 2);
    // And a dark primary keeps white.
    const deep = deriveTheme("#16342a", "woven", null, { overrides: { primary: "#16342a" } })!;
    expect(deep.vars["--primary-foreground"]).toBe("#ffffff");
  });

  it("measures an override and reports a failing one by name (amendment A3)", () => {
    const d = deriveTheme("#16342a", "quiet", null, { overrides: { card: "#3f4a44", "card-foreground": "#2b2f2d" } })!;
    expect(d.contrast.status).toBe("fail");
    expect(d.contrast.pairs.find((p) => p.name === "ink on card")?.verdict).toBe("fail");
  });

  it("derives an ink for a ground a village sets and leaves the ink blank", () => {
    const d = deriveTheme("#16342a", "quiet", null, { overrides: { card: "#3f4a44" } })!;
    expect(contrastRatio(d.vars["--card-foreground"], "#3f4a44")).toBeGreaterThanOrEqual(4.5);
    expect(d.contrast.pairs.find((p) => p.name === "ink on card")?.verdict).toBe("pass");
  });

  it("keeps only the closed slot list and well-formed values", () => {
    expect(sanitizeOverrides({ "--primary": "#E9B84A", primary2: "#ffffff", "--card": "red", "--radius": "2", ring: "#e9b84a;}" })).toEqual({ "--primary": "#e9b84a" });
    expect(sanitizeOverrides({ radius: "0.75rem" })).toEqual({ "--radius": "0.75rem" });
    expect(sanitizeOverrides(["#fff"])).toEqual({});
    expect(sanitizeOverrides(null)).toEqual({});
    // Nothing outside the list ever reaches the stylesheet.
    const css = buildThemeCss({ seed: "#16342a", overrides: { "--evil": "#000000", "--primary": "#e9b84a" } as Record<string, string> });
    expect(css).not.toContain("--evil");
    expect(OVERRIDE_SLOTS).toContain("--primary-hover");
  });
});

describe("the light status inks Admin's light zone restores", () => {
  it("are the literals index.css ships", () => {
    const css = fs.readFileSync(path.resolve(__dirname, "../../client/src/index.css"), "utf8");
    for (const k of ["--color-sage", "--color-coral", "--color-amber-ink", "--color-gold"]) {
      const m = css.match(new RegExp(`^\\s*${k}: (#[0-9a-f]{6});`, "m"));
      expect(m?.[1], k).toBe(LIGHT_STATUS_INKS[k]);
    }
    expect(css).toMatch(/--color-notice: var\(--sheet-notice, #8d5e19\)/);
    expect(css).toMatch(/--color-open: var\(--sheet-open, #3d6e4a\)/);
  });
});
