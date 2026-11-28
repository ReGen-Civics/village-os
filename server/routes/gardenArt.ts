/**
 * The Admin Garden's painted art: one building per place, built and under
 * scaffolding, and the guide's portrait (shared/gardenArt.ts).
 *
 *   GET /images/garden/<place>.webp            a place, built
 *   GET /images/garden/<place>-scaffold.webp   the same place, not built yet
 *   GET /images/garden/guide.webp              the guide's portrait
 *
 * WHY THE SERVER AND NOT `client/public`. The same reason, and the same
 * remedy, as the module cards (server/routes/moduleArt.ts): CI caps the whole
 * of `dist/public`, and art in `server/assets` ships in the image without
 * counting against the client bundle. The Dockerfile already copies the whole
 * folder (`COPY --from=build /app/server/assets ./server/assets`).
 *
 * CACHE. The names are not content-hashed, so a day, with the ETag and
 * Last-Modified express.static sends; a repaint reaches everyone by tomorrow.
 *
 * A MISS FALLS THROUGH to the server's own `/images/` rule, which answers 404
 * text/plain, and a place draws its plaque and lantern without a building.
 *
 * REGISTERED beside the module art in server/index.ts, before the `/images/`
 * rule, so a painting is found before that rule answers its 404.
 */
import express, { type Express } from "express";
import fs from "node:fs";
import path from "node:path";
import { GARDEN_ART_URL } from "../../shared/gardenArt";

/** Where the files live, relative to the repository root (and to /app in the image). */
export const GARDEN_ART_DIR = path.join("server", "assets", "garden");

/** One day, revalidated by ETag after that. */
export const GARDEN_ART_MAX_AGE_SECONDS = 86400;

export interface GardenArtDeps {
  /** Absolute path of the directory holding the paintings. */
  dir: string;
}

export function register(app: Express, deps: GardenArtDeps): void {
  if (!fs.existsSync(deps.dir)) {
    // Loud and not fatal: every place still draws its name, its lantern and its plaque.
    console.warn(`[garden-art] ${deps.dir} is missing, so the garden's places will draw without their buildings`);
  }
  app.use(
    GARDEN_ART_URL,
    express.static(deps.dir, {
      index: false,
      redirect: false,
      dotfiles: "ignore",
      maxAge: GARDEN_ART_MAX_AGE_SECONDS * 1000,
    }),
  );
}
