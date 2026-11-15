/**
 * THE SMALLER COPIES THEMSELVES (shared/uploadVariants.ts says why and which).
 *
 * Made on the first request with sharp, which the server already carries for
 * the upload strip (server/lib/uploads.ts), and kept in memory rather than on
 * the volume, for three reasons:
 *   - a copy on disk is a second file the erasure path would have to find and
 *     unlink; held here it dies with the process or the cache, and the route
 *     checks the original still exists (and is not suppressed) before it ever
 *     reads this cache, so an erased or hidden picture is never answered;
 *   - the uploads gauge and the orphan sweep count the volume's files, and a
 *     cache of copies is not something a founder uploaded;
 *   - the public ones are answered `immutable` for a year, so the CDN keeps
 *     them and the origin makes each copy about once per deploy.
 *
 * The key carries the original's size and mtime, so a file replaced under the
 * same name (no writer does that today) cannot be answered from a stale copy.
 * Bounded by bytes, oldest first out.
 */
import type { UploadVariantAsk } from "../../shared/uploadVariants";
import { UPLOAD_VARIANT_CROPS } from "../../shared/uploadVariants";

const MAX_BYTES = 24 * 1024 * 1024;
const cache = new Map<string, Buffer>();
let held = 0;
/** One encode per key at a time: a burst of first requests shares it. */
const inFlight = new Map<string, Promise<Buffer>>();

/*
 * WHAT ONE REQUEST MAY COST (integrator review of the resize). A copy is made
 * on a public, unauthenticated URL, so three ceilings bound it, and past any of
 * them the route simply sends the original file, which costs only a read:
 *   - a source over MAX_SOURCE_BYTES is never decoded;
 *   - sharp refuses a source over MAX_INPUT_PIXELS (a small file can still
 *     declare a huge canvas), and the route's catch sends the original;
 *   - at most MAX_ENCODES encodes run at once and MAX_WAITING wait their turn;
 *     a request beyond that gets the original instead of a place in line.
 */
export const MAX_SOURCE_BYTES = 15 * 1024 * 1024;
export const MAX_INPUT_PIXELS = 40_000_000;
export const MAX_ENCODES = 2;
export const MAX_WAITING = 16;
let encoding = 0;
const waiting: Array<() => void> = [];

/** A turn at the encoder, or null when the line is already full. */
function takeTurn(): Promise<(() => void) | null> {
  const release = () => {
    const next = waiting.shift();
    if (next) next();
    else encoding -= 1;
  };
  if (encoding < MAX_ENCODES) {
    encoding += 1;
    return Promise.resolve(release);
  }
  if (waiting.length >= MAX_WAITING) return Promise.resolve(null);
  return new Promise((resolve) => waiting.push(() => resolve(release)));
}

/** WebP at this quality: the copies are photographs drawn small, under a scrim or in a card. */
const QUALITY = 72;

export function variantKey(file: string, stat: { size: number; mtimeMs: number }, ask: UploadVariantAsk): string {
  return `${file}|${stat.size}|${Math.round(stat.mtimeMs)}|${ask.width}|${ask.crop ?? ""}`;
}

/** Encode one copy. Never larger than the original: `withoutEnlargement`. */
export async function renderVariant(input: Buffer | string, ask: UploadVariantAsk): Promise<Buffer> {
  const sharp = (await import("sharp")).default;
  const ratio = ask.crop ? UPLOAD_VARIANT_CROPS[ask.crop] : 0;
  return sharp(input, { limitInputPixels: MAX_INPUT_PIXELS })
    .rotate()
    .resize({
      width: ask.width,
      height: ratio ? Math.round(ask.width / ratio) : undefined,
      fit: "cover",
      position: "centre",
      withoutEnlargement: true,
    })
    .webp({ quality: QUALITY })
    .toBuffer();
}

/**
 * The copy for this file and ask, from memory when it is there, or why the
 * route should send the original instead: "too-large" is a lasting answer for
 * that file, "busy" is this moment only (the encoder's line is full), so the
 * route tells caches not to keep it. A source sharp refuses (too many pixels,
 * not an image) rejects, and the route sends the original from its catch.
 */
export async function uploadVariant(filePath: string, stat: { size: number; mtimeMs: number }, ask: UploadVariantAsk): Promise<Buffer | "too-large" | "busy"> {
  if (stat.size > MAX_SOURCE_BYTES) return "too-large";
  const key = variantKey(filePath, stat, ask);
  const hit = cache.get(key);
  if (hit) {
    // Refresh its place: the Map keeps insertion order, so the first key is the oldest.
    cache.delete(key);
    cache.set(key, hit);
    return hit;
  }
  const pending = inFlight.get(key);
  if (pending) return pending;
  const release = await takeTurn();
  if (!release) return "busy";
  const job = renderVariant(filePath, ask)
    .then((bytes) => {
      cache.set(key, bytes);
      held += bytes.length;
      while (held > MAX_BYTES && cache.size > 1) {
        const [oldest, b] = cache.entries().next().value as [string, Buffer];
        cache.delete(oldest);
        held -= b.length;
      }
      return bytes;
    })
    .finally(() => {
      inFlight.delete(key);
      release();
    });
  inFlight.set(key, job);
  return job;
}

/** For tests. */
export function clearUploadVariants(): void {
  cache.clear();
  held = 0;
}
