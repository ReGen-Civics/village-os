/**
 * THE MOON WORD (the lead, 18 Nov 2026): applicant-facing pay is set and shown per moon, because the village works
 * in moon cycles. Every "moon" an applicant reads on the role card and the apply flow carries a small tooltip:
 * "We work in moon cycles, from new moon to new moon."
 *
 * Tiny on purpose: it lands on /roles and /propose-a-role, both at their first-view budgets, so it is React state and
 * the `.moon` rules in client/src/index.css (CSS costs no first-view JS), with no new dependency. The word is
 * focusable and wears a dotted underline. The tip opens on hover, on focus and on a tap, and closes on Escape, on blur
 * and when the pointer leaves (a tap elsewhere is a blur and, on a phone, a mouseleave). It is drawn only while open,
 * so a sentence's text and a heading's name read the same with it closed (InfoTip.tsx has the story of a closed tip
 * read mid-sentence), and while open the word names it with aria-describedby (the ARIA tooltip pattern). On a phone
 * it sits fixed along the foot of the screen, so no card clips it and no edge pushes it off; over the word from 640px
 * up. A tap inside a <label> does not move focus to the label's field. Escape is taken on the window in the capture
 * phase, so it closes the tip and never the explainer or popup around it.
 *
 * `MoonText` takes a whole sentence, as the words modules build it, and wraps each whole-word "moon" or "moons" in
 * it. The words modules stay plain strings driven by the role's `per`, so a price set per month never shows a tip.
 */
import { useEffect, useId, useState } from "react";
import { useLingui } from "@lingui/react/macro";
import { msg } from "@lingui/core/macro";

const TIP = msg({ message: "We work in moon cycles, from new moon to new moon.", context: "tooltip on the word moon, applicant pages" });

export function MoonWord({ children = "moon" }: { children?: string }) {
  const { i18n } = useLingui();
  const [open, setOpen] = useState(false);
  const id = useId();
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
    addEventListener("keydown", key, true);
    return () => removeEventListener("keydown", key, true);
  }, [open]);

  return (
    <span className="moon" onMouseEnter={on} onMouseLeave={off}>
      <span
        tabIndex={0}
        aria-describedby={open ? id : undefined}
        onFocus={on}
        onBlur={off}
        onClick={(e) => {
          e.preventDefault();
          on();
        }}
      >
        {children}
      </span>
      {open && (
        <span id={id} role="tooltip">
          {i18n._(TIP)}
        </span>
      )}
    </span>
  );
}

/** A sentence with each whole-word "moon" or "moons" in it wearing the tip. Text without one comes back as is. */
export function MoonText({ text }: { text: string | null | undefined }) {
  return <>{(text ?? "").split(/\b(moons?)\b/gi).map((p, i) => (i % 2 ? <MoonWord key={i}>{p}</MoonWord> : p))}</>;
}
