/**
 * The light and dark modes' grounds and bands, as hex, for the places that
 * cannot read a CSS variable: the install manifest and the home-screen icon.
 *
 * The palette itself lives in client/src/index.css ("THE MODE PALETTES"); these
 * are copies of four of its lines, and client/src/lib/modePalettes.test.ts
 * fails if a copy and its line part. Change the line there and here together.
 */
export const MODE_PALETTE = {
  dayGround: "#f3ebdd", // --pal-day-ground
  dayBand: "#ead7b4", // --pal-day-band
  nightGround: "#14362b", // --pal-night-ground
  nightBand: "#0c241c", // --pal-night-band
} as const;
