/**
 * THE SIGNS UNDER A BOX WITH A LIMIT (the ops request of 19 Nov 2026: "shown and never cut").
 *
 * Always: how much is written, "1,240 / 8,000", in the reader's own number format, and a small "?" that says how
 * the limits work. At 80% a calm notice in minutes of talking left; at 95% a stronger one; past the limit, how
 * many characters to trim. Nothing is ever cut: the box keeps every word, and the form's send names the box and
 * the trim (ProposeARole.tsx `findProblems`).
 *
 * A screen reader hears the count with the box (aria-describedby) and a short line only when the box crosses into
 * a new state, never on every key (aria-live="polite").
 *
 * The limits themselves live in shared/applyLimits.ts. The "?" text loads only when it is opened.
 */
import { lazy, Suspense, useState } from "react";
import { useLingui } from "@lingui/react/macro";
import { halfMinutes, limitState, minutesOfTalk, overBy } from "@shared/applyLimits";
import { trimWords } from "./trimWords";

const LimitsExplained = lazy(() => import("./LimitsExplained"));

/** A number in the reader's own format: "1,240" in English, "1.240" in Spanish. */
export function useNumber(): (n: number) => string {
  const { i18n } = useLingui();
  return (n: number) => {
    try {
      return new Intl.NumberFormat(i18n.locale || undefined).format(n);
    } catch {
      return String(n);
    }
  };
}

/** About how much talking is left, as a person says it. */
export function useTalkLeft(): (chars: number) => string {
  const { t } = useLingui();
  return (chars: number) => {
    const m = minutesOfTalk(chars);
    if (m < 0.5) return t({ message: "Less than a minute of talking left in this answer.", context: "limit notice under a box" });
    if (m === 0.5) return t({ message: "About half a minute of talking left in this answer.", context: "limit notice under a box" });
    if (m === 1) return t({ message: "About a minute of talking left in this answer.", context: "limit notice under a box" });
    const minutes = halfMinutes(m);
    return t({ message: `About ${minutes} minutes of talking left in this answer.`, context: "limit notice under a box" });
  };
}

/** The trim a box needs before it can be sent, in words (the same message the send names: fireflyPath/limitProblems.ts). */
export function useTrimWords(): (over: number) => string {
  const { i18n } = useLingui();
  return (over: number) => trimWords(over, i18n);
}

export function LimitSigns({ value, max, id, voice = true }: {
  value: string;
  max: number;
  /** The counter's id, so the box can be described by it. */
  id?: string;
  /** Whether the box takes voice: its notice speaks in minutes of talking. */
  voice?: boolean;
}) {
  const { t } = useLingui();
  const n = useNumber();
  const talkLeft = useTalkLeft();
  const trim = useTrimWords();
  const [help, setHelp] = useState(false);
  const used = value.length;
  const state = limitState(used, max);
  const left = Math.max(0, max - used);
  const notice =
    state === "over"
      ? trim(overBy(value, max))
      : state === "nearer"
        ? t({ message: `Nearly full: ${n(left)} characters left.`, context: "limit notice under a box" })
        : state === "near"
          ? voice
            ? talkLeft(left)
            : t({ message: `${n(left)} characters left in this answer.`, context: "limit notice under a box" })
          : "";
  const heard =
    state === "over"
      ? t({ message: "This answer is over its limit. Trim it to send.", context: "limit notice, read aloud" })
      : state === "nearer"
        ? t({ message: "This answer is nearly full.", context: "limit notice, read aloud" })
        : state === "near"
          ? t({ message: "This answer is getting full.", context: "limit notice, read aloud" })
          : "";
  const tone =
    state === "over"
      ? "border-l-4 border-destructive pl-3 font-semibold text-foreground"
      : state === "nearer"
        ? "border-l-4 border-notice pl-3 font-semibold text-foreground"
        : "text-muted-foreground";
  return (
    <div className="mt-1 grid gap-1 text-sm" data-limit-signs={state}>
      <div className="flex items-start justify-between gap-3">
        <p className={`min-w-0 ${tone}`} data-limit-notice={state}>
          {notice}
        </p>
        <span className="flex shrink-0 items-center gap-2">
          <span id={id} className={`tabular-nums ${state === "room" ? "text-muted-foreground" : "font-semibold text-foreground"}`} data-character-count="">
            {n(used)} / {n(max)}
          </span>
          {/* The words, never a circled "?" (the lead, 27 Nov 2026: tooltips on the word), as LimitsAtTop says it. */}
          <button
            type="button"
            onClick={() => setHelp((h) => !h)}
            aria-expanded={help}
            className="inline-flex min-h-11 items-center text-sm font-medium text-notice underline underline-offset-2 hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
            data-limit-help=""
          >
            {t({ message: "How the limits work", context: "limit help button beside a box" })}
          </button>
        </span>
      </div>
      {help && (
        <Suspense fallback={null}>
          <LimitsExplained max={max} voice={voice} />
        </Suspense>
      )}
      <span className="sr-only" role="status" aria-live="polite">
        {heard}
      </span>
    </div>
  );
}

/** Once near the top of the application: a line about the room there is, and the four kinds of limit on a press. */
export function LimitsAtTop({ className = "" }: { className?: string }) {
  const { t } = useLingui();
  const [open, setOpen] = useState(false);
  return (
    <div className={`grid gap-2 ${className}`} data-limits-at-top="">
      <p className="text-sm text-muted-foreground">
        {t({ message: "There is room for long answers: about seven minutes of talking in each, and a count under every box.", context: "founding application, the limits" })}{" "}
        <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="inline-flex min-h-11 items-center font-medium text-notice underline underline-offset-2 hover:text-foreground" data-limits-at-top-toggle="">
          {t({ message: "How the limits work", context: "founding application, the limits" })}
        </button>
      </p>
      {open && (
        <Suspense fallback={null}>
          <LimitsExplained />
        </Suspense>
      )}
    </div>
  );
}
