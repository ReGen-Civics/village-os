/**
 * THE VILLAGE'S SHARE CARD (server/lib/shareCard.ts says why and how).
 *
 *   GET /api/share-card.jpg   the chosen picture as a 1200x630 JPEG, public
 *
 * The preview tags name this address with `?v=<version>` whenever the village's
 * share picture is one of its own uploads, so a chat app that kept yesterday's
 * card asks again once the picture changes. The `v` is a cache-buster only:
 * the card served is always the one for the picture chosen now, and a stranger
 * cycling `v` makes nothing new, because the card is held by its source file.
 *
 * Answers 404 when the chosen picture is on another host, is missing, or may
 * not be shown; the tags then carry the picture's own address as before.
 */
import type { Express, Request } from "express";
import type { LimitState } from "../repos/rateHits";
import { cachedShareCard, makeShareCard, shareCardSource } from "../lib/shareCard";

export interface ShareCardDeps {
  uploadsDir: string;
  /** The picture the share card names now: the Whole site share picture, or the homepage picture. */
  picture(): string;
  /** This request's own origin, so a full address on this village's host counts as its own upload. */
  origin(req: Request): string;
  /** The guard's three answers: this route refuses when it cannot check (as /api/og/quest/:id does). */
  limitState(bucket: string, max: number, windowMs: number): Promise<LimitState>;
  clientIp(req: Request): string;
}

/** An hour: long enough that a crawler walking the site pays once, short enough that a new picture shows the same day. */
const MAX_AGE = 3600;

export function register(app: Express, deps: ShareCardDeps): void {
  // Written out, the same as SHARE_CARD_PATH: the route guards (scripts/check-route-limits.mjs and its
  // neighbours) read a registration's address only as a literal, and a constant would hide this one.
  app.get("/api/share-card.jpg", async (req, res) => {
    const source = shareCardSource(deps.picture(), deps.origin(req), deps.uploadsDir);
    if (!source) {
      return res.status(404).set("Cache-Control", "no-store").json({ error: "This village has no share picture on its own uploads." });
    }
    res.set("Cache-Control", `public, max-age=${MAX_AGE}`);
    res.set("ETag", `"${source.version}"`);
    res.set("X-Content-Type-Options", "nosniff");
    if (req.fresh) return res.status(304).end();
    let card = cachedShareCard(source);
    if (!card) {
      /*
       * THE BOUND SITS AFTER THE CACHE, as on the quest poster. A village has
       * one share picture, so the first fetch renders it and every later one
       * is free; what this catches is a caller forcing misses. 60 an hour is
       * far more picture changes than any village makes.
       */
      const guard = await deps.limitState(`share-card:${deps.clientIp(req)}`, 60, 60 * 60 * 1000);
      if (guard === "over") {
        return res.status(429).set("Cache-Control", "no-store").set("Retry-After", "600").json({ error: "Too many share card requests. Try again shortly." });
      }
      if (guard === "unavailable") {
        console.error(`[share-card] refusing to render: the abuse guard could not check ${deps.clientIp(req)}`);
        return res.status(503).set("Cache-Control", "no-store").set("Retry-After", "600").json({ error: "The share card could not be made just now. Try again shortly." });
      }
      try {
        card = await makeShareCard(source);
      } catch (err) {
        /*
         * sharp refused the file (too many pixels, damaged bytes) or is
         * missing. The original picture is still a picture, so a previewer
         * is sent there, and no cache may keep that answer under this address.
         */
        console.error(`[share-card] could not render ${source.name}: ${(err as Error)?.message ?? err}`);
        res.removeHeader("ETag");
        return res.set("Cache-Control", "no-store").redirect(302, `/api/uploads/${encodeURIComponent(source.name)}`);
      }
    }
    res.type("jpeg").send(card);
  });
}
