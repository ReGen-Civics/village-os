/**
 * A RECORDING EVERY BROWSER CAN PLAY (the lead, 17 Nov 2026: "Make sure they
 * work on all browsers"). Chrome, Android and Firefox record WebM or Ogg with
 * Opus inside; Safari and every iPhone browser play MP4 with AAC inside and
 * may refuse the other two. So the deciders' and the admins' doors take
 * `?as=mp4` and answer with an MP4/AAC copy of the recording.
 *
 * THE ORIGINAL IS NEVER TOUCHED. It stays what the applicant's browser made,
 * checked against its fingerprint on every read (proposalFiles.ts
 * `readVoiceNote`). The copy is made from those checked bytes, the first time
 * somebody asks for it, by ffmpeg, and kept beside the original as
 * `<pv-id>.play.m4a`, so it follows every retention rule the original does:
 * `removeVoiceNotes` takes every `pv-` file, and the folder's removal takes the
 * rest. A recording that is already MP4 is its own copy.
 *
 * NO FFMPEG, NO COPY. The image ships a small ffmpeg built for exactly this
 * (Dockerfile, the `ffmpeg` stage: Opus, Vorbis and AAC decoders, the AAC
 * encoder, the WebM, Ogg and MP4 containers, and nothing else). Where it is
 * missing (a fork running from source on a machine without one), the door
 * answers 415 and the page offers the original, exactly as before.
 *
 * BOUNDED. Two copies are made at once at most, each with a time limit, from a
 * private scratch folder that is removed whatever happens.
 */
import { spawn } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { VoiceNote } from "../../shared/voiceNotes";

/** What a door's `as` asks for: the MP4/AAC copy, or the original. */
export function wantsMp4(raw: unknown): boolean {
  return raw === "mp4";
}

const PROPOSAL_DIR = /^op-[0-9a-f]{20}$/;
const NOTE_ID = /^pv-[0-9a-f]{16}$/;
export const PLAY_COPY_SUFFIX = ".play.m4a";
const TRANSCODE_TIMEOUT_MS = 60_000;
const AT_ONCE = 2;

let ffmpegChecked: Promise<boolean> | null = null;

/** The ffmpeg this process runs: FFMPEG_PATH when a host names one, else whatever `ffmpeg` is on the PATH. */
export function ffmpegBinary(env: NodeJS.ProcessEnv = process.env): string {
  return (env.FFMPEG_PATH ?? "").trim() || "ffmpeg";
}

/** Whether ffmpeg answers here. Asked once per process. */
export function ffmpegAvailable(): Promise<boolean> {
  if (!ffmpegChecked) {
    ffmpegChecked = new Promise<boolean>((resolve) => {
      try {
        const p = spawn(ffmpegBinary(), ["-hide_banner", "-version"], { stdio: "ignore" });
        p.on("error", () => resolve(false));
        p.on("exit", (code) => resolve(code === 0));
      } catch {
        resolve(false);
      }
    });
  }
  return ffmpegChecked;
}

/** For a suite: forget what was learned about ffmpeg. */
export function resetFfmpegCheck(): void {
  ffmpegChecked = null;
}

let running = 0;
const waiting: Array<() => void> = [];
async function slot<T>(work: () => Promise<T>): Promise<T> {
  if (running >= AT_ONCE) await new Promise<void>((resolve) => waiting.push(resolve));
  running += 1;
  try {
    return await work();
  } finally {
    running -= 1;
    waiting.shift()?.();
  }
}

/** Run ffmpeg once: the input file to an MP4/AAC file. Resolves true when it wrote one. */
function runFfmpeg(input: string, output: string): Promise<boolean> {
  return new Promise((resolve) => {
    let done = false;
    const finish = (ok: boolean) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      resolve(ok);
    };
    let p: ReturnType<typeof spawn>;
    try {
      p = spawn(
        ffmpegBinary(),
        ["-nostdin", "-hide_banner", "-loglevel", "error", "-y", "-i", input, "-vn", "-map_metadata", "-1", "-c:a", "aac", "-b:a", "64k", "-ac", "1", "-movflags", "+faststart", "-f", "mp4", output],
        { stdio: "ignore" },
      );
    } catch {
      return resolve(false);
    }
    const timer = setTimeout(() => {
      p.kill("SIGKILL");
      finish(false);
    }, TRANSCODE_TIMEOUT_MS);
    p.on("error", () => finish(false));
    p.on("exit", (code) => finish(code === 0));
  });
}

/**
 * The MP4/AAC copy of one kept recording, made from `original` (its checked
 * bytes) the first time it is asked for. Null when no copy can be made here.
 */
export async function playableCopy(root: string, proposalId: string, note: VoiceNote, original: Buffer): Promise<Buffer | null> {
  if (note.kind === "m4a") return original;
  if (!PROPOSAL_DIR.test(proposalId) || !NOTE_ID.test(note.id)) return null;
  const folder = path.join(root, proposalId);
  const kept = path.join(folder, `${note.id}${PLAY_COPY_SUFFIX}`);
  try {
    return await fs.promises.readFile(kept);
  } catch {
    /* not made yet */
  }
  if (!(await ffmpegAvailable())) return null;
  return slot(async () => {
    const scratch = await fs.promises.mkdtemp(path.join(os.tmpdir(), "voice-play-"));
    try {
      const input = path.join(scratch, `in.${note.kind}`);
      const output = path.join(scratch, "out.m4a");
      await fs.promises.writeFile(input, original);
      if (!(await runFfmpeg(input, output))) return null;
      const copy = await fs.promises.readFile(output);
      if (copy.length < 12) return null;
      // Kept beside the original only while the original is still there: a tidy that ran meanwhile wins.
      const stillKept = await fs.promises.stat(path.join(folder, `${note.id}.${note.kind}`)).then(() => true, () => false);
      if (stillKept) {
        const tmp = `${kept}.${crypto.randomBytes(4).toString("hex")}`;
        await fs.promises.writeFile(tmp, copy);
        await fs.promises.rename(tmp, kept).catch(() => fs.promises.rm(tmp, { force: true }));
      }
      return copy;
    } catch {
      return null;
    } finally {
      await fs.promises.rm(scratch, { recursive: true, force: true }).catch(() => undefined);
    }
  });
}
