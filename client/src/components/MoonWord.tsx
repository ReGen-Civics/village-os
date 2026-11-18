/**
 * THE MOON WORD (the lead, 18 Nov 2026): applicant-facing pay is set and shown per moon, because the village works
 * in moon cycles. Every "moon" an applicant reads on the role card and the apply flow carries a small tooltip:
 * "We work in moon cycles, from new moon to new moon."
 *
 * Tiny on purpose: it lands on /roles and /propose-a-role, both at their first-view budgets, so it is React state
 * and Tailwind classes with no new dependency. The word is focusable and wears a dotted underline. The tip opens on
 * hover, on focus and on a tap, and closes on Escape, on blur, on a tap elsewhere and when the pointer leaves. It is
 * drawn only while open, so a sentence's text and a heading's name read the same with it closed (InfoTip.tsx has the
 * story of a closed tip read mid-sentence), and while open the word names it with aria-describedby (the ARIA tooltip
 * pattern). It sits fixed beside the word, so no card clips it, and a scroll closes it. A click inside a <label>
 * does not move focus to the label's field. Escape closes only the tip, never the explainer or popup around it.
 *
 * `MoonText` takes a whole sentence, as the words modules build it, and wraps each whole-word "moon" or "moons" in
 * it. The words modules stay plain strings driven by the role's `per`, so a price set per month never shows a tip.
 */
import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { useLingui } from "@lingui/react/macro";
import { msg } from "@lingui/core/macro";

const TIP = msg({ message: "We work in moon cycles, from new moon to new moon.", context: "tooltip on the word moon, applicant pages" });

/** The tip's width in CSS pixels (w-48), and the gap it keeps from the word and from the screen's edge. */
const TIP_W = 192;
const GAP = 8;

export function MoonWord({ children = "moon" }: { children?: ReactNode }) {
  const { i18n } = useLingui();
  const [open, setOpen] = useState(false);
  const id = useId();
  const box = useRef<HTMLSpanElement>(null);
  const word = useRef<HTMLSpanElement>(null);
  // Where the open tip sits. FIXED from the word's measured box, so a card's overflow never clips it and a word at a
  // phone's edge keeps it on the screen; above the word, or below it when the word is near the top.
  const [at, setAt] = useState<{ left: number; top: number; above: boolean } | null>(null);

  useLayoutEffect(() => {
    if (!open || !word.current) return setAt(null);
    const r = word.current.getBoundingClientRect();
    const w = window.innerWidth || TIP_W + 2 * GAP;
    const left = Math.max(GAP, Math.min(r.left + r.width / 2 - TIP_W / 2, w - GAP - TIP_W));
    const above = r.top > 96;
    setAt({ left, top: above ? r.top - GAP : r.bottom + GAP, above });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    // On the window, in the capture phase, so an open tip takes the Escape first: the explainer or the price popup it
    // sits in stays open, and only the tip closes.
    const key = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      setOpen(false);
    };
    const away = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    // A fixed tip would drift from its word on a scroll, so a scroll closes it.
    const shut = () => setOpen(false);
    window.addEventListener("keydown", key, true);
    document.addEventListener("pointerdown", away);
    window.addEventListener("scroll", shut, true);
    return () => {
      window.removeEventListener("keydown", key, true);
      document.removeEventListener("pointerdown", away);
      window.removeEventListener("scroll", shut, true);
    };
  }, [open]);

  return (
    <span ref={box} data-moon-word="">
      {/* Inline padding grows the box a thumb hits to about 44px without moving the line; the side margins give it back. */}
      <span
        ref={word}
        tabIndex={0}
        aria-describedby={open ? id : undefined}
        className="-mx-1 cursor-help rounded-lg px-1 py-3.5 underline decoration-dotted underline-offset-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        onPointerEnter={(e) => e.pointerType === "mouse" && setOpen(true)}
        onPointerLeave={(e) => e.pointerType === "mouse" && document.activeElement !== e.currentTarget && setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={(e) => {
          e.preventDefault();
          setOpen(true);
        }}
      >
        {children}
      </span>
      {open && (
        <span
          id={id}
          role="tooltip"
          style={at ? { left: at.left, top: at.top, transform: at.above ? "translateY(-100%)" : undefined } : { visibility: "hidden" }}
          className="fixed z-50 block w-48 max-w-[calc(100vw-1rem)] rounded-lg border border-border bg-card px-3 py-2 text-left font-body text-xs font-normal normal-case leading-snug tracking-normal text-card-foreground shadow-sm"
        >
          {i18n._(TIP)}
        </span>
      )}
    </span>
  );
}

const MOON = /\b(moons?)\b/gi;

/** A sentence with each whole-word "moon" or "moons" in it wearing the tip. Text without one comes back as is. */
export function MoonText({ text }: { text: string | null | undefined }) {
  const s = text ?? "";
  const parts = s.split(MOON);
  if (parts.length === 1) return <>{s}</>;
  return <>{parts.map((p, i) => (i % 2 ? <MoonWord key={i}>{p}</MoonWord> : p))}</>;
}
