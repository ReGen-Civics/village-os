/**
 * SMALLER COPIES OF A VILLAGE'S OWN PICTURES, ASKED FOR BY URL.
 *
 * The landing page's four path cards are drawn 356 by 112 CSS pixels on a
 * phone, and each one downloaded the whole upload: 1120 by 1400 portraits of
 * 120 to 240 KB, cropped by `object-cover` to a strip a tenth of that area.
 * The upload stays the only file on the volume. `/api/uploads/<file>?w=800`
 * answers a copy 800 pixels wide, and `&crop=band` also cuts it to a 3:1 strip
 * around the centre, which is the same centre `object-cover` keeps.
 *
 * The widths are a short fixed list, so a stranger cannot make the server
 * encode a thousand sizes of one picture, and every copy is cacheable at one
 * stable URL. server/lib/uploadVariants.ts makes them; this file is the half
 * the client and the server share, so a srcset can never ask for a width the
 * server refuses.
 */

/** The widths a copy can be asked for, in pixels. */
export const UPLOAD_VARIANT_WIDTHS = [480, 800, 1200] as const;
export type UploadVariantWidth = (typeof UPLOAD_VARIANT_WIDTHS)[number];

/** The crops a copy can be asked for: "band" is a 3:1 strip around the centre. */
export const UPLOAD_VARIANT_CROPS = { band: 3 } as const;
export type UploadVariantCrop = keyof typeof UPLOAD_VARIANT_CROPS;

/** The raster types a copy is made from. A GIF can be animated and an SVG is not a raster, so neither is. */
const RESIZABLE = /\.(?:jpe?g|png|webp|avif)$/i;

/** True for a village upload this server can make smaller copies of. */
export function isResizableUpload(src: string | null | undefined): src is string {
  if (!src) return false;
  const bare = src.split(/[?#]/)[0];
  return bare.startsWith("/api/uploads/") && RESIZABLE.test(bare);
}

/** The URL of one copy. */
export function uploadVariantUrl(src: string, width: UploadVariantWidth, crop?: UploadVariantCrop): string {
  return `${src}?w=${width}${crop ? `&crop=${crop}` : ""}`;
}

/**
 * A `srcset` for an upload, or undefined for anything else (a picture on
 * another host, a file in client/public, an empty value), which then loads
 * exactly as it did before.
 */
export function uploadSrcSet(src: string | null | undefined, crop?: UploadVariantCrop): string | undefined {
  if (!isResizableUpload(src)) return undefined;
  return UPLOAD_VARIANT_WIDTHS.map((w) => `${uploadVariantUrl(src, w, crop)} ${w}w`).join(", ");
}

export interface UploadVariantAsk {
  width: UploadVariantWidth;
  crop?: UploadVariantCrop;
}

/**
 * What a request asked for. Null for no copy (the original is served), and
 * "refused" for a query that names a width or crop outside the lists, which
 * the route answers with a 400 rather than silently with the original.
 */
export function parseUploadVariant(query: Record<string, unknown>): UploadVariantAsk | null | "refused" {
  const w = query.w;
  const crop = query.crop;
  if (w === undefined && crop === undefined) return null;
  const width = Number(w);
  if (typeof w !== "string" || !(UPLOAD_VARIANT_WIDTHS as readonly number[]).includes(width) || String(width) !== w) return "refused";
  if (crop === undefined) return { width: width as UploadVariantWidth };
  if (typeof crop !== "string" || !Object.prototype.hasOwnProperty.call(UPLOAD_VARIANT_CROPS, crop)) return "refused";
  return { width: width as UploadVariantWidth, crop: crop as UploadVariantCrop };
}
