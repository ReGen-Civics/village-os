// @vitest-environment jsdom
/**
 * The device side of a hidden-map photo.
 *
 * The property that matters most: `makeSafe` NEVER hands back the original
 * file, which is the one with the location in it. jsdom has no canvas encoder,
 * which is exactly the "this browser cannot re-encode" case, so it must refuse.
 *
 * `pixelate` is checked on a fake 2D context: every pixel inside a box ends up
 * the colour of its block's average, and nothing outside the box changes.
 */
import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { buildGeotaggedJpeg, FIXTURE_LAT } from "../../../server/lib/exifFixture";
import { CannotMakeSafe, makeSafe, pixelate, readLocation } from "./hiddenMapPhoto";

function fakeCtx(width: number, height: number) {
  const px = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    px[i * 4] = i % 256;
    px[i * 4 + 1] = (i * 7) % 256;
    px[i * 4 + 2] = (i * 13) % 256;
    px[i * 4 + 3] = 255;
  }
  const ctx = {
    getImageData: (x: number, y: number, w: number, h: number) => {
      const d = new Uint8ClampedArray(w * h * 4);
      for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) for (let c = 0; c < 4; c++) d[(yy * w + xx) * 4 + c] = px[((y + yy) * width + x + xx) * 4 + c]!;
      return { data: d, width: w, height: h };
    },
    putImageData: (img: { data: Uint8ClampedArray; width: number; height: number }, x: number, y: number) => {
      for (let yy = 0; yy < img.height; yy++) for (let xx = 0; xx < img.width; xx++) for (let c = 0; c < 4; c++) px[((y + yy) * width + x + xx) * 4 + c] = img.data[(yy * img.width + xx) * 4 + c]!;
    },
  };
  return { ctx: ctx as unknown as CanvasRenderingContext2D, px };
}

describe("makeSafe", () => {
  it("refuses, and never returns the original, when the browser cannot re-encode", async () => {
    const plain = await sharp({ create: { width: 64, height: 48, channels: 3, background: { r: 9, g: 9, b: 9 } } }).jpeg().toBuffer();
    const original = new Blob([buildGeotaggedJpeg(plain)], { type: "image/jpeg" });
    let out: unknown = null;
    let threw: unknown = null;
    try {
      out = await makeSafe(original);
    } catch (e) {
      threw = e;
    }
    expect(out).not.toBe(original);
    expect(threw).toBeInstanceOf(CannotMakeSafe);
  });
});

describe("readLocation", () => {
  it("reads the place from the original bytes", async () => {
    const plain = await sharp({ create: { width: 64, height: 48, channels: 3, background: { r: 9, g: 9, b: 9 } } }).jpeg().toBuffer();
    const got = await readLocation(new Blob([buildGeotaggedJpeg(plain)]));
    expect(got?.lat).toBeCloseTo(FIXTURE_LAT, 3);
  });
});

describe("pixelate", () => {
  it("averages every block inside the box and leaves everything outside it alone", () => {
    const W = 64, H = 64;
    const { ctx, px } = fakeCtx(W, H);
    const before = new Uint8ClampedArray(px);
    pixelate(ctx, { x: 0.25, y: 0.25, w: 0.5, h: 0.5 }, W, H);
    // Outside the box: untouched.
    expect(px[0]).toBe(before[0]);
    expect(px[(63 * W + 63) * 4]).toBe(before[(63 * W + 63) * 4]);
    // Inside: the block is a single colour (blocks are at least 8 px).
    const at = (x: number, y: number) => px[(y * W + x) * 4];
    expect(at(16, 16)).toBe(at(23, 23));
    expect(at(16, 16)).not.toBe(before[(16 * W + 16) * 4]);
  });

  it("clamps a box that runs off the picture", () => {
    const { ctx } = fakeCtx(32, 32);
    expect(() => pixelate(ctx, { x: -0.2, y: 0.9, w: 0.5, h: 0.5 }, 32, 32)).not.toThrow();
  });
});
