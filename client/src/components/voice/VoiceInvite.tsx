/**
 * "WE LOVE HEARING YOUR VOICE" (Rye, 14 Nov 2026), at the top of About you on
 * the public application (client/src/pages/ProposeARole.tsx mounts it).
 *
 * An encouraged path, never a required one. The applicant may record up to
 * three short takes about who they are, why this role and what they would
 * bring; the browser's speech engine writes down what it hears, and they can
 * correct it. "Skip, I'll type" is always there and the form needs none of it.
 *
 * THE TICK DECIDES WHAT THE VILLAGE GETS. Unticked, the recordings and the
 * words stay on this device (the browser's speech service still hears the live
 * sound to write the words down, and the card says whose it is). Ticked, they go with the application for the people who decide
 * it (shared/voiceNotes.ts says who hears it and how long it is kept). Like
 * files, recordings are never saved in the device draft.
 *
 * The page owns the state (`VoiceState`) so Send can carry it;
 * `applicationRequest` builds the post.
 */
import { lazy, Suspense, useEffect, useId, useRef, useState, type ComponentProps } from "react";
import { useLingui } from "@lingui/react/macro";
import { Mic, Square, Trash2 } from "lucide-react";
import GrowingField from "@/components/form/GrowingField";
import { BTN_PRIMARY, BTN_SECONDARY, FIELD, HINT, LABEL } from "@/components/journey/look";
import { VOICE_NOTES_MAX, VOICE_NOTE_MAX_SECONDS, VOICE_TRANSCRIPT_MAX, voiceKindOfType, voiceLength } from "@shared/voiceNotes";
import { voiceWord } from "@/components/fireflyPath/applyWordsT";
import { JSON_BODY_MAX_BYTES } from "@shared/applyLimits";
import { useVoiceRecorder, voiceSupport, type FinishedTake } from "./useVoiceRecorder";
import { TakePlayer, recorderProblemWords } from "./TakePlayer";
import type { VoiceDrafting } from "./VoiceDrafts";
import { VoiceStepMoreLazy } from "./voiceStepMoreLazy";
/** The page mounts the clips beside its answers from here too (components/voice/VoiceClips.tsx). */
export { VoiceClipsProvider } from "./VoiceClips";
export { useAskBeforeLeaving } from "./useVoiceRecorder";
export { clipLimitsOf, type VoiceClipLimits } from "@shared/voiceNotes";

/** The step's later additions (limit note and the AI switch, countdown, words written down), loaded after the page: the first view is at its budget. */
const MoreLazy = VoiceStepMoreLazy;
/** "Draft my answers" too: drawn only once there are words, so it waits for them off the first view. */
const VoiceDrafts = lazy(() => import("./VoiceDrafts").then((m) => ({ default: m.VoiceDrafts })));
const More = (p: ComponentProps<typeof MoreLazy>) => (
  <Suspense fallback={null}>
    <MoreLazy {...p} />
  </Suspense>
);

export interface VoiceTake {
  blob: Blob;
  seconds: number;
  /** An address for the page's own player, made on this device. */
  url: string;
  /** The words the live engine caught in this take, and whether the transcription service wrote it down since (VoiceStepMore.tsx). */
  words?: string;
  written?: boolean;
}

/** A clip beside one answer (components/voice/VoiceClips.tsx): the recording and the words heard while it ran. */
export interface ClipTake extends VoiceTake {
  words: string;
}

export interface VoiceState {
  takes: VoiceTake[];
  /** What the speech engine heard, as the applicant corrected it. */
  transcript: string;
  consent: boolean;
  skipped: boolean;
  /** Clips beside answers, one per answer, by the answer's key (shared/voiceNotes.ts `isClipField`). */
  clips: Record<string, ClipTake>;
}

export const EMPTY_VOICE: VoiceState = { takes: [], transcript: "", consent: false, skipped: false, clips: {} };

/** Whether anything of the voice is sent: only with the tick, and only when there is something. */
export function voiceSent(v: VoiceState): boolean {
  return v.consent && (v.takes.length > 0 || v.transcript.trim() !== "" || Object.keys(v.clips).length > 0);
}

/**
 * The application's post. With files or ticked recordings it goes as multipart
 * (the proposal as JSON in `proposal`, files in `files`, recordings in `voice`);
 * otherwise as JSON. Without the tick, no recording and no transcript is sent.
 */
export function applicationRequest(proposal: Record<string, unknown>, files: readonly File[], voice: VoiceState): RequestInit {
  const sent = voiceSent(voice);
  const clips = sent ? Object.entries(voice.clips) : [];
  const body = sent
    ? {
        ...proposal,
        voice: {
          consent: true,
          seconds: voice.takes.map((t) => t.seconds),
          // Whole: the page holds a send over the limit and names the box (never cut, the ops request of 19 Nov 2026).
          transcript: voice.transcript.trim(),
          ...(clips.length ? { clips: clips.map(([field, c]) => ({ field, seconds: c.seconds, words: c.words })) } : {}),
        },
      }
    : proposal;
  const takes = sent ? voice.takes : [];
  const json = JSON.stringify(body);
  // A long application with nothing attached still goes whole: past the server's ordinary JSON limit it goes as the
  // multipart post's one field, which holds the longest application there can be (shared/applyLimits.ts).
  if (!files.length && !takes.length && !clips.length && new Blob([json]).size <= JSON_BODY_MAX_BYTES) return { method: "POST", headers: { "Content-Type": "application/json" }, body: json };
  const fd = new FormData();
  fd.append("proposal", json);
  for (const f of files) fd.append("files", f, f.name);
  takes.forEach((t, i) => fd.append("voice", t.blob, `voice-${i + 1}.${voiceKindOfType(t.blob.type)}`));
  // Clips in the same order as their descriptions above, which is how the server pairs them.
  clips.forEach(([field, c]) => fd.append("clips", c.blob, `${field}.${voiceKindOfType(c.blob.type)}`));
  return { method: "POST", body: fd };
}

export function VoiceInvite({ value, onChange, drafting }: { value: VoiceState; onChange: (next: VoiceState) => void; drafting?: VoiceDrafting }) {
  const { t } = useLingui();
  const id = useId();
  const [support] = useState(voiceSupport);
  // The latest value inside the recorder's callback, which outlives the render that started it.
  const [latest] = useState(() => ({ v: value }));
  latest.v = value;
  const took = (take: FinishedTake) => {
    const v = latest.v;
    if (v.takes.length >= VOICE_NOTES_MAX) return;
    // Every word heard, however long: the box shows its count and how much to trim.
    const transcript = take.words ? (v.transcript.trim() ? `${v.transcript.trimEnd()}\n\n${take.words}` : take.words) : v.transcript;
    onChange({ ...v, takes: [...v.takes, { blob: take.blob, seconds: take.seconds, url: URL.createObjectURL(take.blob), words: take.words }], transcript });
  };
  const recorder = useVoiceRecorder(took);
  // The live region speaks at the start, at the near-end warning and at the stop, never the running time (a11y sweep P2-10).
  const wasRecording = useRef(false);
  const [stopped, setStopped] = useState(false);
  useEffect(() => {
    if (wasRecording.current && !recorder.recording) setStopped(true);
    if (recorder.recording) setStopped(false);
    wasRecording.current = recorder.recording;
  }, [recorder.recording]);

  if (!support.record && !support.words) return null;
  if (value.skipped) {
    return (
      <button type="button" onClick={() => onChange({ ...value, skipped: false })} className="inline-flex min-h-11 items-center justify-self-start text-sm font-medium text-notice underline underline-offset-2 hover:text-foreground" data-voice-reopen="">
        {voiceWord("reopen")}
      </button>
    );
  }

  const remove = (i: number) => {
    URL.revokeObjectURL(value.takes[i].url);
    onChange({ ...value, takes: value.takes.filter((_, k) => k !== i) });
  };
  const anything = value.takes.length > 0 || value.transcript.trim() !== "" || Object.keys(value.clips).length > 0;
  const left = VOICE_NOTE_MAX_SECONDS - recorder.elapsed;
  const problem = recorderProblemWords(recorder.problem);

  return (
    <section aria-labelledby={`${id}-h`} tabIndex={-1} className="grid scroll-mt-24 gap-4 rounded-2xl border-2 border-notice/60 bg-card p-5 shadow-sm outline-none" data-voice-invite="">
      <div className="grid gap-2">
        <h3 id={`${id}-h`} className="font-display text-2xl leading-snug text-card-foreground">
          {voiceWord("inviteTitle")}
        </h3>
        <p className="text-base leading-relaxed text-muted-foreground">
          {support.record
            ? voiceWord("inviteBody")
            : t({ message: "Tap the mic in any answer below to say it instead of typing it.", context: "voice note" })}
        </p>
        {/* Voice is encouraged, never required (Rye, 14 Nov 2026), so a person who won't record is told so before they choose (steelman QA, 15 Nov 2026). */}
        <p className="text-sm leading-relaxed text-muted-foreground" data-voice-optional="">
          {t({ message: "Recording is optional. Typed answers are read with the same care and count just the same.", context: "voice note" })}
        </p>
      </div>

      {value.takes.length > 0 && (
        <ul className="grid gap-2" data-voice-takes="">
          {value.takes.map((take, i) => (
            <li key={take.url} className="flex min-w-0 flex-wrap items-center gap-3 rounded-xl border border-border bg-muted p-3">
              <span className="text-sm font-semibold text-foreground">
                {t({ message: `Recording ${i + 1}`, context: "voice note" })} <span className="font-normal tabular-nums text-muted-foreground">{voiceLength(take.seconds)}</span>
              </span>
              <TakePlayer url={take.url} type={take.blob.type} name={`voice-${i + 1}`} />
              <button type="button" onClick={() => remove(i)} className="inline-flex min-h-11 items-center gap-1 px-2 text-sm text-muted-foreground underline underline-offset-2 hover:text-foreground">
                <Trash2 className="size-4" aria-hidden="true" />
                {t({ message: "Remove", context: "voice note" })}
              </button>
              {/* Drawn while another take records too, so a take still being written down is never cut off. */}
              <More part="transcribe" index={i} state={latest} onChange={onChange} link={drafting?.link} />
            </li>
          ))}
        </ul>
      )}

      {support.record && (
        <div className="grid gap-2">
          {!recorder.recording && value.takes.length < VOICE_NOTES_MAX && <More part="limit" />}
          {recorder.recording ? (
            <button type="button" onClick={recorder.stop} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-destructive px-6 font-semibold text-destructive-foreground" data-voice-stop="">
              <Square className="size-4" aria-hidden="true" />
              {voiceWord("stop")}
            </button>
          ) : (
            value.takes.length < VOICE_NOTES_MAX && (
              <button type="button" onClick={() => void recorder.start()} className={`${value.takes.length ? BTN_SECONDARY : BTN_PRIMARY} min-h-12 justify-center`} data-voice-record="">
                <Mic className="size-5" aria-hidden="true" />
                {value.takes.length ? voiceWord("recordAnother") : voiceWord("record")}
              </button>
            )
          )}
          {recorder.recording && (
            <p className="flex justify-between text-sm tabular-nums text-muted-foreground" data-voice-timer="">
              <span>{t({ message: `Recording ${value.takes.length + 1} of ${VOICE_NOTES_MAX}`, context: "voice note" })}</span>
              <span>
                {voiceLength(recorder.elapsed)} / {voiceLength(VOICE_NOTE_MAX_SECONDS)}
                <span className="ml-2 font-semibold text-foreground" data-voice-left={recorder.left}>
                  {t({ message: `${voiceLength(recorder.left)} left`, context: "voice note timer" })}
                </span>
              </span>
            </p>
          )}
          {recorder.warned && (
            <p aria-hidden="true" className="border-l-4 border-notice pl-3 text-sm font-semibold text-foreground" data-voice-warned="">
              {voiceWord("nearEnd")} {t({ message: "It stops by itself at the limit and keeps everything you said.", context: "voice note timer" })}
            </p>
          )}
          {recorder.recording && left <= 60 && <More part="countdown" elapsed={recorder.elapsed} />}
          {/* Always drawn, so a screen reader is listening before the words change. */}
          <p className="sr-only" role="status" data-voice-said="">
            {recorder.recording
              ? left <= 30
                ? voiceWord("nearEnd")
                : left <= 60
                  ? t({ message: "About a minute left in this recording.", context: "voice note, read aloud" })
                  : t({ message: `Recording ${value.takes.length + 1} of ${VOICE_NOTES_MAX} started.`, context: "voice note, read aloud" })
              : stopped
                ? t({ message: "Recording stopped. You can play it back below.", context: "voice note, read aloud" })
                : ""}
          </p>
          {recorder.recording && recorder.live && <p className="border-l-2 border-notice pl-3 text-sm italic text-muted-foreground" data-voice-live="">{recorder.live}</p>}
          {recorder.noWords && <p className="border-l-4 border-notice pl-3 text-sm text-foreground" role="status" data-voice-no-words="">{recorder.engine ? voiceWord("noTranscribe") : voiceWord("noEngine")}</p>}
          {problem && <p className="border-l-4 border-notice pl-3 text-sm text-foreground" role="status" data-voice-problem={recorder.problem ?? ""}>{problem}</p>}
        </div>
      )}

      {anything && (
        <div className="grid gap-2">
          <label htmlFor={`${id}-heard`} className={LABEL}>
            {voiceWord("heardLabel")}
          </label>
          {/* Nothing written down (no speech engine, or it could not hear): say so, so an empty box never reads as a fault. */}
          {!recorder.recording && value.takes.length > 0 && !value.transcript.trim() && (
            <p className="text-sm text-foreground" data-voice-heard-nothing="">
              {voiceWord("heardNothing")}
            </p>
          )}
          <GrowingField id={`${id}-heard`} minRows={3} limit={VOICE_TRANSCRIPT_MAX} value={value.transcript} onChange={(transcript) => onChange({ ...value, transcript })} className={FIELD} />
          <p className={HINT}>{voiceWord("heardHint")}</p>
          {drafting && !recorder.recording && (
            <Suspense fallback={null}>
              <VoiceDrafts heard={value.transcript} drafting={drafting} />
            </Suspense>
          )}
        </div>
      )}

      {anything && (
        <label htmlFor={`${id}-keep`} className="flex min-h-11 cursor-pointer items-start gap-3" data-voice-consent="">
          <input id={`${id}-keep`} type="checkbox" className="mt-0.5 size-5 shrink-0 accent-notice" checked={value.consent} onChange={(e) => onChange({ ...value, consent: e.target.checked })} />
          <span className="grid gap-1">
            <span className="font-semibold text-foreground">{voiceWord("consent")}</span>
            <span className={HINT}>{value.consent ? voiceWord("kept") : voiceWord("notKept")}</span>
          </span>
        </label>
      )}

      {!recorder.recording && !anything && (
        <button type="button" onClick={() => onChange({ ...value, skipped: true })} className="inline-flex min-h-11 items-center justify-self-start text-sm font-medium text-muted-foreground underline underline-offset-2 hover:text-foreground" data-voice-skip="">
          {voiceWord("skip")}
        </button>
      )}
    </section>
  );
}

