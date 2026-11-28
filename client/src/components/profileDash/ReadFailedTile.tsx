/**
 * A READ THAT FAILED, SAID ON THE PROFILE IN ONE SHAPE: the bar's tile, the sentence, and "Try again"
 * (QA round 2 on the portal's next moves, 27 Nov 2026). The member's quests, their roles and their card
 * each say it the same way, so a failure never reads as an empty section and never as three styles.
 *
 * `night` draws it inside the player card, on the card's own tile (`pc-box`) with its own pill. The
 * sheet's tile there would take the weathered paper in light mode (seaChart.css repaints a bordered
 * `bg-muted` tile), and the night card's moonlit words on cream measured 1.9:1 (QA round 3).
 */
import { useLingui } from "@lingui/react/macro";
import { BTN_SECONDARY, TILE } from "@/components/journey/look";

export default function ReadFailedTile({
  words,
  onRetry,
  name,
  night = false,
}: {
  words: string;
  onRetry: () => void;
  name: string;
  night?: boolean;
}) {
  const { t } = useLingui();
  const again = t({ message: "Try again", context: "profile: ask again for a read that failed" });
  if (night) {
    return (
      <div role="status" className="pc-box" data-read-failed={name}>
        <p className="m-0 pc-f14">{words}</p>
        <button type="button" onClick={onRetry} className="pc-tab min-h-11 min-w-11 justify-self-start">
          {again}
        </button>
      </div>
    );
  }
  return (
    <div role="status" className={`flex flex-wrap items-center gap-3 ${TILE}`} data-read-failed={name}>
      <p className="m-0 text-foreground">{words}</p>
      <button type="button" onClick={onRetry} className={`${BTN_SECONDARY} min-w-11`}>
        {again}
      </button>
    </div>
  );
}
