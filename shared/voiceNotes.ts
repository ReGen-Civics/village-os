/**
 * A VOICE NOTE WITH AN APPLICATION (Rye, 14 Nov 2026: "store the voice note
 * and ... have the option in admin of hearing their voice note ... we LOVE
 * listening to your voice").
 *
 * On the public application an applicant may talk to us: one to three short
 * recordings, made in the browser. While they record, the browser's own speech
 * engine writes down what it hears, and they can correct that text.
 *
 * KEPT ONLY WITH THEIR TICK. Without `consent: true` nothing of the voice
 * leaves the phone: no recording and no transcript. With it, the recordings and
 * the transcript go with the application, for the people who decide it and
 * nobody else, and follow the proposal's own retention as its files do
 * (server/lib/proposalFiles.ts):
 *
 *   - never confirmed in 48 hours: deleted with the proposal;
 *   - anonymised (declined, withdrawn or undecided, 90 days on): removed;
 *   - and in every case 90 days after the decision, including for somebody who
 *     joined: their written application stays, their voice goes.
 *
 * THE KEPT RECORDING REACHES NO ASSISTANT, agent tool or prompt. It is served
 * by two doors, to the deciders and to the village's admins (admin or founder),
 * and never to an agent caller (server/lib/voiceForViewer.ts). The LIVE sound is heard by
 * the browser's speech service while they talk (Google's in Chrome, Apple's
 * in Safari; see MicButton), which is how the words are written down; the
 * card says so.
 *
 * A RECORDING IS WHAT ITS BYTES SAY: WebM, Ogg or MP4 audio, read from the
 * first bytes, never from the name or the browser's word for it.
 *
 * Pure, so the page and the server import it alike.
 */

export const VOICE_NOTES_MAX = 3;
export const VOICE_NOTE_MAX_SECONDS = 300;
/** Ten minutes of the richest phone recording fits; three of them stay under the upload's own caps. */
export const VOICE_NOTE_MAX_BYTES = 10 * 1024 * 1024;
export const VOICE_TRANSCRIPT_MAX = 12000;

export const VOICE_NOTE_KINDS = ["webm", "ogg", "m4a"] as const;
export type VoiceNoteKind = (typeof VOICE_NOTE_KINDS)[number];

export const VOICE_NOTE_TYPES: Record<VoiceNoteKind, string> = {
  webm: "audio/webm",
  ogg: "audio/ogg",
  m4a: "audio/mp4",
};

/** A kept recording. The bytes are `<id>.<kind>` in the proposal's private folder. */
export interface VoiceNote {
  id: string;
  kind: VoiceNoteKind;
  /** How long the applicant's page timed it, at most VOICE_NOTE_MAX_SECONDS. */
  seconds: number;
  size: number;
  sha256: string;
}

/*
 * CLIPS BESIDE ANSWERS (Rye, 14 Nov 2026: "they can do micro recordings for each
 * answer"). Each written answer may carry one short recording of the applicant
 * saying it; its words go into that answer as they speak. Same tick, same
 * folder, same deletion and the same deciders as the main voice note. How many
 * and how long are village settings (org.voice_clips_max, org.voice_clip_seconds);
 * the numbers below are the platform's ceilings and defaults.
 */
export const VOICE_CLIPS_CEILING = 24;
export const VOICE_CLIP_SECONDS_CEILING = 180;
export const VOICE_CLIPS_DEFAULT = 12;
export const VOICE_CLIP_SECONDS_DEFAULT = 60;
export const VOICE_CLIP_MAX_BYTES = 4 * 1024 * 1024;
export const VOICE_CLIP_WORDS_MAX = 2000;

/** The village's limits on clips, as the form is told them. */
export interface VoiceClipLimits {
  max: number;
  seconds: number;
}
export const DEFAULT_CLIP_LIMITS: VoiceClipLimits = { max: VOICE_CLIPS_DEFAULT, seconds: VOICE_CLIP_SECONDS_DEFAULT };

/** Limits as read from a setting or a response, held to the ceilings. Never throws. */
export function clipLimitsOf(raw: unknown): VoiceClipLimits {
  const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const max = o.max === undefined || o.max === null || o.max === "" ? NaN : Number(o.max);
  const seconds = Number(o.seconds);
  return {
    max: Number.isFinite(max) ? Math.max(0, Math.min(VOICE_CLIPS_CEILING, Math.floor(max))) : VOICE_CLIPS_DEFAULT,
    seconds: Number.isFinite(seconds) && seconds > 0 ? Math.max(10, Math.min(VOICE_CLIP_SECONDS_CEILING, Math.floor(seconds))) : VOICE_CLIP_SECONDS_DEFAULT,
  };
}

/**
 * Which answer a clip belongs to. A closed set, so a clip's key never becomes a
 * path or free words on anybody's page: the answers a decider reads.
 */
const CLIP_FIELD = /^(why|aim|story|based|languages|suggestion|value-(?:[1-9]|1[0-2])-(?:title|done)|term-[a-z]{2,20}|reference-[1-3])$/;
export const isClipField = (v: unknown): v is string => typeof v === "string" && CLIP_FIELD.test(v);

/** The answer a clip belongs to, as the deciders read it. */
export function clipFieldLabel(field: string): string {
  const value = /^value-(\d+)-(title|done)$/.exec(field);
  if (value) return value[2] === "title" ? `Value ${value[1]}: what they will bring` : `Value ${value[1]}: how we will know it is done`;
  const ref = /^reference-(\d)$/.exec(field);
  if (ref) return `Reference ${ref[1]}: how they know them`;
  if (field.startsWith("term-")) return `A term to talk through (${field.slice(5)})`;
  const named: Record<string, string> = {
    why: "Why you, and why now",
    aim: "Their aim in this role",
    story: "Their story with us",
    based: "Where they are based",
    languages: "Languages they work in",
    suggestion: "A suggestion for the role card",
  };
  return named[field] ?? "An answer";
}

/** A kept clip: a recording, the answer it belongs to, and the words heard while it ran. */
export interface VoiceClip extends VoiceNote {
  field: string;
  words: string;
}

/** What the proposal keeps: the tick, the recordings and the words the browser heard, as the applicant corrected them. */
export interface StoredVoice {
  consent: true;
  notes: VoiceNote[];
  transcript: string;
  /** Clips beside answers, when they recorded any. */
  clips?: VoiceClip[];
}

/** One clip as the form describes it beside its bytes. */
export interface SentClip {
  field: string;
  seconds: number;
  words: string;
}

/** What the form sends beside the recordings: the tick, each recording's length, the transcript, and each clip's answer, length and words. */
export interface SentVoice {
  consent: boolean;
  seconds: number[];
  transcript: string;
  clips?: SentClip[];
}

export const VOICE_NOTE_ID = /^pv-[0-9a-f]{16}$/;

/** The deciders' door for one recording. */
export const voiceNoteHref = (proposalId: string, noteId: string): string =>
  `/api/governance/open-proposals/${encodeURIComponent(proposalId)}/voice/${encodeURIComponent(noteId)}`;

/** The kind a recording's own first bytes say it is, or null. */
export function voiceNoteKind(bytes: Uint8Array): VoiceNoteKind | null {
  if (bytes.length < 12) return null;
  // EBML header: WebM (Chrome, Android, Firefox).
  if (bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) return "webm";
  // "OggS": Ogg (older Firefox).
  if (bytes[0] === 0x4f && bytes[1] === 0x67 && bytes[2] === 0x67 && bytes[3] === 0x53) return "ogg";
  // "ftyp" at offset 4: an MP4 container (Safari on iPhone and Mac).
  if (bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70) return "m4a";
  return null;
}

/** The kind a browser's recording type maps to, for naming the upload. The server reads the bytes again. */
export function voiceKindOfType(type: string): VoiceNoteKind {
  const t = type.toLowerCase();
  if (t.includes("mp4") || t.includes("aac") || t.includes("m4a")) return "m4a";
  if (t.includes("ogg")) return "ogg";
  return "webm";
}

export const VOICE_WORDS = {
  inviteTitle: "We love hearing your voice.",
  inviteBody:
    "We learn so much from how you say things, and we read every word too. If you like, talk to us for a few minutes: who you are, why this role, and what you would bring. We'll help turn what you say into your answers, and you edit every one.",
  record: "Record",
  recordAnother: "Record another",
  stop: "Stop recording",
  skip: "Skip, I'll type",
  reopen: "Talk to us instead",
  heardLabel: "What we heard, in your words",
  heardHint: "Your browser's speech service turns what you say into text as you talk: Google's in Chrome, Apple's in Safari. Fix anything it got wrong.",
  consent: "Keep my voice recordings with my application. The people who decide it and the village's admins will listen to them.",
  kept: "Only the people who decide your application and the village's admins hear them. We delete them with your application, and at the latest 90 days after we decide.",
  notKept: "Without the tick, your recordings stay on this device and are not sent.",
  // Clips beside answers.
  clipRecord: "Record this answer",
  clipStop: "Stop",
  clipAgain: "Record again",
  clipRemove: "Remove clip",
  clipLabel: "Your voice for this answer",
  clipsFull: (max: number) => `You've recorded ${max} clips, the most one application holds. Remove one to record another.`,
  tooManyClips: (max: number) => `Send up to ${max} clips beside your answers.`,
  clipTooLong: (seconds: number) => `Keep each clip under ${seconds} seconds.`,
  noTranscribe: "This phone can't write down your words while it records. Your recording is fine; use the mic on each answer for the text.",
  micBlocked: "The microphone is blocked for this site. Allow it in your browser settings, or type your answers.",
  noMic: "No microphone was found on this device. Typing works just as well.",
  nearEnd: "About 30 seconds left in this recording.",
  // Refusals, each with what to do.
  tooMany: `Send up to ${VOICE_NOTES_MAX} recordings.`,
  tooBig: "One recording is too large. Record a shorter one.",
  tooLong: `Keep each recording under ${VOICE_NOTE_MAX_SECONDS / 60} minutes.`,
  wrongType: "We couldn't read one of your recordings. Record it again.",
  needConsent: "Tick that we may keep your voice note, or remove the recordings.",
  transcriptTooLong: `Keep what we heard under ${VOICE_TRANSCRIPT_MAX} characters.`,
  // The deciders' page.
  heardHeading: "Their voice",
  heardNote: "Only the people who decide this application and the village's admins hear it. It is deleted with the application, and at the latest 90 days after the decision.",
  listen: "Listen",
  transcriptFold: "What the browser heard (their words, not checked)",
  unplayable: "This recording didn't play. Try again in a moment.",
} as const;

/** A length in seconds as people say it: "3:07". */
export function voiceLength(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/**
 * The voice part a form sent, judged against how many recordings came with it.
 * Nothing sent and no recordings: no voice. Recordings or words without the tick: refused.
 */
export function parseSentVoice(
  raw: unknown,
  recordings: number,
  clipCount = 0,
  limits: VoiceClipLimits = DEFAULT_CLIP_LIMITS,
): { ok: true; value: SentVoice | null } | { ok: false; error: string } {
  const anyBytes = recordings > 0 || clipCount > 0;
  if (raw === undefined || raw === null) return anyBytes ? { ok: false, error: VOICE_WORDS.needConsent } : { ok: true, value: null };
  const o = typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const transcript = String(typeof o.transcript === "string" ? o.transcript : "").trim();
  const seconds = Array.isArray(o.seconds) ? o.seconds.map((n) => Number(n)) : [];
  const rawClips = Array.isArray(o.clips) ? o.clips : [];
  if (o.consent !== true) return anyBytes || transcript || rawClips.length ? { ok: false, error: VOICE_WORDS.needConsent } : { ok: true, value: null };
  if (recordings > VOICE_NOTES_MAX) return { ok: false, error: VOICE_WORDS.tooMany };
  if (transcript.length > VOICE_TRANSCRIPT_MAX) return { ok: false, error: VOICE_WORDS.transcriptTooLong };
  if (seconds.length !== recordings || seconds.some((n) => !Number.isFinite(n) || n <= 0 || n > VOICE_NOTE_MAX_SECONDS + 5)) {
    return { ok: false, error: VOICE_WORDS.tooLong };
  }
  // Clips: one per answer, each naming an answer the form has, within the village's count and length.
  if (clipCount > limits.max || rawClips.length !== clipCount) return { ok: false, error: VOICE_WORDS.tooManyClips(limits.max) };
  const clips: SentClip[] = [];
  for (const c of rawClips) {
    const one = c && typeof c === "object" ? (c as Record<string, unknown>) : {};
    const s = Number(one.seconds);
    if (!isClipField(one.field) || clips.some((x) => x.field === one.field)) return { ok: false, error: VOICE_WORDS.wrongType };
    if (!Number.isFinite(s) || s <= 0 || s > limits.seconds + 5) return { ok: false, error: VOICE_WORDS.clipTooLong(limits.seconds) };
    const words = String(typeof one.words === "string" ? one.words : "").trim().slice(0, VOICE_CLIP_WORDS_MAX);
    clips.push({ field: one.field, seconds: Math.min(limits.seconds, Math.max(1, Math.round(s))), words });
  }
  if (recordings === 0 && clipCount === 0 && !transcript) return { ok: true, value: null };
  return {
    ok: true,
    value: { consent: true, seconds: seconds.map((n) => Math.min(VOICE_NOTE_MAX_SECONDS, Math.round(n))), transcript, ...(clips.length ? { clips } : {}) },
  };
}

/** A stored voice part as it reads, whatever was stored. Null when there is none. Never throws. */
export function storedVoiceOf(raw: unknown): StoredVoice | null {
  const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : null;
  if (!o || o.consent !== true) return null;
  const notes = (Array.isArray(o.notes) ? o.notes : [])
    .map((n: any): VoiceNote | null =>
      n && typeof n === "object" && VOICE_NOTE_ID.test(String(n.id)) && VOICE_NOTE_KINDS.includes(n.kind) && /^[0-9a-f]{64}$/.test(String(n.sha256))
        ? { id: String(n.id), kind: n.kind, seconds: Math.max(0, Math.min(VOICE_NOTE_MAX_SECONDS, Number(n.seconds) || 0)), size: Math.max(0, Number(n.size) || 0), sha256: String(n.sha256) }
        : null,
    )
    .filter((n): n is VoiceNote => !!n)
    .slice(0, VOICE_NOTES_MAX);
  const transcript = String(typeof o.transcript === "string" ? o.transcript : "").slice(0, VOICE_TRANSCRIPT_MAX);
  const clips = (Array.isArray(o.clips) ? o.clips : [])
    .map((c: any): VoiceClip | null =>
      c && typeof c === "object" && VOICE_NOTE_ID.test(String(c.id)) && VOICE_NOTE_KINDS.includes(c.kind) && /^[0-9a-f]{64}$/.test(String(c.sha256)) && isClipField(c.field)
        ? {
            id: String(c.id),
            kind: c.kind,
            field: c.field,
            seconds: Math.max(0, Math.min(VOICE_CLIP_SECONDS_CEILING, Number(c.seconds) || 0)),
            size: Math.max(0, Number(c.size) || 0),
            sha256: String(c.sha256),
            words: String(typeof c.words === "string" ? c.words : "").slice(0, VOICE_CLIP_WORDS_MAX),
          }
        : null,
    )
    .filter((c): c is VoiceClip => !!c)
    .slice(0, VOICE_CLIPS_CEILING);
  if (!notes.length && !transcript.trim() && !clips.length) return null;
  return { consent: true, notes, transcript, ...(clips.length ? { clips } : {}) };
}
