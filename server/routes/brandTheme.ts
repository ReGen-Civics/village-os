/**
 * The village's theme stylesheet, and the shell that links it.
 *
 *   GET /api/brand/theme.css            the brand document as CSS, revalidated every load
 *   GET /api/brand/theme.css?v=<hash>   the same bytes, cached for a year when <hash> is current
 *
 * WHAT THIS IS. server/lib/themeCss.ts turns the brand document into a
 * stylesheet (fonts, the derived palette), and client/index.html links it
 * render-blocking, so a village's look arrives before its first paint.
 *
 * WHY THE URL CARRIES A VERSION. The route always answered `no-cache` with an
 * ETag, which asks every browser to check back. A cache in front of the
 * village does not have to listen: Cloudflare's default Browser Cache TTL
 * held the old stylesheet for four hours, so a founder who changed the brand
 * in Admin saw the old fonts and colours long after saving. A URL that
 * changes whenever the content changes is the one answer no cache can get
 * wrong. So every page the server sends has its stylesheet link rewritten to
 * `?v=<version>` (`shellWithTheme`), where the version is the same 16-hex
 * sha1 the route sends as its ETag (`themeCssVersion`). A request that names
 * the current version is told to keep the bytes for a year; any other, or
 * none, gets today's revalidate-always answer. An old shell still receives
 * current CSS, and a cache can only ever hold one version's bytes under that
 * version's own URL.
 *
 * WHY IT LIVES HERE. The handler sat inline in server/index.ts, and that file
 * is on a ratchet (scripts/check-server-index-size.mjs) that only lets it
 * shrink. Changing the handler was the moment to move it into a module of its
 * own, with the shell splice beside it, so both halves of the version agree
 * in one file.
 */
import type { Express, Request, Response } from "express";
import { stringVar } from "../lib/variables";
import { THEME_HREF, buildThemeCss, darkScheme, themeCssVersion, villageFontOrigins, withScheme, withThemeVersion, type BrandThemeFields } from "../lib/themeCss";

/** The brand document, read as it stands on each request. Only its `theme` is used here. */
export type GetBrand = () => unknown;

/** The brand document's theme fields, or null when it has none. */
function themeOf(brand: unknown): BrandThemeFields | null {
  if (!brand || typeof brand !== "object") return null;
  const theme = (brand as { theme?: unknown }).theme;
  return theme && typeof theme === "object" ? (theme as BrandThemeFields) : null;
}

/**
 * The stylesheet and its version, built and hashed once per distinct theme. A
 * page load reads the CSS for the shell's link and then again for the
 * stylesheet itself; while the brand stands still, both reuse one result.
 *
 * KEYED ON THE THEME FIELDS, NOT THE CSS. This used to rebuild the CSS on
 * every call and compare the output, which saved only the hash. With a seed
 * set, building is the dear part: deriveTheme's colour math measured 1.2 to
 * 1.9 ms a call (2026-10-20), synchronous, on every page the server sends,
 * and production has a seed. buildThemeCss is a pure function of these fields
 * (shared/brandTokens.ts imports nothing), so the same fields always build the
 * same CSS, and a brand saved in Admin is a different key on the very next
 * request.
 */
type Scheme = { ground: string } | null;
let last: { key: string; css: string; version: string; scheme: Scheme } | null = null;
function currentTheme(getBrand: GetBrand): { css: string; version: string; scheme: Scheme } {
  const brand = getBrand();
  const theme = themeOf(brand);
  // The village's own font hosts are part of the key: a new site address in
  // Admin changes which font URLs pass, so it must rebuild the stylesheet.
  const origins = villageFontOrigins(brand);
  const key = JSON.stringify([theme, origins]);
  if (last && last.key === key) return last;
  const css = buildThemeCss(theme, origins);
  last = { key, css, version: themeCssVersion(css), scheme: darkScheme(theme) };
  return last;
}

/**
 * The shell with its stylesheet link carrying the current version and, for a
 * village in the dark scheme, the dark mark and its own first paint. A shell
 * without the link comes back unchanged.
 */
export function shellWithTheme(shell: string, getBrand: GetBrand): string {
  const t = currentTheme(getBrand);
  return withVillageLook(withScheme(withThemeVersion(shell, t.version), t.scheme), villageLook());
}

/**
 * THE VILLAGE'S OWN DEFAULT MODE AND PAPER, ON <html> BEFORE ANYTHING RUNS
 * (the lead, 26 Nov 2026: a village dial for the default mode, with no flash).
 *
 * The first-paint script in client/index.html runs before any request could
 * ask the server what the village chose, so the server tells it in the page
 * itself: `data-village-mode` (the dial look.default_mode) and
 * `data-village-paper` (look.light_paper) on the <html> tag. They are
 * attributes and not script, so the script's CSP hash is unchanged. The script
 * reads them under the visitor's own choice (client/src/lib/colourMode.ts holds
 * the order), so a first visit opens in the village's mode and, in light, on
 * its paper. Only the known values are written; anything else writes nothing
 * and the platform default stands.
 */
export function withVillageLook(html: string, look: { mode: string; paper: string }): string {
  if (typeof html !== "string") return html;
  const mode = look.mode === "light" || look.mode === "dark" ? look.mode : null;
  const paper = look.paper === "plain" || look.paper === "sea-chart" ? look.paper : null;
  const attrs = (mode ? ` data-village-mode="${mode}"` : "") + (paper ? ` data-village-paper="${paper}"` : "");
  if (!attrs) return html;
  return html.replace(/<html(?![^>]*data-village-)([^>]*)>/i, `<html$1${attrs}>`);
}

/** The two dials as they stand now. A read that fails (dials not loaded yet) writes nothing. */
function villageLook(): { mode: string; paper: string } {
  try {
    return { mode: stringVar("look.default_mode"), paper: stringVar("look.light_paper") };
  } catch {
    return { mode: "", paper: "" };
  }
}

export function register(app: Express, deps: { getBrand: GetBrand }): void {
  const { getBrand } = deps;

  app.get(THEME_HREF, async (req: Request, res: Response) => {
    const { css, version } = currentTheme(getBrand);
    const etag = `"${version}"`;
    // Only the current version may be kept for good. A stale `v` is an old
    // shell asking, and it gets current CSS that it must check again.
    const pinned = typeof req.query?.v === "string" && req.query.v === version;
    res.setHeader("Cache-Control", pinned ? "public, max-age=31536000, immutable" : "no-cache");
    res.setHeader("ETag", etag);
    if (req.headers["if-none-match"] === etag) return res.status(304).end();
    res.type("text/css").send(css);
  });
}
