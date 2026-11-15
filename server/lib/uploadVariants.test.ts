import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { renderVariant, variantKey } from "./uploadVariants";

const portrait = () => sharp({ create: { width: 1120, height: 1400, channels: 3, background: { r: 30, g: 120, b: 60 } } }).webp().toBuffer();

describe("upload variants, the copies", () => {
  it("cuts a band at the width asked for, 3:1, as WebP", async () => {
    const out = await sharp(await renderVariant(await portrait(), { width: 800, crop: "band" })).metadata();
    expect([out.format, out.width, out.height]).toEqual(["webp", 800, 267]);
  });

  it("keeps the shape when no crop is asked for", async () => {
    const out = await sharp(await renderVariant(await portrait(), { width: 480 })).metadata();
    expect([out.width, out.height]).toEqual([480, 600]);
  });

  it("never makes a copy larger than the original", async () => {
    const small = await sharp({ create: { width: 640, height: 960, channels: 3, background: "#888" } }).png().toBuffer();
    const out = await sharp(await renderVariant(small, { width: 1200 })).metadata();
    expect(out.width).toBe(640);
  });

  it("keys a copy on the original's size and time, so a replaced file is never answered from an old copy", () => {
    const a = variantKey("/v/a.webp", { size: 10, mtimeMs: 1 }, { width: 800 });
    expect(variantKey("/v/a.webp", { size: 11, mtimeMs: 1 }, { width: 800 })).not.toBe(a);
    expect(variantKey("/v/a.webp", { size: 10, mtimeMs: 2 }, { width: 800 })).not.toBe(a);
    expect(variantKey("/v/a.webp", { size: 10, mtimeMs: 1 }, { width: 800, crop: "band" })).not.toBe(a);
  });
});
