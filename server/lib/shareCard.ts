/**
 * THE VILLAGE'S LINK-PREVIEW PICTURE, AT THE SIZE EVERY PREVIEWER WANTS.
 *
 *   GET /api/share-card.jpg   server/routes/shareCard.ts serves it
 *
 * The share card names one picture: the "Whole site" page's share picture
 * (Admin, Pages, Whole site) or else the homepage hero. Uploads are re-encoded
 * to WebP at their own shape (server/routes/brandUploads.ts), so that picture
 * reached chat apps and social sites as a 1200x800 WebP, and several of them
 * handle WebP poorly and crop anything that is not 1.91:1 on their own terms.
 *
 * So the server makes the card from the picture the village chose: 1200x630,
 * JPEG, cropped around whatever sharp's attention strategy finds interesting,
 * metadata gone. Changing the picture stays one field in Admin. The card is
 * held in memory, keyed by the file's name, size and mtime, so a new picture
 * is a new card with nothing to clear by hand.
 *
 * ONLY THE VILLAGE'S OWN VOLUME IS READ. A picture on another host is never
 * fetched (that would be a server-side request any admin could aim anywhere),
 * so an external address keeps going into the preview tags exactly as typed,
 * and the route answers 404 for it. The same checks the uploads route makes
 * apply here: a form's attachment, a hidden or taken-down photograph and a
 * member's own picture (served `private` so erasure reaches it) never become a
 * card on a public, shared-cacheable address.
 *
 * `shareCardSource` is the ONE answer to "does this village have a card". The
 * preview tags (server/lib/pageMeta.ts) and the route both ask it, so a tag can
 * never point at a card the route would refuse.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { isResizableUpload } from "../../shared/uploadVariants";
import { isSuppressedUpload } from "./placePhotos";
import { attachmentName } from "./submissionAttachments";
import { isMemberOwnedUpload } from "./uploads";
import { MAX_INPUT_PIXELS, MAX_SOURCE_BYTES } from "./uploadVariants";
import { SHARE_CARD_HEIGHT, SHARE_CARD_PATH, SHARE_CARD_WIDTH, type ShareCardLookup } from "./pageMeta";

export { SHARE_CARD_HEIGHT, SHARE_CARD_PATH, SHARE_CARD_WIDTH, type ShareCardLookup };
/** JPEG at this quality: a photograph drawn once in a chat, where 85 is indistinguishable from the original. */
const QUALITY = 85;

/** The upload a card is made from, and the version its address carries. */
export interface ShareCardSource {
  /** The file on the volume. */
  file: string;
  /** Its name, as /api/uploads/<name> serves it. */
  name: string;
  size: number;
  mtimeMs: number;
  /** A short hash of name, size and mtime: the card's ETag and its `?v=`. */
  version: string;
}

/**
 * The upload's file name when `picture` is one of this village's own uploads:
 * a site path under /api/uploads/, or a full address on this same origin.
 * Null for anything else, a picture on another host included. One path segment
 * only, so nothing here can name a file outside the volume.
 */
export function localUploadName(picture: string, origin: string): string | null {
  let p = String(picture ?? "").trim();
  if (!p) return null;
  if (/^https?:\/\//i.test(p)) {
    let url: URL;
    try {
      url = new URL(p);
    } catch {
      return null;
    }
    if (!origin || url.origin !== origin.replace(/\/+$/, "")) return null;
    p = url.pathname;
  }
  p = p.split(/[?#]/)[0];
  if (!p.startsWith("/api/uploads/")) return null;
  const rest = p.slice("/api/uploads/".length);
  if (!rest || rest !== path.posix.basename(rest) || rest !== path.win32.basename(rest)) return null;
  if (rest === "." || rest === ".." || rest.includes("%")) return null;
  return isResizableUpload(`/api/uploads/${rest}`) ? rest : null;
}

/** The upload a card can be made from, or null when the picture is not one of ours, is missing, or may not be shown. */
export function shareCardSource(picture: string, origin: string, uploadsDir: string): ShareCardSource | null {
  const name = localUploadName(picture, origin);
  if (!name || attachmentName(name) || isSuppressedUpload(name) || isMemberOwnedUpload(name)) return null;
  const file = path.join(uploadsDir, name);
  let stat: fs.Stats;
  try {
    stat = fs.statSync(file);
  } catch {
    return null;
  }
  if (!stat.isFile() || stat.size === 0 || stat.size > MAX_SOURCE_BYTES) return null;
  const mtimeMs = Math.round(stat.mtimeMs);
  const version = crypto.createHash("sha256").update(`${name}|${stat.size}|${mtimeMs}`).digest("hex").slice(0, 12);
  return { file, name, size: stat.size, mtimeMs, version };
}

/** The lookup the preview tags take, bound to this village's volume. */
export function shareCardLookup(uploadsDir: string): ShareCardLookup {
  return (picture, origin) => shareCardSource(picture, origin, uploadsDir)?.version ?? null;
}

/**
 * One card. `rotate()` honours a phone photo's orientation before the crop;
 * `flatten` gives a transparent PNG a white ground, since JPEG has no alpha and
 * would otherwise draw it black. sharp writes no metadata unless asked, so the
 * EXIF, GPS and ICC blocks of the source never reach the card.
 */
export async function renderShareCard(input: Buffer | string): Promise<Buffer> {
  const sharp = (await import("sharp")).default;
  return sharp(input, { limitInputPixels: MAX_INPUT_PIXELS })
    .rotate()
    .resize(SHARE_CARD_WIDTH, SHARE_CARD_HEIGHT, { fit: "cover", position: sharp.strategy.attention })
    .flatten({ background: "#ffffff" })
    .jpeg({ quality: QUALITY, mozjpeg: true })
    .toBuffer();
}

/*
 * A village has one share picture at a time, so a few entries cover the swap
 * between an old picture and a new one; the oldest goes first.
 */
const CACHE_MAX = 4;
const cache = new Map<string, Buffer>();
/** One render per source at a time: a link posted in a busy chat draws a burst of previewers at once. */
const inFlight = new Map<string, Promise<Buffer>>();

const keyOf = (s: ShareCardSource) => `${s.name}|${s.size}|${s.mtimeMs}`;

/** The card already made for this source, if there is one. Costs nothing. */
export function cachedShareCard(source: ShareCardSource): Buffer | undefined {
  return cache.get(keyOf(source));
}

/** The card for this source, rendered once and then held. Rejects when sharp refuses the file. */
export function makeShareCard(source: ShareCardSource): Promise<Buffer> {
  const key = keyOf(source);
  const hit = cache.get(key);
  if (hit) return Promise.resolve(hit);
  const pending = inFlight.get(key);
  if (pending) return pending;
  // The bytes, never the path: libvips keeps its own cache of files it opened by name, so a
  // picture replaced under the same name would render the old one (the route test caught this).
  const job = fs.promises
    .readFile(source.file)
    .then(renderShareCard)
    .then((bytes) => {
      cache.set(key, bytes);
      while (cache.size > CACHE_MAX) {
        const oldest = cache.keys().next();
        if (oldest.done) break;
        cache.delete(oldest.value);
      }
      return bytes;
    })
    .finally(() => inFlight.delete(key));
  inFlight.set(key, job);
  return job;
}

/** For tests. */
export function clearShareCards(): void {
  cache.clear();
}
