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
 *
 * NOTHING SAID IS LOST QUIETLY (an applicant, 17 Nov 2026: "I just recorded like
 * 5 minutes ... it doesn't seem to play back"). Whatever ends a recording, the
 * person's Stop, the five-minute limit, or the browser itself (the microphone
 * taken by another app, a phone call, the tab put away), the sound captured so
 * far becomes a take, the button comes back, and `problem` says what happened.
 * A take with no sound in it is said, never dropped in silence. Where the speech
 * engine takes the microphone from the recording (some phones mute the
 * recording's track), the engine is stopped and the recording keeps the
 * microphone: the recording is what must not be lost. A browser with no speech
 * engine at all (Firefox) is told so at the start, in `noWords`.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { VOICE_NOTE_MAX_SECONDS } from "@shared/voiceNotes";
import { speechLang } from "@/lib/speechLang";

/** The browser's speech engine, read when it is needed (so a test can stand one in). */
const speechEngine = (): any =>
  typeof window !== "undefined" ? ((window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition) : undefined;

/** The recording types to try, best first: WebM or Ogg where the engine is Chrome's or Firefox's. */
const TYPES = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];
/**
 * Safari (and every browser on an iPhone, which all run Safari's engine) first
 * tries MP4, its own format: newer Safari also says yes to WebM, and a WebM it
 * records is the one its own player and an older iPhone are least sure to play.
 */
const APPLE_TYPES = ["audio/mp4", "audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus"];
/**
 * Speech needs far less than music: 64 kbit/s keeps a voice clear and makes five
 * minutes about 2.4 MB, well inside VOICE_NOTE_MAX_BYTES and quick to send on a
 * phone. Browsers left to themselves chose 128 kbit/s or more.
 */
export const VOICE_BITS_PER_SECOND = 64_000;

/** Safari's engine, on a Mac or any iPhone browser: Apple names itself the vendor. */
export function appleEngine(): boolean {
  return typeof navigator !== "undefined" && /apple/i.test(navigator.vendor ?? "") && typeof (window as any).chrome === "undefined";
}

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
  return { record, words: !!speechEngine() };
}

/** The first recording type this browser takes, in the order that suits its engine. */
export function pickType(): string | undefined {
  const MR = (window as any).MediaRecorder;
  if (typeof MR?.isTypeSupported !== "function") return undefined;
  return (appleEngine() ? APPLE_TYPES : TYPES).find((t) => {
    try {
      return MR.isTypeSupported(t);
    } catch {
      return false;
    }
  });
}

/** While `when` holds, closing or reloading the page asks first (the browser's own question). */
export function useAskBeforeLeaving(when: boolean) {
  useEffect(() => {
    if (!when) return;
    const ask = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", ask);
    return () => window.removeEventListener("beforeunload", ask);
  }, [when]);
}

export interface FinishedTake {
  blob: Blob;
  seconds: number;
  /** What the engine wrote down during this take; empty when it could not listen. */
  words: string;
}

/**
 * What went wrong, said to the person: the microphone blocked or missing, the
 * browser ending the recording before they did (`cut`, the take is kept), the
 * time limit reached (`limit`, the take is kept), or a take with no sound in it
 * at all (`empty`, nothing to keep).
 */
export type RecorderProblem = "blocked" | "noMic" | "cut" | "empty" | "limit" | null;

export function useVoiceRecorder(onTake: (take: FinishedTake) => void, maxSeconds: number = VOICE_NOTE_MAX_SECONDS) {
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [live, setLive] = useState("");
  const [noWords, setNoWords] = useState(false);
  const [problem, setProblem] = useState<RecorderProblem>(null);
  const on = useRef(false);
  /** Who ended the recording: the person, the time limit, or (null) the browser itself. */
  const asked = useRef<"person" | "limit" | null>(null);
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
      asked.current = "person";
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

  // While a recording runs, leaving or reloading the page asks first: the sound is only on this page until Send.
  useAskBeforeLeaving(recording);

  const listen = () => {
    const SR = speechEngine();
    if (!SR || !hearing.current || !on.current) return;
    const r = new SR();
    r.lang = speechLang();
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
      // Words still unsettled when a session ends are kept, never dropped when the next one starts.
      if (interim.current) {
        finals.current = finals.current ? `${finals.current} ${interim.current}` : interim.current;
        interim.current = "";
      }
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

  const stopFor = (who: "person" | "limit") => {
    if (!on.current) return;
    asked.current = who;
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
  };
  const stop = useCallback(() => stopFor("person"), []);

  const start = useCallback(async () => {
    if (on.current) return;
    setProblem(null);
    setNoWords(false);
    setLive("");
    finals.current = "";
    interim.current = "";
    hearing.current = true;
    asked.current = null;
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
      r = type ? new MR(media, { mimeType: type, audioBitsPerSecond: VOICE_BITS_PER_SECOND }) : new MR(media, { audioBitsPerSecond: VOICE_BITS_PER_SECOND });
    } catch {
      try {
        // An engine that refuses the options records with its own.
        r = new MR(media);
      } catch {
        release();
        setProblem("noMic");
        return;
      }
    }
    const chunks: Blob[] = [];
    r.ondataavailable = (e: any) => {
      if (e.data && e.data.size > 0) chunks.push(e.data);
    };
    r.onstop = () => {
      // Ended by the browser, not by Stop or the limit: the button comes back, and the person is told.
      const ended = asked.current;
      on.current = false;
      setRecording(false);
      const seconds = Math.max(1, Math.min(limit.current, Math.round((Date.now() - began.current) / 1000)));
      const words = `${finals.current}${interim.current ? ` ${interim.current}` : ""}`.trim();
      release();
      const blob = new Blob(chunks, { type: r.mimeType || type || "audio/webm" });
      if (blob.size > 0) onTakeRef.current({ blob, seconds, words });
      if (blob.size === 0) setProblem("empty");
      else if (ended === "limit") setProblem("limit");
      else if (ended === null) setProblem("cut");
      setLive("");
      setElapsed(0);
    };
    // A recorder error ends the recording; what it captured is still kept by onstop.
    r.onerror = () => {
      try {
        if (r.state !== "inactive") r.stop();
      } catch {
        /* already stopped */
      }
    };
    for (const track of media.getAudioTracks?.() ?? []) {
      // The microphone gone (unplugged, taken by a call): stop, keeping what was said.
      track.addEventListener?.("ended", () => {
        try {
          if (r.state !== "inactive") r.stop();
        } catch {
          /* already stopped */
        }
      });
      // Some phones hand the microphone to the speech engine and mute the recording: the recording keeps it.
      track.addEventListener?.("mute", () => {
        if (!on.current || !hearing.current || !speechEngine()) return;
        hearing.current = false;
        try {
          engine.current.abort?.();
        } catch {
          /* already stopped */
        }
        engine.current = null;
        setNoWords(true);
      });
    }
    rec.current = r;
    began.current = Date.now();
    on.current = true;
    setElapsed(0);
    setRecording(true);
    r.start(1000);
    timer.current = window.setInterval(() => {
      const s = (Date.now() - began.current) / 1000;
      setElapsed(s);
      if (s >= limit.current) stopFor("limit");
    }, 250);
    // No speech engine at all (Firefox): the recording runs, and the person is told the words will not appear.
    if (!speechEngine()) setNoWords(true);
    listen();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Whether this browser has a speech engine at all, so the card can say the right thing when no words come. */
  const [hasEngine] = useState(() => !!speechEngine());
  return { recording, elapsed, live, noWords, problem, engine: hasEngine, start, stop };
}
