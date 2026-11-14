/**
 * The voice note's rules (shared/voiceNotes.ts): what a recording's bytes say
 * it is, what a form may send, and how a stored part reads.
 */
import { describe, expect, it } from "vitest";
import { VOICE_NOTE_MAX_SECONDS, VOICE_TRANSCRIPT_MAX, VOICE_WORDS, parseSentVoice, storedVoiceOf, voiceKindOfType, voiceLength, voiceNoteKind } from "./voiceNotes";

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
