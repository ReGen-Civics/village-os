/**
 * THE VIDEO BEHIND THE ENTRANCE (dials `entrance.background_*`, shared/entrance.ts `backdropOf`).
 *
 * The lead's pick (26 Nov 2026, "go with B", with a glassy card): the first screen is the video itself,
 * with the welcome on a soft shade at the bottom and one "Come in" door; the form follows on a glass
 * card that rises into view over the same video, which stays in place while the page scrolls. A device
 * that asks for less motion gets the still image and no rise. Every text colour here was measured
 * against the poster and four frames of a real video at AA or better (the PR says how).
 */
import { useEffect, useState } from "react";
import type { EntranceBackdrop as Backdrop } from "@shared/entrance";

/** Whether the device asks for less motion, read once and kept current. */
export function useReducedMotion(): boolean {
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

/** The world around the video: `flow-root` keeps the card's margin inside it, so no plain band opens under the header. */
export const VIDEO_WORLD = "flow-root";

/** The first screen: the video, and a shade that deepens toward the words at the bottom. */
export const HERO =
  "relative z-10 flex min-h-[calc(100svh-6rem)] flex-col justify-end pb-[12svh] pt-24 bg-[linear-gradient(to_top,rgba(10,22,20,0.86)_0%,rgba(10,22,20,0.76)_50%,rgba(10,22,20,0.5)_76%,rgba(10,22,20,0)_100%)]"; // theme-ok: a shade over the village's own video, dark in every palette so the white words on it hold AA

/** The words on the first screen, white on the shade. */
export const ON_VIDEO = {
  ring: "inline-flex size-12 items-center justify-center rounded-full border-2 border-white text-white",
  eyebrow: "text-xs font-semibold uppercase tracking-widest text-white",
  h1: "font-display text-4xl leading-tight text-white sm:text-6xl",
  lede: "max-w-2xl text-lg leading-relaxed text-white",
  hint: "text-sm leading-relaxed text-white",
  link: "font-medium text-white underline underline-offset-4",
} as const;

/** The glass card the form sits on: the video shows through it, softened, and it rises into view. */
export const GLASS =
  "entrance-rise relative z-10 mx-3 mb-[10svh] w-auto rounded-2xl border border-border bg-card/80 px-5 shadow-sm backdrop-blur-xl sm:mx-auto sm:w-full sm:px-10";

/** The form's own panel on the glass: an edge and a lighter wash, so the glass reads through it. */
export const GLASS_PANEL = "rounded-2xl border-2 border-notice/60 bg-card/50 p-5 sm:p-8";

export default function EntranceBackdrop({ backdrop }: { backdrop: Backdrop }) {
  const reduce = useReducedMotion();
  return (
    <div className="pointer-events-none absolute inset-0 overflow-clip" aria-hidden="true" data-entrance-backdrop="">
      {reduce ? (
        backdrop.poster ? <img src={backdrop.poster} alt="" className="sticky top-0 h-svh w-full object-cover" /> : null
      ) : (
        <video className="sticky top-0 h-svh w-full object-cover" autoPlay muted loop playsInline preload="metadata" poster={backdrop.poster || undefined}>
          {backdrop.mobile && <source src={backdrop.mobile} media="(max-width: 768px)" />}
          <source src={backdrop.video} />
        </video>
      )}
    </div>
  );
}
