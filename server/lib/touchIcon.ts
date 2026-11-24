/**
 * THE HOME-SCREEN ICON, AS THE PNG A PHONE CAN USE (public launch QA, 24 Nov 2026).
 *
 * `client/index.html` named an SVG as its `apple-touch-icon`, and the shell
 * swapped in the village's own favicon, which on most villages is an SVG too.
 * iOS ignores an SVG there: "Add to Home Screen" drew a blank tile or a
 * screenshot of the page. iOS wants a square PNG; 180px is the size it asks for.
 *
 * So the server renders one from whatever the village set as its favicon (an
 * SVG or a raster, through sharp, which the server already ships for uploads),
 * centred on a solid square: iOS paints a transparent corner black. White-label
 * by construction: the source is the village's own setting, and with none set it
 * is the platform's mark.
 */
import sharp from "sharp";

/** The size iOS asks for on every current iPhone and iPad. */
export const TOUCH_ICON_PX = 180;
/** Breathing room around the mark, as a share of the side, so iOS's rounded corners never cut it. */
export const TOUCH_ICON_INSET = 0.14;

/** A plain CSS colour sharp can read: #rgb or #rrggbb; anything else falls back to white. */
export function iconBackground(colour: string | null | undefined): string {
  const c = String(colour ?? "").trim();
  return /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(c) ? c : "#ffffff";
}

/** Render `source` (SVG or raster bytes) as a TOUCH_ICON_PX square PNG on `background`. */
export async function renderTouchIcon(source: Buffer, background: string): Promise<Buffer> {
  const inner = Math.round(TOUCH_ICON_PX * (1 - 2 * TOUCH_ICON_INSET));
  // density lifts an SVG's raster before the resize, so a small viewBox does not come out blurred.
  const mark = await sharp(source, { density: 384 })
    .resize(inner, inner, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  const ground = iconBackground(background);
  // Two passes: sharp composites last in a pipeline, so a flatten in the same pass would run first and
  // leave the alpha channel the composite brings back. iOS paints any transparency black.
  const composed = await sharp({ create: { width: TOUCH_ICON_PX, height: TOUCH_ICON_PX, channels: 4, background: ground } })
    .composite([{ input: mark, gravity: "centre" }])
    .png()
    .toBuffer();
  return sharp(composed).flatten({ background: ground }).png().toBuffer();
}

/** The logo mark's height: twice the header's 64px, so a phone's 2x screen draws it sharp. */
export const LOGO_MARK_PX = 128;

/**
 * The village's header logo as a transparent PNG, for light mode to use as a
 * mask (client/src/index.css, `.village-logo`): only its alpha matters there,
 * so a logo on any host becomes a same-origin shape the page can fill with ink.
 */
export async function renderLogoMark(source: Buffer): Promise<Buffer> {
  return sharp(source, { density: 384 })
    .resize({ height: LOGO_MARK_PX, fit: "inside", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .ensureAlpha()
    .png()
    .toBuffer();
}

/** Biggest source the route will read: a favicon is kilobytes; this refuses a mistake, not a village. */
export const TOUCH_ICON_MAX_SOURCE_BYTES = 2 * 1024 * 1024;

/** Whether a configured favicon address is one the route may fetch: http(s) only, or a path on this site. */
export function fetchableIconSource(src: string): "path" | "url" | null {
  const s = src.trim();
  if (/^\/(?!\/)/.test(s)) return "path";
  if (/^https?:\/\//i.test(s)) return "url";
  return null;
}
