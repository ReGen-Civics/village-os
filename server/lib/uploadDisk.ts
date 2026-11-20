/**
 * UPLOADS STREAM TO DISK, NEVER INTO MEMORY (the lead, 19 Nov 2026: "ensure we can receive full uploads").
 *
 * Until now multer held every byte of an application post in memory while it was judged, and a cap on the bytes in
 * flight kept four posts from outgrowing the server. Here each part is written to a private folder as it arrives,
 * so a post costs disk and a small buffer per part, however many parts it carries and however large they are.
 *
 * WHERE. `<proposal files root>/.incoming/`: on the data volume, beside the proposals' own private folders, so a
 * kept file is a copy on the same disk, and never under the public uploads folder (`/api/uploads/:filename` answers
 * anybody). A route with no private root falls back to the system's temp folder.
 *
 * NAMES are random (`in-<32 hex>.part`), made here and never from anything the sender typed.
 *
 * CLEANUP. Every file a request writes is recorded on the request, and removed when its answer has gone or its
 * connection has closed (`removeTempsWhenDone`): after success, after a refusal, after an error and after the sender
 * walks away mid-upload. A write still open when the connection drops is destroyed first, so no handle is left. A
 * part that starts after that is refused. Anything a crash left behind is swept by age (`sweepIncoming`).
 *
 * DISK, NOT MEMORY, IS WHAT A POST NOW COSTS, so the busy check is about room on the volume
 * (`roomFor`): the post's own length, every upload already being read, and a reserve kept free.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { Request, Response } from "express";
import type { StorageEngine } from "multer";

const TEMPS = Symbol.for("village.uploadTemps");

interface Tracked {
  paths: Set<string>;
  open: Set<fs.WriteStream>;
  done: boolean;
}

type WithTemps = Request & { [TEMPS]?: Tracked };

function trackOf(req: Request): Tracked {
  const r = req as WithTemps;
  if (!r[TEMPS]) r[TEMPS] = { paths: new Set(), open: new Set(), done: false };
  return r[TEMPS];
}


/* ── Only files this server wrote ────────────────────────────────────────────
 * Every path an upload reader opens, copies or moves came from this module: a folder registered below and a name
 * it generated (`in-<32 hex>.part` while streaming, `up-<32 hex>.bin` once kept as a part). A path that is not
 * both is refused before any file call, so a value from a request can never steer a read, copy or move elsewhere.
 */
const UPLOAD_ROOTS = new Set<string>();
const UPLOAD_NAME = /^(?:in-[0-9a-f]{32}\.part|up-[0-9a-f]{32}\.bin)$/;

/** Record a folder this server streams uploads into or keeps parts in. */
export function registerUploadRoot(dir: string): void {
  UPLOAD_ROOTS.add(path.resolve(dir));
}

/** The resolved path when it is a file this server wrote under a registered upload folder; otherwise it throws. */
export function uploadedFilePath(p: string): string {
  const resolved = path.resolve(String(p));
  const name = path.basename(resolved);
  if (!UPLOAD_NAME.test(name)) throw new Error("not an uploaded file");
  for (const root of Array.from(UPLOAD_ROOTS)) {
    if (resolved.startsWith(root + path.sep) && path.dirname(resolved) === root) return resolved;
  }
  throw new Error("not an uploaded file");
}

/** The folder uploads stream into: under the private root when there is one, else the system's temp folder. */
export function incomingDir(privateRoot?: string): string {
  return privateRoot ? path.join(privateRoot, ".incoming") : path.join(os.tmpdir(), "village-incoming-uploads");
}

/** A file multer wrote with this engine: where it is and how big. It carries no `buffer`. */
export interface DiskFile {
  originalname: string;
  fieldname: string;
  path: string;
  size: number;
}

/**
 * A multer storage engine that writes each part to its own new file in `dir` as the bytes arrive. multer's own
 * limits (fileSize, files, fields) still apply: they work on the stream, whatever the engine.
 */
export function streamToDisk(dir: string): StorageEngine {
  registerUploadRoot(dir);
  return {
    _handleFile(req, file, cb) {
      const t = trackOf(req);
      if (t.done) {
        file.stream.resume();
        return cb(new Error("the request has already finished"));
      }
      fs.promises.mkdir(dir, { recursive: true, mode: 0o700 }).then(
        () => {
          if (t.done) {
            file.stream.resume();
            return cb(new Error("the request has already finished"));
          }
          const name = `in-${crypto.randomBytes(16).toString("hex")}.part`;
          const target = path.join(dir, name);
          t.paths.add(target);
          const out = fs.createWriteStream(target, { flags: "wx", mode: 0o600 });
          t.open.add(out);
          let size = 0;
          let settled = false;
          const fail = (err: Error) => {
            if (settled) return;
            settled = true;
            file.stream.unpipe(out);
            file.stream.resume();
            out.destroy();
            t.open.delete(out);
            fs.rm(target, { force: true }, () => undefined);
            cb(err);
          };
          file.stream.on("data", (chunk: Buffer) => {
            size += chunk.length;
          });
          file.stream.on("error", fail);
          out.on("error", fail);
          out.on("close", () => t.open.delete(out));
          out.on("finish", () => {
            if (settled) return;
            settled = true;
            cb(null, { path: target, size, filename: name, destination: dir });
          });
          file.stream.pipe(out);
        },
        (err) => {
          file.stream.resume();
          cb(err);
        },
      );
    },
    _removeFile(_req, file, cb) {
      fs.rm((file as { path?: string }).path ?? "", { force: true }, () => cb(null));
    },
  };
}

/** Remove every file this request wrote once its answer has gone or its connection closed. Call it before multer runs. */
export function removeTempsWhenDone(req: Request, res: Response): void {
  const t = trackOf(req);
  const clean = () => {
    if (t.done) return;
    t.done = true;
    t.open.forEach((out) => out.destroy());
    t.open.clear();
    t.paths.forEach((p) => fs.rm(p, { force: true }, () => undefined));
  };
  res.once("finish", clean);
  res.once("close", clean);
}

/** The paths a request has written so far (for tests and for the route's own checks). */
export function tempsOf(req: Request): string[] {
  return Array.from(trackOf(req).paths);
}

/** Bytes free on the volume that holds `dir` (its nearest existing folder), or null where the system cannot say. */
export async function freeBytes(dir: string): Promise<number | null> {
  let at = dir;
  for (let i = 0; i < 8; i++) {
    try {
      const s = await fs.promises.statfs(at);
      return Number(s.bavail) * Number(s.bsize);
    } catch {
      const up = path.dirname(at);
      if (up === at) return null;
      at = up;
    }
  }
  return null;
}

/**
 * Whether the volume has room for an upload of `length` while `reading` bytes of other uploads are arriving, with
 * `reserve` kept free. Where the system cannot say how much is free, the count cap alone decides.
 */
export async function roomFor(dir: string, length: number, reading: number, reserve: number, free: (d: string) => Promise<number | null> = freeBytes): Promise<boolean> {
  const left = await free(dir);
  if (left === null) return true;
  return left - reading - length >= reserve;
}

/** Remove what a crash left in the incoming folder: every entry older than `olderThanMs`. Returns how many went. */
export async function sweepIncoming(dir: string, olderThanMs: number, now = Date.now()): Promise<number> {
  let names: string[];
  try {
    names = await fs.promises.readdir(dir);
  } catch {
    return 0;
  }
  let removed = 0;
  for (const name of names) {
    const p = path.join(dir, name);
    try {
      const st = await fs.promises.stat(p);
      if (st.isDirectory()) {
        removed += await sweepIncoming(p, olderThanMs, now);
        continue;
      }
      if (now - st.mtimeMs < olderThanMs) continue;
      await fs.promises.rm(p, { force: true });
      removed += 1;
    } catch {
      /* raced another sweep */
    }
  }
  return removed;
}
