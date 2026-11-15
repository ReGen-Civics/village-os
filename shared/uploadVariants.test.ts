import { describe, expect, it } from "vitest";
import { isResizableUpload, parseUploadVariant, uploadSrcSet, uploadVariantUrl, UPLOAD_VARIANT_WIDTHS } from "./uploadVariants";

describe("upload variants, the half the page and the server share", () => {
  it("offers a srcset only for a raster upload on this server", () => {
    expect(uploadSrcSet("/api/uploads/village-hero.webp")).toBe("/api/uploads/village-hero.webp?w=480 480w, /api/uploads/village-hero.webp?w=800 800w, /api/uploads/village-hero.webp?w=1200 1200w");
    expect(uploadSrcSet("/api/uploads/card.jpg", "band")).toContain("/api/uploads/card.jpg?w=800&crop=band 800w");
    for (const src of ["", null, undefined, "https://cdn.example/a.webp", "/images/a.webp", "/api/uploads/anim.gif", "/api/uploads/logo.svg", "/api/uploads/cap-table.pdf"]) {
      expect(uploadSrcSet(src), String(src)).toBeUndefined();
    }
  });

  it("reads back every URL it writes", () => {
    for (const w of UPLOAD_VARIANT_WIDTHS) {
      const q = Object.fromEntries(new URLSearchParams(uploadVariantUrl("/api/uploads/a.webp", w, "band").split("?")[1]));
      expect(parseUploadVariant(q)).toEqual({ width: w, crop: "band" });
    }
    expect(parseUploadVariant({ w: "800" })).toEqual({ width: 800 });
    expect(parseUploadVariant({})).toBeNull();
    expect(isResizableUpload("/api/uploads/a.webp?w=800")).toBe(true);
  });

  it("refuses a width or a crop outside the lists, so a stranger cannot ask for a thousand sizes", () => {
    for (const q of [{ w: "801" }, { w: "0800" }, { w: "800.0" }, { w: ["800", "480"] }, { crop: "band" }, { w: "800", crop: "square" }, { w: "800", crop: "__proto__" }]) {
      expect(parseUploadVariant(q as Record<string, unknown>), JSON.stringify(q)).toBe("refused");
    }
  });
});
