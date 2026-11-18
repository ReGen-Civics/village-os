/**
 * THE MOON WORD (the lead, 18 Nov 2026): applicant-facing pay is set and shown per moon, because the village works
 * in moon cycles. Every "moon" an applicant reads on the role card and the apply flow carries a small tooltip:
 * "We work in moon cycles, from new moon to new moon."
 *
 * Tiny on purpose: it lands on /roles and /propose-a-role, both at their first-view budgets, so it is React state and
 * the `.moon` rules in client/src/index.css (CSS costs no first-view JS), with no new dependency. The word is
 * focusable and wears a dotted underline. The tip opens on hover with a mouse, on focus, and on a tap or a click; a
 * second tap closes it. It closes on Escape, on blur, when the mouse leaves, on a tap or click outside, and on a
 * scroll. It is drawn only while open, so a sentence's text and a heading's name read the same with it closed
 * (InfoTip.tsx has the story of a closed tip read mid-sentence), and while open the word names it with
 * aria-describedby (the ARIA tooltip pattern). A tap inside a <label> does not move focus to the label's field.
 * Escape is taken on the window in the capture phase, so it closes the tip and never the explainer or popup around it.
 *
 * THE PHONE TAP (production check of 1.3.25): a tap on the Rewards tab drew nothing, and a click drew a tip nobody
 * could see. Two causes. A tap was left to the mouse events a browser makes up after it, which a host may cancel, so
 * the tap is read from the pointer itself (`pointerup` for touch and pen). And the tip was fixed inside the card,
 * where a transformed ancestor (a dialog, an entering piece) makes "fixed" mean "inside that box", so the sheet sat
 * off screen or clipped. The tip is portalled to the page's night sheet (`.sheet-night`, so it keeps the sheet's
 * tokens) or the body: on a phone it is a sheet along the foot of the screen; from 640px up it sits over the word (or
 * under it, near the top of the screen), placed from the word's own box.
 *
 * `MoonText` takes a whole sentence, as the words modules build it, and wraps each whole-word "moon" or "moons" in
 * it. The words modules stay plain strings driven by the role's `per`, so a price set per month never shows a tip.
 */
import { useEffect, useId, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { useLingui } from "@lingui/react/macro";
import { msg } from "@lingui/core/macro";

const TIP = msg({ message: "We work in moon cycles, from new moon to new moon.", context: "tooltip on the word moon, applicant pages" });

export function MoonWord({ children = "moon" }: { children?: string }) {
  const { i18n } = useLingui();
  const [open, setOpen] = useState(false);
  const id = useId();
  const word = useRef<HTMLSpanElement>(null);
  // When a touch last toggled the tip, so the click a browser makes up after the tap does not toggle it back.
  const tapped = useRef(0);
  const on = () => setOpen(true);
  const off = () => setOpen(false);
  useEffect(() => {
    if (!open) return;
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        off();
      }
    };
    const away = (e: Event) => {
      if (!word.current?.contains(e.target as Node)) off();
    };
    addEventListener("keydown", key, true);
    addEventListener("pointerdown", away, true);
    addEventListener("scroll", off, true);
    return () => {
      removeEventListener("keydown", key, true);
      removeEventListener("pointerdown", away, true);
      removeEventListener("scroll", off, true);
    };
  }, [open]);

  // From 640px up the tip sits over the word, placed from the word's box; on a phone the CSS sheet places it.
  let at: CSSProperties | undefined;
  const r = open && innerWidth >= 640 ? word.current?.getBoundingClientRect() : null;
  // Above the word, or below it when the word is too near the top of the screen for the tip to fit.
  if (r) at = { left: Math.max(8, Math.min(r.left, innerWidth - 240)), ...(r.top > 96 ? { top: r.top - 8, transform: "translateY(-100%)" } : { top: r.bottom + 8 }) };

  return (
    <span className="moon">
      <span
        ref={word}
        tabIndex={0}
        aria-describedby={open ? id : undefined}
        onPointerEnter={(e) => e.pointerType === "mouse" && on()}
        onPointerLeave={(e) => e.pointerType === "mouse" && word.current !== document.activeElement && off()}
        onPointerUp={(e) => {
          if (e.pointerType === "mouse") return;
          tapped.current = e.timeStamp;
          setOpen((o) => !o);
        }}
        onFocus={on}
        onBlur={off}
        onClick={(e) => {
          e.preventDefault();
          if (e.timeStamp - tapped.current > 800) on();
        }}
      >
        {children}
      </span>
      {open &&
        createPortal(
          <span id={id} role="tooltip" className="moon-tip" style={at}>
            {i18n._(TIP)}
          </span>,
          word.current?.closest(".sheet-night") ?? document.body,
        )}
    </span>
  );
}

/** A sentence with each whole-word "moon" or "moons" in it wearing the tip. Text without one comes back as is. */
export function MoonText({ text }: { text: string | null | undefined }) {
  return <>{(text ?? "").split(/\b(moons?)\b/gi).map((p, i) => (i % 2 ? <MoonWord key={i}>{p}</MoonWord> : p))}</>;
}
