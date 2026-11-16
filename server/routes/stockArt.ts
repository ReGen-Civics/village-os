/**
 * A VILLAGE'S OWN STOCK CAST (gap G10).
 *
 *   GET    /api/admin/characters/stock-art         which of the thirty this village has replaced
 *   PUT    /api/admin/characters/stock-art/:slot   multipart `art`: one picture for that slot
 *   DELETE /api/admin/characters/stock-art/:slot   go back to the platform's drawing
 *
 * Every village runs the same image, and the image carries thirty stock
 * drawings (server/routes/stockAvatars.ts). A village that wants its own cast
 * loads it here: each picture is cropped to 3:4, encoded to WebP at the stock
 * size, stripped and proven free of metadata (the portrait pipeline,
 * `encodeStockArt`), and written to `<uploads>/stock-avatars/<slot>.webp`. The
 * stock route serves it at the URL every caller already computes, so nothing
 * else changes and no migration is needed.
 *
 * `:slot` is checked against the closed set of thirty (`isStockSlot`) before it
 * goes anywhere near a path, so a name outside it is refused and never read or
 * written.
 *
 * THE GATES match the archetype words beside which this sits in Admin: the
 * read takes `isAdmin`, the writes take `story.tell` ("say what the village
 * is, in public, in its own words"), which is what a class's face is.
 */
import type { Express } from "express";
import fs from "node:fs";
import path from "node:path";
import multer from "multer";
import type { AppDeps } from "../lib/appDeps";
import { STOCK_SLOTS, isStockSlot } from "../lib/characters";
import { ACCEPTED_PORTRAIT_TYPES, MAX_PORTRAIT_BYTES, encodeStockArt, isPortraitMimeType } from "../lib/characterPortraits";
import { writeToVolume } from "../lib/uploads";
import { STOCK_ART_SUBDIR } from "./stockAvatars";

type Deps = Pick<AppDeps, "isAdmin" | "guardCapability" | "uploadsDir">;

/** The slots this village has replaced, read off the volume. */
export function replacedSlots(dir: string): string[] {
  return STOCK_SLOTS.filter((slot) => fs.existsSync(path.join(dir, `${slot}.webp`)));
}

export function register(app: Express, deps: Deps): void {
  const { isAdmin, guardCapability } = deps;
  const dir = path.join(deps.uploadsDir, STOCK_ART_SUBDIR);

  app.get("/api/admin/characters/stock-art", async (req, res) => {
    if (!(await isAdmin(req))) {
      return res.status(401).json({ error: "auth_required", message: "Sign in as an admin to see the village's cast." });
    }
    res.json({ slots: STOCK_SLOTS, replaced: replacedSlots(dir) });
  });

  app.put("/api/admin/characters/stock-art/:slot", async (req, res) => {
    const slot = String(req.params.slot ?? "");
    if (!isStockSlot(slot)) {
      return res.status(404).json({ error: "There is no such face in the stock cast. Name one of the thirty, such as building-f-deep." });
    }
    if (!(await guardCapability(req, res, "story.tell"))) return;
    const parse = multer({
      storage: multer.memoryStorage(),
      limits: { fileSize: MAX_PORTRAIT_BYTES, files: 1 },
      fileFilter: (_r, file, cb) => {
        if (isPortraitMimeType(file.mimetype)) cb(null, true);
        else cb(new Error(`Send a ${ACCEPTED_PORTRAIT_TYPES} picture.`));
      },
    }).single("art");
    parse(req as any, res as any, async (err: any) => {
      if (err) {
        const tooBig = String(err?.code ?? "") === "LIMIT_FILE_SIZE";
        return res.status(400).json({
          error: tooBig
            ? `That picture is over ${Math.round(MAX_PORTRAIT_BYTES / (1024 * 1024))} MB. Send a smaller one.`
            : String(err?.message ?? "That file did not arrive."),
        });
      }
      const file = (req as any).file;
      if (!file?.buffer?.length) return res.status(400).json({ error: "Choose a picture first." });
      try {
        const encoded = await encodeStockArt(file.buffer);
        writeToVolume(dir, `${slot}.webp`, encoded.bytes);
        res.json({ success: true, slot, width: encoded.width, height: encoded.height, bytes: encoded.bytes.length, replaced: replacedSlots(dir) });
      } catch (e: any) {
        // An unreadable picture, or one whose metadata survived the strip.
        res.status(400).json({ error: String(e?.message ?? "That picture could not be read. Try another file.") });
      }
    });
  });

  app.delete("/api/admin/characters/stock-art/:slot", async (req, res) => {
    const slot = String(req.params.slot ?? "");
    if (!isStockSlot(slot)) {
      return res.status(404).json({ error: "There is no such face in the stock cast." });
    }
    if (!(await guardCapability(req, res, "story.tell"))) return;
    const file = path.join(dir, `${slot}.webp`);
    if (fs.existsSync(file)) fs.rmSync(file);
    res.json({ success: true, slot, replaced: replacedSlots(dir) });
  });
}
