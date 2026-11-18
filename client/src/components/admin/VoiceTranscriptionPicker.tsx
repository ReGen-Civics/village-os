/**
 * WHICH SERVICE WRITES VOICE RECORDINGS DOWN, Admin, Integrations (the lead,
 * 17 Nov 2026: "find a better route (preferably free)"). The choice, and what
 * it comes to now; the keys are the cards below, sealed and write-only
 * (server/lib/voiceTranscription.ts names each provider and its address).
 * Server: GET and PUT /api/admin/voice-transcription (routes/openProposals.ts).
 */
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useLingui } from "@lingui/react/macro";
import { msg } from "@lingui/core/macro";
import { API_BASE, authHeaders, refusal } from "@/components/admin/adminApi";
import { TRANSCRIPTION_CHOICES, type TranscriptionChoice, type TranscriptionProviderId, type TranscriptionSettings } from "@shared/voiceTranscribe";

const CHOICE_WORDS: Record<TranscriptionChoice, { label: ReturnType<typeof msg>; line: ReturnType<typeof msg> }> = {
  auto: {
    label: msg({ message: "Automatic (recommended)", context: "voice transcription choice" }),
    line: msg({ message: "Groq when its key is set, then OpenAI when its key is set, then this server's own Whisper. If one fails, the next is tried.", context: "voice transcription choice" }),
  },
  groq: {
    label: msg({ message: "Groq only", context: "voice transcription choice" }),
    line: msg({ message: "Free tier, fast, Spanish and English. Needs the Groq key below.", context: "voice transcription choice" }),
  },
  openai: {
    label: msg({ message: "OpenAI only", context: "voice transcription choice" }),
    line: msg({ message: "Paid per minute. Needs the OpenAI key below.", context: "voice transcription choice" }),
  },
  local: {
    label: msg({ message: "This server only", context: "voice transcription choice" }),
    line: msg({ message: "No key and no outside service: the recording never leaves the server. About a minute for a five-minute take, one at a time.", context: "voice transcription choice" }),
  },
  off: {
    label: msg({ message: "Off", context: "voice transcription choice" }),
    line: msg({ message: "Nothing is written down by a service. Applicants type, or use their browser's own speech service.", context: "voice transcription choice" }),
  },
};

const PROVIDER_NAMES: Record<TranscriptionProviderId, ReturnType<typeof msg>> = {
  groq: msg({ message: "Groq", context: "voice transcription provider" }),
  openai: msg({ message: "OpenAI", context: "voice transcription provider" }),
  local: msg({ message: "this server's Whisper", context: "voice transcription provider" }),
};

export default function VoiceTranscriptionPicker({ password }: { password: string }) {
  const { t, i18n } = useLingui();
  const [s, setS] = useState<TranscriptionSettings | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    fetch(`${API_BASE}/admin/voice-transcription`, { headers: authHeaders(password) })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => live && setS(d && typeof d === "object" && typeof d.choice === "string" ? (d as TranscriptionSettings) : null))
      .catch(() => live && setS(null));
    return () => {
      live = false;
    };
  }, [password]);

  const choose = async (choice: TranscriptionChoice) => {
    const failed = t({ message: "That did not save. Try again.", context: "voice transcription choice" });
    setBusy(true);
    try {
      const res = await fetch(`${API_BASE}/admin/voice-transcription`, { method: "PUT", headers: authHeaders(password, { "Content-Type": "application/json" }), body: JSON.stringify({ choice }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(refusal(d, failed));
      setS(d as TranscriptionSettings);
      toast.success(t({ message: "Saved", context: "voice transcription choice" }));
    } catch (e: any) {
      toast.error(e?.message ?? failed);
    }
    setBusy(false);
  };

  if (!s) return null;
  const order = s.order.map((id) => i18n._(PROVIDER_NAMES[id])).join(", ");
  return (
    <section className="mb-6 rounded-xl border border-border bg-card p-5" data-voice-transcription-picker="">
      <p className="font-semibold text-foreground">{t({ message: "Voice transcription: which service", context: "voice transcription choice" })}</p>
      <p className="mb-3 mt-1 text-xs text-muted-foreground">
        {t({ message: "Applicants' voice recordings are written down by themselves as they record (they can turn it off), and admins can write down kept recordings on the applications panel. The keys for Groq and OpenAI are the cards below.", context: "voice transcription choice" })}
      </p>
      <fieldset className="grid gap-2" disabled={busy}>
        <legend className="sr-only">{t({ message: "Which service writes recordings down", context: "voice transcription choice" })}</legend>
        {TRANSCRIPTION_CHOICES.map((c) => {
          const ready = c === "auto" || c === "off" ? true : !!s.providers.find((p) => p.id === c)?.ready;
          return (
            <label key={c} className="flex min-h-10 cursor-pointer items-start gap-3 text-sm text-foreground">
              <input type="radio" name="voice-transcription" className="mt-0.5 size-4 accent-teal-deep" checked={s.choice === c} onChange={() => void choose(c)} />
              <span className="grid gap-0.5">
                <span className="font-medium">
                  {i18n._(CHOICE_WORDS[c].label)}
                  {!ready && <span className="ml-2 rounded-full bg-amber-light px-1.5 py-0.5 text-[10px] text-notice">{t({ message: "not ready", context: "voice transcription choice" })}</span>}
                </span>
                <span className="text-xs text-muted-foreground">{i18n._(CHOICE_WORDS[c].line)}</span>
              </span>
            </label>
          );
        })}
      </fieldset>
      <p className="mt-3 text-xs font-medium text-foreground" data-voice-transcription-now="">
        {s.order.length
          ? t({ message: `Recordings are written down by ${order}, in that order.`, context: "voice transcription choice" })
          : t({ message: "Nothing writes recordings down now: the voice step works as it always did.", context: "voice transcription choice" })}
      </p>
    </section>
  );
}
