/**
 * WHICH SERVICE WRITES VOICE RECORDINGS DOWN, Admin, Integrations (the lead,
 * 17 Nov 2026: "find a better route (preferably free)"). The choice, and what
 * it comes to now; the keys are the cards below, sealed and write-only
 * (server/lib/voiceTranscription.ts names each provider and its address).
 */
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { authHeaders, refusal } from "@/components/admin/adminApi";
import {
  TRANSCRIPTION_CHOICES,
  VOICE_TRANSCRIPTION_SETTINGS_PATH,
  type TranscriptionChoice,
  type TranscriptionProviderId,
  type TranscriptionSettings,
} from "@shared/voiceTranscribe";

const CHOICE_WORDS: Record<TranscriptionChoice, { label: string; line: string }> = {
  auto: { label: "Automatic (recommended)", line: "Groq when its key is set, then OpenAI when its key is set, then this server's own Whisper. If one fails, the next is tried." },
  groq: { label: "Groq only", line: "Free tier, fast, Spanish and English. Needs the Groq key below." },
  openai: { label: "OpenAI only", line: "Paid per minute. Needs the OpenAI key below." },
  local: { label: "This server only", line: "No key and no outside service: the recording never leaves the server. About a minute for a five-minute take, one at a time." },
  off: { label: "Off", line: "Nothing is written down by a service. Applicants type, or use their browser's own speech service." },
};

const PROVIDER_NAMES: Record<TranscriptionProviderId, string> = { groq: "Groq", openai: "OpenAI", local: "this server's Whisper" };

export default function VoiceTranscriptionPicker({ password }: { password: string }) {
  const [s, setS] = useState<TranscriptionSettings | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    fetch(VOICE_TRANSCRIPTION_SETTINGS_PATH, { headers: authHeaders(password) })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => live && setS(d && typeof d === "object" && typeof d.choice === "string" ? (d as TranscriptionSettings) : null))
      .catch(() => live && setS(null));
    return () => {
      live = false;
    };
  }, [password]);

  const choose = async (choice: TranscriptionChoice) => {
    setBusy(true);
    try {
      const res = await fetch(VOICE_TRANSCRIPTION_SETTINGS_PATH, { method: "PUT", headers: authHeaders(password, { "Content-Type": "application/json" }), body: JSON.stringify({ choice }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(refusal(d, "That did not save. Try again."));
      setS(d as TranscriptionSettings);
      toast.success("Saved");
    } catch (e: any) {
      toast.error(e?.message ?? "That did not save. Try again.");
    }
    setBusy(false);
  };

  if (!s) return null;
  const now = s.order.length ? `Recordings are written down by ${s.order.map((id) => PROVIDER_NAMES[id]).join(", then ")}.` : "Nothing writes recordings down now: the voice step works as it always did.";
  return (
    <section className="mb-6 rounded-xl border border-gray-100 bg-white p-5" data-voice-transcription-picker="">
      <p className="font-semibold text-gray-900">Voice transcription: which service</p>
      <p className="mb-3 mt-1 text-xs text-gray-500">
        Applicants' voice recordings are written down by themselves as they record (they can turn it off), and admins can write down kept recordings on the applications panel. Keys for Groq and OpenAI are the cards below.
      </p>
      <fieldset className="grid gap-2" disabled={busy}>
        <legend className="sr-only">Which service writes recordings down</legend>
        {TRANSCRIPTION_CHOICES.map((c) => {
          const ready = c === "auto" || c === "off" ? true : !!s.providers.find((p) => p.id === c)?.ready;
          return (
            <label key={c} className="flex min-h-10 cursor-pointer items-start gap-3 text-sm text-gray-800">
              <input type="radio" name="voice-transcription" className="mt-0.5 size-4 accent-teal-deep" checked={s.choice === c} onChange={() => void choose(c)} />
              <span className="grid gap-0.5">
                <span className="font-medium">
                  {CHOICE_WORDS[c].label}
                  {!ready && <span className="ml-2 rounded-full border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] text-amber-700">not ready</span>}
                </span>
                <span className="text-xs text-gray-500">{CHOICE_WORDS[c].line}</span>
              </span>
            </label>
          );
        })}
      </fieldset>
      <p className="mt-3 text-xs font-medium text-gray-700" data-voice-transcription-now="">
        {now}
      </p>
    </section>
  );
}
