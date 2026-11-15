import { describe, expect, it } from "vitest";
import sharp from "sharp";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll } from "vitest";
import { MAX_ENCODES, MAX_SOURCE_BYTES, MAX_WAITING, clearUploadVariants, renderVariant, uploadVariant, variantKey } from "./uploadVariants";

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

describe("upload variants, what one request may cost", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "upload-variants-"));
  afterAll(() => {
    // sharp keeps recently read files open; on Windows that refuses the delete, and a temp dir left behind is harmless.
    try {
      fs.rmSync(dir, { recursive: true, force: true });
    } catch {
      /* left for the OS */
    }
  });

  it("sends the original for a source over the size limit, and never decodes it", async () => {
    clearUploadVariants();
    const file = path.join(dir, "big.webp");
    // Not an image at all: decoding it would throw, so a copy here would mean the limit was skipped.
    fs.writeFileSync(file, "not a picture");
    expect(await uploadVariant(file, { size: MAX_SOURCE_BYTES + 1, mtimeMs: 1 }, { width: 800 })).toBe("too-large");
  });

  it("control: the same call under the limit does decode, and a non-image rejects", async () => {
    const file = path.join(dir, "big.webp");
    await expect(uploadVariant(file, { size: 13, mtimeMs: 1 }, { width: 800 })).rejects.toThrow();
  });

  it("makes a copy of a real picture under the limit", async () => {
    const file = path.join(dir, "ok.webp");
    fs.writeFileSync(file, await portrait());
    const out = await uploadVariant(file, fs.statSync(file), { width: 480 });
    expect(Buffer.isBuffer(out)).toBe(true);
  });

  it("refuses a canvas with more pixels than the limit, however small the file", async () => {
    const huge = await sharp({ create: { width: 8000, height: 6000, channels: 3, background: "#000" } }).png({ compressionLevel: 9 }).toBuffer();
    await expect(renderVariant(huge, { width: 480 })).rejects.toThrow(/pixel/i);
  });

  it("encodes at most MAX_ENCODES at once and answers busy once the line is full", async () => {
    clearUploadVariants();
    const file = path.join(dir, "ok.webp");
    const stat = fs.statSync(file);
    // Distinct keys (mtime) so no request shares another's encode.
    const asks = Array.from({ length: MAX_ENCODES + MAX_WAITING + 3 }, (_, i) => uploadVariant(file, { size: stat.size, mtimeMs: 1000 + i }, { width: 480 }));
    const out = await Promise.all(asks);
    expect(out.filter((o) => o === "busy").length).toBe(3);
    expect(out.filter((o) => Buffer.isBuffer(o)).length).toBe(MAX_ENCODES + MAX_WAITING);
  });
});
