/**
 * A CLIP BESIDE EACH ANSWER (Rye, 14 Nov 2026: "they can do micro recordings
 * for each answer ... as they talk in different sections of the application").
 *
 * Under a written answer on the public application, a small "Record this
 * answer" button. While it records, the browser's speech service writes the
 * words down (Google's in Chrome, Apple's in Safari; see MicButton), and when
 * it stops they are added to that answer, where the applicant sees and edits
 * them. The recording stays as that answer's clip: one per answer, replaced by
 * recording again, removed with one press.
 *
 * THE SAME TICK as the main voice note decides whether any clip is sent
 * (shared/voiceNotes.ts). The first clip shows the tick right under it, so
 * nobody has to walk back to About you to find it. How many clips and how long
 * each are village settings, told to the form by the server.
 *
 * Mounted by GrowingField and MicInput when given `clip`, inside the page's
 * `VoiceClipsProvider`. Anywhere else, no provider, no button: the member
 * forms that share those fields are unchanged.
 */
import { createContext, useContext, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import { Circle, Square, Trash2 } from "lucide-react";
import { HINT } from "@/components/journey/look";
import { DEFAULT_CLIP_LIMITS, VOICE_WORDS, isClipField, voiceLength, type VoiceClipLimits } from "@shared/voiceNotes";
import { useVoiceRecorder, voiceSupport } from "./useVoiceRecorder";
import type { VoiceState } from "./VoiceInvite";

interface ClipsContext {
  voice: VoiceState;
  setVoice: Dispatch<SetStateAction<VoiceState>>;
  limits: VoiceClipLimits;
}

const Clips = createContext<ClipsContext | null>(null);

export function VoiceClipsProvider({ voice, setVoice, limits = DEFAULT_CLIP_LIMITS, children }: ClipsContext & { children: ReactNode }) {
  return <Clips.Provider value={{ voice, setVoice, limits }}>{children}</Clips.Provider>;
}

/** The record button, the clip and, until it is given, the tick. Nothing without a provider, a recorder, or clips allowed. */
export function ClipBar({ field, onWords }: { field: string; onWords: (words: string) => void }) {
  const ctx = useContext(Clips);
  const [support] = useState(voiceSupport);
  const recorder = useVoiceRecorder((take) => {
    if (!ctx) return;
    if (take.words) onWords(take.words);
    ctx.setVoice((v) => {
      const old = v.clips[field];
      if (old) URL.revokeObjectURL(old.url);
      return { ...v, clips: { ...v.clips, [field]: { blob: take.blob, seconds: take.seconds, url: URL.createObjectURL(take.blob), words: take.words } } };
    });
  }, ctx?.limits.seconds ?? DEFAULT_CLIP_LIMITS.seconds);
  if (!ctx || !support.record || ctx.limits.max <= 0 || !isClipField(field)) return null;

  const mine = ctx.voice.clips[field];
  const count = Object.keys(ctx.voice.clips).length;
  const full = !mine && count >= ctx.limits.max;
  const remove = () =>
    ctx.setVoice((v) => {
      const { [field]: gone, ...rest } = v.clips;
      if (gone) URL.revokeObjectURL(gone.url);
      return { ...v, clips: rest };
    });
  const problem = recorder.problem === "blocked" ? VOICE_WORDS.micBlocked : recorder.problem === "noMic" ? VOICE_WORDS.noMic : null;
  const btn = "inline-flex min-h-11 items-center gap-2 rounded-full border border-border px-3 text-sm font-medium text-foreground hover:border-notice disabled:opacity-50";

  return (
    <div className="mt-2 grid gap-2" data-voice-clip={field}>
      <div className="flex flex-wrap items-center gap-2">
        {recorder.recording ? (
          <button type="button" onClick={recorder.stop} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-destructive px-4 text-sm font-semibold text-destructive-foreground" data-voice-clip-stop="">
            <Square className="size-3.5" aria-hidden="true" />
            {VOICE_WORDS.clipStop}
            <span className="tabular-nums">
              {voiceLength(recorder.elapsed)} / {voiceLength(ctx.limits.seconds)}
            </span>
          </button>
        ) : (
          <button type="button" onClick={() => void recorder.start()} disabled={full} className={btn} data-voice-clip-record="">
            <Circle className="size-3.5 fill-destructive text-destructive" aria-hidden="true" />
            {mine ? VOICE_WORDS.clipAgain : VOICE_WORDS.clipRecord}
          </button>
        )}
        {mine && !recorder.recording && (
          <>
            <audio controls preload="metadata" src={mine.url} aria-label={VOICE_WORDS.clipLabel} className="h-10 min-w-0 max-w-full flex-1 basis-40" />
            <span className="text-sm tabular-nums text-muted-foreground">{voiceLength(mine.seconds)}</span>
            <button type="button" onClick={remove} className="inline-flex min-h-11 items-center gap-1 px-2 text-sm text-muted-foreground underline underline-offset-2 hover:text-foreground">
              <Trash2 className="size-4" aria-hidden="true" />
              {VOICE_WORDS.clipRemove}
            </button>
          </>
        )}
      </div>
      {recorder.recording && recorder.live && <p className="border-l-2 border-notice pl-3 text-sm italic text-muted-foreground">{recorder.live}</p>}
      {recorder.noWords && <p className="border-l-4 border-notice pl-3 text-sm text-foreground" role="status">{VOICE_WORDS.noTranscribe}</p>}
      {problem && <p className="border-l-4 border-notice pl-3 text-sm text-foreground" role="status">{problem}</p>}
      {full && <p className={HINT}>{VOICE_WORDS.clipsFull(ctx.limits.max)}</p>}
      {mine && !ctx.voice.consent && (
        <label className="flex min-h-11 cursor-pointer items-start gap-3 text-sm" data-voice-clip-consent="">
          <input type="checkbox" className="mt-0.5 size-5 shrink-0 accent-notice" checked={false} onChange={(e) => ctx.setVoice((v) => ({ ...v, consent: e.target.checked }))} />
          <span className="grid gap-0.5">
            <span className="font-semibold text-foreground">{VOICE_WORDS.consent}</span>
            <span className={HINT}>{VOICE_WORDS.notKept}</span>
          </span>
        </label>
      )}
    </div>
  );
}
