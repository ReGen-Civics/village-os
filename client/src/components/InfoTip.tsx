/**
 * InfoTip (R46): the tooltip layer under the enchant-first copy ruling. The
 * surface line enchants in the map's register; the plaque this component
 * opens carries the plain one-sentence mechanics. One card may wear up to
 * three of these where three concepts genuinely live on it; a plaque never
 * contains another trigger.
 *
 * THE WORD IS THE TRIGGER (the lead, 27 Nov 2026, over a screenshot of
 * "domains" with a circled mark after it: "tooltips should be on the word not
 * next to it like this. fix this for all tooltips across the site, should be
 * something subtle and not disrupt the whole paragraph text like this."). A
 * call site passes the word or phrase the tip explains as `children`, and
 * that word becomes the trigger where it stands in the sentence. There is no
 * mark, no circle and no extra width: the word wears a thin dotted underline
 * in a muted tone that firms up on hover (the `.info-word` rules in
 * client/src/index.css, which cost the first view no JS). The trigger is an
 * INLINE span, so a phrase wraps exactly as the plain text would, line for
 * line; a <button> is always laid out as an inline-block, which cannot break
 * across lines and would move the paragraph. Its touch target is the word's
 * own inline padding, given back by an equal negative margin, so it adds no
 * layout and covers each line of a wrapped phrase exactly (`.info-word`).
 *
 * Why not the shadcn/Radix tooltip two doors down: Radix tooltips never open
 * on touch, and mobile is most of this audience. This trigger is a real
 * button to every reader and every key: role="button" with tabIndex 0, so a
 * tap toggles it, Tab reaches it, Enter and Space toggle it, Escape dismisses
 * it, and hover still works for mouse visitors. Its accessible name is the
 * word itself.
 *
 * Accessibility contract:
 * - The trigger has role="button", aria-expanded and a focus-visible ring.
 * - The plaque is aria-describedby-linked and stays in the DOM while closed,
 *   so a screen reader hears the mechanics on focus without needing the
 *   visual open state. It is `hidden` while closed, NOT `sr-only`: see below.
 * - Keyboard focus opens the plaque visually too, and blur closes it.
 * - The plaque positions FIXED from the trigger's measured rect, so an
 *   overflow-hidden card ancestor never clips it; scrolling closes it
 *   instead of letting it drift.
 * - A click on the word never reaches a <label>'s field or a link around it.
 *
 * WHY THE CLOSED PLAQUE IS `hidden` AND NOT `sr-only`. The plaque node sits in
 * the HOST PARAGRAPH'S INLINE FLOW, right after the word. An `sr-only` node is
 * out of the VISUAL flow and fully inside the reading order, so every one of
 * these read its definition MID-SENTENCE and then let the host sentence
 * resume as a fragment after a full stop, and then read the same words AGAIN
 * when the trigger took focus. On /campaigns that was: "...through the hub's
 * crowdpool A crowdpool gathers pledges of money, goods, tools and hands for
 * one build. Nothing moves through this page; every claim finishes on the
 * hub's own page. . Each ring fills as the pool does". It renders perfectly
 * for sighted visitors, which is why no screenshot, contrast pass or overflow
 * sweep could ever have caught it.
 *
 * `hidden` (display:none) takes the node out of the accessibility tree
 * altogether, and accname (Accessible Name and Description Computation 1.2,
 * step 2A) carves out one exception: a node hidden but DIRECTLY referenced by
 * aria-labelledby or aria-describedby is still traversed for the description.
 * So both halves hold, which is the whole requirement: out of the sentence,
 * still resolvable on focus. Measured in Chromium 153.0.8010.12 over the
 * browser's own accessibility tree: the button's computed description is the
 * tip text while the plaque is `hidden`, and the tip text is NOT among the
 * tree's static-text nodes. Under `sr-only` the description resolved too and
 * the text WAS a static-text node, which is the defect.
 *
 * The same defect had a second face, in HEADINGS. Fourteen of the call sites
 * sit inside an h2, h3 or h4, and a heading's accessible name is computed
 * from its content, which `sr-only` content is part of. Measured the same
 * way: the governance "Your weight" h3 was named "Your weight What voting
 * weight is Weight is how much a vote counts. It is read when a ballot opens
 * and frozen there, so a later change never rewrites a vote in flight." in a
 * screen reader's list of headings. Under `hidden` it was "Your weight What
 * voting weight is", and with the word as the trigger it is "Your weight".
 *
 * A portal was the other candidate FOR THE DESCRIPTION, and the probe ruled
 * it out: a portalled `sr-only` description was still a static-text node,
 * merely relocated to the end of the document, so it is read out of nowhere
 * instead of mid-sentence. So the description stays where it is, `hidden`,
 * beside the word, and it is what aria-describedby names, open or closed.
 *
 * THE OPEN PLAQUE IS PORTALLED, and that is a different node (27 Nov 2026).
 * position:fixed does not escape everything: the Weathered map draws each card
 * as a torn page with a CSS mask on its border box (client/src/seaChart.css),
 * and a mask paints away every descendant outside that box, fixed ones too.
 * Measured on /governance/decisions at 375 on the Weathered map: "Your weight"
 * opened a 264px plaque at x 8, and its left 14px, border and first letters,
 * were cut off by the card it opened from. So while open, the visible plaque
 * is drawn in the page's night sheet (`.sheet-night`, so it keeps that sheet's
 * tokens) or the body, the way the moon word's tip is (WordTip.tsx). While it
 * shows, the word's aria-describedby names it (the ARIA tooltip pattern); the
 * in-place copy stays display:none, so the words are in the tree once. It
 * wears the body face, so a tip opened from a display heading reads in the
 * reading face at the plaque's own size.
 *
 * The plaque takes the page's own colours (`.info-plaque`: --card,
 * --card-foreground, --border), the same tokens the moon word's tip wears, so
 * it reads as the page in the light, on the Weathered map's paper and in the
 * dark, and the two tooltip families read as one voice.
 */
import { decayReachSentence } from "@shared/tokenScale";
import { useEffect, useId, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent as ReactMouseEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";

const PLAQUE_MAX_W = 264;

interface InfoTipProps {
  /** The plain mechanics, one to three short sentences. Text only. */
  tip: string;
  /** The word or phrase the tip explains, as the sentence has it. It is the trigger and its accessible name. */
  children: ReactNode;
  /** Extra classes for the word. */
  className?: string;
}

export default function InfoTip({ tip, children, className = "" }: InfoTipProps) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number; above: boolean } | null>(null);
  const triggerRef = useRef<HTMLSpanElement | null>(null);
  // True while a pointer interaction is underway, so the focus that a tap or
  // click raises does not pre-open the plaque the click is about to toggle.
  const pointerDown = useRef(false);
  // True when the plaque was pinned open by a click or tap; a pinned plaque
  // ignores mouseleave and closes on outside tap, Escape, or a second tap.
  const pinned = useRef(false);
  const id = useId();

  const place = () => {
    const el = triggerRef.current;
    if (!el) return;
    // The word's first line: a phrase that wraps opens beside where it starts.
    const r = el.getClientRects?.()[0] ?? el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const w = Math.min(PLAQUE_MAX_W, vw - 16);
    const left = Math.min(Math.max(8, r.left + r.width / 2 - w / 2), vw - w - 8);
    const above = r.bottom + 150 > vh && r.top > 150;
    setPos({ top: above ? r.top - 8 : r.bottom + 8, left, above });
  };

  const show = () => {
    place();
    setOpen(true);
  };
  const hide = () => {
    setOpen(false);
    pinned.current = false;
  };
  const toggle = () => {
    if (open && pinned.current) {
      hide();
    } else {
      pinned.current = true;
      show();
    }
  };
  // From the keyboard an open tip is one Enter or Space from closed, pinned or not: Tab has already opened it, so the
  // first key a reader presses on it should never be one that seems to do nothing (QA round 1, 27 Nov 2026).
  const toggleByKey = () => {
    if (open) hide();
    else {
      pinned.current = true;
      show();
    }
  };

  // A tip inside a link or a button cannot work on a phone: the tap is the link's or the button's. Said in
  // development, where the next call site that does it is being written; production builds drop this.
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const host = triggerRef.current?.parentElement?.closest("a[href], button, [role='button']");
    if (host) console.warn("InfoTip: a tip inside a link or a button cannot open on touch, since the tap belongs to the link. Put the tip beside it.", host);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") hide();
    };
    const onDocDown = (e: Event) => {
      if (triggerRef.current && e.target instanceof Node && triggerRef.current.contains(e.target)) return;
      hide();
    };
    // Scrolling would leave a fixed plaque floating over the wrong words.
    const onScroll = () => hide();
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDocDown);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDocDown);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [open]);

  const w = typeof window !== "undefined" ? Math.min(PLAQUE_MAX_W, window.innerWidth - 16) : PLAQUE_MAX_W;
  // The open plaque's home: out of the card it opens from (a torn card's mask cuts a fixed child), into the night
  // sheet so it keeps that sheet's tokens, or the body.
  const into = open && pos && typeof document !== "undefined" ? (triggerRef.current?.closest(".sheet-night") ?? document.body) : null;
  const shown = into && pos ? { ...pos, into } : null;
  const plaqueId = `${id}-open`;

  return (
    <span>
      <span
        role="button"
        tabIndex={0}
        ref={triggerRef}
        aria-expanded={open}
        // The open plaque while it shows (the ARIA tooltip pattern), the in-place description otherwise: the same words.
        aria-describedby={shown ? plaqueId : id}
        onPointerDown={() => {
          pointerDown.current = true;
        }}
        onClick={(e: ReactMouseEvent) => {
          // Inside a <label> a click would also focus its field, inside a link it would follow it.
          e.preventDefault();
          pointerDown.current = false;
          toggle();
        }}
        onKeyDown={(e: ReactKeyboardEvent) => {
          if (e.key !== "Enter" && e.key !== " ") return;
          // Space would scroll the page, Enter would submit a form around it.
          e.preventDefault();
          if (!e.repeat) toggleByKey();
        }}
        onFocus={() => {
          if (!pointerDown.current) show();
        }}
        onBlur={hide}
        onMouseEnter={show}
        onMouseLeave={() => {
          if (!pinned.current) setOpen(false);
        }}
        className={className ? `info-word ${className}` : "info-word"}
      >
        {children}
      </span>
      {/* The description, always display:none and always here, so aria-describedby resolves without it ever being
          read mid-sentence; see the header for what was measured and why `sr-only` was the defect. */}
      <span id={id} role="tooltip" hidden>
        {tip}
      </span>
      {shown &&
        createPortal(
          <span
            id={plaqueId}
            role="tooltip"
            style={{
              // Fixed and above the page here as well as in the stylesheet, so no ancestor's overflow clips it.
              position: "fixed",
              zIndex: 80,
              top: shown.above ? undefined : shown.top,
              bottom: shown.above ? window.innerHeight - shown.top : undefined,
              left: shown.left,
              width: w,
            }}
            className="info-plaque"
          >
            {tip}
          </span>,
          shown.into,
        )}
    </span>
  );
}

/**
 * THE SMALLEST BALANCE A WANING RATE ACTUALLY REACHES, said beside the dial.
 *
 * Here beside `InfoTip` because both are the same kind of thing: the extra
 * sentence a control carries so a person can act on it. The difference is that
 * a plaque explains what a dial MEANS and this one states what the value in
 * front of you WOULD DO, computed rather than written.
 *
 * `decayVoice` floors each member's share and skips the member when the answer
 * is zero, so every percentage has a line below which it silently does nothing.
 * At one percent and two decimals that line is one whole Voice, and at half a
 * percent it is two. A number that quietly stops applying below a line is a
 * promise the village cannot see it is not keeping, and a village voting a
 * small percentage to be gentle may be voting one that reaches almost nobody
 * while the panel shows it working.
 *
 * A STATEMENT OF FACT AND NEVER A REFUSAL. The standing ruling is that a
 * warning never blocks, and this sits one step below a warning.
 *
 * The sentence comes from `shared/tokenScale.ts`, which derives it from
 * `decayUnits`, the SAME floor the engine uses. A displayed number and an
 * actual behaviour that are different quantities is the mint cap's lesson.
 *
 * It reads the STAGED value when there is one, so it moves as the dial moves.
 * A `span` and not a `p`, because it renders inside the description paragraph.
 *
 * PROPOSED BY THE GOVERNANCE SESSION on 2026-09-04 and NOT a founder ruling.
 * Rye ruled the scale and this follows from the same measurement, and he has
 * not been asked for it.
 */
export function DialFact({
  v,
  staged,
}: {
  v: { key: string; value?: string; default?: string };
  staged?: string;
}) {
  if (v.key !== "economy.voice_decay_pct") return null;
  const pct = Number(staged ?? v.value ?? v.default);
  if (!Number.isFinite(pct)) return null;
  return <span className="block text-notice mt-1">{decayReachSentence(pct, "Voice")}</span>;
}
