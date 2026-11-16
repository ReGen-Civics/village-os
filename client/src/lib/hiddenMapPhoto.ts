/**
 * A hidden-map photo, made safe on the device before it goes anywhere.
 *
 * 1. The location is read from the ORIGINAL bytes (`readJpegGps`), so the pin
 *    can be filled from the photo.
 * 2. The picture is drawn onto a canvas and encoded again. A canvas holds
 *    pixels and nothing else, so the new file carries no location, no camera,
 *    no time: every metadata field is gone.
 * 3. Any box the member drew over a face or a number plate is pixelated in
 *    large blocks BEFORE the encode, so what leaves the device never held it.
 *
 * THIS NEVER HANDS BACK THE ORIGINAL FILE. `client/src/lib/imagePrep.ts`
 * returns the original when it is small or when the browser cannot encode
 * WebP, which is right for a gallery and wrong here: the original is the file
 * with the location in it. When this cannot re-encode, it refuses, and the
 * server's own strip still runs on everything it receives.
 */
import { readJpegGps, type GpsReading } from "@shared/exifGps";

/** A box to cover, in fractions of the picture's width and height (0 to 1). */
export interface CoverBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const MAX_EDGE = 2000;

export class CannotMakeSafe extends Error {
  constructor() {
    super("This phone could not prepare that photo safely, so it was not added. Try a different photo.");
  }
}

/** The location in the photo, read before anything else touches it. */
export async function readLocation(file: Blob): Promise<GpsReading | null> {
  try {
    // The EXIF sits at the front of a JPEG. 256 KB is far more than a phone writes there.
    const head = await file.slice(0, 256 * 1024).arrayBuffer();
    return readJpegGps(head);
  } catch {
    return null;
  }
}

async function decode(file: Blob): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === "function") {
    try {
      // "from-image" honours the photo's orientation flag before the flag is thrown away.
      return await createImageBitmap(file, { imageOrientation: "from-image" } as ImageBitmapOptions);
    } catch {
      /* fall through to an <img>, which older Safari needs */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Pixelate one box on the canvas, in blocks no smaller than a twelfth of the box's short side. */
export function pixelate(ctx: CanvasRenderingContext2D, box: CoverBox, width: number, height: number): void {
  const x = Math.max(0, Math.floor(box.x * width));
  const y = Math.max(0, Math.floor(box.y * height));
  const w = Math.min(width, Math.ceil((box.x + box.w) * width)) - x;
  const h = Math.min(height, Math.ceil((box.y + box.h) * height)) - y;
  if (w <= 0 || h <= 0) return;
  const block = Math.max(8, Math.ceil(Math.min(w, h) / 12));
  const data = ctx.getImageData(x, y, w, h);
  const px = data.data;
  for (let by = 0; by < h; by += block) {
    for (let bx = 0; bx < w; bx += block) {
      let r = 0, g = 0, b = 0, n = 0;
      for (let yy = by; yy < Math.min(h, by + block); yy++) {
        for (let xx = bx; xx < Math.min(w, bx + block); xx++) {
          const i = (yy * w + xx) * 4;
          r += px[i]!; g += px[i + 1]!; b += px[i + 2]!; n++;
        }
      }
      r = Math.round(r / n); g = Math.round(g / n); b = Math.round(b / n);
      for (let yy = by; yy < Math.min(h, by + block); yy++) {
        for (let xx = bx; xx < Math.min(w, bx + block); xx++) {
          const i = (yy * w + xx) * 4;
          px[i] = r; px[i + 1] = g; px[i + 2] = b; px[i + 3] = 255;
        }
      }
    }
  }
  ctx.putImageData(data, x, y);
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), type, quality));
}

/**
 * The safe copy: re-encoded, shrunk to MAX_EDGE, covered where asked. WebP
 * where the browser can, JPEG otherwise; both from a canvas, so neither keeps
 * any metadata. Throws `CannotMakeSafe` rather than returning the original.
 */
export async function makeSafe(file: Blob, covers: readonly CoverBox[] = [], crop?: CoverBox): Promise<Blob> {
  let source: ImageBitmap | HTMLImageElement;
  try {
    source = await decode(file);
  } catch {
    throw new CannotMakeSafe();
  }
  const sw = "naturalWidth" in source ? source.naturalWidth : source.width;
  const sh = "naturalHeight" in source ? source.naturalHeight : source.height;
  const c = crop ?? { x: 0, y: 0, w: 1, h: 1 };
  const cx = Math.floor(c.x * sw), cy = Math.floor(c.y * sh);
  const cw = Math.max(1, Math.floor(c.w * sw)), ch = Math.max(1, Math.floor(c.h * sh));
  const scale = Math.min(1, MAX_EDGE / Math.max(cw, ch));
  const w = Math.max(1, Math.round(cw * scale));
  const h = Math.max(1, Math.round(ch * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new CannotMakeSafe();
  ctx.drawImage(source as CanvasImageSource, cx, cy, cw, ch, 0, 0, w, h);
  if ("close" in source && typeof source.close === "function") source.close();
  // Covers are drawn on the whole picture; map each into the cropped frame.
  for (const box of covers) {
    pixelate(ctx, { x: (box.x - c.x) / c.w, y: (box.y - c.y) / c.h, w: box.w / c.w, h: box.h / c.h }, w, h);
  }
  const webp = await toBlob(canvas, "image/webp", 0.85);
  if (webp && webp.type === "image/webp" && webp.size > 0) return webp;
  const jpeg = await toBlob(canvas, "image/jpeg", 0.88);
  if (jpeg && jpeg.size > 0) return jpeg;
  throw new CannotMakeSafe();
}
