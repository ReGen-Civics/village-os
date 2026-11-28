/**
 * THE PHONE KEYBOARD, AS TWO CSS VARIABLES (QA round 2 on #1885, 27 Nov 2026).
 *
 * On iOS Safari and Android Chrome the keyboard shrinks only the VISUAL viewport: the layout viewport, which every
 * `position: fixed` panel is pinned to, stays full height, so a panel docked at the bottom sits under the keyboard
 * and Send with it. While any chat box is mounted this keeps two values on <html>:
 *
 *   --kb    how much of the layout viewport's foot the keyboard covers: innerHeight - (vv.offsetTop + vv.height)
 *   --vvh   the visual viewport's height
 *
 * A docked panel takes `bottom: max(<its usual>, calc(var(--kb) + .5rem))` and caps its height at
 * `calc(var(--vvh) - 1rem)`, so it rides above the keyboard. Both read 0px / 100vh when nothing is up.
 */
import { useSyncExternalStore } from "react";

let inset = 0;
const listeners = new Set<() => void>();

function measure(): void {
  const vv = window.visualViewport;
  if (!vv) return;
  const next = Math.max(0, Math.round(window.innerHeight - (vv.offsetTop + vv.height)));
  const root = document.documentElement;
  root.style.setProperty("--kb", `${next}px`);
  root.style.setProperty("--vvh", `${Math.round(vv.height)}px`);
  if (next !== inset) {
    inset = next;
    listeners.forEach((l) => l());
  }
}

function subscribe(listener: () => void): () => void {
  const vv = typeof window !== "undefined" ? window.visualViewport : null;
  if (listeners.size === 0 && vv) {
    vv.addEventListener("resize", measure);
    vv.addEventListener("scroll", measure);
    measure();
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && vv) {
      vv.removeEventListener("resize", measure);
      vv.removeEventListener("scroll", measure);
      document.documentElement.style.removeProperty("--kb");
      document.documentElement.style.removeProperty("--vvh");
      inset = 0;
    }
  };
}

/** How many pixels of the layout viewport's foot the on-screen keyboard covers now; 0 when none is up. */
export function useKeyboardInset(): number {
  return useSyncExternalStore(
    subscribe,
    () => inset,
    () => 0,
  );
}
