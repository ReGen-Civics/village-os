/**
 * THE VOICE STEP'S SECOND HALF, loaded after the page (the lead, 17 Nov 2026).
 * The application's first view is at its budget, so everything added to the
 * step that day lives here and arrives a moment after the card, through one
 * lazy import in VoiceInvite.tsx and one in VoiceClips.tsx:
 *
 *   - `limit`: before recording, "You can record up to 7 minutes each time.", and, when the
 *     village's transcription service is on, the line that says an AI service
 *     writes recordings down, with the switch that turns it off.
 *   - `countdown`: in the last minute of a take, the seconds left, large, and
 *     what happens at 0:00. The hard stop itself is the recorder's
 *     (useVoiceRecorder.ts), at exactly VOICE_NOTE_MAX_SECONDS.
 *   - `transcribe`: under one take, its words being written down.
 *   - `clip`: the same beside one answer's clip.
 *
 * AUTOMATIC, WITH A SWITCH TO TURN IT OFF (the lead, 17 Nov 2026: "actually
 * make it automatic and the button is to turn it off!"). While the service is
 * on and "Write down my words automatically" is on (it is, unless the
 * applicant turns it off; remembered for their visit), each take and clip is
 * sent as soon as it is recorded (shared/voiceTranscribe.ts). Turning it off
 * stops every send and cancels the ones running; each take then offers "Write
 * down my words" to press. The words go into "What we heard, in your words"
 * (or the answer, for a clip), replacing what the live engine caught where it
 * still stands as caught, and never over anything the applicant typed.
 */
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useLingui } from "@lingui/react/macro";
import type { I18n } from "@lingui/core";
import { msg } from "@lingui/core/macro";
import { SeedGlint } from "@/components/sacred/living";
import { BTN_SECONDARY, HINT } from "@/components/journey/look";
import { speechLang } from "@/lib/speechLang";
import { VOICE_NOTE_MAX_SECONDS, VOICE_WORDS, voiceKindOfType, voiceLength } from "@shared/voiceNotes";
import { TRANSCRIBE_WORDS, VOICE_TRANSCRIBE_PATH } from "@shared/voiceTranscribe";
import { autoWriteDown, markTried, running, setAutoWriteDown, subscribeAutoWriteDown, transcriptionOn, triedBefore } from "./voiceWriteDownStore";
import type { ClipTake, VoiceState } from "./VoiceInvite";
export { autoWriteDown, forgetTranscriptionOn, setAutoWriteDown, transcriptionOn } from "./voiceWriteDownStore";

/** The last minute of a take: when the countdown shows. */
export const COUNTDOWN_FROM_SECONDS = 60;

/** The seconds left in a take, whole and never below zero; null before the last minute. */
export function countdownLeft(elapsed: number, max: number = VOICE_NOTE_MAX_SECONDS): number | null {
  const left = Math.max(0, Math.ceil(max - elapsed));
  return left <= COUNTDOWN_FROM_SECONDS ? left : null;
}

/**
 * Replace the words the live engine caught where they still stand as caught; add them where nothing was caught;
 * otherwise leave the text alone. Always whole (the ops request of 19 Nov 2026): words that run a box past its
 * limit are kept and shown, and the box's own signs say how much to trim.
 */
export function placeWords(text: string, caught: string, words: string): { text: string; placed: boolean } {
  const c = caught.trim();
  if (c && text.includes(c)) return { text: text.replace(c, words), placed: true };
  if (!c) return { text: addWords(text, words), placed: true };
  return { text, placed: false };
}

/** Words added at the end of an answer, whole. */
export function addWords(text: string, words: string): string {
  return text.trim() ? `${text.trimEnd()} ${words}` : words;
}

/**
 * The step's state once take `i` has been written down: its words replace the
 * words the live engine caught for that take, where they still stand in the box
 * as caught, and are added at the end otherwise, so nothing the applicant typed
 * is overwritten.
 */
export function withWrittenWords(v: VoiceState, i: number, text: string): VoiceState {
  const take = v.takes[i];
  const words = text.trim();
  if (!take || !words) return v;
  const caught = (take.words ?? "").trim();
  const box = v.transcript;
  const transcript =
    caught && box.includes(caught) ? box.replace(caught, words) : box.trim() ? `${box.trimEnd()}\n\n${words}` : words;
  // Whole, however long: the box shows its count and how much to trim (never cut, the ops request of 19 Nov 2026).
  return { ...v, transcript, takes: v.takes.map((t, k) => (k === i ? { ...t, words, written: true } : t)) };
}

function useTranscriptionOn(): boolean {
  const [on, setOn] = useState(false);
  useEffect(() => {
    let live = true;
    void transcriptionOn().then((v) => live && setOn(v));
    return () => {
      live = false;
    };
  }, []);
  return on;
}

/* ── The switch: on unless turned off, remembered for the visit (voiceWriteDownStore.ts) ── */

function useAutoWriteDown(): boolean {
  return useSyncExternalStore(subscribeAutoWriteDown, autoWriteDown, () => true);
}

/** The server's refusals, in the reader's language, keyed by the shared constant itself. */
function refusalWords(said: string, i18n: I18n): string {
  const known: Array<[string, ReturnType<typeof msg>]> = [
    [TRANSCRIBE_WORDS.closed, msg({ message: "Applications are closed just now, so recordings can't be written down.", context: "voice transcription refusal" })],
    [TRANSCRIBE_WORDS.off, msg({ message: "Writing recordings down isn't switched on here. Type what you said instead.", context: "voice transcription refusal" })],
    [TRANSCRIBE_WORDS.tooMany, msg({ message: "That's a lot of recordings written down for one connection. Your recording is still kept. Type what you said, or try again in an hour.", context: "voice transcription refusal" })],
    [TRANSCRIBE_WORDS.unavailable, msg({ message: "We couldn't write this recording down just now. Your recording is still kept. Try again in a moment, or type what you said.", context: "voice transcription refusal" })],
    [TRANSCRIBE_WORDS.busy, msg({ message: "A few recordings are being written down already. Try again in a moment.", context: "voice transcription refusal" })],
    [TRANSCRIBE_WORDS.tooLong, msg({ message: "Only takes up to 7 minutes can be written down.", context: "voice transcription refusal" })],
    [TRANSCRIBE_WORDS.heardNothing, msg({ message: "The service heard no words in this recording. Type what you said, or record again.", context: "voice transcription refusal" })],
    [VOICE_WORDS.tooBig, msg({ message: "One recording is too large. Record a shorter one.", context: "voice transcription refusal" })],
    [VOICE_WORDS.wrongType, msg({ message: "We couldn't read one of your recordings. Record it again.", context: "voice transcription refusal" })],
  ];
  const hit = known.find(([k]) => k === said);
  return hit ? i18n._(hit[1]) : said;
}

/** One recording to the service. Resolves its words, a refusal in the server's words, or null when cancelled. */
export async function sendForWords(blob: Blob, seconds: number, link?: string, what: "take" | "clip" = "take"): Promise<{ text: string } | { error: string } | null> {
  running.get(blob)?.abort();
  const stop = new AbortController();
  running.set(blob, stop);
  try {
    const fd = new FormData();
    fd.append("seconds", String(seconds));
    // Clips have their own count on the server, so short clips never use up the takes' hour (shared/voiceTranscribe.ts).
    fd.append("kind", what);
    fd.append("lang", speechLang());
    if (link) fd.append("link", link);
    fd.append("voice", blob, `take.${voiceKindOfType(blob.type)}`);
    const res = await fetch(VOICE_TRANSCRIBE_PATH, { method: "POST", body: fd, signal: stop.signal });
    const data = await res.json().catch(() => ({}));
    if (stop.signal.aborted) return null;
    if (!res.ok) return { error: typeof data?.error === "string" ? data.error : TRANSCRIBE_WORDS.unavailable };
    const text = typeof data?.text === "string" ? data.text.trim() : "";
    return text ? { text } : { error: TRANSCRIBE_WORDS.heardNothing };
  } catch {
    return stop.signal.aborted ? null : { error: TRANSCRIBE_WORDS.unavailable };
  } finally {
    if (running.get(blob) === stop) running.delete(blob);
  }
}

/** What `apply` may answer: nothing to say, a note, or a note with words still to place, offered as a button. */
type Applied = string | null | { note: string; offer: () => void };
type Phase = { kind: "idle" } | { kind: "busy" } | { kind: "done" } | { kind: "said"; words: string; offer?: () => void } | { kind: "stopped" };

/**
 * Send one recording by itself once it exists, while the service and the
 * switch are on, and offer the button otherwise. `apply` puts the words in.
 */
function useWriteDown(blob: Blob | undefined, seconds: number, written: boolean, link: string | undefined, apply: (text: string) => Applied, what: "take" | "clip" = "take") {
  const { t, i18n } = useLingui();
  const on = useTranscriptionOn();
  const auto = useAutoWriteDown();
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const applyRef = useRef(apply);
  applyRef.current = apply;

  const go = async (b: Blob) => {
    setPhase({ kind: "busy" });
    const got = await sendForWords(b, seconds, link, what);
    if (!got) return setPhase({ kind: "stopped" });
    if ("error" in got) return setPhase({ kind: "said", words: refusalWords(got.error, i18n) });
    const note = applyRef.current(got.text);
    setPhase(!note ? { kind: "done" } : typeof note === "string" ? { kind: "said", words: note } : { kind: "said", words: note.note, offer: note.offer });
  };

  useEffect(() => {
    if (!on || !auto || !blob || written || triedBefore(blob)) return;
    markTried(blob);
    void go(blob);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [on, auto, blob, written]);

  // The recording went away (removed, or recorded again): its send stops.
  useEffect(() => () => {
    if (blob) running.get(blob)?.abort();
  }, [blob]);

  useEffect(() => {
    if (!auto) setPhase((p) => (p.kind === "busy" ? { kind: "stopped" } : p));
  }, [auto]);

  const status =
    phase.kind === "busy"
      ? t({ message: "Writing down your words. A long take can take a few minutes.", context: "voice transcription" })
      : phase.kind === "done"
        ? t({ message: "Your words are in the box. Read them and fix anything we got wrong.", context: "voice transcription" })
        : phase.kind === "stopped"
          ? t({ message: "Stopped. Nothing more is sent. Your recording is kept.", context: "voice transcription" })
          : phase.kind === "said"
            ? phase.words
            : "";
  const showButton = on && !!blob && phase.kind !== "busy" && (!auto || phase.kind === "said" || phase.kind === "stopped");
  const offer = phase.kind === "said" && phase.offer ? () => {
    phase.offer?.();
    setPhase({ kind: "done" });
  } : null;
  return { on, status, showButton, busy: phase.kind === "busy", press: () => blob && void go(blob), offer };
}

/** The AI line and the switch, shown before recording while the service is on. */
function AutoSwitch({ compact = false }: { compact?: boolean }) {
  const { t } = useLingui();
  const auto = useAutoWriteDown();
  return (
    <div className={compact ? "grid gap-1" : "grid gap-1.5"} data-voice-auto="">
      <p className={compact ? "text-xs text-muted-foreground" : HINT} data-voice-ai-line="">
        {t({ message: "Your recording is transcribed by an AI service so the team can read it. You can turn this off.", context: "voice note, consent line" })}
      </p>
      <label className={`flex min-h-11 cursor-pointer items-center gap-3 ${compact ? "text-xs" : "text-sm"} font-medium text-foreground`}>
        <input type="checkbox" role="switch" className="size-5 shrink-0 accent-notice" checked={auto} onChange={(e) => setAutoWriteDown(e.target.checked)} data-voice-auto-switch="" />
        {t({ message: "Write down my words automatically", context: "voice transcription switch" })}
      </label>
    </div>
  );
}

/** "You can record up to 7 minutes each time.", and the AI line with its switch while the service is on. */
function LimitNote() {
  const { t } = useLingui();
  const on = useTranscriptionOn();
  const minutes = VOICE_NOTE_MAX_SECONDS / 60;
  return (
    <div className="grid gap-1" data-voice-limit-note="">
      <p className="text-sm font-medium text-foreground">
        {t({ message: `You can record up to ${minutes} minutes each time.`, context: "voice note, before recording" })}
      </p>
      {on && <AutoSwitch />}
    </div>
  );
}

/** The last minute of a take, counted down where it can't be missed. */
function Countdown({ elapsed }: { elapsed: number }) {
  const { t } = useLingui();
  const left = countdownLeft(elapsed);
  if (left === null) return null;
  return (
    <p className="flex flex-wrap items-baseline gap-x-2 rounded-lg border-2 border-notice bg-muted px-3 py-2 text-foreground" data-voice-countdown={left}>
      <span className="font-display text-2xl tabular-nums">{t({ message: `${voiceLength(left)} left`, context: "voice note countdown" })}</span>
      <span className="text-sm">{t({ message: `This take stops by itself at ${voiceLength(VOICE_NOTE_MAX_SECONDS)}, and it is kept.`, context: "voice note countdown" })}</span>
    </p>
  );
}

function WriteDownButton({ again, busy, press }: { again: boolean; busy: boolean; press: () => void }) {
  const { t } = useLingui();
  return (
    <button type="button" onClick={press} disabled={busy} className={`${BTN_SECONDARY} min-h-11 justify-self-start`} data-voice-transcribe-button="">
      <SeedGlint className="size-4" aria-hidden="true" />
      {again ? t({ message: "Write it down again", context: "voice transcription" }) : t({ message: "Write down my words", context: "voice transcription" })}
    </button>
  );
}

/** One take, written down by itself while the switch is on. */
function TranscribeTake({ index, state, onChange, link }: { index: number; state: { v: VoiceState }; onChange: (next: VoiceState) => void; link?: string }) {
  const take = state.v.takes[index];
  const blob = take?.blob;
  const w = useWriteDown(blob, take?.seconds ?? 0, !!take?.written, link, (text) => {
    // The take may have moved since it was sent: find it by its recording.
    const i = state.v.takes.findIndex((t) => t.blob === blob);
    if (i >= 0) onChange(withWrittenWords(state.v, i, text));
    return null;
  });
  if (!w.on || !take) return null;
  return (
    <div className="grid basis-full gap-1.5" data-voice-transcribe={index}>
      {w.showButton && <WriteDownButton again={!!take.written} busy={w.busy} press={w.press} />}
      <p role="status" className="text-sm text-foreground" data-voice-transcribe-said="">
        {w.status}
      </p>
    </div>
  );
}

/** One answer's clip: the AI line before the first recording, then its words written down by themselves. */
function TranscribeClip({ field, clip, answer, setClipWords, link, aiLine = true }: VoiceStepClipProps) {
  const { t } = useLingui();
  const blob = clip?.blob;
  // The answer as it stands when the offer is pressed, never as it stood when the words came back.
  const answerNow = useRef(answer);
  answerNow.current = answer;
  const w = useWriteDown(blob, clip?.seconds ?? 0, !!clip?.written, link, (text): Applied => {
    const caught = clip?.words ?? "";
    let note: Applied = null;
    if (answer) {
      // Whole, however long: an answer the words run past its limit shows how much to trim (never cut).
      const placed = placeWords(answer.value, caught, text);
      if (placed.placed) answer.set(placed.text);
      else
        note = {
          note: t({ message: "You changed this answer, so we left it as you wrote it. The written-down words go with your clip, and you can add them to the answer.", context: "voice transcription" }),
          offer: () => {
            const a = answerNow.current;
            if (a) a.set(addWords(a.value, text));
          },
        };
    }
    // The clip keeps every word the service wrote down; a clip over its own limit is named at send.
    if (blob) setClipWords(blob, text);
    return note;
  }, "clip");
  if (!w.on) return null;
  // Said once (idea 16): only the clip the page names shows the AI line and its switch.
  if (!clip) return aiLine ? <AutoSwitch compact /> : null;
  return (
    <div className="grid gap-1" data-voice-clip-transcribe={field}>
      {w.showButton && <WriteDownButton again={!!clip.written} busy={w.busy} press={w.press} />}
      <p role="status" className="text-xs text-foreground" data-voice-transcribe-said="">
        {w.status}
      </p>
      {w.offer && (
        <button type="button" onClick={w.offer} className={`${BTN_SECONDARY} min-h-11 justify-self-start`} data-voice-place-words="">
          {t({ message: "Add these words to the answer", context: "voice transcription" })}
        </button>
      )}
    </div>
  );
}

export interface VoiceStepClipProps {
  field: string;
  clip: ClipTake | undefined;
  /** The answer the clip belongs to, read fresh on each draw. */
  answer?: { value: string; set: (next: string) => void; limit?: number };
  /** Keep the written-down words with the clip, when it is still the same recording. */
  setClipWords: (blob: Blob, words: string) => void;
  link?: string;
  /** Whether this clip shows the AI line and its switch before its first recording (VoiceClips.tsx `aiLineAt`). */
  aiLine?: boolean;
}

export type VoiceStepMoreProps =
  | { part: "limit" }
  | { part: "countdown"; elapsed: number }
  | { part: "transcribe"; index: number; state: { v: VoiceState }; onChange: (next: VoiceState) => void; link?: string }
  | ({ part: "clip" } & VoiceStepClipProps);

export default function VoiceStepMore(props: VoiceStepMoreProps) {
  if (props.part === "limit") return <LimitNote />;
  if (props.part === "countdown") return <Countdown elapsed={props.elapsed} />;
  if (props.part === "clip") return <TranscribeClip {...props} />;
  return <TranscribeTake index={props.index} state={props.state} onChange={props.onChange} link={props.link} />;
}
