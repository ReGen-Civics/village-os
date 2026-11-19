/**
 * The voice note's rules (shared/voiceNotes.ts): what a recording's bytes say
 * it is, what a form may send, and how a stored part reads.
 */
import { describe, expect, it } from "vitest";
import { OPEN_WHY_MAX } from "./openProposals";
import { VOICE_CLIP_WORDS_MAX, VOICE_NOTE_MAX_SECONDS, VOICE_TRANSCRIPT_MAX, VOICE_WORDS, clipFieldLabel, clipLimitsOf, isClipField, parseSentVoice, storedVoiceOf, voiceKindOfType, voiceLength, voiceNoteKind } from "./voiceNotes";

const bytes = (...head: number[]) => new Uint8Array([...head, ...new Array(16).fill(0)]);

describe("a recording is what its bytes say", () => {
  it("reads WebM, Ogg and MP4 by their first bytes, and nothing else", () => {
    expect(voiceNoteKind(bytes(0x1a, 0x45, 0xdf, 0xa3))).toBe("webm");
    expect(voiceNoteKind(bytes(0x4f, 0x67, 0x67, 0x53))).toBe("ogg");
    expect(voiceNoteKind(bytes(0, 0, 0, 0x20, 0x66, 0x74, 0x79, 0x70))).toBe("m4a");
    expect(voiceNoteKind(new TextEncoder().encode("<html><script>alert(1)</script></html>"))).toBeNull();
    expect(voiceNoteKind(bytes(0x25, 0x50, 0x44, 0x46))).toBeNull();
    expect(voiceNoteKind(new Uint8Array([0x1a, 0x45]))).toBeNull();
  });

  it("names an upload from the browser's recording type", () => {
    expect(voiceKindOfType("audio/mp4")).toBe("m4a");
    expect(voiceKindOfType("audio/webm;codecs=opus")).toBe("webm");
    expect(voiceKindOfType("audio/ogg; codecs=opus")).toBe("ogg");
    expect(voiceLength(187)).toBe("3:07");
  });
});

describe("what a form may send", () => {
  it("keeps nothing without the tick, and refuses recordings or words sent without it", () => {
    expect(parseSentVoice(undefined, 0)).toEqual({ ok: true, value: null });
    expect(parseSentVoice({ consent: false, seconds: [], transcript: "" }, 0)).toEqual({ ok: true, value: null });
    expect(parseSentVoice(undefined, 1)).toEqual({ ok: false, error: VOICE_WORDS.needConsent });
    expect(parseSentVoice({ consent: false, seconds: [], transcript: "words" }, 0)).toEqual({ ok: false, error: VOICE_WORDS.needConsent });
    expect(parseSentVoice({ consent: "yes", seconds: [10], transcript: "" }, 1)).toEqual({ ok: false, error: VOICE_WORDS.needConsent });
  });

  it("takes the tick with a length for each recording, within the limits", () => {
    expect(parseSentVoice({ consent: true, seconds: [42.4, 61], transcript: " I keep gates. " }, 2)).toEqual({ ok: true, value: { consent: true, seconds: [42, 61], transcript: "I keep gates." } });
    expect(parseSentVoice({ consent: true, seconds: [10, 10, 10, 10], transcript: "" }, 4)).toEqual({ ok: false, error: VOICE_WORDS.tooMany });
    expect(parseSentVoice({ consent: true, seconds: [VOICE_NOTE_MAX_SECONDS + 60], transcript: "" }, 1)).toEqual({ ok: false, error: VOICE_WORDS.tooLong });
    expect(parseSentVoice({ consent: true, seconds: [10], transcript: "" }, 2)).toEqual({ ok: false, error: VOICE_WORDS.tooLong });
    expect(parseSentVoice({ consent: true, seconds: [], transcript: "x".repeat(VOICE_TRANSCRIPT_MAX + 1) }, 0)).toEqual({ ok: false, error: VOICE_WORDS.transcriptTooLong });
  });

  it("refuses a clip whose words run past their limit, and never keeps them cut (the ops request of 19 Nov 2026)", () => {
    const clip = (words: string) => parseSentVoice({ consent: true, seconds: [], transcript: "", clips: [{ field: "why", seconds: 10, words }] }, 0, 1);
    const whole = "w".repeat(VOICE_CLIP_WORDS_MAX);
    expect(clip(whole)).toMatchObject({ ok: true, value: { clips: [{ words: whole }] } });
    expect(clip(`${whole}w`)).toEqual({ ok: false, error: VOICE_WORDS.clipWordsTooLong });
  });

  it("a clip keeps as many words as the longest answer it can write into, and the heard words hold more (the lead, 19 Nov 2026)", () => {
    expect(VOICE_CLIP_WORDS_MAX).toBeGreaterThanOrEqual(OPEN_WHY_MAX);
    expect(VOICE_TRANSCRIPT_MAX).toBeGreaterThanOrEqual(OPEN_WHY_MAX);
  });
});

describe("a stored voice part", () => {
  const note = { id: "pv-0123456789abcdef", kind: "webm", seconds: 42, size: 900, sha256: "a".repeat(64) };
  it("reads back what was kept, and nothing that was not ticked or not well formed", () => {
    expect(storedVoiceOf({ consent: true, notes: [note], transcript: "Hi" })).toEqual({ consent: true, notes: [note], transcript: "Hi" });
    expect(storedVoiceOf({ consent: false, notes: [note], transcript: "Hi" })).toBeNull();
    expect(storedVoiceOf({ consent: true, notes: [{ ...note, id: "../etc/passwd" }], transcript: "" })).toBeNull();
    expect(storedVoiceOf({ consent: true, notes: [{ ...note, kind: "exe" }], transcript: "Hi" })).toEqual({ consent: true, notes: [], transcript: "Hi" });
    expect(storedVoiceOf(null)).toBeNull();
  });
});

describe("clips beside answers (Rye, 14 Nov 2026)", () => {
  const limits = { max: 2, seconds: 60 };
  it("takes one clip per known answer, within the village's count and length", () => {
    const ok = parseSentVoice({ consent: true, seconds: [], transcript: "", clips: [{ field: "why", seconds: 31.6, words: " I keep gates. " }, { field: "value-2-done", seconds: 12, words: "" }] }, 0, 2, limits);
    expect(ok).toEqual({ ok: true, value: { consent: true, seconds: [], transcript: "", clips: [{ field: "why", seconds: 32, words: "I keep gates." }, { field: "value-2-done", seconds: 12, words: "" }] } });
    expect(parseSentVoice({ consent: true, seconds: [], transcript: "", clips: [{ field: "why", seconds: 5 }, { field: "aim", seconds: 5 }, { field: "story", seconds: 5 }] }, 0, 3, limits)).toEqual({ ok: false, error: VOICE_WORDS.tooManyClips(2) });
    expect(parseSentVoice({ consent: true, seconds: [], transcript: "", clips: [{ field: "why", seconds: 90 }] }, 0, 1, limits)).toEqual({ ok: false, error: VOICE_WORDS.clipTooLong(60) });
    expect(parseSentVoice({ consent: true, seconds: [], transcript: "", clips: [{ field: "../etc", seconds: 5 }] }, 0, 1, limits)).toEqual({ ok: false, error: VOICE_WORDS.wrongType });
    expect(parseSentVoice({ consent: true, seconds: [], transcript: "", clips: [{ field: "why", seconds: 5 }, { field: "why", seconds: 5 }] }, 0, 2, limits)).toEqual({ ok: false, error: VOICE_WORDS.wrongType });
    // Bytes and descriptions must agree; and no clip goes without the tick.
    expect(parseSentVoice({ consent: true, seconds: [], transcript: "", clips: [] }, 0, 1, limits)).toEqual({ ok: false, error: VOICE_WORDS.tooManyClips(2) });
    expect(parseSentVoice(undefined, 0, 1, limits)).toEqual({ ok: false, error: VOICE_WORDS.needConsent });
    expect(parseSentVoice({ consent: false, seconds: [], transcript: "", clips: [{ field: "why", seconds: 5 }] }, 0, 1, limits)).toEqual({ ok: false, error: VOICE_WORDS.needConsent });
  });

  it("knows the answers a clip may belong to, names them for deciders, and holds the settings to the ceilings", () => {
    for (const f of ["why", "aim", "story", "based", "languages", "suggestion", "value-1-title", "value-12-done", "value-24-done", "term-clocks", "reference-3"]) expect(isClipField(f), f).toBe(true);
    for (const f of ["selfKnowledge", "name", "email", "value-25-title", "reference-4", "term-", "WHY", ""]) expect(isClipField(f), f).toBe(false);
    expect(clipFieldLabel("value-2-done")).toBe("Value 2: how we will know it is done");
    expect(clipLimitsOf({ max: 12, seconds: 60 })).toEqual({ max: 12, seconds: 60 });
    expect(clipLimitsOf({ max: 99, seconds: 9999 })).toEqual({ max: 24, seconds: 540 });
    expect(clipLimitsOf({ max: 0, seconds: 1 })).toEqual({ max: 0, seconds: 10 });
    expect(clipLimitsOf(undefined)).toEqual({ max: 12, seconds: 180 });
  });

  it("reads stored clips back, dropping any that are not well formed", () => {
    const clip = { id: "pv-0123456789abcdef", kind: "m4a", field: "aim", seconds: 20, size: 100, sha256: "b".repeat(64), words: "Seed." };
    expect(storedVoiceOf({ consent: true, notes: [], transcript: "", clips: [clip, { ...clip, field: "email" }] })).toEqual({ consent: true, notes: [], transcript: "", clips: [clip] });
  });
});
