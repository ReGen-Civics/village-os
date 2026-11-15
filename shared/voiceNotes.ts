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
 * by one door, to the deciders, as the files are. The LIVE sound is heard by
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

/** What the proposal keeps: the tick, the recordings and the words the browser heard, as the applicant corrected them. */
export interface StoredVoice {
  consent: true;
  notes: VoiceNote[];
  transcript: string;
}

/** What the form sends beside the recordings: the tick, each recording's length, and the transcript. */
export interface SentVoice {
  consent: boolean;
  seconds: number[];
  transcript: string;
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
  consent: "Keep my voice note with my application. The people who decide will listen to it.",
  kept: "Only the people who decide your application hear it. We delete it with your application, and at the latest 90 days after we decide.",
  notKept: "Without the tick, your recording stays on this device and is not sent.",
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
  heardNote: "Only the people who decide this application hear it. It is deleted with the application, and at the latest 90 days after the decision.",
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
export function parseSentVoice(raw: unknown, recordings: number): { ok: true; value: SentVoice | null } | { ok: false; error: string } {
  if (raw === undefined || raw === null) return recordings > 0 ? { ok: false, error: VOICE_WORDS.needConsent } : { ok: true, value: null };
  const o = typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const transcript = String(typeof o.transcript === "string" ? o.transcript : "").trim();
  const seconds = Array.isArray(o.seconds) ? o.seconds.map((n) => Number(n)) : [];
  if (o.consent !== true) return recordings > 0 || transcript ? { ok: false, error: VOICE_WORDS.needConsent } : { ok: true, value: null };
  if (recordings > VOICE_NOTES_MAX) return { ok: false, error: VOICE_WORDS.tooMany };
  if (transcript.length > VOICE_TRANSCRIPT_MAX) return { ok: false, error: VOICE_WORDS.transcriptTooLong };
  if (seconds.length !== recordings || seconds.some((n) => !Number.isFinite(n) || n <= 0 || n > VOICE_NOTE_MAX_SECONDS + 5)) {
    return { ok: false, error: VOICE_WORDS.tooLong };
  }
  if (recordings === 0 && !transcript) return { ok: true, value: null };
  return { ok: true, value: { consent: true, seconds: seconds.map((n) => Math.min(VOICE_NOTE_MAX_SECONDS, Math.round(n))), transcript } };
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
  if (!notes.length && !transcript.trim()) return null;
  return { consent: true, notes, transcript };
}
