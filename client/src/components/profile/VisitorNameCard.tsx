/**
 * "SHOW MY FIRST NAME TO VISITORS", on your own profile's settings band.
 *
 * The lead decided on 24 Nov 2026 that the public pages (/powers, the gratitude
 * wall, the team page, festivals) may show members' first names to visitors,
 * and that any member may opt out. This is the opt-out. It sets
 * `showFirstNameToVisitors` (default on, server/lib/profile.ts) through
 * `/api/me/privacy`.
 *
 * The server is the whole of the rule: with it off, every payload a signed-out
 * visitor reads says "A member" where this member's name would be, and a page
 * reached by their handle is not found. Nothing here hides anything; the box
 * only says what the member chose. Members signed in still read names.
 *
 * The box draws once the stored answer has arrived, so it never shows a guess
 * that a click would then save.
 */
import { useEffect, useId, useState } from "react";
import { useLingui } from "@lingui/react/macro";
import { gameFetch } from "@/lib/gameApi";
import { CARD, H2, HINT, TICK } from "@/components/journey/look";
import { PRIVACY_URL } from "@shared/profileInventory";

export default function VisitorNameCard() {
  const { t } = useLingui();
  const base = useId();
  const [shown, setShown] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let live = true;
    gameFetch(PRIVACY_URL)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!live) return;
        const v = d?.privacy?.showFirstNameToVisitors;
        // An older server that has no such flag answers without it: absent reads as on, its default.
        if (d?.privacy) setShown(typeof v === "boolean" ? v : true);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);

  const toggle = async (next: boolean) => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await gameFetch(PRIVACY_URL, { method: "PUT", body: JSON.stringify({ showFirstNameToVisitors: next }) });
      if (res.ok) setShown(next);
      else setError(t({ message: "That did not save. Try again.", context: "profile, show my first name to visitors" }));
    } catch {
      setError(t({ message: "That did not save. Try again.", context: "profile, show my first name to visitors" }));
    } finally {
      setBusy(false);
    }
  };

  if (shown === null) return null;

  return (
    <section aria-labelledby={`${base}-h`} className={CARD} data-visitor-name="">
      <h2 id={`${base}-h`} className={H2}>
        {t({ message: "Visitors", context: "profile settings heading: what signed-out visitors see" })}
      </h2>
      <div className="mt-4 flex min-h-11 items-start gap-3">
        {/* The box sits in a 44px label of its own, so a thumb finds it as easily as the words beside it. */}
        <label htmlFor={`${base}-box`} className="-m-2.5 flex shrink-0 cursor-pointer p-2.5">
          <input
            id={`${base}-box`}
            type="checkbox"
            aria-describedby={`${base}-hint`}
            className={TICK}
            checked={shown}
            disabled={busy}
            onChange={(e) => void toggle(e.target.checked)}
            data-visitor-name-box=""
          />
        </label>
        <div className="grid gap-1">
          <label htmlFor={`${base}-box`} className="cursor-pointer font-semibold text-foreground">
            {t({ message: "Show my first name to visitors", context: "profile, show my first name to visitors" })}
          </label>
          <p id={`${base}-hint`} className={HINT}>
            {t({
              message: 'Visitors to the public pages see your first name beside what you hold and give. Turn this off and they see "A member" instead.',
              context: "profile, show my first name to visitors",
            })}
          </p>
        </div>
      </div>
      {error && (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {error}
        </p>
      )}
    </section>
  );
}
