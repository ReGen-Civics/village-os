/**
 * THE EXAMPLE STAMP (the lead, 24 Nov 2026): "put a big 'example' stamp on
 * the existing cards". An ink stamp in the village's gold, outlined and a
 * little crooked, laid over a quest that is an example of the work to come.
 *
 * Real text, never a picture of text. The visible word is short ("Example")
 * and the accessible name is the whole thought ("Example quest"), so a screen
 * reader hears what the stamp means. Where the stamp sits inside a link that
 * carries its own `aria-label` (the board's card), the card puts the same
 * words into that label, because a link's label replaces its children.
 *
 * CONTRAST. The stamp sits on a poster whose colour nobody controls, so it
 * carries its own ground: the panel colour at 95%, under the gold. Measured
 * over the worst poster (pure white or pure black showing through the 5%):
 * the sheet's default gold on the night panel 6.8:1, a teal-tinted village
 * gold 5.8:1, and the day gold on white on the quest's own page 5.0:1. AA for
 * body text in every case, and the stamp is large text besides.
 *
 * No motion: a stamp is already down when the page arrives.
 */
import { useLingui } from "@lingui/react/macro";

const LOOK =
  "pointer-events-none inline-block -rotate-6 select-none rounded-lg border-4 border-double border-notice bg-card/95 font-display font-bold uppercase tracking-widest text-notice shadow-sm";

const SIZE = {
  card: "px-4 py-1 text-2xl",
  page: "px-5 py-1.5 text-3xl sm:px-7 sm:py-2 sm:text-5xl",
} as const;

export default function ExampleStamp({
  size = "card",
  className = "",
}: {
  size?: keyof typeof SIZE;
  className?: string;
}) {
  const { t } = useLingui();
  return (
    <span className={`${LOOK} ${SIZE[size]} ${className}`} data-example-stamp>
      <span aria-hidden="true">{t({ message: "Example", context: "the ink stamp across a quest that is an example of the work to come" })}</span>
      <span className="sr-only">{t({ message: "Example quest", context: "the example stamp, read aloud" })}</span>
    </span>
  );
}

