/**
 * Since 1.3.43 (the lead, after 1.3.42) the act sits right after the card's title, ABOVE the one-minute panel: under
 * the goal its top edge sat behind the phone's tab bar on a 390x664 iPhone. With the goal below the act, `measure`
 * passes no goal line, so the bar reads the act's own top. What follows is the history of the rule.
 *
 * THE PHONE'S APPLY, VISIBLE FROM THE START (the lead, 20 Nov 2026, after 1.3.38). On a phone the act is drawn in
 * the card's flow, right under the goal of "the role in one minute", so the first screen shows the goal whole and
 * Apply beneath it. The bar along the phone's foot shows only while that act is off the screen: scrolled past above,
 * or, with the card still low on the screen, before the goal line comes onto the screen. At most one Apply is in view
 * at a time, and the bar never covers the goal: once the act has scrolled past, so has the goal above it, and below,
 * the bar gives way as soon as the goal comes onto the screen.
 *
 * 1.3.38 made the bar wait until the goal scrolled clear above it, so Apply was off the first screen. This replaces it.
 */
import { useEffect, useState, type RefObject } from "react";

/**
 * Whether the bar shows. Above: the in-flow act has scrolled past the top (its bottom at or above `topInset`, the
 * sticky header's foot). Below: the goal line is not yet on the screen, so the bar covers only what comes before it; a
 * card with no goal line reads whether the act is still under the bar line. In between (the goal on the screen, the
 * act not yet) the bar waits: the goal is never covered, and Apply comes into view with a little more scroll. Null
 * rects (nothing laid out): no bar.
 */
export function applyBarShows(act: { top: number; bottom: number } | null, viewport: number, tabbar: number, bar: number, topInset = 0, goalTop: number | null = null): boolean {
  if (!act) return false;
  if (act.bottom <= topInset) return true;
  // The goal not yet on the screen at all: nothing the bar could cover. No goal line: the act still under the bar line.
  return goalTop !== null ? goalTop >= viewport - tabbar : act.top >= viewport - tabbar - bar;
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

/** The card's goal line (or its one-minute box, when it writes no goal), which the bar must never cover. */
function goalOf(act: HTMLElement): HTMLElement | null {
  const card = act.closest<HTMLElement>("[data-full-role-card]");
  return card?.querySelector<HTMLElement>("[data-one-minute-goal]") ?? card?.querySelector<HTMLElement>("[data-role-one-minute]") ?? null;
}

function measure(act: HTMLElement): boolean {
  const r = act.getBoundingClientRect();
  // Not laid out (a test's document, or a hidden card): the act in the flow stands, and there is no bar.
  if (r.width === 0 && r.height === 0) return false;
  // The bar holds the same act with its padding, so the act's own height plus the bar's padding is the bar's height.
  // The goal counts only while it sits above the act. Since 1.3.43 a phone's act comes right after the title, above
  // the goal, so the bar reads the act's own top: below, it covers only what comes before the act.
  const goal = goalOf(act);
  const goalTop = goal ? goal.getBoundingClientRect().top : null;
  return applyBarShows({ top: r.top, bottom: r.bottom }, window.innerHeight, tabbarPx(act), act.offsetHeight + 24, topInsetPx(), goalTop !== null && goalTop < r.top ? goalTop : null);
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
