/**
 * The application's limits, one source (the ops request of 19 Nov 2026): every older name reads these numbers,
 * the sizing rules hold, the upload sums are true, and a summary that has to be shortened says so.
 */
import { describe, expect, it } from "vitest";
import {
  APPLY_COUNTS,
  APPLY_TEXT,
  CLIP_MAX_BYTES,
  CLIP_SECONDS_CEILING,
  CLIPS_CEILING,
  FILE_MAX_BYTES,
  FILES_MAX,
  CLIPS_DEFAULT,
  HOST_BODY_UPLOAD_MS,
  OPEN_UPLOAD_DISK_RESERVE_BYTES,
  PROVIDER_UPLOAD_MAX_BYTES,
  RECORDING_BYTES_PER_SECOND,
  SPEECH_CHARS_PER_MINUTE,
  SUMMARY_MORE,
  TAKE_MAX_BYTES,
  TAKE_MAX_SECONDS,
  TAKES_MAX,
  UPLOAD_ENVELOPE_BYTES,
  VOICE_BOX_FLOOR,
  summaryWithin,
  uploadTotalMax,
} from "./applyLimits";
import { OPEN_AIM_MAX, OPEN_WHY_MAX, SELF_KNOWLEDGE_MAX } from "./openProposals";
import { ABOUT_BASED_MAX, ABOUT_LANGUAGES_MAX, ABOUT_STORY_MAX, REFERENCE_HOW_MAX } from "./proposalAbout";
import { GOAL_LIMITS } from "./proposalGoals";
import { TERM_NOTE_MAX } from "./termsWords";
import { SUGGESTION_LIMITS } from "./pieceSuggestions";
import { WORDS_MAX } from "./seatApplications";
import { VOICE_CLIP_MAX_BYTES, VOICE_CLIP_WORDS_MAX, VOICE_NOTE_MAX_BYTES, VOICE_NOTE_MAX_SECONDS, VOICE_TRANSCRIPT_MAX } from "./voiceNotes";
import { VOICE_TRANSCRIBE_MAX_SECONDS, VOICE_TRANSCRIBE_TEXT_MAX } from "./voiceTranscribe";
import { PROPOSAL_FILE_MAX_BYTES, PROPOSAL_FILES_MAX } from "./proposalAttachments";

describe("one source for every limit", () => {
  it("the older names read the module's numbers", () => {
    expect(OPEN_WHY_MAX).toBe(APPLY_TEXT.why);
    expect(VOICE_NOTE_MAX_SECONDS).toBe(TAKE_MAX_SECONDS);
    expect(VOICE_NOTE_MAX_BYTES).toBe(TAKE_MAX_BYTES);
    expect(VOICE_CLIP_MAX_BYTES).toBe(CLIP_MAX_BYTES);
    expect(PROPOSAL_FILE_MAX_BYTES).toBe(FILE_MAX_BYTES);
    expect(PROPOSAL_FILES_MAX).toBe(FILES_MAX);
    expect(VOICE_TRANSCRIBE_MAX_SECONDS).toBe(TAKE_MAX_SECONDS + 5);
  });

  it("why holds 8,000, and every box that takes voice at least the floor of about seven minutes", () => {
    expect(OPEN_WHY_MAX).toBe(8000);
    expect(VOICE_BOX_FLOOR / SPEECH_CHARS_PER_MINUTE).toBeGreaterThanOrEqual(7);
    for (const max of [OPEN_AIM_MAX, SELF_KNOWLEDGE_MAX, ABOUT_BASED_MAX, ABOUT_LANGUAGES_MAX, ABOUT_STORY_MAX, REFERENCE_HOW_MAX, GOAL_LIMITS.title, GOAL_LIMITS.doneWhen, TERM_NOTE_MAX, SUGGESTION_LIMITS.text]) {
      expect(max).toBeGreaterThanOrEqual(VOICE_BOX_FLOOR);
    }
  });

  it("three times the old limits elsewhere", () => {
    expect(APPLY_TEXT.roleNote).toBe(600 * 3);
    expect(APPLY_TEXT.priceWhy).toBe(600 * 3);
    expect(APPLY_TEXT.linkUrl).toBe(500 * 3);
    expect(APPLY_COUNTS.goalsPerRole).toBe(8 * 3);
    expect(APPLY_COUNTS.links).toBe(5 * 3);
    expect(APPLY_COUNTS.suggestions).toBe(30 * 3);
    expect(TAKE_MAX_SECONDS).toBe(300 * 3);
    expect(CLIP_SECONDS_CEILING).toBe(180 * 3);
    expect(FILE_MAX_BYTES).toBe(10 * 1024 * 1024 * 3);
    expect(CLIP_MAX_BYTES).toBe(4 * 1024 * 1024 * 3);
  });

  it("words follow the boxes they fill: a member's note holds a full why, a clip holds the longest answer, the heard words three full takes", () => {
    expect(WORDS_MAX).toBeGreaterThanOrEqual(OPEN_WHY_MAX);
    expect(VOICE_CLIP_WORDS_MAX).toBeGreaterThanOrEqual(OPEN_WHY_MAX);
    expect(VOICE_CLIP_WORDS_MAX).toBeGreaterThanOrEqual((CLIP_SECONDS_CEILING / 60) * SPEECH_CHARS_PER_MINUTE);
    expect(VOICE_TRANSCRIPT_MAX).toBeGreaterThanOrEqual(TAKES_MAX * (TAKE_MAX_SECONDS / 60) * SPEECH_CHARS_PER_MINUTE);
    expect(VOICE_TRANSCRIBE_TEXT_MAX).toBeGreaterThanOrEqual((TAKE_MAX_SECONDS / 60) * SPEECH_CHARS_PER_MINUTE);
  });
});

describe("the upload's sizes", () => {
  it("a 15-minute take at the largest phone rate fits, and stays under what a transcription provider takes", () => {
    expect(TAKE_MAX_SECONDS * RECORDING_BYTES_PER_SECOND).toBeLessThanOrEqual(TAKE_MAX_BYTES);
    expect(TAKE_MAX_BYTES).toBeLessThan(PROVIDER_UPLOAD_MAX_BYTES);
    expect(CLIP_SECONDS_CEILING * RECORDING_BYTES_PER_SECOND).toBeLessThanOrEqual(CLIP_MAX_BYTES);
  });

  it("the whole post holds every part at its cap, for the village's clip count, and the server can read the largest", () => {
    for (const clips of [0, CLIPS_DEFAULT, CLIPS_CEILING]) {
      expect(uploadTotalMax(clips)).toBe(FILES_MAX * FILE_MAX_BYTES + TAKES_MAX * TAKE_MAX_BYTES + clips * CLIP_MAX_BYTES + UPLOAD_ENVELOPE_BYTES);
    }
    expect(uploadTotalMax(999)).toBe(uploadTotalMax(CLIPS_CEILING));
    // On disk, never in memory: the reserve kept free on the volume is a figure of its own, not a sum of posts.
    expect(OPEN_UPLOAD_DISK_RESERVE_BYTES).toBeGreaterThan(0);
  });

  it("the counts doubled (the lead, 19 Nov 2026): six files, six takes, 24 clips by default and 48 at the ceiling", () => {
    expect([FILES_MAX, TAKES_MAX, CLIPS_DEFAULT, CLIPS_CEILING]).toEqual([6, 6, 24, 48]);
  });

  it("every part, sent on its own, arrives inside the host's five minutes on a 1 Mbit/s line", () => {
    const seconds = (bytes: number) => (bytes * 8) / 1_000_000;
    expect(HOST_BODY_UPLOAD_MS).toBe(5 * 60_000);
    for (const part of [FILE_MAX_BYTES, TAKE_MAX_BYTES, CLIP_MAX_BYTES]) expect(seconds(part + 64 * 1024) * 1000).toBeLessThan(HOST_BODY_UPLOAD_MS);
    // The whole application in one request could never arrive inside it there, which is why the form sends parts.
    expect(seconds(uploadTotalMax(CLIPS_DEFAULT)) * 1000).toBeGreaterThan(HOST_BODY_UPLOAD_MS);
  });
});

describe("a summary made from the answers", () => {
  it("is whole when it fits, and says so in its last line when it does not", () => {
    expect(summaryWithin("short", 100)).toBe("short");
    const cut = summaryWithin("x".repeat(500), 100);
    expect(cut.length).toBeLessThanOrEqual(100);
    expect(cut.endsWith(SUMMARY_MORE)).toBe(true);
  });
});

describe("the village's own words on the application (ops check of live 1.3.30)", () => {
  it("are read whole on the form, however long the save door let them be", async () => {
    const { foundingSetupFrom, foundingSetupOf } = await import("./foundingApplication");
    const note = "n".repeat(3600);
    const line = "a".repeat(255);
    const got = foundingSetupFrom((k) => (k === "org.founding_know_us_note" ? note : k === "org.pay_shape_at_risk" || k === "org.founding_updated_note" || k === "org.pay_shape_note" ? line : ""));
    expect(got.knowUsNote).toBe(note);
    expect(got.atRisk).toBe(line);
    expect(got.updatedNote).toBe(line);
    expect(got.footer).toBe(line);
    expect(foundingSetupOf({ knowUsNote: note, atRisk: line, updatedNote: line, firstCycle: note }).firstCycle).toBe(note);
  });

  it("are held at Admin's save door with the reason, never cut: three times the old limits", async () => {
    const { validateVariable, VARIABLES_BY_KEY } = await import("./gameVariables");
    const knowUsNote = VARIABLES_BY_KEY["org.founding_know_us_note"];
    expect(validateVariable(knowUsNote, "n".repeat(3600))).toBeNull();
    expect(validateVariable(knowUsNote, "n".repeat(3601))).toMatch(/3600 characters maximum/);
    const ways = VARIABLES_BY_KEY["org.founding_know_us"];
    expect(validateVariable(ways, Array.from({ length: 24 }, (_, i) => `Way ${i}`).join("\n"))).toBeNull();
    expect(validateVariable(ways, Array.from({ length: 25 }, (_, i) => `Way ${i}`).join("\n"))).toMatch(/Up to 24 lines/);
    expect(validateVariable(ways, "w".repeat(481))).toMatch(/480 characters maximum/);
  });
});
