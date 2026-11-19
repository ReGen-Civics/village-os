/**
 * The "Write down my words automatically" switch and the sends it governs,
 * kept OUT of VoiceStepMore.tsx's chunk (hotfix, 19 Nov 2026; see
 * voiceStepMoreLazy.ts). This module has no long copy, so its chunk never gets
 * the copy loader's top-level await, and it is evaluated before VoiceStepMore
 * is imported: nothing here can be read before it exists.
 */
import { VOICE_TRANSCRIBE_PATH } from "@shared/voiceTranscribe";

export const AUTO_KEY = "voice-write-down-automatically";

/** Whether the village's transcription service is on: asked once per page. */
let onAnswer: Promise<boolean> | null = null;
export function transcriptionOn(fetcher: typeof fetch = fetch): Promise<boolean> {
  if (!onAnswer) {
    onAnswer = fetcher(VOICE_TRANSCRIBE_PATH)
      .then((r) => (r.ok ? r.json() : { on: false }))
      .then((d: any) => d?.on === true)
      .catch(() => false);
  }
  return onAnswer;
}

let autoOn: boolean | null = null;
const listeners = new Set<() => void>();
/** Sends in flight, by the recording they carry: turning the switch off aborts them all. */
export const running = new Map<Blob, AbortController>();
/** Recordings already sent by themselves once, so a redraw never sends one twice. */
let tried = new WeakSet<Blob>();

export function triedBefore(blob: Blob): boolean {
  return tried.has(blob);
}
export function markTried(blob: Blob): void {
  tried.add(blob);
}

/** For a test: ask again, forget the switch and every send. */
export function forgetTranscriptionOn(): void {
  onAnswer = null;
  autoOn = null;
  running.forEach((c) => c.abort());
  running.clear();
  tried = new WeakSet();
}

/** The snapshot for useSyncExternalStore. It never throws: storage that cannot be read means on. */
export function autoWriteDown(): boolean {
  if (autoOn === null) {
    try {
      autoOn = window.sessionStorage.getItem(AUTO_KEY) !== "off";
    } catch {
      autoOn = true;
    }
  }
  return autoOn;
}

export function setAutoWriteDown(on: boolean): void {
  autoOn = on;
  try {
    window.sessionStorage.setItem(AUTO_KEY, on ? "on" : "off");
  } catch {
    /* remembered for this page only */
  }
  if (!on) {
    running.forEach((c) => c.abort());
    running.clear();
  }
  listeners.forEach((l) => l());
}

export function subscribeAutoWriteDown(l: () => void): () => void {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}
