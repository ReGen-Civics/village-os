/**
 * WHAT ONE APPLICATION POST WILL CARRY, added up before it is sent (the ops request of 19 Nov 2026: the form
 * checked each file and never the whole). The server refuses a post longer than `uploadTotalMax` for the
 * village's clip count before reading a byte (server/routes/openProposals.ts), so the form adds the same parts up
 * and holds the send, with the reason, instead of letting the post fail after minutes of uploading.
 *
 * Only what is sent counts: recordings and clips go only with the applicant's tick.
 */
import { CLIP_MAX_BYTES, FILE_MAX_BYTES, FILES_MAX, TAKE_MAX_BYTES, TAKES_MAX, UPLOAD_ENVELOPE_BYTES, uploadTotalMax } from "@shared/applyLimits";

interface Sized {
  size: number;
}
/** The voice parts that decide what is sent, as VoiceInvite.tsx `VoiceState` holds them. */
export interface VoiceParts {
  consent: boolean;
  takes: ReadonlyArray<{ blob: Sized }>;
  clips: Readonly<Record<string, { blob: Sized }>>;
}

/** The bytes of everything attached that would be sent: files always, recordings and clips with the tick. */
export function attachedBytes(files: readonly Sized[], voice: VoiceParts): number {
  const fileBytes = files.reduce((n, f) => n + f.size, 0);
  if (!voice.consent) return fileBytes;
  const takes = voice.takes.reduce((n, t) => n + t.blob.size, 0);
  const clips = Object.values(voice.clips).reduce((n, c) => n + c.blob.size, 0);
  return fileBytes + takes + clips;
}

/** About how big the post will be: what is attached and the proposal's own words with their wrapping. */
export function postBytes(files: readonly Sized[], voice: VoiceParts, proposalJsonBytes: number): number {
  return attachedBytes(files, voice) + proposalJsonBytes + 64 * 1024;
}

/** Room for attachments in one post, for the village's clip count: the whole post less its envelope. */
export function attachmentRoom(clipsMax: number): number {
  return uploadTotalMax(clipsMax) - UPLOAD_ENVELOPE_BYTES;
}

export type UploadProblem =
  | { kind: "tooManyFiles"; extra: number }
  | { kind: "fileTooBig"; name: string }
  | { kind: "takeTooBig" }
  | { kind: "clipTooBig" }
  | { kind: "tooBigTogether"; over: number }
  | null;

/** The first thing about the attachments that would stop the send, or null. Every part checked, nothing dropped. */
export function uploadProblem(files: readonly (Sized & { name: string })[], voice: VoiceParts, clipsMax: number): UploadProblem {
  if (files.length > FILES_MAX) return { kind: "tooManyFiles", extra: files.length - FILES_MAX };
  const big = files.find((f) => f.size > FILE_MAX_BYTES);
  if (big) return { kind: "fileTooBig", name: big.name };
  if (voice.consent) {
    if (voice.takes.slice(0, TAKES_MAX).some((t) => t.blob.size > TAKE_MAX_BYTES)) return { kind: "takeTooBig" };
    if (Object.values(voice.clips).some((c) => c.blob.size > CLIP_MAX_BYTES)) return { kind: "clipTooBig" };
  }
  const over = attachedBytes(files, voice) - attachmentRoom(clipsMax);
  return over > 0 ? { kind: "tooBigTogether", over } : null;
}
