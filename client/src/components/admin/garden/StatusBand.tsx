/**
 * THE STATUS BAND: the one line across the top that says the village's state
 * in plain words.
 *
 * It takes its words as props and fetches nothing: the label is the launch
 * label another slice computes (unclaimed, setup, vote open, and the rest),
 * the sentence says what that means tonight, and the action is the one door
 * that goes with it.
 */
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
  className?: string;
}

export default function StatusBand({ label, sentence, action, className = "" }: StatusBandProps) {
  const { t } = useLingui();
  return (
    <section aria-label={t({ message: "Where the village stands", context: "garden status band" })} className={`gd-band flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2 sm:px-6 ${className}`.trim()}>
      <p className="m-0 min-w-0 grow basis-64 text-sm">
        <strong className="mr-3 font-display text-lg font-normal text-notice">{label}</strong>
        {sentence ? <span className="text-muted-foreground">{sentence}</span> : null}
      </p>
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
    </section>
  );
}
