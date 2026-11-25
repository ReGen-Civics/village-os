/**
 * THE VIDEO BEHIND THE ENTRANCE (dials `entrance.background_*`, shared/entrance.ts `backdropOf`). It plays
 * muted and looping behind the card, a phone gets the smaller copy when the village set one, and a visitor
 * whose device asks for less motion sees the still image instead. It is decoration only: hidden from
 * screen readers, and never in the way of a click.
 */
import { useEffect, useState } from "react";
import type { EntranceBackdrop as Backdrop } from "@shared/entrance";

/** Whether the device asks for less motion, read once and kept current. */
function useReducedMotion(): boolean {
  const query = "(prefers-reduced-motion: reduce)";
  const [reduce, setReduce] = useState(() => typeof window !== "undefined" && !!window.matchMedia?.(query).matches);
  useEffect(() => {
    const m = window.matchMedia?.(query);
    if (!m) return;
    const on = () => setReduce(m.matches);
    m.addEventListener?.("change", on);
    return () => m.removeEventListener?.("change", on);
  }, []);
  return reduce;
}

/** The section's classes when a video plays behind it: the card floats, readable over any frame. */
export const FLOATING = "relative z-10 mx-3 my-6 w-auto rounded-2xl sm:mx-auto sm:w-full border border-border bg-card/90 px-5 shadow-sm backdrop-blur-md sm:my-14 sm:px-10";

export default function EntranceBackdrop({ backdrop }: { backdrop: Backdrop }) {
  const reduce = useReducedMotion();
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true" data-entrance-backdrop="">
      {reduce ? (
        backdrop.poster ? <img src={backdrop.poster} alt="" className="size-full object-cover" /> : null
      ) : (
        <video className="size-full object-cover" autoPlay muted loop playsInline preload="metadata" poster={backdrop.poster || undefined}>
          {backdrop.mobile && <source src={backdrop.mobile} media="(max-width: 768px)" />}
          <source src={backdrop.video} />
        </video>
      )}
      <div className="absolute inset-0 bg-background/30" />
    </div>
  );
}
