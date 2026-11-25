/**
 * WHO SEES WHAT: every privacy flag a member has, in one place (profile overhaul, Direction D, 25 Nov 2026).
 *
 * The server held seven flags (server/lib/profile.ts) and the profile offered switches for two of them: the
 * borrowed-and-booked box at the foot of its card and "Show my first name to visitors" (which this replaces).
 * The other five had no control anywhere. They are all here now, each saved through /api/me/privacy.
 *
 * The defaults are the server's and are unchanged (the lead's ruling, 25 Nov 2026): roles, badges, standing
 * and the first name shown; borrowed and booked, where you will be, and where you live hidden. A flag an
 * older server does not send reads as its default. Nothing here hides anything; the server does, and every
 * box draws only once the stored answer has arrived, so it never shows a guess that a click would save.
 */
import { useEffect, useId, useState } from "react";
import { useLingui } from "@lingui/react/macro";
import { gameFetch } from "@/lib/gameApi";
import { CARD, H2, HINT, LEDE, TICK } from "@/components/journey/look";
import { PRIVACY_URL } from "@shared/profileInventory";

export const PRIVACY_FLAGS = [
  "showFirstNameToVisitors",
  "showRoles",
  "showBadges",
  "showHearts",
  "showInventory",
  "showCalendar",
  "showHome",
] as const;
export type PrivacyFlag = (typeof PRIVACY_FLAGS)[number];

/** The server's defaults (PRIVACY_DEFAULTS in server/lib/profile.ts), for a flag an older server leaves out. */
export const PRIVACY_FALLBACK: Record<PrivacyFlag, boolean> = {
  showFirstNameToVisitors: true,
  showRoles: true,
  showBadges: true,
  showHearts: true,
  showInventory: false,
  showCalendar: false,
  showHome: false,
};

export default function PrivacyPanel() {
  const { t } = useLingui();
  const base = useId();
  const [flags, setFlags] = useState<Record<PrivacyFlag, boolean> | null>(null);
  const [busy, setBusy] = useState<PrivacyFlag | null>(null);
  const [error, setError] = useState("");

  const words: Record<PrivacyFlag, { label: string; hint: string }> = {
    showFirstNameToVisitors: {
      label: t({ message: "Show my first name to visitors", context: "profile, show my first name to visitors" }),
      hint: t({ message: 'Turned off, the public pages say "A member" instead.', context: "privacy settings: the first name switch" }),
    },
    showRoles: {
      label: t({ message: "Show the roles I hold", context: "privacy settings: a switch" }),
      hint: t({ message: "On your profile and the village's pages.", context: "privacy settings: the roles switch" }),
    },
    showBadges: {
      label: t({ message: "Show my badges", context: "privacy settings: a switch" }),
      hint: t({ message: "The badges you have earned and pinned.", context: "privacy settings: the badges switch" }),
    },
    showHearts: {
      label: t({ message: "Show my standing", context: "privacy settings: a switch" }),
      hint: t({ message: "What the village has thanked you with, and from whom.", context: "privacy settings: the standing switch" }),
    },
    showInventory: {
      label: t({ message: "Show what I have borrowed and booked", context: "privacy settings: a switch" }),
      hint: t({ message: "Loans and stays.", context: "privacy settings: the borrowed and booked switch" }),
    },
    showCalendar: {
      label: t({ message: "Show where I will be, and when", context: "privacy settings: a switch" }),
      hint: t({ message: "Your stays and gatherings, by date.", context: "privacy settings: the calendar switch" }),
    },
    showHome: {
      label: t({ message: "Show where I live", context: "privacy settings: a switch" }),
      hint: t({ message: "Your home on the land.", context: "privacy settings: the home switch" }),
    },
  };

  useEffect(() => {
    let live = true;
    gameFetch(PRIVACY_URL)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!live || !d?.privacy) return;
        const next = { ...PRIVACY_FALLBACK };
        for (const f of PRIVACY_FLAGS) if (typeof d.privacy[f] === "boolean") next[f] = d.privacy[f];
        setFlags(next);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);

  const toggle = async (flag: PrivacyFlag, next: boolean) => {
    if (busy || !flags) return;
    setBusy(flag);
    setError("");
    const failed = t({ message: "That did not save. Try again.", context: "profile, show my first name to visitors" });
    try {
      const res = await gameFetch(PRIVACY_URL, { method: "PUT", body: JSON.stringify({ [flag]: next }) });
      if (res.ok) setFlags({ ...flags, [flag]: next });
      else setError(failed);
    } catch {
      setError(failed);
    } finally {
      setBusy(null);
    }
  };

  if (!flags) return null;

  return (
    <section aria-labelledby={`${base}-h`} className={CARD} data-privacy-panel="">
      <h2 id={`${base}-h`} className={H2}>
        {t({ message: "Who sees what", context: "privacy settings: heading" })}
      </h2>
      <p className={`mt-1 ${LEDE}`}>
        {t({ message: "Members signed in always see your first name.", context: "privacy settings: under the heading" })}
      </p>
      <ul className="mt-4 grid gap-1">
        {PRIVACY_FLAGS.map((flag) => (
          <li key={flag} className="flex min-h-11 items-start gap-3 rounded-lg px-1 py-2">
            {/* The box sits in a 44px label of its own, so a thumb finds it as easily as the words beside it. */}
            <label htmlFor={`${base}-${flag}`} className="-m-2.5 flex shrink-0 cursor-pointer p-2.5">
              <input
                id={`${base}-${flag}`}
                type="checkbox"
                aria-describedby={`${base}-${flag}-hint`}
                className={TICK}
                checked={flags[flag]}
                disabled={busy !== null}
                onChange={(e) => void toggle(flag, e.target.checked)}
                data-privacy-flag={flag}
              />
            </label>
            <div className="grid gap-0.5">
              <label htmlFor={`${base}-${flag}`} className="cursor-pointer font-semibold text-foreground">
                {words[flag].label}
              </label>
              <p id={`${base}-${flag}-hint`} className={HINT}>
                {words[flag].hint}
              </p>
            </div>
          </li>
        ))}
      </ul>
      {error && (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {error}
        </p>
      )}
    </section>
  );
}
