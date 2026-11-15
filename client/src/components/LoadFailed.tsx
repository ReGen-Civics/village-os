/**
 * A PAGE'S DATA DID NOT LOAD: say so, and offer to ask again.
 *
 * Kept apart from "closed" and "nothing here" on purpose. A failed read that
 * reads as "Not open right now" hides an outage behind a decision nobody made
 * (performance QA sweep, resilience P2-6). The page decides what "again"
 * means; usually it clears its state to loading and runs its read once more.
 */
import { Trans } from "@lingui/react/macro";
import { BTN_PRIMARY } from "@/components/journey/look";

export default function LoadFailed({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-start gap-4">
      <p role="alert" className="text-foreground">
        <Trans>This page didn't load. Check your connection and try again.</Trans>
      </p>
      <button type="button" onClick={onRetry} className={BTN_PRIMARY}>
        <Trans context="a page's data failed to load: read it again">Try again</Trans>
      </button>
    </div>
  );
}
