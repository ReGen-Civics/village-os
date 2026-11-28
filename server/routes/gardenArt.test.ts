/**
 * The Admin Garden's painted art is in the image, in the format the house
 * ships (WebP), small, and answered at the URL the client computes.
 *
 * Every name here comes from shared/gardenArt.ts, the one table the client
 * reads too, so a place added to the union without its two paintings fails
 * here by name.
 */
import express from "express";
import fs from "node:fs";
import path from "node:path";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import sharp from "sharp";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { GARDEN_ART_DIR, GARDEN_ART_MAX_AGE_SECONDS, register } from "./gardenArt";
import {
  GARDEN_ART_URL,
  GARDEN_GUIDE_URL,
  GARDEN_PLACE_KEYS,
  GARDEN_SPRITE_HEIGHT,
  GARDEN_SPRITE_WIDTHS,
  gardenArtFiles,
  gardenSpriteFile,
  gardenSpriteUrl,
} from "../../shared/gardenArt";

const ROOT = process.cwd();
const DIR = path.resolve(ROOT, GARDEN_ART_DIR);

/** One sprite stays a thumbnail's weight; the whole folder stays under half a megabyte of the image. */
const MAX_SPRITE_BYTES = 40 * 1024;
const MAX_FOLDER_BYTES = 500 * 1024;

async function serve(dir: string): Promise<{ base: string; server: Server }> {
  const app = express();
  register(app, { dir });
  app.use((_req, res) => res.status(404).type("text/plain").send("Not found"));
  const server = await new Promise<Server>((resolve) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
  });
  return { base: `http://127.0.0.1:${(server.address() as AddressInfo).port}`, server };
}

let base = "";
let server: Server | undefined;

beforeAll(async () => {
  ({ base, server } = await serve(DIR));
});

afterAll(async () => {
  await new Promise((r) => server?.close(r));
});

describe("the garden's painted art", () => {
  it("holds exactly the files the table names, outside the client bundle", () => {
    expect(fs.existsSync(path.join(ROOT, "client/public/images/garden"))).toBe(false);
    expect(fs.readdirSync(DIR).sort()).toEqual(gardenArtFiles().sort());
    expect(GARDEN_PLACE_KEYS).toHaveLength(10);
  });

  it("every place has a built painting and one under scaffolding, as WebP with transparency, at the width the table says", async () => {
    for (const place of GARDEN_PLACE_KEYS) {
      for (const scaffolding of [false, true]) {
        const file = gardenSpriteFile(place, scaffolding);
        const meta = await sharp(path.join(DIR, file)).metadata();
        expect(meta.format, file).toBe("webp");
        expect(meta.hasAlpha, file).toBe(true);
        expect(meta.height, file).toBe(GARDEN_SPRITE_HEIGHT);
        expect(meta.width, file).toBe(GARDEN_SPRITE_WIDTHS[place][scaffolding ? "scaffold" : "built"]);
      }
    }
  });

  it("stays small: no file over the sprite ceiling, and the folder under its own", () => {
    let total = 0;
    for (const file of gardenArtFiles()) {
      const bytes = fs.statSync(path.join(DIR, file)).size;
      expect(bytes, file).toBeLessThanOrEqual(MAX_SPRITE_BYTES);
      total += bytes;
    }
    expect(total).toBeLessThanOrEqual(MAX_FOLDER_BYTES);
  });

  it("carries no village's name in a file name", () => {
    for (const file of gardenArtFiles()) expect(file).toMatch(/^(?:fire|hall|gate|library|greenhouse|store|tower|spring|stage|ceiba)(?:-scaffold)?\.webp$|^guide\.webp$/);
  });

  it("serves every painting at the URL the client computes, as webp, cached a day", async () => {
    const urls = [...GARDEN_PLACE_KEYS.flatMap((k) => [gardenSpriteUrl(k), gardenSpriteUrl(k, true)]), GARDEN_GUIDE_URL];
    for (const url of urls) {
      expect(url.startsWith(`${GARDEN_ART_URL}/`), url).toBe(true);
      const res = await fetch(`${base}${url}`); // module-review-ok: the test client dialling its own in-process server on localhost
      expect(res.status, url).toBe(200);
      expect(res.headers.get("content-type"), url).toMatch(/image\/webp/);
      expect(res.headers.get("cache-control"), url).toBe(`public, max-age=${GARDEN_ART_MAX_AGE_SECONDS}`);
    }
  });

  it("a missing painting is a plain 404, and a path that climbs out is refused", async () => {
    const missing = await fetch(`${base}${GARDEN_ART_URL}/zzz-does-not-exist.webp`); // module-review-ok: the test client dialling its own in-process server on localhost
    expect(missing.status).toBe(404);
    expect(missing.headers.get("content-type")).toMatch(/text\/plain/);
    const climbing = await fetch(`${base}${GARDEN_ART_URL}/..%2f..%2fpackage.json`); // module-review-ok: the test client dialling its own in-process server on localhost
    expect(climbing.status).toBe(404);
  });
});
