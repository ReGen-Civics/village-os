/**
 * A WORD WITH A TIP, the mechanics MoonWord.tsx describes (the moon word, then the contribution token's name,
 * 19 Nov 2026): focusable, dotted underline, opens on hover with a mouse, on focus and on a tap, closes on Escape,
 * blur, a tap outside or a scroll, portalled to the night sheet so a phone gets the sheet along the screen's foot.
 * Drawn only while open. The `.moon` and `.moon-tip` rules in client/src/index.css style every one of them.
 */
import { useEffect, useId, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";

/** A word that carries a tip: `children` is the word as the sentence has it, `tip` the plain words it opens. */
export function WordTip({ children, tip, kind = "moon" }: { children: string; tip: string; kind?: "moon" | "tip-word" }) {
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
    <span className={kind}>
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
            {tip}
          </span>,
          word.current?.closest(".sheet-night") ?? document.body,
        )}
    </span>
  );
}
