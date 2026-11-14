/**
 * THEIR VOICE, for the people who decide an application (Rye, 14 Nov 2026:
 * "the option in admin of hearing their voice note"). Drawn on the decider
 * page (client/src/pages/OpenProposal.tsx), which Admin's open proposals panel
 * opens; the server sends `voice` only to those who decide it, and only when
 * the applicant ticked that we may keep it (shared/voiceNotes.ts).
 *
 * Each recording is fetched when "Listen" is pressed, with the reader's own
 * sign-in, and played from memory on this device: nothing is cached, and no
 * download link is drawn. The transcript sits folded beneath: what the
 * browser heard, in their words, unchecked. No AI summary of a person is ever
 * shown here.
 */
import { useEffect, useState } from "react";
import { useLingui } from "@lingui/react/macro";
import { Play } from "lucide-react";
import { gameFetch } from "@/lib/gameApi";
import { VOICE_WORDS, voiceLength } from "@shared/voiceNotes";

export interface ServedVoice {
  notes: Array<{ id: string; seconds: number; size: number; href: string }>;
  transcript: string;
}

function Recording({ n, note }: { n: number; note: ServedVoice["notes"][number] }) {
  const { t } = useLingui();
  const [url, setUrl] = useState<string | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "failed">("idle");
  useEffect(() => () => {
    if (url) URL.revokeObjectURL(url);
  }, [url]);
  const listen = async () => {
    setState("loading");
    try {
      const res = await gameFetch(note.href);
      if (!res.ok) throw new Error(String(res.status));
      setUrl(URL.createObjectURL(await res.blob()));
      setState("idle");
    } catch {
      setState("failed");
    }
  };
  return (
    <li className="grid gap-2 rounded-xl border border-border bg-muted p-3" data-voice-note={note.id}>
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm font-semibold text-foreground">
          {t({ message: `Recording ${n}`, context: "voice note, deciders" })} <span className="font-normal tabular-nums text-muted-foreground">{voiceLength(note.seconds)}</span>
        </span>
        {!url && (
          <button type="button" onClick={() => void listen()} disabled={state === "loading"} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-notice px-4 text-sm font-semibold text-foreground hover:bg-card disabled:opacity-60">
            <Play className="size-4" aria-hidden="true" />
            {VOICE_WORDS.listen}
          </button>
        )}
      </div>
      {url && <audio controls autoPlay src={url} className="w-full" />}
      {state === "failed" && (
        <p role="status" className="text-sm text-foreground">
          {VOICE_WORDS.unplayable}
        </p>
      )}
    </li>
  );
}

export function VoiceHeard({ voice }: { voice: ServedVoice | null | undefined }) {
  if (!voice || (!voice.notes.length && !voice.transcript.trim())) return null;
  return (
    <section aria-labelledby="op-voice" className="grid gap-3" data-voice-heard="">
      <h2 id="op-voice" className="text-lg font-bold text-foreground">
        {VOICE_WORDS.heardHeading}
      </h2>
      <p className="text-sm text-muted-foreground">{VOICE_WORDS.heardNote}</p>
      {voice.notes.length > 0 && (
        <ul className="grid gap-2">
          {voice.notes.map((note, i) => (
            <Recording key={note.id} n={i + 1} note={note} />
          ))}
        </ul>
      )}
      {voice.transcript.trim() && (
        <details className="rounded-xl border border-border p-3">
          <summary className="cursor-pointer text-sm font-semibold text-foreground">{VOICE_WORDS.transcriptFold}</summary>
          <p className="mt-2 whitespace-pre-line break-words text-foreground">{voice.transcript}</p>
        </details>
      )}
    </section>
  );
}
