/**
 * THE VOICE STEP'S SECOND HALF, loaded after the page (the lead, 17 Nov 2026).
 * The application's first view is at its budget, so everything added to the
 * step that day lives here and arrives a moment after the card, through one
 * lazy import in VoiceInvite.tsx:
 *
 *   - `limit`: before recording, "Up to 5 minutes per take", and, when the
 *     village's transcription service is on, the line that says an AI service
 *     writes recordings down ("Make sure to be clear and cut them off at 5 min").
 *   - `countdown`: in the last minute of a take, the seconds left, large, and
 *     what happens at 0:00. The hard stop itself is the recorder's
 *     (useVoiceRecorder.ts), at exactly VOICE_NOTE_MAX_SECONDS.
 *   - `transcribe`: under one take, "Write down my words", which sends that take
 *     to the village's transcription service (shared/voiceTranscribe.ts) and puts
 *     the words in "What we heard, in your words" for the applicant to read and
 *     fix before Send. Drawn only while the service is on.
 */
import { useEffect, useState } from "react";
import { useLingui } from "@lingui/react/macro";
import type { I18n } from "@lingui/core";
import { msg } from "@lingui/core/macro";
import { Sparkles } from "lucide-react";
import { BTN_SECONDARY, HINT } from "@/components/journey/look";
import { speechLang } from "@/lib/speechLang";
import { VOICE_NOTE_MAX_SECONDS, VOICE_TRANSCRIPT_MAX, VOICE_WORDS, voiceKindOfType, voiceLength } from "@shared/voiceNotes";
import { TRANSCRIBE_WORDS, VOICE_TRANSCRIBE_PATH } from "@shared/voiceTranscribe";
import type { VoiceState } from "./VoiceInvite";

/** The last minute of a take: when the countdown shows. */
export const COUNTDOWN_FROM_SECONDS = 60;

/** The seconds left in a take, whole and never below zero; null before the last minute. */
export function countdownLeft(elapsed: number, max: number = VOICE_NOTE_MAX_SECONDS): number | null {
  const left = Math.max(0, Math.ceil(max - elapsed));
  return left <= COUNTDOWN_FROM_SECONDS ? left : null;
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
  return { ...v, transcript: transcript.slice(0, VOICE_TRANSCRIPT_MAX), takes: v.takes.map((t, k) => (k === i ? { ...t, words, written: true } : t)) };
}

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
/** For a test: ask again. */
export function forgetTranscriptionOn(): void {
  onAnswer = null;
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

/** The server's refusals, in the reader's language, keyed by the shared constant itself. */
function refusalWords(said: string, i18n: I18n): string {
  const known: Array<[string, ReturnType<typeof msg>]> = [
    [TRANSCRIBE_WORDS.closed, msg({ message: "Applications are closed just now, so recordings can't be written down.", context: "voice transcription refusal" })],
    [TRANSCRIBE_WORDS.off, msg({ message: "Writing recordings down isn't switched on here. Type what you said instead.", context: "voice transcription refusal" })],
    [TRANSCRIBE_WORDS.tooMany, msg({ message: "That's a lot of recordings written down for one connection. Type what you said, or try again in an hour.", context: "voice transcription refusal" })],
    [TRANSCRIBE_WORDS.unavailable, msg({ message: "We couldn't write this recording down just now. Your recording is still kept. Try again in a moment, or type what you said.", context: "voice transcription refusal" })],
    [TRANSCRIBE_WORDS.busy, msg({ message: "A few recordings are being written down already. Try again in a moment.", context: "voice transcription refusal" })],
    [TRANSCRIBE_WORDS.tooLong, msg({ message: "Only takes up to 5 minutes can be written down.", context: "voice transcription refusal" })],
    [TRANSCRIBE_WORDS.heardNothing, msg({ message: "The service heard no words in this recording. Type what you said, or record again.", context: "voice transcription refusal" })],
    [VOICE_WORDS.tooBig, msg({ message: "One recording is too large. Record a shorter one.", context: "voice transcription refusal" })],
    [VOICE_WORDS.wrongType, msg({ message: "We couldn't read one of your recordings. Record it again.", context: "voice transcription refusal" })],
  ];
  const hit = known.find(([k]) => k === said);
  return hit ? i18n._(hit[1]) : said;
}

/** "Up to 5 minutes per take", and the AI line while the service is on. */
function LimitNote() {
  const { t } = useLingui();
  const on = useTranscriptionOn();
  return (
    <div className="grid gap-1" data-voice-limit-note="">
      <p className="text-sm font-medium text-foreground">
        {t({ message: `Up to ${VOICE_NOTE_MAX_SECONDS / 60} minutes per take. It stops by itself at ${voiceLength(VOICE_NOTE_MAX_SECONDS)}.`, context: "voice note, before recording" })}
      </p>
      {on && (
        <p className={HINT} data-voice-ai-line="">
          {t({ message: "Your recording is transcribed by an AI service so the team can read it.", context: "voice note, consent line" })}
        </p>
      )}
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

/** "Write down my words" for one take, while the village's service is on. */
function TranscribeTake({ index, state, onChange, link }: { index: number; state: { v: VoiceState }; onChange: (next: VoiceState) => void; link?: string }) {
  const { t, i18n } = useLingui();
  const on = useTranscriptionOn();
  const [busy, setBusy] = useState(false);
  const [said, setSaid] = useState<string | null>(null);
  const take = state.v.takes[index];
  if (!on || !take) return null;
  const press = async () => {
    setBusy(true);
    setSaid(null);
    try {
      const fd = new FormData();
      fd.append("seconds", String(take.seconds));
      fd.append("lang", speechLang());
      if (link) fd.append("link", link);
      fd.append("voice", take.blob, `take.${voiceKindOfType(take.blob.type)}`);
      const res = await fetch(VOICE_TRANSCRIBE_PATH, { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return setSaid(refusalWords(typeof data?.error === "string" ? data.error : TRANSCRIBE_WORDS.unavailable, i18n));
      const text = typeof data?.text === "string" ? data.text : "";
      if (!text.trim()) return setSaid(refusalWords(TRANSCRIBE_WORDS.heardNothing, i18n));
      onChange(withWrittenWords(state.v, index, text));
      setSaid(t({ message: "Your words are in the box below. Read them and fix anything we got wrong.", context: "voice transcription" }));
    } catch {
      setSaid(refusalWords(TRANSCRIBE_WORDS.unavailable, i18n));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="grid basis-full gap-1.5" data-voice-transcribe={index}>
      <button type="button" onClick={() => void press()} disabled={busy} className={`${BTN_SECONDARY} min-h-11 justify-self-start`} data-voice-transcribe-button="">
        <Sparkles className="size-4" aria-hidden="true" />
        {take.written ? t({ message: "Write it down again", context: "voice transcription" }) : t({ message: "Write down my words", context: "voice transcription" })}
      </button>
      <p className="text-xs text-muted-foreground">{t({ message: "Your recording is transcribed by an AI service so the team can read it.", context: "voice note, consent line" })}</p>
      <p role="status" className="text-sm text-foreground" data-voice-transcribe-said="">
        {busy ? t({ message: "Writing down your words. A five-minute take can take a minute.", context: "voice transcription" }) : (said ?? "")}
      </p>
    </div>
  );
}

export type VoiceStepMoreProps =
  | { part: "limit" }
  | { part: "countdown"; elapsed: number }
  | { part: "transcribe"; index: number; state: { v: VoiceState }; onChange: (next: VoiceState) => void; link?: string };

export default function VoiceStepMore(props: VoiceStepMoreProps) {
  if (props.part === "limit") return <LimitNote />;
  if (props.part === "countdown") return <Countdown elapsed={props.elapsed} />;
  return <TranscribeTake index={props.index} state={props.state} onChange={props.onChange} link={props.link} />;
}
