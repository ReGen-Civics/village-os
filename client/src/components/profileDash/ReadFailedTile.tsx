/**
 * A READ THAT FAILED, SAID ON THE PROFILE IN ONE SHAPE: the bar's tile, the sentence, and "Try again"
 * (QA round 2 on the portal's next moves, 27 Nov 2026). The member's quests, their roles and their card
 * each say it the same way, so a failure never reads as an empty section and never as three styles.
 */
import { useLingui } from "@lingui/react/macro";
import { BTN_SECONDARY, TILE } from "@/components/journey/look";

export default function ReadFailedTile({ words, onRetry, name }: { words: string; onRetry: () => void; name: string }) {
  const { t } = useLingui();
  return (
    <div role="status" className={`flex flex-wrap items-center gap-3 ${TILE}`} data-read-failed={name}>
      <p className="m-0 text-foreground">{words}</p>
      <button type="button" onClick={onRetry} className={`${BTN_SECONDARY} min-w-11`}>
        {t({ message: "Try again", context: "profile: ask again for a read that failed" })}
      </button>
    </div>
  );
}
