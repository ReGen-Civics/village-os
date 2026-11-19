/**
 * A WORD WITH A TIP, the mechanics MoonWord.tsx describes (the moon word, then the contribution token's name,
 * 19 Nov 2026): focusable, dotted underline, opens on hover with a mouse, on focus and on a tap, closes on Escape,
 * blur, a tap outside or a scroll, portalled to the night sheet so a phone gets the sheet along the screen's foot.
 * Drawn only while open. The `.moon` and `.moon-tip` rules in client/src/index.css style every one of them.
 *
 * TWO WORDS ON NEIGHBOURING LINES (production check of 1.3.29, a phone at 390px): the padding that grows a word's box
 * to a thumb's 44px is taller than a line, so in "Each moon you share what you'll bring the next moon." the second
 * word's box lay over the first word's text. A tap on the first word reached the second, half the taps opened or
 * closed the other word's tip, and the tap seemed to do nothing. So a tap or a click belongs to the word whose own
 * text is nearest the point (`tipWordAt`), and is handed to that word; and a focus that a press brings does not open
 * anything by itself, because focus goes to whichever box is on top. A keyboard focus still opens the tip.
 */
import { useEffect, useId, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";

/** Every word that carries a tip, whichever kind. */
const TIP_WORDS = ".moon > [tabindex], .tip-word > [tabindex]";
/** The event a word hands a press to the word it belongs to with. */
const HAND_ON = "wordtip-press";
type Press = "toggle" | "open";

/**
 * The tip word a press at (x, y) belongs to: the one whose own text is nearest the point, among the words whose boxes
 * are under it. `hit` is what the browser says was pressed. With no layout to ask (a test page), it is `hit`'s word.
 */
export function tipWordAt(x: number, y: number, hit: EventTarget | null): HTMLElement | null {
  const own = hit instanceof Element ? (hit.closest(TIP_WORDS) as HTMLElement | null) : null;
  if (typeof document.elementsFromPoint !== "function") return own;
  const under = document.elementsFromPoint(x, y).filter((el): el is HTMLElement => el instanceof HTMLElement && el.matches(TIP_WORDS));
  if (under.length < 2) return own ?? under[0] ?? null;
  let best = own ?? under[0];
  let far = Infinity;
  for (const el of under) {
    const text = document.createRange();
    text.selectNodeContents(el);
    for (const r of Array.from(text.getClientRects())) {
      // Lines are close and words are wide, so a step off the line counts for more than a step along it.
      const d = Math.max(r.top - y, 0, y - r.bottom) * 4 + Math.max(r.left - x, 0, x - r.right);
      if (d < far) {
        far = d;
        best = el;
      }
    }
  }
  return best;
}

/** A word that carries a tip: `children` is the word as the sentence has it, `tip` the plain words it opens. */
export function WordTip({ children, tip, kind = "moon" }: { children: string; tip: string; kind?: "moon" | "tip-word" }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const word = useRef<HTMLSpanElement>(null);
  // When a touch last toggled the tip, so the click a browser makes up after the tap does not toggle it back.
  const tapped = useRef(0);
  // When a pointer last pressed this word, so the focus the press brings does not open it by itself.
  const pressed = useRef(-Infinity);
  const on = () => setOpen(true);
  const off = () => setOpen(false);
  const take = (p: Press) => (p === "toggle" ? setOpen((o) => !o) : on());
  // A press at a point goes to the word it belongs to, which may be this one or a neighbour under this one's box.
  const press = (x: number, y: number, p: Press) => {
    const owner = tipWordAt(x, y, word.current) ?? word.current;
    if (!owner || owner === word.current) take(p);
    else owner.dispatchEvent(new CustomEvent<Press>(HAND_ON, { detail: p }));
  };
  useEffect(() => {
    const el = word.current;
    if (!el) return;
    const handed = (e: Event) => take((e as CustomEvent<Press>).detail);
    el.addEventListener(HAND_ON, handed);
    return () => el.removeEventListener(HAND_ON, handed);
  }, []);
  useEffect(() => {
    if (!open) return;
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        off();
      }
    };
    // A press outside closes it, and so does a press inside its box that belongs to a neighbouring word.
    const away = (e: PointerEvent) => {
      if (tipWordAt(e.clientX, e.clientY, e.target) !== word.current) off();
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
        onPointerDown={(e) => {
          pressed.current = e.timeStamp;
        }}
        onPointerUp={(e) => {
          if (e.pointerType === "mouse") return;
          tapped.current = e.timeStamp;
          press(e.clientX, e.clientY, "toggle");
        }}
        onFocus={(e) => {
          // A press decides on its own (the tap or the click above); a focus with no press, from the keyboard, opens.
          if (e.timeStamp - pressed.current > 1000) on();
        }}
        onBlur={off}
        onClick={(e) => {
          e.preventDefault();
          if (e.timeStamp - tapped.current > 800) press(e.clientX, e.clientY, "open");
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
