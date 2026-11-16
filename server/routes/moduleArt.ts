/**
 * The module library's card art: one drawing per module, served by the server
 * at the URL it has always had.
 *
 *   GET /images/modules/<module-id>.webp
 *   GET /images/modules/manifest.json   (the generator's record)
 *
 * WHY THE SERVER AND NOT `client/public`. The same reason, and the same
 * remedy, as the stock character art (server/routes/stockAvatars.ts, Rye on
 * 2026-10-13: "Move the avatars to uploads"). CI caps the whole of
 * `dist/public` (MAX_TOTAL_DIST_KB, block-charged), and these thirty files
 * were about 600 KB of it on 2026-11-16, when main had 8 KB left under the cap
 * and the next module page could not land. They now live in
 * `server/assets/modules`, which the Dockerfile already copies into the image
 * (`COPY --from=build /app/server/assets ./server/assets`), and which the
 * client build never sees. The bytes still ship in the image; they no longer
 * count against the client bundle, which is what the cap exists to bound.
 *
 * WHY NOT THE UPLOADS VOLUME ITSELF. Every instance has to answer these URLs,
 * a fresh fork with an empty volume included; stockAvatars.ts has the full
 * reasoning. Art a founder picks for a module still goes in the uploads
 * volume, and `ModuleArt` prefers it over this file.
 *
 * THE URLS DID NOT CHANGE. `bundledArtPath` (client/src/components/modules/
 * ModuleArt.tsx) computes `/images/modules/<file>` from the generated map in
 * bundledModuleArt.ts, so nothing stores one and nothing migrates.
 *
 * CACHE. The names are not content-hashed, so a day, with the ETag and
 * Last-Modified express.static sends; a redraw reaches everyone by tomorrow.
 *
 * A MISS FALLS THROUGH to the server's own `/images/` rule, which answers 404
 * text/plain, and `ModuleArt` draws its gradient and emblem on error.
 */
import express, { type Express } from "express";
import fs from "node:fs";
import path from "node:path";

/** The public path. Unchanged since the art shipped; stored nowhere. */
export const MODULE_ART_URL = "/images/modules";

/** Where the files live, relative to the repository root (and to /app in the image). */
export const MODULE_ART_DIR = path.join("server", "assets", "modules");

/** One day, revalidated by ETag after that. */
export const MODULE_ART_MAX_AGE_SECONDS = 86400;

export interface ModuleArtDeps {
  /** Absolute path of the directory holding the drawings. */
  dir: string;
}

export function register(app: Express, deps: ModuleArtDeps): void {
  if (!fs.existsSync(deps.dir)) {
    // Loud and not fatal: every card draws its own gradient and emblem.
    console.warn(`[module-art] ${deps.dir} is missing, so module cards will draw their fallback art`);
  }
  app.use(
    MODULE_ART_URL,
    express.static(deps.dir, {
      index: false,
      redirect: false,
      dotfiles: "ignore",
      maxAge: MODULE_ART_MAX_AGE_SECONDS * 1000,
    }),
  );
}
