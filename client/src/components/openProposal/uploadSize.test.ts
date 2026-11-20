/**
 * What one application post carries, added up before it is sent (the ops request of 19 Nov 2026): an eight-minute
 * take at the largest phone rate, and three at the largest size a take may be, both fit; nothing past a cap is dropped, it is
 * named.
 */
import { describe, expect, it } from "vitest";
import { CLIP_MAX_BYTES, CLIPS_DEFAULT, FILE_MAX_BYTES, FILES_MAX, TAKES_MAX, RECORDING_BYTES_PER_SECOND, TAKE_MAX_BYTES, TAKE_MAX_SECONDS, uploadTotalMax } from "@shared/applyLimits";
import { attachedBytes, attachmentRoom, uploadProblem } from "./uploadSize";

const blob = (size: number) => ({ size });
const voice = (takes: number[], clips: number[] = [], consent = true) => ({
  consent,
  takes: takes.map((n) => ({ blob: blob(n) })),
  clips: Object.fromEntries(clips.map((n, i) => [`value-${i + 1}-title`, { blob: blob(n) }])),
});

describe("an application's uploads, added up", () => {
  it("a seven-minute take at the largest phone rate fits, and so do three takes at their cap with three full files", () => {
    const seven = 7 * 60 * RECORDING_BYTES_PER_SECOND;
    expect(uploadProblem([], voice([seven]), 12)).toBeNull();
    // A real Blob of the computed size, as the recorder hands it over.
    const take = new Blob([new Uint8Array(TAKE_MAX_BYTES)], { type: "audio/webm" });
    expect(take.size).toBe(TAKE_MAX_BYTES);
    expect(TAKE_MAX_SECONDS * RECORDING_BYTES_PER_SECOND).toBeLessThanOrEqual(take.size);
    const files = [1, 2, 3].map((i) => ({ name: `cv-${i}.pdf`, size: FILE_MAX_BYTES }));
    const full = voice([take.size, take.size, take.size], Array.from({ length: 12 }, () => CLIP_MAX_BYTES));
    expect(uploadProblem(files, full, 12)).toBeNull();
    expect(attachedBytes(files, full)).toBeLessThanOrEqual(attachmentRoom(12));
    expect(attachmentRoom(12)).toBeLessThan(uploadTotalMax(12));
  });

  it("the doubled counts fit whole (the lead, 19 Nov 2026): six full files, six full takes and 24 full clips", () => {
    const files = Array.from({ length: FILES_MAX }, (_, i) => ({ name: `cv-${i}.pdf`, size: FILE_MAX_BYTES }));
    const full = voice(Array.from({ length: TAKES_MAX }, () => TAKE_MAX_BYTES), Array.from({ length: CLIPS_DEFAULT }, () => CLIP_MAX_BYTES));
    expect(uploadProblem(files, full, CLIPS_DEFAULT)).toBeNull();
    expect(attachedBytes(files, full)).toBe(attachmentRoom(CLIPS_DEFAULT));
  });

  it("names what is over, and drops nothing", () => {
    const four = Array.from({ length: FILES_MAX + 1 }, (_, i) => i).map((i) => ({ name: `f${i}.pdf`, size: 10 }));
    expect(uploadProblem(four, voice([]), 12)).toEqual({ kind: "tooManyFiles", extra: 1 });
    expect(uploadProblem([{ name: "big.pdf", size: FILE_MAX_BYTES + 1 }], voice([]), 12)).toEqual({ kind: "fileTooBig", name: "big.pdf" });
    expect(uploadProblem([], voice([TAKE_MAX_BYTES + 1]), 12)).toEqual({ kind: "takeTooBig" });
    expect(uploadProblem([], voice([], [CLIP_MAX_BYTES + 1]), 12)).toEqual({ kind: "clipTooBig" });
  });

  it("recordings count only with the tick", () => {
    expect(attachedBytes([{ size: 5 }], voice([100], [7], false))).toBe(5);
    expect(attachedBytes([{ size: 5 }], voice([100], [7], true))).toBe(112);
  });
});
