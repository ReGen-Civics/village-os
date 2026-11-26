/**
 * THE LAST DAY TO APPLY, MADE OBVIOUS (the lead, 24 Nov 2026: "Let's add a big stamp on desktop in the space on the
 * right of the card that's open, and find another way of showing it on mobile so that it's really obvious the cut off
 * date to apply"). Chosen from the phase 1 options (24 Nov 2026): the tilted seal and the ribbon.
 *
 *   - From 1024px, one straight line of plain text in the card's right column under "Read the card": "Applications
 *     close Monday 30 November", and inside the last week the days left (the lead, 26 Nov 2026: "just text", in place
 *     of the tilted seal).
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

/**
 * The last day to apply, for the card's right column on a desktop: one quiet line of plain text, straight, in the
 * card's own muted words (the lead, 26 Nov 2026: "straighten it up and make it just text, we don't want it to be too
 * much standing out"). It was a tilted gold seal. The line is the whole sentence, so a screen reader hears what is
 * shown and needs no copy of its own.
 */
export function ApplyByStamp({ parts, className = "" }: { parts: ApplyByParts; className?: string }) {
  return (
    // Close under its button (the column's 40px gap is for the card beside it), centred and balanced, and the days
    // left never split across a line.
    <p className={`-mt-7 max-w-64 text-balance text-center text-sm text-muted-foreground ${className}`} data-apply-stamp="">
      {parts.label}
      {parts.soon && <span className="whitespace-nowrap" data-apply-soon="">{` · ${parts.soon}`}</span>}
    </p>
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
