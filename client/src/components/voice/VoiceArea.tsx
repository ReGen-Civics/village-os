/**
 * A LONG TEXT BOX YOU CAN TALK TO (Rye, 2026-11-09: "whenever long text is
 * about to be used to offer a mic option to talk directly to the field or
 * talk it out with Sera").
 *
 * Wrap any `<textarea>`:
 *
 *   <VoiceArea value={about} onValue={setAbout} talk={{ label: "About you", purpose: "..." }}>
 *     <textarea value={about} onChange={...} className="..." />
 *   </VoiceArea>
 *
 * Two things appear, and the box itself is untouched:
 *   - the mic (MicButton): the browser's speech service turns speech into text
 *     (Google's in Chrome, Apple's in Safari; this village's server gets only the
 *     text), in the box's corner. Each finished phrase is added to the end
 *     of what is there. It draws nothing where the browser cannot listen.
 *   - "Talk it out" (with `talk`), under the box, for a signed-in member: a
 *     short conversation with their own guide, Maia or Sera, that ends in a
 *     draft they can use or ignore. It loads only when opened.
 */
import GuideDataLine from "@/components/guide/GuideDataLine";
import { Children, cloneElement, isValidElement, lazy, Suspense, useState, type ReactElement, type ReactNode } from "react";
import { MessageCircle } from "lucide-react";
import { useLingui } from "@lingui/react/macro";
import MicButton from "@/components/MicButton";
import { appendSpoken } from "@/components/journal/GrowingTextarea";
import { useOptionalAuth } from "@/contexts/AuthContext";
import { LimitSigns } from "@/components/form/LimitSigns";

const TalkItOut = lazy(() => import("./TalkItOut"));

export interface TalkTarget {
  /** The box's name as the page shows it ("About you"). */
  label: string;
  /** What the box is for, in a sentence, for the guide. */
  purpose?: string;
}

export default function VoiceArea({
  value,
  onValue,
  talk,
  disabled,
  limit,
  children,
}: {
  value: string;
  onValue: (next: string) => void;
  /** Offer "Talk it out" for this box. Members only; visitors get the mic alone. */
  talk?: TalkTarget;
  disabled?: boolean;
  /** A limit that never cuts: the count, the notices and the trim under the box (components/form/LimitSigns.tsx). */
  limit?: number;
  children: ReactNode;
}) {
  const { t } = useLingui();
  // Optional: a page rendered outside the auth provider still gets its mic.
  const user = useOptionalAuth()?.user ?? null;
  const [open, setOpen] = useState(false);
  const only = Children.only(children);
  // What is spoken or drafted goes in whole (the ops request of 19 Nov 2026: never cut silently); the box's own count shows a limit.
  const set = (next: string) => onValue(next);
  // Room in the corner for the mic, so the last line of text never sits under it.
  const box = isValidElement(only)
    ? cloneElement(only as ReactElement<{ className?: string }>, {
        className: `${(only as ReactElement<{ className?: string }>).props.className ?? ""} pr-12`,
      })
    : only;

  return (
    <div className="space-y-2">
      <div className="relative">
        {box}
        <MicButton
          className="absolute bottom-2 right-2"
          disabled={disabled}
          onText={(chunk) => set(appendSpoken(value, chunk))}
        />
      </div>
      {limit ? <LimitSigns value={value} max={limit} /> : null}
      {talk && user && !open && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <button
          type="button"
          disabled={disabled}
          onClick={() => setOpen(true)}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-border bg-card px-3 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <MessageCircle className="h-4 w-4 text-notice" aria-hidden="true" />
          {t({ message: "Talk it out", context: "voice field: opens a conversation with your guide about this box" })}
        </button>
        <GuideDataLine className="min-w-0 flex-1" />
        </div>
      )}
      {talk && user && open && (
        <Suspense fallback={null}>
          <TalkItOut
            target={talk}
            current={value}
            onUse={(draft) => set(draft)}
            onAdd={(draft) => set(value.trim() ? `${value.trimEnd()}\n\n${draft}` : draft)}
            onClose={() => setOpen(false)}
          />
        </Suspense>
      )}
    </div>
  );
}
