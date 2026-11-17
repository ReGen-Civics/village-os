/**
 * "WRITE DOWN THE WORDS" BESIDE A KEPT RECORDING (the lead, 17 Nov 2026:
 * "Transcribe them! They've personally consented with me."). Drawn under each
 * recording and clip on the deciders' page (VoiceHeard.tsx) and Admin's
 * applications panel (admin/OpenProposalsPanel.tsx), loaded only there.
 *
 * The words come from the village's transcription service and are kept with
 * the application (server/routes/openProposalVoiceWritten.ts). They are always
 * shown as an AI transcript, named as such, apart from anything the applicant
 * wrote or the browser heard while they spoke.
 */
import { useState } from "react";
import { useLingui } from "@lingui/react/macro";
import type { I18n } from "@lingui/core";
import { msg } from "@lingui/core/macro";
import { Sparkles } from "lucide-react";
import type { WrittenWords } from "@shared/voiceNotes";
import { STORED_TRANSCRIBE_WORDS, type TranscriptionProviderId } from "@shared/voiceTranscribe";

/** Who wrote it down, as a reader knows them. */
function byWords(by: string, i18n: I18n): string {
  const named: Record<TranscriptionProviderId, ReturnType<typeof msg>> = {
    groq: msg({ message: "Groq's Whisper", context: "AI transcript, who wrote it" }),
    openai: msg({ message: "OpenAI", context: "AI transcript, who wrote it" }),
    local: msg({ message: "the village's own Whisper", context: "AI transcript, who wrote it" }),
  };
  const hit = (named as Record<string, ReturnType<typeof msg> | undefined>)[by];
  return hit ? i18n._(hit) : by;
}

function refusalWords(said: string, i18n: I18n): string {
  const known: Array<[string, ReturnType<typeof msg>]> = [
    [STORED_TRANSCRIBE_WORDS.tooMany, msg({ message: "That's a lot of recordings written down in an hour. Try again later.", context: "AI transcript refusal" })],
    [STORED_TRANSCRIBE_WORDS.dayFull, msg({ message: "The village has written down as many recordings as it may today. Try again tomorrow.", context: "AI transcript refusal" })],
    [STORED_TRANSCRIBE_WORDS.unavailable, msg({ message: "We couldn't write this recording down just now. The recording is still kept. Try again in a moment.", context: "AI transcript refusal" })],
    [STORED_TRANSCRIBE_WORDS.off, msg({ message: "Writing recordings down isn't switched on. An admin can switch it on under Integrations.", context: "AI transcript refusal" })],
    [STORED_TRANSCRIBE_WORDS.heardNothing, msg({ message: "The service heard no words in this recording.", context: "AI transcript refusal" })],
  ];
  const hit = known.find(([k]) => k === said);
  return hit ? i18n._(hit[1]) : said;
}

export interface StoredWordsProps {
  /** The recording's Listen door; its transcribe door is the same address with `/transcribe`. */
  href: string;
  written?: WrittenWords | null;
  /** Whether a recording can be written down now. */
  on: boolean;
  /** How to post: the member sign-in on the deciders' page, the desk's own on Admin. */
  poster: (href: string) => Promise<Response>;
}

export default function StoredWords({ href, written: first, on, poster }: StoredWordsProps) {
  const { t, i18n } = useLingui();
  const [written, setWritten] = useState<WrittenWords | null>(first ?? null);
  const [busy, setBusy] = useState(false);
  const [said, setSaid] = useState("");
  const shown = written ?? first ?? null;
  const press = async () => {
    setBusy(true);
    setSaid("");
    try {
      const res = await poster(`${href}/transcribe`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return setSaid(refusalWords(typeof data?.error === "string" ? data.error : STORED_TRANSCRIBE_WORDS.unavailable, i18n));
      if (data?.written && typeof data.written.text === "string") setWritten(data.written as WrittenWords);
      else setSaid(refusalWords(STORED_TRANSCRIBE_WORDS.heardNothing, i18n));
    } catch {
      setSaid(refusalWords(STORED_TRANSCRIBE_WORDS.unavailable, i18n));
    } finally {
      setBusy(false);
    }
  };
  if (!shown && !on) return null;
  return (
    <div className="grid gap-1.5" data-stored-words="">
      {shown && (
        <div className="grid gap-1 rounded-lg border border-dashed border-border bg-muted/40 p-3" data-ai-transcript="">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t({ message: `AI transcript, written down by ${byWords(shown.by, i18n)}. Not checked by the applicant.`, context: "AI transcript label" })}
          </p>
          <p className="whitespace-pre-line break-words text-sm text-foreground">{shown.text}</p>
        </div>
      )}
      {on && (
        <button
          type="button"
          onClick={() => void press()}
          disabled={busy}
          className="inline-flex min-h-11 items-center gap-2 justify-self-start rounded-full border border-border px-4 text-sm font-medium text-foreground hover:border-notice disabled:opacity-60"
          data-stored-words-button=""
        >
          <Sparkles className="size-4" aria-hidden="true" />
          {shown ? t({ message: "Write it down again", context: "AI transcript" }) : t({ message: "Write down the words", context: "AI transcript" })}
        </button>
      )}
      <p role="status" className="text-sm text-foreground">
        {busy ? t({ message: "Writing down the words. A five-minute recording can take a minute or two.", context: "AI transcript" }) : said}
      </p>
    </div>
  );
}
