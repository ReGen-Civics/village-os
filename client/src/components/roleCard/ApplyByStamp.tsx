/**
 * THE LAST DAY TO APPLY, MADE OBVIOUS (the lead, 24 Nov 2026: "Let's add a big stamp on desktop in the space on the
 * right of the card that's open, and find another way of showing it on mobile so that it's really obvious the cut off
 * date to apply").
 *
 *   - From 1024px, a seal in the village's true gold (the dash gold, as the tile it replaces) in the card's right
 *     column under "Read the card": "APPLY BY" over the day and month, the weekday small, and inside the last week a
 *     band with the days left. Tilted a few degrees like an ink stamp, or straight.
 *   - Below 1024px the date rides on the painting: a gold ribbon across its top edge ("Applications close Mon 30 Nov"),
 *     or a smaller seal on its bottom-right corner.
 *
 * PHASE 1 (options): `?stamp=desktop-tilt|desktop-straight` and `?stampm=ribbon|corner` choose the look, so one build
 * shows every option. The date is real text throughout; the drawn pieces are hidden from a screen reader, which hears
 * one sentence instead ("Applications close Monday 30 November. 6 days left."). Nothing moves.
 */
import { CalendarClock } from "lucide-react";
import type { ApplyByParts } from "./frontWords";

export type DeskStamp = "tilt" | "straight";
export type PhoneStamp = "ribbon" | "corner";

/** The look the address asks for (phase 1 only), else the tilted seal and the ribbon. */
export function stampLook(search: string = typeof window !== "undefined" ? window.location.search : ""): { desk: DeskStamp; phone: PhoneStamp } {
  let q: URLSearchParams;
  try {
    q = new URLSearchParams(search);
  } catch {
    q = new URLSearchParams();
  }
  return { desk: q.get("stamp") === "desktop-straight" ? "straight" : "tilt", phone: q.get("stampm") === "corner" ? "corner" : "ribbon" };
}

/** The sentence a screen reader hears in place of the drawn pieces. */
const heard = (p: ApplyByParts) => (p.soon ? `${p.label}. ${p.soon}.` : `${p.label}.`);

/**
 * The seal. `lg` stands in the card's right column on a desktop; `sm` sits on the painting's corner on a phone, on its
 * own dark ground so the gold reads over any painting.
 */
export function ApplyByStamp({ parts, tilt, size = "lg", className = "" }: { parts: ApplyByParts; tilt: boolean; size?: "lg" | "sm"; className?: string }) {
  const lg = size === "lg";
  return (
    // The caller may place it (`absolute ...` on the painting); otherwise it stands in the flow.
    <div className={className || "relative"} data-apply-stamp={`${size}-${tilt ? "tilt" : "straight"}`}>
      <p className="sr-only">{heard(parts)}</p>
      <div className={`relative ${tilt ? (lg ? "-rotate-6" : "-rotate-3") : ""}`} aria-hidden="true">
        <div className={`grid place-items-center rounded-full border-2 border-dash-gold ${lg ? "size-40 bg-dash-gold/5 p-1.5" : "size-28 bg-card/90 p-1 shadow-sm"}`}>
          <div className="grid size-full content-center justify-items-center rounded-full border border-dashed border-dash-gold/70 text-center text-dash-gold-lit">
            <span className={`text-xs font-bold uppercase leading-tight tracking-widest ${lg ? "max-w-28" : "max-w-20"}`}>{parts.eyebrow}</span>
            <span className={`font-display leading-none ${lg ? "mt-1 text-5xl" : "text-3xl"}`}>{parts.day}</span>
            <span className={`font-bold uppercase tracking-widest ${lg ? "text-base" : "text-xs"}`}>{parts.month}</span>
            {lg && <span className="mt-0.5 text-xs uppercase tracking-widest text-dash-gold">{parts.weekday}</span>}
          </div>
        </div>
        {parts.soon && (
          <span className={`absolute left-1/2 -translate-x-1/2 whitespace-nowrap rounded-lg bg-dash-gold font-bold uppercase tracking-widest text-dash-gold-ink shadow-sm ${lg ? "-bottom-3 px-3 py-1 text-xs" : "-bottom-2 px-2 py-0.5 text-xs"}`} data-apply-soon="">
            {parts.soon}
          </span>
        )}
      </div>
    </div>
  );
}

/** The ribbon: a gold band across the painting's top edge, the days left in a dark chip inside the last week. */
export function ApplyByRibbon({ parts, className = "" }: { parts: ApplyByParts; className?: string }) {
  return (
    <div className={`flex flex-wrap items-center justify-center gap-x-2 gap-y-1 bg-dash-gold px-3 py-2 text-center text-sm font-semibold text-dash-gold-ink shadow-sm ${className}`} data-apply-ribbon="">
      <p className="sr-only">{heard(parts)}</p>
      <span className="inline-flex items-center gap-1.5" aria-hidden="true">
        <CalendarClock className="size-4 shrink-0" />
        {parts.line}
      </span>
      {parts.soon && (
        <span className="whitespace-nowrap rounded-full bg-dash-gold-ink px-2 py-0.5 text-xs font-bold text-dash-gold-lit" aria-hidden="true" data-apply-soon="">
          {parts.soon}
        </span>
      )}
    </div>
  );
}
