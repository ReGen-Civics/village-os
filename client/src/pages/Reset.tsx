/**
 * /reset: a fresh start for this device, by a link we hand to a member whose
 * phone is stuck on an old version. No sign-in, no question to answer: the
 * link is the tap. It clears the site's workers, caches and storage, keeps
 * any draft (lib/deviceReset.ts says which keys and why), says in one line
 * what it did, and goes home.
 *
 * It renders without the shell, like the 404, so a broken header or a stuck
 * sign-in cannot stand between a member and the fix.
 */
import { useEffect, useState } from "react";
import { Trans } from "@lingui/react/macro";
import { CARD, H2, HINT, LINK, NOTE, WORLD } from "@/components/journey/look";
import { resetDevice, type ResetResult } from "@/lib/deviceReset";

/** Long enough to read one line, short enough that nobody wonders what to do. */
const HOME_AFTER_MS = 2500;

export default function Reset() {
  const [result, setResult] = useState<ResetResult | null>(null);

  useEffect(() => {
    let left = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    void resetDevice().then((r) => {
      if (left) return;
      setResult(r);
      timer = setTimeout(() => window.location.replace("/"), HOME_AFTER_MS);
    });
    return () => {
      left = true;
      if (timer) clearTimeout(timer);
    };
  }, []);

  return (
    <main className={`${WORLD} flex w-full items-center justify-center px-4 py-10`}>
      <div className={`${CARD} w-full max-w-md text-center`}>
        <h1 className={H2}>
          <Trans>A fresh start for this device</Trans>
        </h1>
        <p role="status" className={`${NOTE} mt-4`}>
          {result ? (
            result.kept > 0 ? (
              <Trans>Done. We cleared this site's saved files and old version from this device, and kept your drafts.</Trans>
            ) : (
              <Trans>Done. We cleared this site's saved files and old version from this device.</Trans>
            )
          ) : (
            <Trans>Clearing this site from your device...</Trans>
          )}
        </p>
        {result && (
          <p className={`${HINT} mt-3`}>
            <Trans>Taking you home now. You may need to sign in again.</Trans>{" "}
            <a href="/" className={LINK}>
              <Trans context="fresh start page: go to the home page now">Go home</Trans>
            </a>
          </p>
        )}
      </div>
    </main>
  );
}
