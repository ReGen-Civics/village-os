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
import { BTN_PRIMARY, BTN_SECONDARY, CARD_FEATURED, EYEBROW, HINT, LINK, NOTE, STATEMENT } from "@/components/journey/look";

/** How long the page settles before the card may show by itself. */
export const OFFER_DELAY_MS = 1500;

export default function InstallCard({ auto }: { auto: boolean }) {
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
    return (
      <p className="text-center">
        <button type="button" className={LINK} onClick={() => setOpen(true)}>
          <Trans context="protocols install card">Add to your phone</Trans>
        </button>
      </p>
    );
  }

  return (
    <section className={CARD_FEATURED} aria-labelledby="install-title" role="dialog" aria-modal="false">
      <p className={EYEBROW}>
        <Trans context="protocols install card">Works with no signal</Trans>
      </p>
      <h2 id="install-title" className={`${STATEMENT} mt-1`}>
        <Trans context="protocols install card">Add the protocols to your phone</Trans>
      </h2>
      {road === "prompt" ? (
        <>
          <p className={`${NOTE} mt-2`}>
            <Trans context="protocols install card">They open from your home screen like an app, and work when there is no signal.</Trans>
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              className={BTN_PRIMARY}
              onClick={async () => {
                const outcome = await promptInstall();
                if (outcome === "accepted") setInstalled(true);
                else if (outcome === "dismissed") dismiss();
                else setRoad(installRoad(null));
              }}
            >
              <Trans context="protocols install card">Add to home screen</Trans>
            </button>
            <button type="button" className={BTN_SECONDARY} onClick={dismiss}>
              <Trans context="protocols install card">Not now</Trans>
            </button>
          </div>
        </>
      ) : (
        <>
          <ol className={`${NOTE} mt-3 list-decimal space-y-1 pl-5`}>
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
          <p className={`${HINT} mt-3`}>
            <Trans context="protocols install card">Then open it once from your home screen while you have signal and sign in. After that it works with no signal.</Trans>
          </p>
          <div className="mt-4">
            <button type="button" className={BTN_SECONDARY} onClick={dismiss}>
              <Trans context="protocols install card">Done</Trans>
            </button>
          </div>
        </>
      )}
    </section>
  );
}
