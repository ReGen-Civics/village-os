/**
 * THE STATUS BAND: the one line across the top that says the village's state
 * in plain words.
 *
 * It takes its words as props and fetches nothing: the label is the launch
 * label another slice computes (unclaimed, setup, vote open, and the rest),
 * the sentence says what that means tonight, and the action is the one door
 * that goes with it. The season and the moon are the caller's words too: the
 * band marks the cycle with the real moon, and never with a countdown.
 */
import type { ReactNode } from "react";
import { Link } from "wouter";
import { useLingui } from "@lingui/react/macro";
import { BTN_NOTICE } from "@/components/journey/look";
import "./garden.css";

export interface StatusBandAction {
  /** The words on the door. */
  label: string;
  /** Where it leads. Given, the door is a link. */
  href?: string;
  /** What pressing it does. Given without `href`, the door is a button. */
  onPress?: () => void;
}

export interface StatusBandProps {
  /** The village's state, in a few plain words ("Tokens issuing, launch vote not yet held"). */
  label: string;
  /** One sentence on what that means. */
  sentence?: string;
  /** The one door that goes with it. */
  action?: StatusBandAction;
  /** The season the village is in, in its own words ("Season of Foundations"). */
  season?: string;
  /** Where the moon stands, in plain words ("Moon 3, waxing"). */
  moon?: string;
  /** A drawing of the moon, from the glyphs that already ship. Decoration beside the words. */
  moonGlyph?: ReactNode;
  /**
   * The page's switches, side by side: the view switch (the guide first, or the dashboard) and the lens toggle (the
   * Grounds, the Desk). Drawn in the band on every garden screen and in every dock state, so a person always sees
   * where they are and where else they can go; they wrap to a row of their own when the band is narrow. Left out,
   * the band draws none and a caller places its lens toggle where it always did.
   */
  switches?: ReactNode;
  /**
   * The way out, for now: the door to the old admin dashboard (SeeOldAdmin, ./oldAdmin.tsx). Drawn at the far end of
   * the band, after the switches and the band's own door, and under them when the band is narrow. Unlike the view
   * switch it is drawn at every width: a person on a phone must be able to reach the old admin too.
   */
  exit?: ReactNode;
  className?: string;
}

export default function StatusBand({ label, sentence, action, season, moon, moonGlyph, switches, exit, className = "" }: StatusBandProps) {
  const cycle = [season, moon].filter((w): w is string => typeof w === "string" && w.trim() !== "");
  const { t } = useLingui();
  return (
    <section aria-label={t({ message: "Where the village stands", context: "garden status band" })} className={`gd-band flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2 sm:px-6 ${className}`.trim()}>
      <p className="m-0 min-w-0 grow basis-64 text-sm">
        <strong className="mr-3 font-display text-lg font-normal text-notice">{label}</strong>
        {sentence ? <span className="text-muted-foreground">{sentence}</span> : null}
      </p>
      {cycle.length > 0 ? (
        <p data-testid="garden-band-cycle" className="m-0 flex items-center gap-2 text-xs text-muted-foreground">
          {moonGlyph ? <span aria-hidden="true" className="inline-flex">{moonGlyph}</span> : null}
          <span>{cycle.join(" · ")}</span>
        </p>
      ) : null}
      {switches ? (
        // `contents`: each switch is the band's own item, so one that has stepped back (a narrow screen) leaves no gap.
        <div className="contents" data-testid="garden-band-switches">
          {switches}
        </div>
      ) : null}
      {action ? (
        action.href ? (
          <Link href={action.href} className={BTN_NOTICE}>
            {action.label}
          </Link>
        ) : (
          <button type="button" onClick={action.onPress} className={BTN_NOTICE}>
            {action.label}
          </button>
        )
      ) : null}
      {exit ? (
        // Last in the band and last in the document. No rule hides it at any width: it is the one way to the old admin.
        <div className="flex items-center" data-testid="garden-band-exit">
          {exit}
        </div>
      ) : null}
    </section>
  );
}
