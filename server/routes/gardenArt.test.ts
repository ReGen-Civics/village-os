/**
 * The Admin Garden's painted art is in the image, in the format the house
 * ships (WebP), small, and answered at the URL the client computes.
 *
 * Every name here comes from shared/gardenArt.ts, the one table the client
 * reads too, so a place added to the union without its two paintings fails
 * here by name, and so does a ground added without its painting.
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
  DEFAULT_GARDEN_GROUND,
  GARDEN_ART_URL,
  GARDEN_GROUND_HEIGHT,
  GARDEN_GROUND_KEYS,
  GARDEN_GROUND_WIDTH,
  GARDEN_GUIDE_FILE,
  GARDEN_GUIDE_URL,
  GARDEN_PLACE_KEYS,
  GARDEN_SPRITE_HEIGHT,
  GARDEN_SPRITE_WIDTHS,
  gardenArtFiles,
  gardenGroundFile,
  gardenGroundUrl,
  gardenSpriteFile,
  gardenSpriteUrl,
  readGardenGround,
} from "../../shared/gardenArt";

const ROOT = process.cwd();
const DIR = path.resolve(ROOT, GARDEN_ART_DIR);

/** One sprite stays a thumbnail's weight. The guide's portrait is held to the same. */
const MAX_SPRITE_BYTES = 40 * 1024;
/**
 * A ground is a whole land, 1280 by 1152, so it is larger than a sprite and has a ceiling of its own. The four
 * together are held to the size the founder approved for them (28 Nov 2026): 160 KB. Only the picked one is fetched.
 */
const MAX_GROUND_BYTES = 60 * 1024;
const MAX_GROUNDS_BYTES = 160 * 1024;
/** The folder: under half a megabyte for the buildings and the portrait, as it was, and the grounds' own allowance on top. */
const MAX_FOLDER_BYTES = 500 * 1024 + MAX_GROUNDS_BYTES;

/** The buildings and the portrait: every file that is not a ground. */
const spriteFiles = () => [...GARDEN_PLACE_KEYS.flatMap((k) => [gardenSpriteFile(k), gardenSpriteFile(k, true)]), GARDEN_GUIDE_FILE];
const groundFiles = () => GARDEN_GROUND_KEYS.map(gardenGroundFile);

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

  it("holds the four painted grounds, each WebP in the land's own shape at 1280 by 1152, and forest is the default", async () => {
    expect(GARDEN_GROUND_KEYS).toEqual(["forest", "valley", "hills", "beach"]);
    expect(DEFAULT_GARDEN_GROUND).toBe("forest");
    expect([GARDEN_GROUND_WIDTH, GARDEN_GROUND_HEIGHT]).toEqual([1280, 1152]);
    // 10 wide to 9 tall: the shape the land is drawn in (`.gd-land` in garden.css).
    expect(GARDEN_GROUND_WIDTH * 9).toBe(GARDEN_GROUND_HEIGHT * 10);
    for (const ground of GARDEN_GROUND_KEYS) {
      const file = gardenGroundFile(ground);
      expect(file).toBe(`ground-${ground}.webp`);
      expect(fs.existsSync(path.join(DIR, file)), file).toBe(true);
      const meta = await sharp(path.join(DIR, file)).metadata();
      expect(meta.format, file).toBe("webp");
      expect(meta.width, file).toBe(GARDEN_GROUND_WIDTH);
      expect(meta.height, file).toBe(GARDEN_GROUND_HEIGHT);
    }
  });

  it("reads a kept ground back, and anything that is no ground as the default", () => {
    for (const ground of GARDEN_GROUND_KEYS) expect(readGardenGround(ground)).toBe(ground);
    for (const junk of [undefined, null, "", "FOREST", "desert", "ground-forest.webp", 2, {}]) expect(readGardenGround(junk)).toBe("forest");
  });

  it("stays small: no building over the sprite ceiling, no ground over its own, the four grounds within what was approved, and the folder under its ceiling", () => {
    let sprites = 0;
    for (const file of spriteFiles()) {
      const bytes = fs.statSync(path.join(DIR, file)).size;
      expect(bytes, file).toBeLessThanOrEqual(MAX_SPRITE_BYTES);
      sprites += bytes;
    }
    let grounds = 0;
    for (const file of groundFiles()) {
      const bytes = fs.statSync(path.join(DIR, file)).size;
      expect(bytes, file).toBeLessThanOrEqual(MAX_GROUND_BYTES);
      grounds += bytes;
    }
    expect(grounds).toBeLessThanOrEqual(MAX_GROUNDS_BYTES);
    // The buildings and the portrait keep the ceiling they had before the grounds came: the grounds spend none of it.
    expect(sprites).toBeLessThanOrEqual(MAX_FOLDER_BYTES - MAX_GROUNDS_BYTES);
    expect(sprites + grounds).toBeLessThanOrEqual(MAX_FOLDER_BYTES);
    // Every file in the folder was weighed as one kind or the other.
    expect([...spriteFiles(), ...groundFiles()].sort()).toEqual(gardenArtFiles().sort());
  });

  it("carries no village's name in a file name", () => {
    for (const file of gardenArtFiles()) {
      expect(file).toMatch(/^(?:fire|hall|gate|library|greenhouse|store|tower|spring|stage|ceiba)(?:-scaffold)?\.webp$|^guide\.webp$|^ground-(?:forest|valley|hills|beach)\.webp$/);
    }
  });

  it("serves every painting at the URL the client computes, as webp, cached a day", async () => {
    const urls = [...GARDEN_PLACE_KEYS.flatMap((k) => [gardenSpriteUrl(k), gardenSpriteUrl(k, true)]), GARDEN_GUIDE_URL, ...GARDEN_GROUND_KEYS.map(gardenGroundUrl)];
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
