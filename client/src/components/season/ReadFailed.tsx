/**
 * A read on the season page that failed: the sentence, in the panel that
 * failed, with "Try again" beside it (the game UI bar's failed-read state).
 */
import { Trans } from "@lingui/react/macro";
import { BTN_SECONDARY, TILE } from "@/components/journey/look";

export default function ReadFailed({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div
      className={`${TILE} flex flex-wrap items-center justify-between gap-3`}
    >
      <p role="alert" className="text-foreground">
        {message}
      </p>
      <button type="button" className={BTN_SECONDARY} onClick={onRetry}>
        <Trans context="season page">Try again</Trans>
      </button>
    </div>
  );
}
