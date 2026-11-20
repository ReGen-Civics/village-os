/**
 * WHEN THE PHONE'S APPLY BAR RIDES THE SCREEN (screenshot check of 1.3.38): the bar along a phone's foot covered
 * "the role in one minute" goal on the first screen. It now sticks only once the goal line sits clear above the
 * place the bar would take; until then it waits in its own slot at the card's end, in the flow, so nothing covers
 * the goal and the act is still drawn once. The bar never moves the page either way: a sticky box keeps its slot.
 */
import { useEffect, useState, type RefObject } from "react";

/** Whether the bar may ride the screen: the goal's bottom edge is above the bar's top edge, were it stuck. */
export function applyBarMayStick(goalBottom: number | null, viewport: number, tabbar: number, bar: number): boolean {
  if (goalBottom === null) return true;
  return goalBottom <= viewport - tabbar - bar;
}

/** The card's goal line (or its summary, when it writes no goal), which the bar must never cover. */
function goalOf(bar: HTMLElement): HTMLElement | null {
  const card = bar.closest<HTMLElement>("[data-full-role-card]");
  return card?.querySelector<HTMLElement>("[data-one-minute-goal]") ?? card?.querySelector<HTMLElement>("[data-role-one-minute]") ?? null;
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

function measure(el: HTMLElement): boolean {
  const goal = goalOf(el);
  const tabbar = tabbarPx(el);
  return applyBarMayStick(goal ? goal.getBoundingClientRect().bottom : null, window.innerHeight, tabbar, el.offsetHeight);
}

export function useApplyBarStuck(bar: RefObject<HTMLElement | null>, on: boolean): boolean {
  const [stuck, setStuck] = useState(true);
  // After every render of the card too: its words arrive after it mounts, and the goal moves when they do.
  useEffect(() => {
    if (on && bar.current && typeof window !== "undefined") {
      const next = measure(bar.current);
      if (next !== stuck) setStuck(next);
    }
  });
  useEffect(() => {
    const el = bar.current;
    if (!on || !el || typeof window === "undefined") return;
    let frame = 0;
    const check = () => {
      frame = 0;
      setStuck(measure(el));
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
  }, [bar, on]);
  return stuck;
}
