/**
 * THE LAST DAY TO APPLY (the lead, 24 Nov 2026: "really obvious the cut off date to apply"; the team, 26 Nov 2026: the
 * tilted seal was "a bit disruptive" and "salesy", so "just keep it the text").
 *
 *   - From 1024px, under "Read the card" in the card's right column.
 *   - Below 1024px, in one row above the painting.
 *
 * Both draw "Apply by 30 November" in semibold, and inside the last week the days left in the accent. The date is
 * real text; a screen reader hears one sentence instead ("Applications close Monday 30 November. 6 days left."). Nothing
 * moves.
 */
import type { ApplyByParts } from "./frontWords";

/** The sentence a screen reader hears in place of the drawn pieces. */
const heard = (p: ApplyByParts) => (p.soon ? `${p.label}. ${p.soon}.` : `${p.label}.`);

/**
 * The plain words both places draw (the team, 26 Nov 2026: "remove this circle and just leave apply by ... not tilted
 * ... Keep it simple ... Just keep it the text"): "Apply by 30 November" in the card's own ink, its weight what makes
 * it noticed, and inside the last week the days left in the village's accent. No circle, no tilt, no band, no gold.
 * A screen reader hears the whole sentence with the weekday instead.
 */
function PlainApplyBy({ parts }: { parts: ApplyByParts }) {
  return (
    <>
      <p className="sr-only">{heard(parts)}</p>
      <span aria-hidden="true" className="font-semibold text-card-foreground">
        {parts.plain}
      </span>
      {parts.soon && (
        <span aria-hidden="true" className="whitespace-nowrap text-sm font-semibold text-notice" data-apply-soon="">
          {parts.soon}
        </span>
      )}
    </>
  );
}

/** From 1024px: under "Read the card", close to its button (the column's 40px gap is for the card beside it). */
export function ApplyByStamp({ parts, className = "" }: { parts: ApplyByParts; className?: string }) {
  return (
    // The caller's class shows or hides it (hidden lg:block); the stacking sits inside, so the two never fight.
    <div className={className} data-apply-stamp="">
      <div className="-mt-7 flex flex-col items-center gap-0.5 text-center">
        <PlainApplyBy parts={parts} />
      </div>
    </div>
  );
}

/** Below 1024px: the same words in one quiet row above the painting, in place of the gold ribbon. */
export function ApplyByRibbon({ parts, className = "" }: { parts: ApplyByParts; className?: string }) {
  return (
    <div className={`flex flex-wrap items-baseline justify-center gap-x-2 gap-y-0.5 px-3 py-2 text-center ${className}`} data-apply-ribbon="">
      <PlainApplyBy parts={parts} />
    </div>
  );
}
