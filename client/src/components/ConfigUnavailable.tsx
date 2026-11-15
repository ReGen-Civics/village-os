/**
 * THE CARD A PAGE SHOWS WHEN THE VILLAGE'S CONFIG WOULD NOT LOAD.
 *
 * The home page, /steward and /visit wait on /api/game/config before they
 * draw anything, so neither village's page flashes on the other's. When every
 * try at it fails (lib/gameApi.ts, CONFIG_RETRY_DELAYS_MS), they show this
 * instead of a blank screen (performance QA sweep, resilience P1-1). The
 * button asks again without a reload; a success redraws the page underneath.
 *
 * It stands on its own, outside the shell, because the shell reads the same
 * config and has nothing to draw without it.
 */
import { useState } from "react";
import { Trans } from "@lingui/react/macro";
import { RotateCcw } from "lucide-react";
import { retryGameConfig } from "@/lib/gameApi";

export default function ConfigUnavailable() {
  const [trying, setTrying] = useState(false);

  async function tryAgain() {
    setTrying(true);
    await retryGameConfig();
    setTrying(false);
  }

  return (
    <div className="relative sheet-night flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="flex w-full max-w-md flex-col items-center rounded-2xl border border-border bg-card p-6 text-center shadow-sm sm:p-8">
        <h1 role="alert" className="font-display text-2xl font-bold text-card-foreground mb-3">
          <Trans>We couldn't reach the village just now</Trans>
        </h1>
        <p className="text-base leading-relaxed text-muted-foreground mb-6">
          <Trans>Check your connection, then try again.</Trans>
        </p>
        <button
          type="button"
          onClick={() => void tryAgain()}
          disabled={trying}
          className="jw-btn inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-notice px-5 py-2 font-semibold text-background hover:bg-notice/90 disabled:opacity-50 cursor-pointer"
        >
          <RotateCcw size={16} aria-hidden="true" />
          {trying ? (
            <Trans context="config card: asking the server again">Trying again...</Trans>
          ) : (
            <Trans context="config card: ask the server again">Try again</Trans>
          )}
        </button>
      </div>
    </div>
  );
}
