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
import { createContext, lazy, Suspense, useContext, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import { Circle, Square, Trash2 } from "lucide-react";
import { useLingui } from "@lingui/react/macro";
import { HINT } from "@/components/journey/look";
import { DEFAULT_CLIP_LIMITS, isClipField, voiceLength, type VoiceClipLimits } from "@shared/voiceNotes";
import { clipsFullWords, voiceWord } from "@/components/fireflyPath/applyWordsT";
import { useVoiceRecorder, voiceSupport } from "./useVoiceRecorder";
import { forField } from "@/components/form/fieldName";
import { TakePlayer, recorderProblemWords } from "./TakePlayer";
import type { VoiceState } from "./VoiceInvite";
import { VoiceStepMoreLazy } from "./voiceStepMoreLazy";

interface ClipsContext {
  voice: VoiceState;
  setVoice: Dispatch<SetStateAction<VoiceState>>;
  limits: VoiceClipLimits;
  /** The application's own link, when it came through one: the transcription door is the same door as the form. */
  link?: string;
  /**
   * Where the AI line and its switch show before a first clip (idea 16: said once, on the first voice field). Absent:
   * beside every clip, as before. A field name: beside that clip alone. Null: no clip says it, because the page's
   * voice card above already does.
   */
  aiLineAt?: string | null;
}

const Clips = createContext<ClipsContext | null>(null);

/** The clip's words written down by themselves, and the AI line before its first recording (VoiceStepMore.tsx), loaded after the page. */
const More = VoiceStepMoreLazy;

export function VoiceClipsProvider({ voice, setVoice, limits = DEFAULT_CLIP_LIMITS, link, aiLineAt, children }: Omit<ClipsContext, "limits"> & { limits?: VoiceClipLimits; children: ReactNode }) {
  return <Clips.Provider value={{ voice, setVoice, limits, link, aiLineAt }}>{children}</Clips.Provider>;
}

/** The record button, the clip and, until it is given, the tick. Nothing without a provider, a recorder, or clips allowed. */
export function ClipBar({ field, onWords, fieldName = "", answer }: {
  field: string;
  onWords: (words: string) => void;
  /** The answer's own label, so each control is named for it (components/form/fieldName.ts). */
  fieldName?: string;
  /** The answer itself, so the clip's written-down words can replace what the live engine caught there. */
  answer?: { value: string; set: (next: string) => void; limit?: number };
}) {
  const ctx = useContext(Clips);
  const { t } = useLingui();
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
  // A clip that reaches its limit says so on its own timer; every other ending is said here.
  const problem = recorder.problem === "limit" ? null : recorderProblemWords(recorder.problem);
  const btn = "inline-flex min-h-11 items-center gap-2 rounded-full border border-border px-3 text-sm font-medium text-foreground hover:border-notice disabled:opacity-50";

  return (
    <div className="mt-2 grid gap-2" data-voice-clip={field}>
      <div className="flex flex-wrap items-center gap-2">
        {recorder.recording ? (
          <button type="button" onClick={recorder.stop} aria-label={forField(voiceWord("clipStop"), fieldName)} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-destructive px-4 text-sm font-semibold text-destructive-foreground" data-voice-clip-stop="">
            <Square className="size-3.5" aria-hidden="true" />
            {voiceWord("clipStop")}
            <span className="tabular-nums">
              {voiceLength(recorder.elapsed)} / {voiceLength(ctx.limits.seconds)}
            </span>
          </button>
        ) : (
          <button type="button" onClick={() => void recorder.start()} disabled={full} aria-label={forField(mine ? voiceWord("clipAgain") : voiceWord("clipRecord"), fieldName)} className={btn} data-voice-clip-record="">
            <Circle className="size-3.5 fill-destructive text-destructive" aria-hidden="true" />
            {mine ? voiceWord("clipAgain") : voiceWord("clipRecord")}
          </button>
        )}
        {mine && !recorder.recording && (
          <>
            <TakePlayer url={mine.url} type={mine.blob.type} name={field} label={forField(voiceWord("clipLabel"), fieldName)} className="h-10 min-w-0 max-w-full flex-1 basis-40" />
            <span className="text-sm tabular-nums text-muted-foreground">{voiceLength(mine.seconds)}</span>
            <button type="button" onClick={remove} aria-label={forField(voiceWord("clipRemove"), fieldName)} className="inline-flex min-h-11 items-center gap-1 px-2 text-sm text-muted-foreground underline underline-offset-2 hover:text-foreground">
              <Trash2 className="size-4" aria-hidden="true" />
              {voiceWord("clipRemove")}
            </button>
          </>
        )}
      </div>
      {recorder.recording && (
        <p className="text-sm tabular-nums text-foreground" data-voice-clip-left={recorder.left}>
          {t({ message: `${voiceLength(recorder.left)} left`, context: "voice note timer" })}
          {recorder.warned && <span className="ml-2 font-semibold" role="status">{voiceWord("nearEnd")}</span>}
        </p>
      )}
      {recorder.recording && recorder.live && <p className="border-l-2 border-notice pl-3 text-sm italic text-muted-foreground">{recorder.live}</p>}
      {recorder.noWords && <p className="border-l-4 border-notice pl-3 text-sm text-foreground" role="status">{recorder.engine ? voiceWord("noTranscribe") : voiceWord("noEngine")}</p>}
      {problem && <p className="border-l-4 border-notice pl-3 text-sm text-foreground" role="status">{problem}</p>}
      {!recorder.recording && (
        <Suspense fallback={null}>
          <More
            part="clip"
            field={field}
            clip={mine}
            answer={answer}
            link={ctx.link}
            aiLine={ctx.aiLineAt === undefined || ctx.aiLineAt === field}
            setClipWords={(blob, words) => ctx.setVoice((v) => (v.clips[field]?.blob === blob ? { ...v, clips: { ...v.clips, [field]: { ...v.clips[field], words, written: true } } } : v))}
          />
        </Suspense>
      )}
      {full && <p className={HINT}>{clipsFullWords(ctx.limits.max)}</p>}
      {mine && !ctx.voice.consent && (
        <label className="flex min-h-11 cursor-pointer items-start gap-3 text-sm" data-voice-clip-consent="">
          <input type="checkbox" className="mt-0.5 size-5 shrink-0 accent-notice" checked={false} onChange={(e) => ctx.setVoice((v) => ({ ...v, consent: e.target.checked }))} />
          <span className="grid gap-0.5">
            <span className="font-semibold text-foreground">{voiceWord("consent")}</span>
            <span className={HINT}>{voiceWord("notKept")}</span>
          </span>
        </label>
      )}
    </div>
  );
}
