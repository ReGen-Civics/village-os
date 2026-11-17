/**
 * THEIR VOICE, for the people who decide an application (Rye, 14 Nov 2026:
 * "I want to be able to hear the applicants voice and listen to them as
 * well"). Drawn on the decider page (client/src/pages/OpenProposal.tsx); the
 * server sends `voice` only to those who decide it, and only when the
 * applicant ticked that we may keep it (shared/voiceNotes.ts). `PlayVoice` is
 * also Admin's play control, beside each answer in the applications panel.
 *
 * Each recording is fetched when its play button is pressed, with the reader's
 * own sign-in, and played from memory on this device: nothing is cached, and
 * no download link is drawn. Words heard sit beside each clip and folded
 * under the main note: what the browser heard, in their words, unchecked. No
 * AI summary of a person is ever shown here.
 *
 * EVERY BROWSER PLAYS IT (the lead, 17 Nov 2026). A recording made in Chrome or
 * Firefox is WebM or Ogg, which Safari and iPhones may refuse. Where this
 * browser says it cannot play what came, or is Safari's engine, the MP4/AAC
 * copy is asked for instead (`?as=mp4`, server/lib/voicePlayback.ts), and a
 * player that fails on the original tries the copy once before saying so.
 */
import { lazy, Suspense, useEffect, useState } from "react";
import { useLingui } from "@lingui/react/macro";
import { Play } from "lucide-react";
import { gameFetch } from "@/lib/gameApi";
import { appleEngine } from "./useVoiceRecorder";
import { learnLength } from "./TakePlayer";
import { VOICE_WORDS, voiceLength, type WrittenWords } from "@shared/voiceNotes";

/** "Write down the words" and the AI transcript, loaded only where a recording is drawn (StoredWords.tsx). */
const StoredWordsLazy = lazy(() => import("./StoredWords"));
export function StoredWordsSlot(p: { href: string; written?: WrittenWords | null; on: boolean; poster: (href: string) => Promise<Response> }) {
  if (!p.on && !p.written) return null;
  return (
    <Suspense fallback={null}>
      <StoredWordsLazy {...p} />
    </Suspense>
  );
}
const postAsMember = (href: string) => gameFetch(href, { method: "POST" });

export interface ServedClip {
  id: string;
  field: string;
  label: string;
  seconds: number;
  words: string;
  href: string;
}

export interface ServedVoice {
  notes: Array<{ id: string; seconds: number; size?: number; href: string }>;
  transcript: string;
  clips?: ServedClip[];
  /** AI transcripts of these recordings, by recording id (shared/voiceNotes.ts `written`). */
  written?: Record<string, WrittenWords>;
  /** Whether a recording can be written down now. */
  transcribeOn?: boolean;
}

/** The door's address for the MP4/AAC copy of a recording. */
export const mp4Href = (href: string) => `${href}${href.includes("?") ? "&" : "?"}as=mp4`;

/** Whether this browser should be handed the MP4/AAC copy of a recording of this type. */
export function wantsMp4Copy(type: string, canPlay: (type: string) => string = (t) => document.createElement("audio").canPlayType(t), apple: boolean = appleEngine()): boolean {
  const base = type.split(";")[0].trim().toLowerCase();
  if (!base || base === "audio/mp4") return false;
  return apple || canPlay(base) === "";
}

/** One recording: a play button that fetches it, then the player. */
export function PlayVoice({ href, seconds, label, fetcher = gameFetch }: { href: string; seconds: number; label: string; /** How to fetch it: the member sign-in by default; Admin hands in its own. */ fetcher?: (href: string) => Promise<Response> }) {
  const [url, setUrl] = useState<string | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "failed">("idle");
  useEffect(
    () => () => {
      if (url) URL.revokeObjectURL(url);
    },
    [url],
  );
  const [triedCopy, setTriedCopy] = useState(false);
  const copy = async (): Promise<Blob | null> => {
    setTriedCopy(true);
    const res = await fetcher(mp4Href(href)).catch(() => null);
    return res?.ok ? res.blob() : null;
  };
  const listen = async () => {
    setState("loading");
    try {
      const res = await fetcher(href);
      if (!res.ok) throw new Error(String(res.status));
      let blob = await res.blob();
      // Safari and iPhones: the MP4/AAC copy, when this browser cannot play what came (and the original when no copy can be made).
      if (wantsMp4Copy(res.headers.get("content-type") ?? blob.type)) blob = (await copy()) ?? blob;
      setUrl(URL.createObjectURL(blob));
      setState("idle");
    } catch {
      setState("failed");
    }
  };
  // The player refused the original after all: try the copy once, then say so.
  const refused = async () => {
    if (triedCopy) return void (setUrl(null), setState("failed"));
    const blob = await copy();
    if (!blob) return void (setUrl(null), setState("failed"));
    setUrl(URL.createObjectURL(blob));
  };
  if (url) return <audio controls autoPlay src={url} aria-label={label} onLoadedMetadata={learnLength} onError={() => void refused()} className="h-10 w-full max-w-md" data-voice-heard-player="" />;
  return (
    <span className="inline-flex flex-wrap items-center gap-2" data-play-voice="">
      <button
        type="button"
        onClick={() => void listen()}
        disabled={state === "loading"}
        aria-label={`${VOICE_WORDS.listen}: ${label}`}
        className="inline-flex min-h-11 items-center gap-2 rounded-full border border-notice px-4 text-sm font-semibold text-foreground hover:bg-muted disabled:opacity-60"
      >
        <Play className="size-4" aria-hidden="true" />
        {VOICE_WORDS.listen} <span className="font-normal tabular-nums text-muted-foreground">{voiceLength(seconds)}</span>
      </button>
      {state === "failed" && (
        <span role="status" className="text-sm text-foreground">
          {VOICE_WORDS.unplayable}
        </span>
      )}
    </span>
  );
}

export function VoiceHeard({ voice }: { voice: ServedVoice | null | undefined }) {
  const { t } = useLingui();
  const clips = voice?.clips ?? [];
  if (!voice || (!voice.notes.length && !voice.transcript.trim() && !clips.length)) return null;
  return (
    <section aria-labelledby="op-voice" className="grid gap-3" data-voice-heard="">
      <h2 id="op-voice" className="text-lg font-bold text-foreground">
        {VOICE_WORDS.heardHeading}
      </h2>
      <p className="text-sm text-muted-foreground">{VOICE_WORDS.heardNote}</p>
      <p className="text-sm text-muted-foreground" data-voice-weigh-same="">{t({ message: "Recording is optional, and many people type. Weigh typed answers the same as a recording.", context: "their voice, for deciders" })}</p>
      {voice.notes.length > 0 && (
        <ul className="grid gap-2">
          {voice.notes.map((note, i) => (
            <li key={note.id} className="grid gap-2 rounded-xl border border-border bg-muted p-3" data-voice-note={note.id}>
              <span className="text-sm font-semibold text-foreground">{t({ message: `Recording ${i + 1}`, context: "voice note, deciders" })}</span>
              <PlayVoice href={note.href} seconds={note.seconds} label={t({ message: `Recording ${i + 1}`, context: "voice note, deciders" })} />
              <StoredWordsSlot href={note.href} written={voice.written?.[note.id]} on={!!voice.transcribeOn} poster={postAsMember} />
            </li>
          ))}
        </ul>
      )}
      {voice.transcript.trim() && (
        <details className="rounded-xl border border-border p-3">
          <summary className="cursor-pointer text-sm font-semibold text-foreground">{VOICE_WORDS.transcriptFold}</summary>
          <p className="mt-2 whitespace-pre-line break-words text-foreground">{voice.transcript}</p>
        </details>
      )}
      {clips.length > 0 && (
        <ul className="grid gap-2" data-voice-clips="">
          {clips.map((c) => (
            <li key={c.id} className="grid gap-2 rounded-xl border border-border p-3" data-voice-clip-heard={c.field}>
              <span className="text-sm font-semibold text-foreground">{c.label}</span>
              <PlayVoice href={c.href} seconds={c.seconds} label={c.label} />
              {c.words && <p className="whitespace-pre-line break-words text-sm text-muted-foreground">{c.words}</p>}
              <StoredWordsSlot href={c.href} written={voice.written?.[c.id]} on={!!voice.transcribeOn} poster={postAsMember} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
