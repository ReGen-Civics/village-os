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
import { useLingui } from "@lingui/react/macro";
import { msg } from "@lingui/core/macro";
import { WordTip } from "./WordTip";

const TIP = msg({ message: "We work in moon cycles, from new moon to new moon.", context: "tooltip on the word moon, applicant pages" });

export function MoonWord({ children = "moon" }: { children?: string }) {
  const { i18n } = useLingui();
  return <WordTip tip={i18n._(TIP)}>{children}</WordTip>;
}

/** A sentence with each whole-word "moon" or "moons" in it wearing the tip. Text without one comes back as is. */
export function MoonText({ text }: { text: string | null | undefined }) {
  return <>{(text ?? "").split(/\b(moons?)\b/gi).map((p, i) => (i % 2 ? <MoonWord key={i}>{p}</MoonWord> : p))}</>;
}
