/**
 * A RECORDING EVERY BROWSER CAN PLAY (the lead, 17 Nov 2026; server/lib/voicePlayback.ts).
 *
 * A real WebM and a real Ogg, as Chrome and Firefox record them, become an
 * MP4/AAC copy Safari and iPhones play; the copy is kept beside the original so
 * the tidy job takes it too; an MP4 is its own copy; and with no ffmpeg the
 * answer is null, never a broken file.
 */
import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { voiceNoteKind, type VoiceNote } from "../../shared/voiceNotes";
import { removeVoiceNotes } from "./proposalFiles";
import { PLAY_COPY_SUFFIX, ffmpegAvailable, playableCopy, resetFfmpegCheck, wantsMp4 } from "./voicePlayback";
import { TINY_OGG_OPUS, TINY_WEBM_OPUS } from "./voiceRecordingFixtures";

const hasFfmpeg = spawnSync("ffmpeg", ["-hide_banner", "-version"], { stdio: "ignore" }).status === 0;
if (!hasFfmpeg) console.warn("[voicePlayback] no ffmpeg on this machine: the transcoding cases are SKIPPED. A skip is not a pass.");

const PROPOSAL = "op-0123456789abcdef0123";
let root = "";

function keep(bytes: Buffer, kind: VoiceNote["kind"]): VoiceNote {
  const id = `pv-${crypto.randomBytes(8).toString("hex")}`;
  fs.mkdirSync(path.join(root, PROPOSAL), { recursive: true });
  fs.writeFileSync(path.join(root, PROPOSAL, `${id}.${kind}`), bytes);
  return { id, kind, seconds: 2, size: bytes.length, sha256: crypto.createHash("sha256").update(bytes).digest("hex") };
}

beforeAll(async () => {
  root = await fs.promises.mkdtemp(path.join(os.tmpdir(), "voice-play-test-"));
});
afterAll(async () => {
  await fs.promises.rm(root, { recursive: true, force: true });
});
afterEach(() => {
  delete process.env.FFMPEG_PATH;
  resetFfmpegCheck();
});

describe("which copy a door is asked for", () => {
  it("only `as=mp4` asks for the copy", () => {
    expect(wantsMp4("mp4")).toBe(true);
    expect(wantsMp4(undefined)).toBe(false);
    expect(wantsMp4(["mp4"])).toBe(false);
    expect(wantsMp4("webm")).toBe(false);
  });
});

describe.skipIf(!hasFfmpeg)("an MP4/AAC copy, with ffmpeg here", () => {
  for (const [name, bytes, kind] of [["Chrome's WebM", TINY_WEBM_OPUS, "webm"], ["Firefox's Ogg", TINY_OGG_OPUS, "ogg"]] as const) {
    it(`turns ${name} into MP4 with AAC inside, about as long, and keeps it beside the original`, async () => {
      const note = keep(bytes, kind);
      const copy = await playableCopy(root, PROPOSAL, note, bytes);
      expect(copy).not.toBeNull();
      expect(voiceNoteKind(new Uint8Array(copy!))).toBe("m4a");
      const probe = path.join(root, `probe-${note.id}.m4a`);
      fs.writeFileSync(probe, copy!);
      // ffmpeg reads the copy back: AAC audio, two seconds.
      const read = spawnSync("ffmpeg", ["-hide_banner", "-i", probe], { encoding: "utf8" });
      expect(read.stderr).toMatch(/Audio: aac/);
      expect(read.stderr).toMatch(/Duration: 00:00:0[12]\./);
      const kept = path.join(root, PROPOSAL, `${note.id}${PLAY_COPY_SUFFIX}`);
      expect(fs.readFileSync(kept).equals(copy!)).toBe(true);
      // The second ask reads the kept copy, made once.
      fs.writeFileSync(kept, Buffer.from("kept copy"));
      expect((await playableCopy(root, PROPOSAL, note, bytes))?.toString()).toBe("kept copy");
      fs.rmSync(probe);
    });
  }

  it("the tidy job's removal takes the copy with the original", async () => {
    const note = keep(TINY_WEBM_OPUS, "webm");
    await playableCopy(root, PROPOSAL, note, TINY_WEBM_OPUS);
    const names = () => fs.readdirSync(path.join(root, PROPOSAL)).filter((n) => n.startsWith(note.id));
    expect(names().sort()).toEqual([`${note.id}${PLAY_COPY_SUFFIX}`, `${note.id}.webm`]);
    await removeVoiceNotes(root, PROPOSAL);
    expect(names()).toEqual([]);
  });

  it("makes no copy for a recording already gone from the folder", async () => {
    const note = keep(TINY_WEBM_OPUS, "webm");
    fs.rmSync(path.join(root, PROPOSAL, `${note.id}.webm`));
    // The bytes were read before the tidy ran: the person still hears them, nothing is left behind.
    expect(await playableCopy(root, PROPOSAL, note, TINY_WEBM_OPUS)).not.toBeNull();
    expect(fs.existsSync(path.join(root, PROPOSAL, `${note.id}${PLAY_COPY_SUFFIX}`))).toBe(false);
  });

  it("answers null for bytes ffmpeg cannot read, keeping nothing", async () => {
    const junk = Buffer.concat([TINY_WEBM_OPUS.subarray(0, 16), Buffer.alloc(200, 7)]);
    const note = keep(junk, "webm");
    expect(await playableCopy(root, PROPOSAL, note, junk)).toBeNull();
    expect(fs.existsSync(path.join(root, PROPOSAL, `${note.id}${PLAY_COPY_SUFFIX}`))).toBe(false);
  });
});

describe("without ffmpeg, or for an MP4", () => {
  it("an MP4 recording is its own copy, with or without ffmpeg", async () => {
    process.env.FFMPEG_PATH = path.join(root, "no-such-ffmpeg");
    const mp4 = Buffer.concat([Buffer.from([0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70, 0x4d, 0x34, 0x41, 0x20]), Buffer.alloc(32, 2)]);
    const note = keep(mp4, "m4a");
    expect(await playableCopy(root, PROPOSAL, note, mp4)).toBe(mp4);
  });

  it("with no ffmpeg, a WebM has no copy: null, and nothing written", async () => {
    process.env.FFMPEG_PATH = path.join(root, "no-such-ffmpeg");
    expect(await ffmpegAvailable()).toBe(false);
    const note = keep(TINY_WEBM_OPUS, "webm");
    expect(await playableCopy(root, PROPOSAL, note, TINY_WEBM_OPUS)).toBeNull();
    expect(fs.existsSync(path.join(root, PROPOSAL, `${note.id}${PLAY_COPY_SUFFIX}`))).toBe(false);
  });

  it("never makes a path from an id that is not one", async () => {
    const note: VoiceNote = { id: "../../etc", kind: "webm", seconds: 1, size: 1, sha256: "0".repeat(64) };
    expect(await playableCopy(root, PROPOSAL, note, TINY_WEBM_OPUS)).toBeNull();
    expect(await playableCopy(root, "../x", { ...note, id: "pv-0000000000000000" }, TINY_WEBM_OPUS)).toBeNull();
  });
});
