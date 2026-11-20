/**
 * PARTS SENT AHEAD OF THE APPLICATION (the lead, 19 Nov 2026; the host's edge closes a request body still arriving
 * after five minutes, shared/applyLimits.ts HOST_BODY_UPLOAD_MS).
 *
 * The form sends each file, take and clip in a request of its own (POST /api/open-proposals/parts), and the
 * application after, naming the parts by the ids this module handed back. A part is checked by its own bytes when
 * it arrives, kept in `<incoming>/parts/` under a random id, and checked again when the application takes it.
 *
 * AN ID IS THE ONLY KEY. It is 128 random bits, known to the page that sent the part and nobody else, and it names
 * nothing but a file in this private folder. A part no application takes is swept after PART_KEPT_MS.
 *
 * WHAT HAPPENS TO A PART: the application copies it into its own folder (server/lib/proposalFiles.ts), and the
 * staged copy is removed once the application's row is kept. A refused application leaves its parts for a second
 * try until they are swept.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { UploadedFile } from "./proposalFiles";
import { registerUploadRoot, uploadedFilePath } from "./uploadDisk";

/** Which list of the application a part belongs to, as the multipart route names its fields. */
export const PART_KINDS = ["files", "voice", "clips"] as const;
export type PartKind = (typeof PART_KINDS)[number];

export const isPartKind = (v: unknown): v is PartKind => typeof v === "string" && (PART_KINDS as readonly string[]).includes(v);

/** A part's id: `up-` and 32 hex characters. Anything else never becomes a path. */
export const PART_ID = /^up-[0-9a-f]{32}$/;

interface PartMeta {
  kind: PartKind;
  name: string;
  size: number;
}

export const partsDir = (incoming: string): string => {
  const dir = path.join(incoming, "parts");
  registerUploadRoot(dir);
  return dir;
};

/**
 * Keep an uploaded file as a part: moved (a rename on the same volume) from where the upload streamed it, with a
 * small note of its kind, name and size beside it. Returns the part's id.
 */
export async function stagePart(incoming: string, file: { path: string; size: number; originalname: string }, kind: PartKind): Promise<string> {
  const dir = partsDir(incoming);
  await fs.promises.mkdir(dir, { recursive: true, mode: 0o700 });
  const id = `up-${crypto.randomBytes(16).toString("hex")}`;
  const target = path.join(dir, `${id}.bin`);
  const from = uploadedFilePath(file.path);
  try {
    await fs.promises.rename(from, target);
  } catch {
    await fs.promises.copyFile(from, target);
  }
  const meta: PartMeta = { kind, name: String(file.originalname ?? "").slice(0, 400), size: file.size };
  await fs.promises.writeFile(path.join(dir, `${id}.json`), JSON.stringify(meta), { mode: 0o600 });
  return id;
}

/** The ids an application names, by list, read safely: anything that is not a list of ids is an empty list. */
export function partIdsOf(raw: unknown): Record<PartKind, string[]> {
  const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const list = (v: unknown) => (Array.isArray(v) ? v.map((x) => String(x)) : []);
  return { files: list(o.files), voice: list(o.voice), clips: list(o.clips) };
}

/**
 * The parts an application names, as uploaded files on disk, in the order named. `null` when any id is malformed,
 * unknown (swept, or never sent), named twice, or named in the wrong list: the application is refused and the page
 * sends its parts again.
 */
export async function resolveParts(incoming: string, ids: Record<PartKind, string[]>): Promise<Record<PartKind, UploadedFile[]> | null> {
  const dir = partsDir(incoming);
  const seen = new Set<string>();
  const out: Record<PartKind, UploadedFile[]> = { files: [], voice: [], clips: [] };
  for (const kind of PART_KINDS) {
    for (const id of ids[kind]) {
      if (!PART_ID.test(id) || seen.has(id)) return null;
      seen.add(id);
      let meta: PartMeta;
      try {
        meta = JSON.parse(await fs.promises.readFile(path.join(dir, `${id}.json`), "utf8")) as PartMeta;
        const st = await fs.promises.stat(path.join(dir, `${id}.bin`));
        if (meta.kind !== kind || st.size !== meta.size) return null;
      } catch {
        return null;
      }
      out[kind].push({ originalname: meta.name, path: path.join(dir, `${id}.bin`), size: meta.size });
    }
  }
  return out;
}

/** Remove parts once their application is kept. A part already gone is fine. */
export async function removeParts(incoming: string, ids: Record<PartKind, string[]>): Promise<void> {
  const dir = partsDir(incoming);
  for (const kind of PART_KINDS) {
    for (const id of ids[kind]) {
      if (!PART_ID.test(id)) continue;
      await fs.promises.rm(path.join(dir, `${id}.bin`), { force: true });
      await fs.promises.rm(path.join(dir, `${id}.json`), { force: true });
    }
  }
}
