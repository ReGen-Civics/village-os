/**
 * THE LAST DAY TO APPLY, MADE OBVIOUS (the lead, 24 Nov 2026: "Let's add a big stamp on desktop in the space on the
 * right of the card that's open, and find another way of showing it on mobile so that it's really obvious the cut off
 * date to apply"). Chosen from the phase 1 options (24 Nov 2026): the tilted seal and the ribbon.
 *
 *   - From 1024px, a seal in the village's true gold (the dash gold, as the tile it replaces) in the card's right
 *     column under "Read the card": "APPLY BY" over the day and month, the weekday small, and inside the last week a
 *     band with the days left. Tilted a few degrees like an ink stamp, its words still crisp.
 *   - Below 1024px, a gold ribbon across the painting's top edge ("Applications close Mon 30 Nov"), above the painting
 *     so the whole subject stays in frame, with the days left in a dark chip inside the last week.
 *
 * The date is real text throughout; the drawn pieces are hidden from a screen reader, which hears one sentence instead
 * ("Applications close Monday 30 November. 6 days left."). Nothing moves.
 */
import { CalendarClock } from "lucide-react";
import type { ApplyByParts } from "./frontWords";

/** The sentence a screen reader hears in place of the drawn pieces. */
const heard = (p: ApplyByParts) => (p.soon ? `${p.label}. ${p.soon}.` : `${p.label}.`);

/** The seal, for the card's right column on a desktop. */
export function ApplyByStamp({ parts, className = "" }: { parts: ApplyByParts; className?: string }) {
  return (
    <div className={className} data-apply-stamp="">
      <p className="sr-only">{heard(parts)}</p>
      <div className="relative -rotate-6" aria-hidden="true">
        <div className="grid size-40 place-items-center rounded-full border-2 border-dash-gold bg-dash-gold/5 p-1.5">
          <div className="grid size-full content-center justify-items-center rounded-full border border-dashed border-dash-gold/70 text-center text-dash-gold-lit">
            <span className="max-w-28 text-xs font-bold uppercase leading-tight tracking-widest">{parts.eyebrow}</span>
            <span className="mt-1 font-display text-5xl leading-none">{parts.day}</span>
            <span className="text-base font-bold uppercase tracking-widest">{parts.month}</span>
            <span className="mt-0.5 text-xs uppercase tracking-widest text-dash-gold">{parts.weekday}</span>
          </div>
        </div>
        {parts.soon && (
          <span className="absolute -bottom-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-lg bg-dash-gold px-3 py-1 text-xs font-bold uppercase tracking-widest text-dash-gold-ink shadow-sm" data-apply-soon="">
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
