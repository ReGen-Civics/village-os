/**
 * /reset: a fresh start for this device, by a link we hand to a member whose
 * phone is stuck on an old version. No sign-in, no question to answer: the
 * link is the tap. It clears the site's workers, caches and storage, keeps
 * any draft and the sign-in (lib/deviceReset.ts says which keys and why),
 * says in one line what it did, and goes home.
 *
 * THE SIGN-IN STAYS unless the member asks. The link is one anybody can
 * send, so it may not sign anybody out by itself. A member who is signed in
 * gets an "Also sign me out" button instead of the automatic trip home, so
 * the choice cannot run out under them; signing out goes through `logout`,
 * which ends the session on the server too.
 *
 * It renders without the shell, like the 404, so a broken header or a stuck
 * sign-in cannot stand between a member and the fix.
 */
import { useEffect, useState } from "react";
import { Trans } from "@lingui/react/macro";
import { BTN_SECONDARY, CARD, H2, HINT, LINK, NOTE, WORLD } from "@/components/journey/look";
import { useAuth } from "@/contexts/AuthContext";
import { PageLanguageBar } from "@/i18n/PageLanguageBar";
import { resetDevice, type ResetResult } from "@/lib/deviceReset";

/** Long enough to read one line, short enough that nobody wonders what to do. */
export const HOME_AFTER_MS = 2500;

export default function Reset() {
  const [result, setResult] = useState<ResetResult | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const { logout } = useAuth();

  useEffect(() => {
    let left = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    void resetDevice().then((r) => {
      if (left) return;
      setResult(r);
      // Signed in: the member chooses, so nothing leaves the page under them.
      if (!r.signedIn) timer = setTimeout(() => window.location.replace("/"), HOME_AFTER_MS);
    });
    return () => {
      left = true;
      if (timer) clearTimeout(timer);
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
        {result && !result.signedIn && (
          <p className={`${HINT} mt-3`}>
            <Trans>Taking you home now.</Trans>{" "}
            <a href="/" className={LINK}>
              <Trans context="fresh start page: go to the home page now">Go home</Trans>
            </a>
          </p>
        )}
        {result?.signedIn && (
          <div className="mt-5 flex flex-col items-center gap-3">
            <p className={HINT}>
              <Trans>You're still signed in.</Trans>
            </p>
            <a href="/" className={LINK}>
              <Trans context="fresh start page: go to the home page now">Go home</Trans>
            </a>
            <button type="button" onClick={() => void signOut()} disabled={signingOut} className={BTN_SECONDARY}>
              <Trans context="fresh start page: sign out on this device too">Also sign me out</Trans>
            </button>
          </div>
        )}
      </div>
      </div>
    </main>
  );
}
