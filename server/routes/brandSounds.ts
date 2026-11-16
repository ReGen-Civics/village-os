/**
 * A VILLAGE'S OWN SOUNDS (gap G8).
 *
 *   GET    /api/brand/sounds                 { volume, files } for client/src/lib/sound.ts, public
 *   POST   /api/admin/brand/sound            multipart `file` + `moment`: one short file for a moment
 *   DELETE /api/admin/brand/sound/:moment    that moment goes silent again
 *   PUT    /api/admin/brand/sounds           { volume } the village-wide ceiling, 0 to 1
 *
 * The audio layer had five moments and a way to map them to files, and nothing
 * ever set it, so every village was silent. A village uploads its own here
 * (OGG Vorbis or MP3, checked by their bytes, 300 KB at most, which is a long
 * one-shot); the files live in the uploads volume and the map lives in the
 * brand document at `theme.sounds`. Nothing plays unless a member has turned
 * sound on: the member's own mute and reduced-motion silence stay in charge.
 */
import type { Express } from "express";
import multer from "multer";
import type { AppDeps } from "../lib/appDeps";
import { writeToVolume } from "../lib/uploads";
import { SOUND_MOMENT_IDS, type SoundMomentId } from "../../shared/soundMoments";

type Deps = Pick<AppDeps, "isAdmin" | "brandRepo" | "uploadsDir"> & {
  /** The brand document as the rest of the server reads it. */
  getBrand(): any;
};

export const MAX_SOUND_BYTES = 300 * 1024;

/** OGG ("OggS") or MP3 (an ID3 tag or an MPEG frame sync), by the bytes. */
export function soundKindOf(b: Buffer): "ogg" | "mp3" | null {
  if (b.length > 4 && b.toString("ascii", 0, 4) === "OggS") return "ogg";
  if (b.length > 3 && b.toString("ascii", 0, 3) === "ID3") return "mp3";
  if (b.length > 2 && b[0] === 0xff && (b[1] & 0xe0) === 0xe0) return "mp3";
  return null;
}

/** The stored map, cleaned: known moments only, file names only. */
export function soundsOf(theme: any): { volume: number; files: Partial<Record<SoundMomentId, { ogg?: string; mp3?: string }>> } {
  const raw = theme?.sounds && typeof theme.sounds === "object" ? theme.sounds : {};
  const volume = typeof raw.volume === "number" && raw.volume >= 0 && raw.volume <= 1 ? raw.volume : 0.5;
  const files: Partial<Record<SoundMomentId, { ogg?: string; mp3?: string }>> = {};
  for (const m of SOUND_MOMENT_IDS) {
    const f = raw.files?.[m];
    const ok = (n: unknown) => (typeof n === "string" && /^brand-sound-[a-z_]+-[a-z0-9-]+\.(ogg|mp3)$/.test(n) ? n : undefined);
    const ogg = ok(f?.ogg);
    const mp3 = ok(f?.mp3);
    if (ogg || mp3) files[m] = { ...(ogg ? { ogg } : {}), ...(mp3 ? { mp3 } : {}) };
  }
  return { volume, files };
}

export function register(app: Express, deps: Deps): void {
  const { isAdmin, brandRepo, uploadsDir, getBrand } = deps;
  const save = async (sounds: ReturnType<typeof soundsOf>) => {
    const current = getBrand();
    await brandRepo.put({ ...current, theme: { ...current.theme, sounds } } as any);
  };

  app.get("/api/brand/sounds", (_req, res) => {
    res.setHeader("Cache-Control", "public, max-age=300");
    res.json(soundsOf(getBrand()?.theme));
  });

  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_SOUND_BYTES, files: 1 } });

  app.post("/api/admin/brand/sound", async (req, res) => {
    if (!(await isAdmin(req))) return res.status(401).json({ error: "auth_required" });
    upload.single("file")(req as any, res as any, async (err: any) => {
      if (err) {
        const tooBig = String(err?.code ?? "") === "LIMIT_FILE_SIZE";
        return res.status(400).json({ error: tooBig ? `A sound is a short one-shot. Keep it under ${MAX_SOUND_BYTES / 1024} KB.` : "That file did not arrive." });
      }
      // The moment comes from the closed list itself, never from the request,
      // so nothing a caller sends reaches the file name.
      const moment = SOUND_MOMENT_IDS.find((m) => m === req.body?.moment);
      if (!moment) return res.status(400).json({ error: `Name the moment this sound is for: ${SOUND_MOMENT_IDS.join(", ")}.` });
      const file = (req as any).file;
      if (!file?.buffer?.length) return res.status(400).json({ error: "Choose a sound file first." });
      const kind = soundKindOf(file.buffer);
      if (!kind) return res.status(400).json({ error: "Not a sound file this site can play. Upload an OGG (best) or an MP3." });
      const name = `brand-sound-${moment}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${kind === "ogg" ? "ogg" : "mp3"}`;
      writeToVolume(uploadsDir, name, file.buffer);
      const sounds = soundsOf(getBrand()?.theme);
      sounds.files[moment] = { ...(sounds.files[moment] ?? {}), [kind]: name };
      await save(sounds);
      res.json({ success: true, moment, kind, file: name, sounds });
    });
  });

  app.delete("/api/admin/brand/sound/:moment", async (req, res) => {
    if (!(await isAdmin(req))) return res.status(401).json({ error: "auth_required" });
    const moment = SOUND_MOMENT_IDS.find((m) => m === req.params.moment);
    if (!moment) return res.status(404).json({ error: "There is no such moment." });
    const sounds = soundsOf(getBrand()?.theme);
    delete sounds.files[moment];
    await save(sounds);
    res.json({ success: true, sounds });
  });

  app.put("/api/admin/brand/sounds", async (req, res) => {
    if (!(await isAdmin(req))) return res.status(401).json({ error: "auth_required" });
    const v = Number(req.body?.volume);
    if (!Number.isFinite(v) || v < 0 || v > 1) return res.status(400).json({ error: "The volume is a number from 0 to 1." });
    const sounds = soundsOf(getBrand()?.theme);
    sounds.volume = Math.round(v * 100) / 100;
    await save(sounds);
    res.json({ success: true, sounds });
  });
}
