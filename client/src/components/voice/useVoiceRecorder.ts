/**
 * ONE RECORDING AT A TIME, WITH ITS WORDS (Rye, 14 Nov 2026; shared/voiceNotes.ts).
 *
 * MediaRecorder keeps the sound; while it runs, the browser's own speech
 * engine (the same one MicButton uses) writes down what it hears, shown live.
 * The recording stays on the device here and goes to the village only with
 * the applicant's tick. The live sound is heard by the browser's speech
 * service to write the words down (Google's in Chrome, Apple's in Safari;
 * MicButton says more).
 *
 * PHONES. iPhone Safari records MP4 and Android Chrome WebM; both have a speech
 * engine. Some phones cannot record and transcribe from one microphone at
 * once: then the engine fails with `audio-capture`, the recording carries on,
 * and `noWords` says so, so the card can tell the truth. Where the engine stops
 * itself on a pause (Chrome does), it is started again while recording lasts.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { VOICE_NOTE_MAX_SECONDS } from "@shared/voiceNotes";

const SR: any =
  typeof window !== "undefined" ? ((window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition) : undefined;

/** The recording types to try, best first. Safari takes MP4; the rest take WebM or Ogg. */
const TYPES = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];

/** The microphone may be used here: the page's Permissions-Policy, when the browser can say. */
function policyAllowsMic(): boolean {
  const fp = typeof document !== "undefined" ? (document as any).featurePolicy : undefined;
  if (!fp || typeof fp.allowsFeature !== "function") return true;
  try {
    return Boolean(fp.allowsFeature("microphone"));
  } catch {
    return true;
  }
}

/** What this browser can do: record a voice note, and write down speech. */
export function voiceSupport(): { record: boolean; words: boolean } {
  if (typeof window === "undefined" || !policyAllowsMic()) return { record: false, words: false };
  const record = typeof (window as any).MediaRecorder === "function" && typeof navigator !== "undefined" && typeof navigator.mediaDevices?.getUserMedia === "function";
  return { record, words: !!SR };
}

function pickType(): string | undefined {
  const MR = (window as any).MediaRecorder;
  if (typeof MR?.isTypeSupported !== "function") return undefined;
  return TYPES.find((t) => {
    try {
      return MR.isTypeSupported(t);
    } catch {
      return false;
    }
  });
}

export interface FinishedTake {
  blob: Blob;
  seconds: number;
  /** What the engine wrote down during this take; empty when it could not listen. */
  words: string;
}

export type RecorderProblem = "blocked" | "noMic" | null;

export function useVoiceRecorder(onTake: (take: FinishedTake) => void, maxSeconds: number = VOICE_NOTE_MAX_SECONDS) {
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [live, setLive] = useState("");
  const [noWords, setNoWords] = useState(false);
  const [problem, setProblem] = useState<RecorderProblem>(null);
  const on = useRef(false);
  const rec = useRef<any>(null);
  const engine = useRef<any>(null);
  const stream = useRef<MediaStream | null>(null);
  const timer = useRef<number | null>(null);
  const began = useRef(0);
  const finals = useRef("");
  const interim = useRef("");
  const hearing = useRef(true);
  const onTakeRef = useRef(onTake);
  onTakeRef.current = onTake;
  const limit = useRef(maxSeconds);
  limit.current = maxSeconds;

  const release = () => {
    if (timer.current !== null) window.clearInterval(timer.current);
    timer.current = null;
    try {
      engine.current?.abort?.();
    } catch {
      /* already stopped */
    }
    engine.current = null;
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
  };

  // Leaving the page releases the microphone.
  useEffect(
    () => () => {
      on.current = false;
      try {
        if (rec.current?.state === "recording") rec.current.stop();
      } catch {
        /* already stopped */
      }
      release();
    },
    [],
  );

  const listen = () => {
    if (!SR || !hearing.current || !on.current) return;
    const r = new SR();
    r.lang = navigator.language || "en-US";
    r.continuous = true;
    r.interimResults = true;
    r.onresult = (e: any) => {
      if (!on.current) return;
      let now = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const said = String(e.results[i]?.[0]?.transcript ?? "").trim();
        if (!said) continue;
        if (e.results[i].isFinal) finals.current = finals.current ? `${finals.current} ${said}` : said;
        else now = now ? `${now} ${said}` : said;
      }
      interim.current = now;
      setLive(`${finals.current}${now ? ` ${now}` : ""}`.trim());
    };
    r.onerror = (e: any) => {
      const code = String(e?.error ?? "");
      // No speech yet, or our own stop: nothing to say. Anything else means it cannot write down this take.
      if (code === "no-speech" || code === "aborted") return;
      hearing.current = false;
      if (on.current) setNoWords(true);
    };
    // The engine ends itself on a pause in some browsers: start it again while the recording lasts.
    r.onend = () => {
      if (on.current && hearing.current) window.setTimeout(listen, 150);
    };
    engine.current = r;
    try {
      r.start();
    } catch {
      hearing.current = false;
      setNoWords(true);
    }
  };

  const stop = useCallback(() => {
    if (!on.current) return;
    on.current = false;
    setRecording(false);
    try {
      engine.current?.stop?.();
    } catch {
      /* already stopped */
    }
    try {
      rec.current?.stop();
    } catch {
      release();
    }
  }, []);

  const start = useCallback(async () => {
    if (on.current) return;
    setProblem(null);
    setNoWords(false);
    setLive("");
    finals.current = "";
    interim.current = "";
    hearing.current = true;
    let media: MediaStream;
    try {
      media = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (e: any) {
      setProblem(e?.name === "NotFoundError" || e?.name === "OverconstrainedError" ? "noMic" : "blocked");
      return;
    }
    stream.current = media;
    const type = pickType();
    const MR = (window as any).MediaRecorder;
    let r: any;
    try {
      r = type ? new MR(media, { mimeType: type }) : new MR(media);
    } catch {
      release();
      setProblem("noMic");
      return;
    }
    const chunks: Blob[] = [];
    r.ondataavailable = (e: any) => {
      if (e.data && e.data.size > 0) chunks.push(e.data);
    };
    r.onstop = () => {
      const seconds = Math.max(1, Math.min(limit.current, Math.round((Date.now() - began.current) / 1000)));
      const words = `${finals.current}${interim.current ? ` ${interim.current}` : ""}`.trim();
      release();
      const blob = new Blob(chunks, { type: r.mimeType || type || "audio/webm" });
      if (blob.size > 0) onTakeRef.current({ blob, seconds, words });
      setLive("");
      setElapsed(0);
    };
    rec.current = r;
    began.current = Date.now();
    on.current = true;
    setElapsed(0);
    setRecording(true);
    r.start(1000);
    timer.current = window.setInterval(() => {
      const s = (Date.now() - began.current) / 1000;
      setElapsed(s);
      if (s >= limit.current) stop();
    }, 250);
    listen();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stop]);

  return { recording, elapsed, live, noWords, problem, start, stop };
}
