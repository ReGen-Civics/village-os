/**
 * /reset: a fresh start for this device, by a link we hand to a member whose
 * phone is stuck on an old version. No sign-in, no question to answer: the
 * link is the tap. It clears the site's workers, caches and storage, keeps
 * any draft and the sign-in (lib/deviceReset.ts says which keys and why),
 * and says in one line what it did.
 *
 * THE PAGE WAITS FOR A TAP. It used to go home by itself after 2.5 seconds,
 * which left no time to use the language selector or read the line (copy
 * sweep on #1272). Now it stays until the member taps "Go home".
 *
 * THE SIGN-IN STAYS unless the member asks. The link is one anybody can
 * send, so it may not sign anybody out by itself. A member who is signed in
 * also gets an "Also sign me out" button; signing out goes through `logout`,
 * which ends the session on the server too.
 *
 * It renders without the shell, like the 404, so a broken header or a stuck
 * sign-in cannot stand between a member and the fix.
 */
import { useEffect, useState } from "react";
import { Trans } from "@lingui/react/macro";
import { BTN_PRIMARY, BTN_SECONDARY, CARD, H2, HINT, NOTE, WORLD } from "@/components/journey/look";
import { useAuth } from "@/contexts/AuthContext";
import { PageLanguageBar } from "@/i18n/PageLanguageBar";
import { resetDevice, type ResetResult } from "@/lib/deviceReset";

export default function Reset() {
  const [result, setResult] = useState<ResetResult | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const { logout } = useAuth();

  useEffect(() => {
    let left = false;
    void resetDevice().then((r) => {
      if (!left) setResult(r);
    });
    return () => {
      left = true;
    };
  }, []);

  async function signOut() {
    setSigningOut(true);
    await logout();
    window.location.replace("/");
  }

  return (
    <main className={`${WORLD} flex w-full flex-col px-4 pb-10`}>
      {/* The language selector (spec i18n US2): this page renders without the
          shell. The choice also lives in a cookie, so the reset keeps it. */}
      <PageLanguageBar tone="onSheet" className="pt-3" />
      <div className="flex flex-1 items-center justify-center py-4 sm:py-10">
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
          <div className="mt-5 flex flex-col items-center gap-3">
            {result.signedIn && (
              <p className={HINT}>
                <Trans>You're still signed in.</Trans>
              </p>
            )}
            <a href="/" className={BTN_PRIMARY}>
              <Trans context="fresh start page: go to the home page now">Go home</Trans>
            </a>
            {result.signedIn && (
              <button type="button" onClick={() => void signOut()} disabled={signingOut} className={BTN_SECONDARY}>
                <Trans context="fresh start page: sign out on this device too">Also sign me out</Trans>
              </button>
            )}
          </div>
        )}
      </div>
      </div>
    </main>
  );
}
