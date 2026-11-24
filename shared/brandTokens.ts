/**
 * THE DESIGN TOKEN LAYER (docs/DESIGN_TOKENS_SPEC.md, as amended).
 *
 * A founder makes THREE decisions — a seed colour, a character card, a
 * sentence about their place — and everything visual derives: the palette
 * with its semantic roles, the corner radius, the type pairing, and (later)
 * the image-generation prompt. This is "design the system, not 200 images"
 * made executable: two villages running identical code look like themselves,
 * not like each other, from three inputs a non-designer can give.
 *
 * Two rules this module enforces by construction:
 *
 * NEUTRAL BY DEFAULT. No seed = no output. An untouched fork emits nothing
 * from here and renders pixel-identically to the platform's shipped CSS —
 * a fresh village must look like nobody in particular, never like the first
 * tenant (spec §2.3, and the whole point of the white-label rule).
 *
 * CONTRAST IS MEASURED, NEVER EXCUSED (amendment A3). Every derived pairing
 * is checked against WCAG 2.1; under the default "enforce" policy a failing
 * role is ADJUSTED (the seed keeps its hue, loses its lightness) and reported
 * as such. The report never claims "ok" for anything it did not compute.
 *
 * All colour math is here, dependency-free: hex ↔ HSL for derivation and the
 * WCAG relative-luminance formula for truth. HSL is crude next to OKLCH, but
 * every derived LIGHTNESS is chosen by binary search against the WCAG ratio
 * itself, so perceptual crudeness costs harmony at worst — never legibility.
 */

// ── Colour math ──────────────────────────────────────────────────────────────

export interface Hsl { h: number; s: number; l: number }

export function hexToHsl(hex: string): Hsl | null {
  const m = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h =
    max === r ? ((g - b) / d + (g < b ? 6 : 0)) * 60 :
    max === g ? ((b - r) / d + 2) * 60 :
    ((r - g) / d + 4) * 60;
  return { h, s, l };
}

export function hslToHex({ h, s, l }: Hsl): string {
  const hue = ((h % 360) + 360) % 360;
  const f = (n: number) => {
    const k = (n + hue / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    const c = l - a * Math.max(-1, Math.min(k - 3, Math.min(9 - k, 1)));
    return Math.round(c * 255).toString(16).padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

/** WCAG 2.1 relative luminance of a hex colour. */
export function luminance(hex: string): number {
  const m = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return 0;
  const n = parseInt(m[1], 16);
  const chan = (v: number) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * chan((n >> 16) & 255) + 0.7152 * chan((n >> 8) & 255) + 0.0722 * chan(n & 255);
}

/** WCAG contrast ratio between two hex colours: 1 (none) to 21 (black/white). */
export function contrastRatio(a: string, b: string): number {
  const la = luminance(a), lb = luminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * The seed at a lightness where `against` text clears `ratio`. Binary search
 * on L against the WCAG formula itself — hue and saturation survive, so the
 * village's colour stays THEIRS; only its legibility is non-negotiable.
 */
export function atContrast(seed: Hsl, against: string, ratio: number, darker = true): Hsl {
  let lo = darker ? 0 : seed.l;
  let hi = darker ? seed.l : 1;
  let best = { ...seed, l: darker ? 0.2 : 0.9 };
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    const candidate = { ...seed, l: mid };
    const ok = contrastRatio(hslToHex(candidate), against) >= ratio;
    if (ok) {
      best = candidate;
      // ok: move toward the seed's own lightness to change it as little as possible
      if (darker) lo = mid; else hi = mid;
    } else {
      if (darker) hi = mid; else lo = mid;
    }
  }
  return best;
}

// ── The character cards ──────────────────────────────────────────────────────

/**
 * One card bundles exactly the choices a non-designer gets wrong when asked
 * separately: radius, type pairing, surface warmth, palette intensity. Six
 * moods, all in the platform's register. The card also carries the WORLD
 * words the image prompt will use when generation lands — the same choice
 * that rounds your corners will light your illustrations.
 */
export interface CharacterCard {
  id: string;
  label: string;
  hint: string;
  radiusRem: number;
  /** Degrees the accent hue sits from the seed. */
  accentRotation: number;
  /** Multiplies derived-step saturation. The seed itself is never touched. */
  chromaMul: number;
  surface: "light" | "warm" | "deep";
  /** FONT_CATALOG ids (shared/fontCatalog.ts) — display / body / accent. */
  fonts: [string, string, string];
  /** WORLD clause for the future prompt grammar. Brand-neutral by CI. */
  world: string;
}

export const CHARACTER_CARDS: CharacterCard[] = [
  { id: "quiet",    label: "Quiet",    hint: "Restrained, spacious, lets the work speak.",          radiusRem: 0.5,  accentRotation: 30,  chromaMul: 0.7, surface: "light", fonts: ["raleway", "montserrat", "kalam"],          world: "soft even light, muted natural palette, calm negative space" },
  { id: "handmade", label: "Handmade", hint: "Warm, imperfect, close to the materials.",            radiusRem: 0.75, accentRotation: 45,  chromaMul: 0.9, surface: "warm",  fonts: ["josefin-sans", "nunito-sans", "caveat"],   world: "warm afternoon light, textured natural materials, hand-crafted detail" },
  { id: "field",    label: "Field",    hint: "Open air, working land, boots on.",                   radiusRem: 0.375,accentRotation: -40, chromaMul: 1.0, surface: "light", fonts: ["raleway", "nunito-sans", "kalam"],         world: "clear daylight, wide horizons, growing things in rows and hedges" },
  { id: "woven",    label: "Woven",    hint: "Layered, communal, many hands in the pattern.",       radiusRem: 1.0,  accentRotation: 60,  chromaMul: 1.1, surface: "warm",  fonts: ["cormorant-garamond", "montserrat", "caveat"], world: "interlaced patterns, gathered textiles, dappled communal light" },
  { id: "coastal",  label: "Coastal",  hint: "Bright water, salt air, easy movement.",              radiusRem: 0.75, accentRotation: -25, chromaMul: 1.0, surface: "light", fonts: ["josefin-sans", "montserrat", "caveat"],    world: "bright reflected light, water and sky, weathered timber" },
  { id: "civic",    label: "Civic",    hint: "Steady, inscriptional, built to be read aloud.",      radiusRem: 0.25, accentRotation: 15,  chromaMul: 0.8, surface: "deep",  fonts: ["marcellus", "montserrat", "kalam"],        world: "monumental calm, stone and timber, long shadows and clear geometry" },
];

export function cardById(id: string | undefined | null): CharacterCard | null {
  return CHARACTER_CARDS.find((c) => c.id === id) ?? null;
}

// ── Derivation ───────────────────────────────────────────────────────────────

export interface ContrastPair { name: string; fg: string; bg: string; ratio: number; wanted: number; verdict: "pass" | "adjusted" | "fail" }
export interface ContrastReport {
  /** "unverified" whenever anything was NOT computed — never silently "ok" (A3). */
  status: "ok" | "adjusted" | "fail" | "unverified";
  worstRatio: number;
  pairs: ContrastPair[];
}

export interface DerivedTheme {
  /** CSS custom properties, ready for :root:root emission. */
  vars: Record<string, string>;
  contrast: ContrastReport;
  card: CharacterCard;
  /** Font stacks the card implies (explicit theme.font* fields beat these). */
  fonts: { display: string; body: string; accent: string };
  /** The scheme the page is drawn in (`theme.mode`). Light unless a village chose dark. */
  mode: ThemeMode;
  /**
   * In the dark scheme only: the light palette Admin keeps (Admin is light by
   * ruling, 2026-09-04). themeCss emits it on `.admin-root`. Null in light.
   */
  lightVars: Record<string, string> | null;
}

// ── The scheme, and the colours a village sets itself (gap G1) ─────────────

/**
 * `theme.mode` (DESIGN_TOKENS_SPEC §3.2). Only the exact word "dark" turns the
 * page dark; anything else, absent included, is light, so a stray value can
 * never repaint a village.
 */
export type ThemeMode = "light" | "dark";
export function themeModeOf(raw: unknown): ThemeMode {
  return raw === "dark" ? "dark" : "light";
}

/**
 * The slots `theme.overrides` may set (DESIGN_TOKENS_SPEC §3.3). A closed list:
 * a key outside it is dropped, so an override can only ever name a colour the
 * platform already reads. Colour slots take `#rrggbb`; `--radius` takes rem.
 */
export const OVERRIDE_SLOTS = [
  "--background", "--foreground", "--card", "--card-foreground", "--popover", "--popover-foreground",
  "--primary", "--primary-foreground", "--primary-hover", "--secondary", "--secondary-foreground",
  "--accent", "--accent-foreground", "--muted", "--muted-foreground", "--border", "--input", "--ring",
  "--destructive", "--destructive-foreground", "--sidebar", "--sidebar-foreground",
  "--chart-1", "--chart-2", "--chart-3", "--chart-4", "--chart-5",
  "--tone-brand", "--tone-brand-hover", "--tone-brand-mid", "--tone-brand-soft", "--tone-brand-text",
  "--tone-brand-band", "--tone-sun", "--tone-sun-on-band", "--tone-mist", "--tone-mist-light", "--tone-cream",
  "--radius",
] as const;
export type OverrideSlot = (typeof OVERRIDE_SLOTS)[number];
const OVERRIDE_SET: ReadonlySet<string> = new Set(OVERRIDE_SLOTS);

/**
 * The stored `theme.overrides` map, cleaned. Keys may be written with or
 * without the leading `--`. A value that is not a 6-digit hex (or, for the
 * radius, a number of rem from 0 to 1.5) is dropped, never repaired: the
 * stylesheet is built from what survives, so nothing here reaches CSS raw.
 */
export function sanitizeOverrides(raw: unknown): Partial<Record<OverrideSlot, string>> {
  const out: Partial<Record<OverrideSlot, string>> = {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
  for (const [k0, v0] of Object.entries(raw as Record<string, unknown>)) {
    const k = (k0.startsWith("--") ? k0 : `--${k0}`) as OverrideSlot;
    if (!OVERRIDE_SET.has(k)) continue;
    if (k === "--radius") {
      const n = typeof v0 === "number" ? v0 : typeof v0 === "string" ? Number(v0.trim().replace(/rem$/, "")) : NaN;
      if (Number.isFinite(n) && n >= 0 && n <= 1.5) out[k] = `${Math.round(n * 1000) / 1000}rem`;
      continue;
    }
    if (typeof v0 === "string" && /^#[0-9a-f]{6}$/i.test(v0.trim())) out[k] = v0.trim().toLowerCase();
  }
  return out;
}

/**
 * The legible partner for a ground: the current ink when it already clears
 * `floor`, otherwise whichever of a dark or a light ink of the ground's own
 * hue reads better, pushed until it clears. Used when a village sets a ground
 * and leaves its ink to the platform (the `enforce` policy, §3.2).
 */
export function inkOn(groundHex: string, currentInk: string | undefined, floor: number): string {
  if (currentInk && /^#[0-9a-f]{6}$/i.test(currentInk) && contrastRatio(currentInk, groundHex) >= floor) return currentInk;
  const g = hexToHsl(groundHex) ?? { h: 0, s: 0, l: 0.5 };
  const dark = hslToHex(atContrast({ h: g.h, s: Math.min(0.45, g.s), l: 0.14 }, groundHex, floor, true));
  const light = hslToHex(atContrast({ h: g.h, s: Math.min(0.3, g.s), l: 0.95 }, groundHex, floor, false));
  return contrastRatio(dark, groundHex) >= contrastRatio(light, groundHex) ? dark : light;
}

/** The ground a pair of grounds shares the worst text on: the one an ink reads least well against. */
function hardestGround(ink: string, grounds: string[]): string {
  return grounds.reduce((worst, g) => (contrastRatio(ink, g) < contrastRatio(ink, worst) ? g : worst), grounds[0]);
}

/** An ink of `hue` that clears `floor` on every ground given, by moving lighter (dark scheme). */
function lightInkOnAll(seed: Hsl, grounds: string[], floor: number): string {
  let hex = hslToHex(seed);
  for (let i = 0; i < 4; i++) {
    const g = hardestGround(hex, grounds);
    if (contrastRatio(hex, g) >= floor) break;
    hex = hslToHex(atContrast(hexToHsl(hex)!, g, floor, false));
  }
  return hex;
}

/**
 * THE GAME TOKENS (gap G3): colours the new modules and the game surfaces read
 * beyond the slots (paper for anything sworn or signed, a stamp's inks, the
 * map's water and land, the three places a quest happens). A closed list; each
 * one names the slot a component falls back to when the village sets nothing,
 * written `var(--paper, var(--card))` at the point of use. Nothing is emitted
 * for a token a village did not set, so its fallback stands.
 */
export const GAME_TOKENS = {
  "paper": "--card",
  "paper-2": "--muted",
  "paper-foreground": "--card-foreground",
  "paper-muted": "--muted-foreground",
  "success": "--color-sage",
  "ceremony": "--secondary",
  "seal": "--destructive",
  "stamp-alt": "--color-sage",
  "surface-deep": "--background",
  "glow": "--muted",
  "place-1": "--chart-2",
  "place-2": "--primary",
  "place-3": "--secondary",
  "map-sea": "--background",
  "map-land": "--card",
  "map-line": "--border",
  "map-water": "--chart-2",
  "map-grid": "--border",
  "map-fog": "--background",
  "destructive": "--destructive",
  // Light mode, the day palette (client/src/index.css, `[data-mode="light"] .sheet-night`).
  "day-ground": "--background",
  "day-panel": "--card",
  "day-panel-raised": "--muted",
  "day-ink": "--foreground",
  "day-ink-dim": "--muted-foreground",
  "day-edge": "--border",
  "day-accent": "--primary",
  "day-heading": "--foreground",
  "day-band": "--background",
  "day-sky": "--background",
  "day-rule": "--border",
  // Dark mode, the night palette: the sheet's own roles, set exactly instead of derived.
  "sheet-ground": "--sheet-ground",
  "sheet-panel": "--sheet-panel",
  "sheet-panel-raised": "--sheet-panel-raised",
  "sheet-ink": "--sheet-ink",
  "sheet-ink-dim": "--sheet-ink-dim",
  "sheet-edge": "--sheet-edge",
  "sheet-earned": "--sheet-earned",
  "sheet-earned-highlight": "--sheet-earned-highlight",
  "sheet-earned-shadow": "--sheet-earned-shadow",
  "night-band": "--sheet-ground",
} as const satisfies Record<string, string>;
export type GameToken = keyof typeof GAME_TOKENS;

/** The stored `theme.tokens` map, cleaned: known names only, 6-digit hex only. `font-label` is a stack, cleaned by themeCss. */
export function sanitizeGameTokens(raw: unknown): Partial<Record<GameToken, string>> {
  const out: Partial<Record<GameToken, string>> = {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
  for (const [k0, v0] of Object.entries(raw as Record<string, unknown>)) {
    const k = k0.replace(/^--/, "") as GameToken;
    if (!(k in GAME_TOKENS)) continue;
    if (typeof v0 === "string" && /^#[0-9a-f]{6}$/i.test(v0.trim())) out[k] = v0.trim().toLowerCase();
  }
  return out;
}

/**
 * The light ink literals index.css ships for the status colours (`@theme
 * inline`). The dark scheme lifts each one for the night page, and Admin's
 * light zone puts these back. brandTokens.test.ts holds them to index.css.
 */
export const LIGHT_STATUS_INKS: Record<string, string> = {
  "--color-sage": "#3d6e4a",
  "--color-coral": "#9b4030",
  "--color-amber-ink": "#8d5e19",
  "--color-gold": "#a06b1c",
  "--sheet-notice": "#8d5e19",
  "--sheet-open": "#3d6e4a",
};
/** index.css `:root`'s destructive pair, which Admin's light zone keeps. */
export const LIGHT_DESTRUCTIVE: Record<string, string> = {
  "--destructive": "oklch(0.577 0.245 27.325)",
  "--destructive-foreground": "oklch(0.985 0 0)",
};

const AA_BODY = 4.5;
const AA_LARGE = 3.0;

/**
 * How far a hover moves from the brand, as the WCAG ratio between the two
 * grounds. The platform's own neutral pair, #404040 at rest and #262626 under
 * the pointer, is 1.46; Tailwind's blue-600 to blue-700 is 1.30. This sits
 * between them, so every village's hover reads as a change at least as clearly
 * as those do.
 */
export const HOVER_STEP = 1.4;

/**
 * What the MUTED ink must clear on the darkest light tone this file emits,
 * `--tone-mist-light` (the `bg-aqua-light` band). It used to be derived
 * against `--muted` alone, and pages put it on darker grounds than that:
 * measured on the live site 2026-10-20, 12 public routes at 4.08 to 4.49:1,
 * on the aqua-light band (4.33) and on the 5 to 20% sage, amber, coral and
 * brand washes pages lay over the background.
 * 4.5 on mist-light alone fixed only the band; 5.0 leaves the room those
 * washes take: the 4.08 to 4.49 grounds measure 4.76 to 5.24 after it. On
 * Amora the ink moves from #436f61 to #3d6457, the same grey-green a shade
 * deeper. The one wash it cannot carry is a 20% sage gradient (/good-neighbor,
 * 4.10), which is that page's to fix, not the palette's.
 */
export const MUTED_ON_TINT = 5.0;

/**
 * Derive everything from (seed, card). Returns null when seed is absent or
 * invalid — the neutral case, which MUST emit nothing.
 *
 * `accentHex` is the one optional pinned colour (Admin, Look). A card finds
 * its accent by turning the seed's hue a fixed step, and no step turns a deep
 * green into gold. A village whose guide names its accent passes it here: its
 * hue and saturation are kept as given, and its lightness still goes through
 * the same measurements as a derived accent (ink on it, and it as a label on
 * the band). An absent or invalid value falls back to the card's rotation,
 * so a stray string can only ever cost the village its pin, never the page.
 */
export function deriveTheme(
  seedHex: string | undefined | null,
  cardId: string | undefined | null,
  accentHex?: string | null,
  options?: { mode?: unknown; overrides?: unknown; tokens?: unknown } | null,
): DerivedTheme | null {
  const seed = seedHex ? hexToHsl(seedHex) : null;
  if (!seed) return null;
  // The stored theme is merged blindly on write, so the type is a hope here.
  const pinnedAccent = typeof accentHex === "string" && accentHex ? hexToHsl(accentHex) : null;
  const card = cardById(cardId) ?? CHARACTER_CARDS[0];

  const sat = (mul: number) => Math.max(0.04, Math.min(0.95, seed.s * card.chromaMul * mul));
  const pairs: ContrastPair[] = [];
  let adjusted = false;

  const measured = (name: string, fgHex: string, bgHex: string, wanted: number, wasAdjusted: boolean): void => {
    const ratio = contrastRatio(fgHex, bgHex);
    const verdict: ContrastPair["verdict"] = ratio >= wanted ? (wasAdjusted ? "adjusted" : "pass") : "fail";
    if (wasAdjusted) adjusted = true;
    pairs.push({ name, fg: fgHex, bg: bgHex, ratio: Math.round(ratio * 100) / 100, wanted, verdict });
  };

  // brand: the seed, at a lightness where white text clears AA body. This is
  // "enforce": the hue is the village's, the legibility is the platform's.
  const brandTarget = { ...seed, s: sat(1) };
  const brand = atContrast(brandTarget, "#ffffff", AA_BODY, true);
  const brandHex = hslToHex(brand);
  measured("white on brand", "#ffffff", brandHex, AA_BODY, Math.abs(brand.l - seed.l) > 0.02);

  /*
   * THE BRAND UNDER THE POINTER. A primary button is white text on `brand`,
   * and it needs a hover colour a member can SEE that still carries the white.
   * No tone here did both. The soft tone is where 17 buttons used to hover, and
   * white on it is 1.67 to 3.00:1. A translucent brand (`/90`, `opacity-90`)
   * lifts toward the page, and `brand` above is derived so white only just
   * clears 4.5, so the fade dropped 28 of 55 villages below it (3.79 worst).
   * The band is darker or equal, and it is EQUAL whenever the accent already
   * clears on the brand: 8 of 54 themes, where a hover to it changes nothing.
   *
   * So the hover is the brand moved by a fixed step, HOVER_STEP, measured as
   * the WCAG ratio between the two grounds. It goes DARKER when there is room,
   * which can only raise white's contrast. A brand so dark that no darker
   * colour sits a step away (a near-black seed) goes lighter by the same step
   * instead, and the step is small enough that white still clears AA body on
   * it with room to spare. Both directions keep the seed's hue and saturation.
   */
  const darkerHover = atContrast(brand, brandHex, HOVER_STEP, true);
  const brandHover =
    darkerHover.l < brand.l && contrastRatio(hslToHex(darkerHover), brandHex) >= HOVER_STEP
      ? darkerHover
      : atContrast(brand, brandHex, HOVER_STEP, false);
  const brandHoverHex = hslToHex(brandHover);
  measured("white on brand hover", "#ffffff", brandHoverHex, AA_BODY, false);

  // ink: near-black of the seed's hue, forced past AAA-ish on the background.
  const surfaces = {
    light: { bg: { h: seed.h, s: 0.04, l: 0.95 }, card: { h: 0, s: 0, l: 1 } },
    warm:  { bg: { h: 45, s: 0.28, l: 0.93 }, card: { h: 45, s: 0.35, l: 0.97 } },
    deep:  { bg: { h: seed.h, s: 0.08, l: 0.92 }, card: { h: 0, s: 0, l: 1 } },
  }[card.surface];
  const bgHex = hslToHex(surfaces.bg);
  const cardHex = hslToHex(surfaces.card);
  const ink = atContrast({ h: seed.h, s: Math.min(0.45, seed.s), l: 0.2 }, bgHex, 7, true);
  const inkHex = hslToHex(ink);
  measured("ink on background", inkHex, bgHex, AA_BODY, false);
  measured("ink on card", inkHex, cardHex, AA_BODY, false);

  // accent (sun): rotated hue, used for chips and highlights carrying ink.
  // Enforced upward: some rotations land in hues that are perceptually dark
  // at the same nominal lightness (teal+45° → blue read 2.65:1 under ink),
  // so the accent RISES until the ink clears large-text contrast on it.
  // A pinned accent starts from its own colour and is held to the same floor.
  const sunStart = pinnedAccent ?? { h: seed.h + card.accentRotation, s: sat(1.05), l: 0.62 };
  const sun = atContrast(sunStart, inkHex, AA_LARGE, false);
  const sunHex = hslToHex(sun);
  measured("ink on accent", inkHex, sunHex, AA_LARGE, Math.abs(sun.l - sunStart.l) > 0.02);

  /*
   * THE ACCENT AS A LABEL ON THE BRAND SURFACE — the pairing this file did not
   * have, and the reason fifteen section eyebrows shipped at 2.53:1. `sun` above
   * is derived for ink to sit ON it. The client also does the opposite: the
   * accent AS TEXT, on the brand band. Nothing measured that, so nothing caught
   * it, and the header of this file was still telling the truth: it measures the
   * pairings it DERIVES, and that one was composed in JSX.
   *
   * Naively lifting the accent until it clears does not work, and the simulation
   * says so: `brand` is already derived so that WHITE only just clears 4.5 on it,
   * so no saturated colour can clear 4.5 above it without becoming white. Across
   * 72 seed x card combinations, lifting alone washed 34 accents past L 0.92.
   * Darkening the band alone is no better at the other end: a navy seed drove its
   * band to L 0.02, which is not navy any more, it is black.
   *
   * So BOTH MOVE, one step each, and the search stops the moment the pair clears.
   * Neither colour carries the whole cost. Measured over the same 72:
   *
   *     accents washed near-white   34 -> 0
   *     bands driven near-black      6 (from 1 catastrophic) and none below L 0.02
   *     worst pairing              4.51:1, max deviation 0.185 L on either side
   *     white on the deepened band 5.36:1 worst, so white text only gets safer
   *
   * That is the A3 philosophy applied to a pair rather than to one colour: the
   * village's hues stay theirs, and the legibility is non-negotiable.
   */
  const bandSeed = hexToHsl(brandHex)!;
  let brandBand = bandSeed;
  let sunOnBand = sun;
  for (let i = 0; i <= 100; i++) {
    const step = i * 0.005;
    brandBand = { ...bandSeed, l: Math.max(0, bandSeed.l - step) };
    sunOnBand = { ...sun, l: Math.min(1, sun.l + step) };
    if (contrastRatio(hslToHex(sunOnBand), hslToHex(brandBand)) >= AA_BODY) break;
  }
  const brandBandHex = hslToHex(brandBand);
  const sunOnBandHex = hslToHex(sunOnBand);
  measured("accent label on brand band", sunOnBandHex, brandBandHex, AA_BODY, brandBand.l < bandSeed.l - 0.001);
  measured("white on brand band", "#ffffff", brandBandHex, AA_BODY, false);

  // Soft steps — decorative tints, checked only where text sits on them.
  // brand-mid carries white text in hovers and secondary chips, so it is not
  // a blind lightness offset: it rises toward brand.l+0.14 only as far as
  // white-at-3:1 allows. A neon seed taught this — its mid at +0.14 measured
  // 2.28:1 and the report correctly refused to say "ok".
  const brandMid = hslToHex(
    atContrast({ ...brand, l: Math.min(0.55, brand.l + 0.14) }, "#ffffff", AA_LARGE, true),
  );
  const brandSoft = hslToHex({ h: seed.h, s: sat(0.55), l: 0.66 });
  const mist = hslToHex({ h: seed.h + 12, s: sat(0.35), l: 0.62 });
  const mistLight = hslToHex({ h: seed.h + 12, s: sat(0.3), l: 0.87 });
  const cream = card.surface === "warm" ? hslToHex({ h: 45, s: 0.4, l: 0.9 }) : hslToHex({ h: seed.h, s: sat(0.2), l: 0.91 });
  const border = hslToHex({ h: seed.h, s: sat(0.3), l: 0.82 });
  const mutedBg = hslToHex({ h: seed.h, s: sat(0.25), l: 0.92 });
  // Derived against the DARKER of the two light tones muted text lands on, at
  // MUTED_ON_TINT, so it holds on the band and on a page's light wash too.
  const mutedGround = contrastRatio("#000000", mistLight) < contrastRatio("#000000", mutedBg) ? mistLight : mutedBg;
  const mutedFg = atContrast({ h: seed.h, s: sat(0.6), l: 0.35 }, mutedGround, MUTED_ON_TINT, true);
  measured("muted text on muted", hslToHex(mutedFg), mutedBg, AA_BODY, false);
  measured("muted text on mist-light", hslToHex(mutedFg), mistLight, AA_BODY, false);
  measured("white on brand-mid (large only)", "#ffffff", brandMid, AA_LARGE, false);

  /*
   * THE NIGHT, from the same seed. The role card (playerCard.css `.pc-night`),
   * the owner's character sheet and Admin's Night look are one dark surface
   * that reads the `--sheet-*` layer. index.css always documented that layer
   * as the village's knob, and nothing wrote it, so every village's card was
   * the approved forest and gold whatever its Look said (Rye, 2026-11-09: the
   * role card must "pull from the same color palette being delivered by the
   * admin section").
   *
   * The approved design is the template. Its grounds keep the design's
   * lightness and (at most) its saturation, and take the seed's HUE, so a
   * forest village gets the design back almost exactly and a blue village gets
   * a blue night. The gold takes the accent's hue. Inks are then enforced
   * against the lightest ground they sit on (the raised panel), at the floors
   * the design was measured at: ink 7, dim and gold 4.5, edges 3.
   * An unseeded village returns early above and keeps the design's literals,
   * which are each `var(--sheet-*, <design>)`'s fallback.
   */
  const nightSat = Math.min(0.212, seed.s);
  const nightHue = seed.h;
  const nightGround = hslToHex({ h: nightHue, s: nightSat, l: 0.065 });
  const nightPanel = hslToHex({ h: nightHue, s: nightSat, l: 0.11 });
  const nightRaised = hslToHex({ h: nightHue, s: nightSat, l: 0.139 });
  const nightLine = hslToHex({ h: nightHue, s: Math.min(0.157, seed.s), l: 0.2 });
  const nightEdge = hslToHex(atContrast({ h: nightHue, s: Math.min(0.084, seed.s), l: 0.467 }, nightRaised, AA_LARGE, false));
  const nightInk = hslToHex(atContrast({ h: nightHue, s: Math.min(0.22, seed.s), l: 0.92 }, nightRaised, 7, false));
  const nightDim = hslToHex(atContrast({ h: nightHue, s: Math.min(0.112, seed.s), l: 0.651 }, nightRaised, AA_BODY, false));
  const goldSat = Math.max(0.35, Math.min(0.8, sun.s * 1.3));
  // The gold also sits on a 14% wash of itself (a proposal's changed words,
  // playerCard.css `.pc-changed`), and that wash greys a ground whose hue is far
  // from the gold's. So the gold rises until it clears its own wash too.
  const washOf = (hex: string, alpha: number, under: string): string => {
    const ch = (x: string, i: number) => parseInt(x.slice(1 + i * 2, 3 + i * 2), 16);
    const mix = [0, 1, 2].map((i) => Math.round(ch(hex, i) * alpha + ch(under, i) * (1 - alpha)));
    return `#${mix.map((n) => n.toString(16).padStart(2, "0")).join("")}`;
  };
  const NIGHT_WASH = 0.14;
  let goldL = hexToHsl(hslToHex(atContrast({ h: sun.h, s: goldSat, l: 0.588 }, nightRaised, AA_BODY, false)))!.l;
  while (goldL < 0.97 && contrastRatio(hslToHex({ h: sun.h, s: goldSat, l: goldL }), washOf(hslToHex({ h: sun.h, s: goldSat, l: goldL }), NIGHT_WASH, nightRaised)) < AA_BODY) goldL += 0.005;
  const nightGold = hslToHex({ h: sun.h, s: goldSat, l: goldL });
  const nightGoldLit = hslToHex(atContrast({ h: sun.h, s: Math.min(0.85, goldSat * 1.16), l: Math.max(0.735, goldL) }, nightRaised, AA_BODY, false));
  const rgbaOf = (hex: string, alpha: number) =>
    `rgba(${parseInt(hex.slice(1, 3), 16)}, ${parseInt(hex.slice(3, 5), 16)}, ${parseInt(hex.slice(5, 7), 16)}, ${alpha})`;
  const nightGoldDeep = hslToHex({ h: sun.h, s: Math.min(0.8, goldSat * 0.97), l: 0.251 });
  measured("night ink on night raised", nightInk, nightRaised, AA_BODY, false);
  measured("night ink-dim on night raised", nightDim, nightRaised, AA_BODY, false);
  measured("night gold on night raised", nightGold, nightRaised, AA_BODY, false);
  measured("night ground on night gold", nightGround, nightGold, AA_BODY, false);
  measured("night edge on night raised", nightEdge, nightRaised, AA_LARGE, false);
  measured("night gold on its own wash", nightGold, washOf(nightGold, NIGHT_WASH, nightRaised), AA_BODY, false);

  // Each pair now CARRIES the floor it was judged against. This used to sniff the
  // name for "large" or "accent", which happened to be right for the six pairings
  // that existed and would have quietly mis-scored the next one added: "accent
  // label on brand band" is an AA_BODY pairing whose name contains "accent".
  const worst = Math.min(...pairs.map((p) => p.ratio / p.wanted));
  const anyFail = pairs.some((p) => p.verdict === "fail");
  const contrast: ContrastReport = {
    status: anyFail ? "fail" : adjusted ? "adjusted" : "ok",
    worstRatio: Math.round(Math.min(...pairs.map((p) => p.ratio)) * 100) / 100,
    pairs,
  };
  void worst;

  const vars: Record<string, string> = {
    // The tone layer — index.css aliases the historical colour names to these.
    "--tone-brand": brandHex,
    // The primary button's hover partner: a visible step from --tone-brand,
    // carrying white at AA body for every seed. Derived above.
    "--tone-brand-hover": brandHoverHex,
    "--tone-brand-mid": brandMid,
    "--tone-brand-soft": brandSoft,
    "--tone-mist": mist,
    "--tone-mist-light": mistLight,
    "--tone-cream": cream,
    "--tone-sun": sunHex,
    // The band, and the accent that is legible AS TEXT on it. Derived as a pair
    // above, because neither one alone can carry the contrast without ceasing to
    // be a colour the village would recognise.
    "--tone-brand-band": brandBandHex,
    "--tone-sun-on-band": sunOnBandHex,
    // The shadcn semantic set (already runtime vars in :root).
    "--primary": brandHex,
    "--primary-foreground": "#ffffff",
    "--ring": brandHex,
    "--background": bgHex,
    "--foreground": inkHex,
    "--card": cardHex,
    "--card-foreground": inkHex,
    "--popover": cardHex,
    "--popover-foreground": inkHex,
    "--secondary": sunHex,
    "--secondary-foreground": inkHex,
    "--accent": brandSoft,
    "--accent-foreground": inkHex,
    "--muted": mutedBg,
    "--muted-foreground": hslToHex(mutedFg),
    "--border": border,
    "--input": mutedBg,
    "--sidebar": cream,
    "--sidebar-foreground": inkHex,
    "--sidebar-primary": brandHex,
    "--sidebar-primary-foreground": "#ffffff",
    "--sidebar-accent": mutedBg,
    "--sidebar-accent-foreground": inkHex,
    "--sidebar-border": border,
    "--sidebar-ring": brandHex,
    "--chart-1": brandHex,
    "--chart-2": brandSoft,
    "--chart-3": mist,
    "--chart-4": sunHex,
    "--chart-5": mistLight,
    "--radius": `${card.radiusRem}rem`,
    // The night layer (role card, character sheet, Admin Night look). Derived above.
    "--sheet-ground": nightGround,
    "--sheet-panel": nightPanel,
    "--sheet-panel-raised": nightRaised,
    "--sheet-line": nightLine,
    "--sheet-edge": nightEdge,
    "--sheet-ink": nightInk,
    "--sheet-ink-dim": nightDim,
    "--sheet-earned": nightGold,
    "--sheet-earned-highlight": nightGoldLit,
    "--sheet-earned-shadow": nightGoldDeep,
    // The gold washes the card lays under gold words (playerCard.css).
    "--sheet-earned-wash": rgbaOf(nightGold, NIGHT_WASH),
    "--sheet-earned-wash-soft": rgbaOf(nightGold, 0.06),
    "--sheet-earned-highlight-wash": rgbaOf(nightGoldLit, 0.1),
    "--sheet-earned-highlight-wash-soft": rgbaOf(nightGoldLit, 0.02),
  };

  const mode = themeModeOf(options?.mode);
  const overrides = sanitizeOverrides(options?.overrides);
  const tokens = sanitizeGameTokens(options?.tokens);
  // A village that chose neither a dark page nor a colour of its own gets
  // exactly what every village got before either existed.
  if (mode === "light" && Object.keys(overrides).length === 0 && Object.keys(tokens).length === 0) {
    return { vars, contrast, card, fonts: cardFontStacks(card), mode, lightVars: null };
  }
  const night = { ground: nightGround, panel: nightPanel, raised: nightRaised, ink: nightInk, dim: nightDim, edge: nightEdge, gold: nightGold };
  return withScheme({ vars, nightPairs: pairs.filter((p) => p.name.startsWith("night ")), adjusted, seed, sat, night, mode, overrides, tokens, card });
}

/**
 * THE DARK SCHEME AND THE VILLAGE'S OWN COLOURS (gap G1).
 *
 * The night layer above was always the dark world: the role card, the sheet
 * and Admin's Night look draw on it, and index.css said promoting it to the
 * page was "a move, not a rewrite". In the dark scheme this is that move. The
 * page's grounds and inks become the night's, the status inks are lifted to
 * read on them, and the primary is found where its ink reads best, dark ink on
 * a light primary when that is the better pair, so a gold button carries dark
 * ink instead of white.
 *
 * Overrides then set any slot from OVERRIDE_SLOTS exactly. A ground a village
 * sets keeps its ink only if that ink still clears; otherwise the ink is
 * derived for it (`enforce`). An ink a village sets is kept as given. Every
 * pair the page draws is then MEASURED on the final values, so an override
 * can fail, and the report says so (amendment A3): choosing exact colours
 * costs the guarantee, visibly.
 */
function withScheme(i: {
  vars: Record<string, string>;
  nightPairs: ContrastPair[];
  adjusted: boolean;
  seed: Hsl;
  sat: (mul: number) => number;
  night: { ground: string; panel: string; raised: string; ink: string; dim: string; edge: string; gold: string };
  mode: ThemeMode;
  overrides: Partial<Record<OverrideSlot, string>>;
  tokens: Partial<Record<GameToken, string>>;
  card: CharacterCard;
}): DerivedTheme {
  const { night, mode, overrides, seed } = i;
  const out: Record<string, string> = { ...i.vars };
  const set = (k: string) => k in overrides;

  if (mode === "dark") {
    Object.assign(out, {
      "--background": night.ground,
      "--foreground": night.ink,
      "--card": night.panel,
      "--card-foreground": night.ink,
      "--popover": night.panel,
      "--popover-foreground": night.ink,
      "--muted": night.raised,
      "--muted-foreground": night.dim,
      "--accent": night.raised,
      "--accent-foreground": night.ink,
      "--border": night.edge,
      "--input": night.edge,
      "--ring": night.gold,
      "--sidebar": night.panel,
      "--sidebar-foreground": night.ink,
      "--sidebar-accent": night.raised,
      "--sidebar-accent-foreground": night.ink,
      "--sidebar-border": night.edge,
      "--sidebar-ring": night.gold,
    });
    // The primary: the seed's hue, lifted until it reads as a shape on a
    // panel (3:1) and a dark ink of its own hue clears AA body on it. Most
    // seeds land on a light primary with dark ink; that is the dark scheme's
    // convention, and it is what lets gold be the button.
    let p: Hsl = { h: seed.h, s: i.sat(1), l: Math.max(0.5, seed.l) };
    for (let n = 0; n < 50; n++) {
      const hex = hslToHex(p);
      const ink = inkOn(hex, undefined, AA_BODY);
      // Room for the hover too: one step darker must still carry the ink.
      const hover = hslToHex(atContrast(p, hex, HOVER_STEP, true));
      if (contrastRatio(hex, night.panel) >= AA_LARGE && contrastRatio(ink, hex) >= AA_BODY && contrastRatio(ink, hover) >= AA_BODY) break;
      p = { ...p, l: Math.min(0.95, p.l + 0.01) };
    }
    out["--primary"] = hslToHex(p);
    out["--primary-foreground"] = inkOn(out["--primary"], undefined, AA_BODY);
  }

  for (const [k, v] of Object.entries(overrides)) out[k] = v as string;

  // Inks follow their grounds unless the village set the ink too.
  const PARTNERS: Array<[string, string]> = [
    ["--background", "--foreground"],
    ["--card", "--card-foreground"],
    ["--popover", "--popover-foreground"],
    ["--primary", "--primary-foreground"],
    ["--secondary", "--secondary-foreground"],
    ["--accent", "--accent-foreground"],
    ["--sidebar", "--sidebar-foreground"],
    ["--destructive", "--destructive-foreground"],
  ];
  for (const [ground, ink] of PARTNERS) {
    if (!out[ground] || set(ink)) continue;
    if (set(ground) || mode === "dark") out[ink] = inkOn(out[ground], out[ink], AA_BODY);
  }
  // Muted text lands on the page, the card and the muted panel alike.
  if (!set("--muted-foreground")) {
    const grounds = [out["--muted"], out["--card"], out["--background"]];
    const mf = out["--muted-foreground"];
    if (grounds.some((g) => contrastRatio(mf, g) < AA_BODY)) {
      const hardest = hardestGround(mf, grounds);
      const lighter = luminance(hardest) < 0.18;
      out["--muted-foreground"] = lighter
        ? lightInkOnAll(hexToHsl(mf)!, grounds, AA_BODY)
        : hslToHex(atContrast(hexToHsl(mf)!, hardest, AA_BODY, true));
    }
  }
  // A border the village did not set is re-measured against the panels it
  // edges (WCAG 1.4.11, 3:1), so an overridden card never strands it.
  if (mode === "dark" && !set("--border")) {
    const edges = [out["--card"], out["--muted"], out["--background"]];
    if (edges.some((g) => contrastRatio(out["--border"], g) < AA_LARGE)) {
      out["--border"] = lightInkOnAll(hexToHsl(out["--border"])!, edges, AA_LARGE);
      if (!set("--input")) out["--input"] = out["--border"];
      if (!("--sidebar-border" in overrides)) out["--sidebar-border"] = out["--border"];
    }
  }
  if (!set("--sidebar-primary") && (set("--primary") || mode === "dark")) {
    out["--sidebar-primary"] = out["--primary"];
    out["--sidebar-primary-foreground"] = out["--primary-foreground"];
  }

  // The primary under the pointer, carrying the primary's own ink. Emitted
  // only here: a light village with no overrides hovers to --tone-brand-hover
  // as before, and index.css falls back to it. Darker when the ink allows it
  // (Rye, 2026-09-21: hover goes darker, never back to the soft tone).
  if (!set("--primary-hover") && (set("--primary") || set("--primary-foreground") || mode === "dark")) {
    const prim = out["--primary"];
    const fg = out["--primary-foreground"];
    const ph = hexToHsl(prim)!;
    const darker = hslToHex(atContrast(ph, prim, HOVER_STEP, true));
    const lighter = hslToHex(atContrast(ph, prim, HOVER_STEP, false));
    out["--primary-hover"] =
      contrastRatio(fg, darker) >= AA_BODY && luminance(darker) < luminance(prim) ? darker
      : contrastRatio(fg, lighter) >= AA_BODY ? lighter
      : prim;
  }

  if (mode === "dark") {
    const grounds = [out["--background"], out["--card"], out["--muted"]];
    // The brand as TEXT on the night page (`text-teal-deep`). --tone-brand
    // itself stays dark enough to carry white, because `bg-teal-deep
    // text-white` is how most of the app draws a brand button.
    if (!set("--tone-brand-text")) out["--tone-brand-text"] = lightInkOnAll(hexToHsl(out["--tone-brand"])!, grounds, AA_BODY);
    // The status inks index.css ships are dark inks measured on white. On the
    // night page they lift, keeping their hues; .sheet-night measured these
    // roles first (living green, warn, gold).
    const status: Record<string, Hsl> = {
      "--color-sage": { h: 140, s: 0.42, l: 0.6 },
      "--color-coral": { h: 14, s: 0.68, l: 0.63 },
      "--color-amber-ink": hexToHsl(night.gold)!,
      "--color-gold": hexToHsl(night.gold)!,
    };
    for (const [k, start] of Object.entries(status)) out[k] = lightInkOnAll(start, grounds, AA_BODY);
    out["--sheet-notice"] = out["--color-amber-ink"];
    out["--sheet-open"] = out["--color-sage"];
    if (!set("--destructive")) out["--destructive"] = out["--color-coral"];
    if (!set("--destructive-foreground")) out["--destructive-foreground"] = inkOn(out["--destructive"], out["--background"], AA_BODY);
  }

  // Every pair the page draws, measured on what is emitted.
  const pairs: ContrastPair[] = [...i.nightPairs];
  const m = (name: string, fg: string | undefined, bg: string | undefined, wanted: number) => {
    if (!fg || !bg || !/^#[0-9a-f]{6}$/i.test(fg) || !/^#[0-9a-f]{6}$/i.test(bg)) return;
    const ratio = contrastRatio(fg, bg);
    pairs.push({ name, fg, bg, ratio: Math.round(ratio * 100) / 100, wanted, verdict: ratio >= wanted ? "pass" : "fail" });
  };
  m("ink on background", out["--foreground"], out["--background"], AA_BODY);
  m("ink on card", out["--card-foreground"], out["--card"], AA_BODY);
  m("ink on popover", out["--popover-foreground"], out["--popover"], AA_BODY);
  m("muted text on muted", out["--muted-foreground"], out["--muted"], AA_BODY);
  m("muted text on card", out["--muted-foreground"], out["--card"], AA_BODY);
  m("muted text on background", out["--muted-foreground"], out["--background"], AA_BODY);
  m("primary ink on primary", out["--primary-foreground"], out["--primary"], AA_BODY);
  m("primary ink on primary hover", out["--primary-foreground"], out["--primary-hover"], AA_BODY);
  m("ink on accent", out["--secondary-foreground"], out["--secondary"], AA_BODY);
  m("accent ink on accent", out["--accent-foreground"], out["--accent"], AA_BODY);
  m("white on brand", "#ffffff", out["--tone-brand"], AA_BODY);
  m("white on brand hover", "#ffffff", out["--tone-brand-hover"], AA_BODY);
  m("white on brand band", "#ffffff", out["--tone-brand-band"], AA_BODY);
  m("accent label on brand band", out["--tone-sun-on-band"], out["--tone-brand-band"], AA_BODY);
  m("focus ring on background", out["--ring"], out["--background"], AA_LARGE);
  m("destructive ink on destructive", out["--destructive-foreground"], out["--destructive"], AA_BODY);
  if (mode === "light") m("muted text on mist-light", out["--muted-foreground"], out["--tone-mist-light"], AA_BODY);
  // A border is measured where it is the village's choice or the night's
  // (WCAG 1.4.11, 3:1); the light derivation's soft hairline is decoration.
  if (mode === "dark" || set("--border")) m("border on card", out["--border"], out["--card"], AA_LARGE);
  if (mode === "dark") {
    for (const g of ["--background", "--card", "--muted"] as const) {
      m(`brand text on ${g.slice(2)}`, out["--tone-brand-text"], out[g], AA_BODY);
      m(`positive ink on ${g.slice(2)}`, out["--color-sage"], out[g], AA_BODY);
      m(`warning ink on ${g.slice(2)}`, out["--color-coral"], out[g], AA_BODY);
      m(`notice ink on ${g.slice(2)}`, out["--color-amber-ink"], out[g], AA_BODY);
    }
    m("destructive text on background", out["--destructive"], out["--background"], AA_BODY);
  }

  // The game tokens a village set, after the slots, each pair that carries
  // text measured on what the page will draw. A token's partner is the one
  // the village set, or the slot it falls back to.
  const tok = (k: GameToken): string | undefined => i.tokens[k] ?? out[GAME_TOKENS[k]] ?? (k === "success" || k === "stamp-alt" ? out["--color-sage"] ?? LIGHT_STATUS_INKS["--color-sage"] : undefined);
  for (const [k, v] of Object.entries(i.tokens)) {
    if (k === "destructive") out["--destructive"] = v as string;
    else out[`--${k}`] = v as string;
  }
  const anyToken = Object.keys(i.tokens).length > 0;
  if (anyToken) {
    const inkOnPaper: GameToken[] = ["paper-foreground", "paper-muted", "seal", "stamp-alt"];
    if (["paper", "paper-2", ...inkOnPaper].some((k) => k in i.tokens)) {
      for (const k of inkOnPaper) {
        m(`${k} on paper`, tok(k), tok("paper"), AA_BODY);
        m(`${k} on paper-2`, tok(k), tok("paper-2"), k === "paper-foreground" || k === "paper-muted" ? AA_BODY : AA_LARGE);
      }
    }
    // The two mode palettes, measured as the page will draw them: text on every
    // surface, the main act on the panel, and the edge as a boundary.
    const day = ["day-ground", "day-panel", "day-panel-raised", "day-ink", "day-ink-dim", "day-edge", "day-accent", "day-heading"] as GameToken[];
    if (day.some((k) => k in i.tokens)) {
      for (const g of ["day-ground", "day-panel", "day-panel-raised"] as GameToken[]) {
        m(`day ink on ${g}`, tok("day-ink"), tok(g), AA_BODY);
        m(`day quiet ink on ${g}`, tok("day-ink-dim"), tok(g), AA_BODY);
        m(`day accent on ${g}`, tok("day-accent"), tok(g), AA_BODY);
      }
      m("day heading on day-ground", tok("day-heading"), tok("day-ground"), AA_LARGE);
      m("day edge on day-panel", tok("day-edge"), tok("day-panel"), AA_LARGE);
    }
    const night = ["sheet-ground", "sheet-panel", "sheet-panel-raised", "sheet-ink", "sheet-ink-dim", "sheet-edge", "sheet-earned"] as GameToken[];
    if (night.some((k) => k in i.tokens)) {
      for (const g of ["sheet-ground", "sheet-panel", "sheet-panel-raised"] as GameToken[]) {
        m(`night ink on ${g}`, tok("sheet-ink"), tok(g), AA_BODY);
        m(`night quiet ink on ${g}`, tok("sheet-ink-dim"), tok(g), AA_BODY);
        m(`night gold on ${g}`, tok("sheet-earned"), tok(g), AA_BODY);
      }
      m("night edge on sheet-panel", tok("sheet-edge"), tok("sheet-panel"), AA_LARGE);
    }
    for (const k of ["success", "ceremony"] as GameToken[]) {
      if (k in i.tokens) {
        m(`${k} on background`, tok(k), out["--background"], AA_BODY);
        m(`${k} on card`, tok(k), out["--card"], AA_LARGE);
      }
    }
  }

  const anyFail = pairs.some((p) => p.verdict === "fail");
  const contrast: ContrastReport = {
    status: anyFail ? "fail" : i.adjusted ? "adjusted" : "ok",
    worstRatio: Math.round(Math.min(...pairs.map((p) => p.ratio)) * 100) / 100,
    pairs,
  };
  if (overrides["--radius"]) out["--radius"] = overrides["--radius"];
  return {
    vars: out,
    contrast,
    card: i.card,
    fonts: cardFontStacks(i.card),
    mode,
    // Admin's light zone: the light derivation as it stands, the status inks
    // and the destructive colour index.css ships, and the light hover (the
    // dark primary's hover would otherwise reach Admin's buttons).
    lightVars: mode === "dark"
      ? { ...i.vars, ...LIGHT_STATUS_INKS, ...LIGHT_DESTRUCTIVE, "--primary-hover": i.vars["--tone-brand-hover"] }
      : null,
  };
}

/** Resolve a card's FONT_CATALOG ids to full stacks without importing the
 * catalogue here (shared→shared import cycles bite); the caller joins them.
 * STACKS mirrors every catalogue offering, and shared/fontCatalog.test.ts
 * fails when an offering is added there and forgotten here. */
export function cardFontStacks(card: CharacterCard): { display: string; body: string; accent: string } {
  const STACKS: Record<string, string> = {
    "raleway": '"Raleway", system-ui, sans-serif',
    "josefin-sans": '"Josefin Sans", "Raleway", system-ui, sans-serif',
    "cormorant-garamond": '"Cormorant Garamond", Georgia, serif',
    "playfair-display": '"Playfair Display", Georgia, serif',
    "marcellus": '"Marcellus", Georgia, serif',
    "montserrat": '"Montserrat", -apple-system, BlinkMacSystemFont, sans-serif',
    "nunito-sans": '"Nunito Sans", -apple-system, BlinkMacSystemFont, sans-serif',
    "raleway-body": '"Raleway", system-ui, sans-serif',
    "jost": '"Jost", -apple-system, BlinkMacSystemFont, sans-serif',
    "kalam": '"Kalam", cursive',
    "caveat": '"Caveat", cursive',
    "pinyon-script": '"Pinyon Script", cursive',
  };
  const [d, b, a] = card.fonts;
  return {
    display: STACKS[d] ?? STACKS["raleway"],
    body: STACKS[b] ?? STACKS["montserrat"],
    accent: STACKS[a] ?? STACKS["kalam"],
  };
}
