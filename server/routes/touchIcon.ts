/**
 * GET /api/brand/touch-icon.png: the village's favicon as the 180px PNG a
 * phone's home screen uses (server/lib/touchIcon.ts has the why). Beside
 * /api/brand/theme.css because it is the same kind of thing: the brand overlay,
 * drawn per village at request time, never a file in client/public.
 * client/index.html names it as the apple-touch-icon. Public, like the favicon
 * it is drawn from.
 *
 * Bounded: the PNG is rendered once per source and kept in memory, so a crowd
 * costs one render. A render (which may fetch the source from the village's own
 * site or the address an admin typed) is rate-limited, and anything that fails
 * falls back to the platform's mark from disk, so the route always answers
 * with an image.
 */
import type express from "express";
import fs from "node:fs";
import { guardedFetch } from "../lib/toolcheck";
import {
  TOUCH_ICON_MAX_SOURCE_BYTES,
  fetchableIconSource,
  renderLogoMark,
  renderTouchIcon,
} from "../lib/touchIcon";

interface Deps {
  /** The village's favicon setting (an address), or "" for none. */
  favicon: () => string;
  /** The village's header logo setting (an address), or "" for none: the source of /api/brand/logo-mark.png. */
  logo?: () => string;
  /** The square's colour: the install background the manifest already uses. */
  background: () => string;
  /** The platform's own mark on disk, the fallback. */
  platformIconFile: string;
  /** overLimit(bucket, max, windowMs), the codebase's request bound. */
  overLimit: (bucket: string, max: number, windowMs: number) => Promise<boolean>;
  /** Fetch, injectable for tests. The default refuses private and loopback addresses (guardOutboundUrl). */
  fetchImpl?: (url: string, init?: RequestInit) => Promise<Response>;
}

/** How long a rendered icon is kept before the source is read again (a favicon change shows within this). */
const KEEP_MS = 60 * 60 * 1000;
/** Renders per hour across the whole site: a favicon changes rarely, so this is generous. */
const RENDERS_PER_HOUR = 30;

export function register(app: express.Express, deps: Deps): void {
  const kept = new Map<string, { png: Buffer; at: number }>();
  const fetchImpl = deps.fetchImpl ?? guardedFetch;

  const readSource = async (req: express.Request, src: string): Promise<Buffer | null> => {
    const kind = fetchableIconSource(src);
    if (!kind) return null;
    const host = String(req.headers.host ?? "").trim();
    const proto = String(req.headers["x-forwarded-proto"] ?? req.protocol ?? "https").split(",")[0].trim();
    const url = kind === "url" ? src : host ? `${proto}://${host}${src}` : "";
    if (!url) return null;
    const res = await fetchImpl(url, { signal: AbortSignal.timeout(5000), redirect: "follow" });
    if (!res.ok) return null;
    const bytes = Buffer.from(await res.arrayBuffer());
    return bytes.length > 0 && bytes.length <= TOUCH_ICON_MAX_SOURCE_BYTES ? bytes : null;
  };

  const platformPng = async (background: string): Promise<Buffer> => {
    const key = `platform|${background}`;
    const hit = kept.get(key);
    if (hit) return hit.png;
    const png = await renderTouchIcon(fs.readFileSync(deps.platformIconFile), background);
    kept.set(key, { png, at: Date.now() });
    return png;
  };

  app.get("/api/brand/touch-icon.png", async (req, res) => {
    const src = deps.favicon().trim();
    const background = deps.background();
    const key = `${src}|${background}`;
    res.type("image/png");
    // A day in the browser; the server re-reads the source hourly.
    res.setHeader("Cache-Control", "public, max-age=86400");
    try {
      const hit = kept.get(key);
      if (hit && Date.now() - hit.at < KEEP_MS) return res.send(hit.png);
      if (src && !(await deps.overLimit("touch-icon:render", RENDERS_PER_HOUR, 60 * 60 * 1000))) {
        const source = await readSource(req, src);
        if (source) {
          const png = await renderTouchIcon(source, background);
          kept.set(key, { png, at: Date.now() });
          return res.send(png);
        }
      }
      // With no favicon set, an unreadable one, or the bound reached: the last good render, else the platform's mark.
      if (hit) return res.send(hit.png);
      return res.send(await platformPng(background));
    } catch {
      try {
        return res.send(await platformPng(background));
      } catch {
        return res.status(404).end();
      }
    }
  });

  /*
   * GET /api/brand/logo-mark.png: the header logo as a transparent PNG on this
   * site's own origin, which light mode uses as a mask to repaint the mark in
   * the light band's ink (the lead, 24 Nov 2026: recolour it "automatically").
   * A logo on another host cannot be a CSS mask without CORS; drawn here, it
   * can. Bounded like the icon above. With nothing to draw it answers 404, and
   * the page then shows the logo as it is (Layout's useLogoMask waits for this
   * image to load before it repaints anything).
   */
  app.get("/api/brand/logo-mark.png", async (req, res) => {
    const src = (deps.logo?.() ?? "").trim();
    const key = `logo|${src}`;
    res.setHeader("Cache-Control", "public, max-age=86400");
    try {
      const hit = kept.get(key);
      if (hit && Date.now() - hit.at < KEEP_MS) return res.type("image/png").send(hit.png);
      if (src && !(await deps.overLimit("logo-mark:render", RENDERS_PER_HOUR, 60 * 60 * 1000))) {
        const source = await readSource(req, src);
        if (source) {
          const png = await renderLogoMark(source);
          kept.set(key, { png, at: Date.now() });
          return res.type("image/png").send(png);
        }
      }
      if (hit) return res.type("image/png").send(hit.png);
      return res.status(404).end();
    } catch {
      return res.status(404).end();
    }
  });
}
