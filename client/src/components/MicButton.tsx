/**
 * Voice-to-text for every "talk to the guide" input. The whole UX promise of
 * a conversational surface is that people can just TALK — so wherever there
 * is a chat with the assistant, this button sits beside the send button.
 *
 * Web Speech API underneath: tap to talk, each finished phrase is appended
 * to the draft through onText, tap again to stop. Where the API is absent
 * (Firefox, some webviews) the button renders nothing and typing works as it
 * always did — a mic that cannot listen must not be shown.
 *
 * WHERE THE SOUND GOES. This village's server never receives the audio, only
 * the text the person keeps. But the BROWSER'S speech service does the
 * transcription, and in most browsers that is a cloud service: Chrome and
 * Android send the audio to Google, Safari to Apple (on-device for some
 * languages), Edge to Microsoft. Never describe this button as private or
 * say the speech is "sent nowhere"; say the browser's speech service turns it
 * into text.
 */
import { useEffect, useRef, useState } from "react";
import { Mic, Square } from "lucide-react";
import { useLingui } from "@lingui/react/macro";
import { speechLang } from "@/lib/speechLang";

const SR: any =
  typeof window !== "undefined"
    ? (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition
    : undefined;

/**
 * Whether the page's Permissions-Policy lets this document use the
 * microphone at all. Where the browser cannot say (no featurePolicy), assume
 * yes and let a refusal speak for itself through `onerror`. Until 2026-10-02
 * the server sent `microphone=()`, every tap failed with `not-allowed`, and
 * the button reset without a word, which is the failure this guards.
 */
function policyAllowsMic(): boolean {
  const fp = typeof document !== "undefined" ? (document as any).featurePolicy : undefined;
  if (!fp || typeof fp.allowsFeature !== "function") return true;
  try {
    return Boolean(fp.allowsFeature("microphone"));
  } catch {
    return true;
  }
}

/** The engine's error codes this button explains; any other is not said. */
type Refusal = "blocked" | "network" | "noMic";
function refusalOf(code: string): Refusal | null {
  if (code === "not-allowed" || code === "service-not-allowed") return "blocked";
  if (code === "network") return "network";
  if (code === "audio-capture") return "noMic";
  return null;
}

export default function MicButton({
  onText,
  disabled,
  className = "",
  fieldName = "",
}: {
  /** Called with each finished phrase — append it to the draft. */
  onText: (chunk: string) => void;
  disabled?: boolean;
  /** Extra classes for spacing tweaks at the call site. */
  className?: string;
  /** The field it types into, so each button has its own name (components/form/fieldName.ts). */
  fieldName?: string;
}) {
  const [listening, setListening] = useState(false);
  // The last refusal, said out loud on the button until the next try.
  const [problem, setProblem] = useState<Refusal | null>(null);
  const { t } = useLingui();
  const recRef = useRef<any>(null);
  // The latest onText without re-creating the recognizer mid-phrase.
  const onTextRef = useRef(onText);
  onTextRef.current = onText;

  // Leaving the page must release the microphone.
  useEffect(() => () => { recRef.current?.abort?.(); }, []);

  if (!SR || !policyAllowsMic()) return null;

  const stop = () => {
    recRef.current?.stop?.();
    setListening(false);
  };

  const start = () => {
    const rec = new SR();
    rec.lang = speechLang();
    rec.continuous = true;
    // Final results only: interim text fighting the member's own typing in
    // one input is worse than a beat of delay after each phrase.
    rec.interimResults = false;
    rec.onresult = (e: any) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        const text = r.isFinal ? String(r[0]?.transcript ?? "").trim() : "";
        if (text) onTextRef.current(text);
      }
    };
    // The engine ends itself on silence or permission refusal; either way
    // the button must tell the truth about whether anyone is listening.
    rec.onend = () => setListening(false);
    rec.onerror = (e: any) => {
      setListening(false);
      setProblem(refusalOf(String(e?.error ?? "")));
    };
    recRef.current = rec;
    setProblem(null);
    try {
      rec.start();
      setListening(true);
    } catch {
      setListening(false);
    }
  };

  // What a refusal means to the person holding the phone, in the language they read (Spanish phone QA, 15 Nov 2026).
  const said =
    problem === "blocked"
      ? t({ message: "The microphone is blocked for this site. Allow it in your browser settings to speak.", context: "mic button refusal" })
      : problem === "network"
        ? t({ message: "Speaking needs a connection. Typing works offline.", context: "mic button refusal" })
        : problem === "noMic"
          ? t({ message: "No microphone was found on this device.", context: "mic button refusal" })
          : null;
  const label = listening ? t({ message: "Stop voice input", context: "mic button" }) : said ?? t({ message: "Speak instead of typing", context: "mic button" });

  // A title is invisible on a phone, so a refusal is also printed above the
  // button. Absolutely placed, so no call site's row changes shape.
  return (
    <span className="relative inline-flex shrink-0">
      <button
        type="button"
        onClick={() => (listening ? stop() : start())}
        disabled={disabled}
        aria-label={fieldName ? `${label}: ${fieldName}` : label}
        title={label}
        className={`shrink-0 size-11 rounded-xl flex items-center justify-center disabled:opacity-50 ${
          listening
            ? "bg-red-500 text-white animate-pulse"
            : "bg-stone-100 text-stone-600 hover:bg-stone-200"
        } ${className}`}
      >
        {listening ? <Square className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
      </button>
      {problem && !listening && (
        <span
          role="status"
          className="absolute bottom-full right-0 mb-2 w-56 rounded-lg bg-stone-800 px-3 py-2 text-xs leading-snug text-white shadow-lg z-10"
        >
          {said}
        </span>
      )}
    </span>
  );
}
