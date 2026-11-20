/**
 * THE PHONE'S APPLY, VISIBLE FROM THE START (the lead, 20 Nov 2026, after 1.3.38). On a phone the act is drawn in
 * the card's flow, right under the goal of "the role in one minute", so the first screen shows the goal whole and
 * Apply beneath it. The bar along the phone's foot shows only while that act is off the screen: scrolled past above,
 * or still below where the bar would sit. Exactly one Apply is in view at a time, and the bar never covers the goal,
 * because the goal sits above the act in the flow: while the act is below the bar line, so is everything after it,
 * and once the act has scrolled past, so has the goal.
 *
 * 1.3.38 made the bar wait until the goal scrolled clear above it, so Apply was off the first screen. This replaces it.
 */
import { useEffect, useState, type RefObject } from "react";

/**
 * Whether the bar shows: the in-flow act has scrolled past the top (its bottom at or above `topInset`, the sticky
 * header's foot), or its top is below the line where the bar's top would be. Null rects (nothing laid out): no bar.
 */
export function applyBarShows(act: { top: number; bottom: number } | null, viewport: number, tabbar: number, bar: number, topInset = 0): boolean {
  if (!act) return false;
  if (act.bottom <= topInset) return true;
  return act.top > viewport - tabbar - bar;
}

/** The phone tab bar's height in pixels. `--tabbar-h` is a calc() with the safe area in it, so the browser resolves it. */
function tabbarPx(el: HTMLElement): number {
  const probe = document.createElement("div");
  probe.style.cssText = "position:absolute;visibility:hidden;pointer-events:none;width:0;height:var(--tabbar-h,0px)";
  el.appendChild(probe);
  const h = probe.getBoundingClientRect().height;
  probe.remove();
  return Number.isFinite(h) ? h : 0;
}

/** The foot of a header pinned to the top of the screen, which hides what scrolls under it. */
function topInsetPx(): number {
  let inset = 0;
  for (const h of Array.from(document.querySelectorAll<HTMLElement>("header"))) {
    const pos = window.getComputedStyle(h).position;
    if (pos !== "sticky" && pos !== "fixed") continue;
    const r = h.getBoundingClientRect();
    if (r.top <= 0 && r.bottom > inset && r.bottom < window.innerHeight / 2) inset = r.bottom;
  }
  return inset;
}

function measure(act: HTMLElement): boolean {
  const r = act.getBoundingClientRect();
  // Not laid out (a test's document, or a hidden card): the act in the flow stands, and there is no bar.
  if (r.width === 0 && r.height === 0) return false;
  // The bar holds the same act with its padding, so the act's own height plus the bar's padding is the bar's height.
  return applyBarShows({ top: r.top, bottom: r.bottom }, window.innerHeight, tabbarPx(act), act.offsetHeight + 24, topInsetPx());
}

/** Whether the phone's bar shows, read from the in-flow act (`act`), on every scroll, resize and render. */
export function useApplyBarStuck(act: RefObject<HTMLElement | null>, on: boolean): boolean {
  const [shows, setShows] = useState(false);
  // After every render of the card too: its words arrive after it mounts, and the act moves when they do.
  useEffect(() => {
    if (on && act.current && typeof window !== "undefined") {
      const next = measure(act.current);
      if (next !== shows) setShows(next);
    }
  });
  useEffect(() => {
    const el = act.current;
    if (!on || !el || typeof window === "undefined") return;
    let frame = 0;
    const check = () => {
      frame = 0;
      setShows(measure(el));
    };
    const soon = () => {
      if (!frame) frame = window.requestAnimationFrame(check);
    };
    check();
    window.addEventListener("scroll", soon, { passive: true });
    window.addEventListener("resize", soon);
    return () => {
      window.removeEventListener("scroll", soon);
      window.removeEventListener("resize", soon);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [act, on]);
  return on && shows;
}
