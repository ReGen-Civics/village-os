/**
 * "Add to your phone", on the protocols page (lib/installPrompt.ts holds the
 * rules: when it may show by itself, and the two roads).
 *
 * It shows by itself once the page has drawn and settled, never while running
 * as an installed app, never after an install, and a dismissal keeps it away
 * for a month (three dismissals, for good). The quiet link under the page opens
 * it at any time on a browser that can install.
 */
import { useEffect, useState } from "react";
import { Trans } from "@lingui/react/macro";
import {
  heldInstallPrompt,
  installRoad,
  mayOfferNow,
  ownInstallOffer,
  promptInstall,
  readInstallMemory,
  rememberDismissed,
  runningInstalled,
  type InstallRoad,
} from "@/lib/installPrompt";
import { Smartphone } from "lucide-react";
import { BTN_PRIMARY, LINK } from "@/components/journey/look";

/** How long the page settles before the card may show by itself. */
export const OFFER_DELAY_MS = 1500;

/** `quietLink`: keep a small "Add to your phone" link when the offer is closed (the list page). */
export default function InstallCard({ auto, quietLink = true }: { auto: boolean; quietLink?: boolean }) {
  const [road, setRoad] = useState<InstallRoad>(() => installRoad(heldInstallPrompt()));
  const [open, setOpen] = useState(false);
  const [installed, setInstalled] = useState(() => runningInstalled());

  useEffect(() => ownInstallOffer(() => setRoad(installRoad(heldInstallPrompt()))), []);

  useEffect(() => {
    if (!auto || installed || road === "none") return;
    const t = setTimeout(() => {
      if (mayOfferNow(readInstallMemory(), runningInstalled())) setOpen(true);
    }, OFFER_DELAY_MS);
    return () => clearTimeout(t);
  }, [auto, installed, road]);

  if (installed || road === "none") return null;

  const dismiss = () => {
    rememberDismissed();
    setOpen(false);
  };

  if (!open) {
    if (!quietLink) return null;
    return (
      <p className="text-center">
        <button type="button" className={LINK} onClick={() => setOpen(true)}>
          <Trans context="protocols install card">Add to your phone</Trans>
        </button>
      </p>
    );
  }

  return (
    <section className={BANNER} aria-labelledby="install-title" role="dialog" aria-modal="false">
      <div className={BANNER_ICON} aria-hidden="true">
        <Smartphone className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <h2 id="install-title" className="text-[15px] font-semibold text-foreground">
          <Trans context="protocols install card">Add the protocols to your phone</Trans>
        </h2>
        {road === "prompt" ? (
          <>
            <p className="text-xs text-muted-foreground">
              <Trans context="protocols install card">They open from your home screen like an app, and work when there is no signal.</Trans>
            </p>
            <div className="mt-2.5 flex flex-wrap items-center gap-3">
              <button
                type="button"
                className={`${BTN_PRIMARY} min-h-10 px-4 text-sm`}
                onClick={async () => {
                  const outcome = await promptInstall();
                  if (outcome === "accepted") setInstalled(true);
                  else if (outcome === "dismissed") dismiss();
                  else setRoad(installRoad(null));
                }}
              >
                <Trans context="protocols install card">Add to home screen</Trans>
              </button>
              <button type="button" className={`${LINK} min-h-10 text-sm`} onClick={dismiss}>
                <Trans context="protocols install card">Not now</Trans>
              </button>
            </div>
          </>
        ) : (
          <>
            <ol className="mt-1 list-decimal space-y-0.5 pl-5 text-sm text-foreground">
              <li>
                <Trans context="protocols install card">
                  Tap the Share button <span aria-hidden="true">(the square with an arrow)</span> at the bottom of Safari.
                </Trans>
              </li>
              <li>
                <Trans context="protocols install card">Scroll down and tap Add to Home Screen.</Trans>
              </li>
              <li>
                <Trans context="protocols install card">Tap Add.</Trans>
              </li>
            </ol>
            <p className="mt-1.5 text-xs text-muted-foreground">
              <Trans context="protocols install card">Then open it once from your home screen while you have signal and sign in. After that it works with no signal.</Trans>
            </p>
            <button type="button" className={`${LINK} mt-1 min-h-10 text-sm`} onClick={dismiss}>
              <Trans context="protocols install card">Done</Trans>
            </button>
          </>
        )}
      </div>
    </section>
  );
}

/** The design's calm notice (`.banner`), the same frame as the page's offline notice. */
const BANNER = "flex items-start gap-3 rounded-[14px] border border-open/25 bg-card px-3.5 py-3";
const BANNER_ICON = "grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-open/15 text-open";
