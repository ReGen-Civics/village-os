/**
 * WHAT THE STRIP ABOVE THE ADMIN HEADER SAYS, and when it says nothing.
 *
 * The strip itself is `LaunchBanner` in pages/Admin.tsx. Its rule and its words
 * live here so the rule can be tested without the page, and so the page, whose
 * length is ratcheted, does not grow.
 *
 * IT READS THE LAUNCH FACTS (`shared/launchFacts.ts`), where it used to read
 * `launchedAt` alone:
 *
 *   the checklist froze     nothing. The journey is a record now.
 *   a launch vote is open   that, and nothing about rows.
 *   issuing, vote not held  the open rows, and the plain fact that no launch
 *                           vote has carried. It used to say "ready when a founder
 *                           asks the village", which the server refuses for a
 *                           village that is already issuing.
 *   otherwise               the open rows, as before.
 *
 * Both reads are shared with every other caller on the screen
 * (`client/src/lib/launchReads.ts`), so this costs the page no second request.
 */
import { useEffect, useState } from "react";
import { plural } from "@lingui/core/macro";
import { useLingui } from "@lingui/react/macro";
import type { LaunchFacts } from "@shared/launchFacts";
import { useTokensWord } from "@/hooks/useTokenNames";
import { readLaunchFacts, readLaunchStatus, type LaunchStatusRead } from "@/lib/launchReads";

export type LaunchBannerState =
  | { kind: "vote-open" }
  | { kind: "rows"; blocking: number; recommended: number; issuingUnvoted: boolean };

/**
 * The strip's state from the two reads, or null when it has nothing to say.
 *
 * `facts` may be null when that read failed. The strip then falls back to the
 * one field it always read, so a failed small read never hides the journey
 * from a village that has not launched.
 */
export function launchBannerState(status: LaunchStatusRead | null, facts: LaunchFacts | null): LaunchBannerState | null {
  if (!status) return null;
  const frozen = facts ? facts.checklistFrozen : !!status.launchedAt;
  if (frozen) return null;
  if (facts?.voteOpen) return { kind: "vote-open" };
  const count = (n: unknown) => (Number.isFinite(Number(n)) ? Math.max(0, Number(n)) : 0);
  return {
    kind: "rows",
    blocking: count(status.blockingOpen),
    recommended: count(status.recommendedOpen),
    issuingUnvoted: !!facts && facts.issuing && !facts.voteCarried,
  };
}

export interface LaunchBannerLines {
  /** For a phone. */
  short: string;
  /** For a wide screen. */
  full: string;
}

/** The strip's two lines for this admin, or null when it should not show. */
export function useLaunchBanner(token: string): LaunchBannerLines | null {
  const { t } = useLingui();
  // What this village calls all its tokens together.
  const tokens = useTokensWord();
  const [state, setState] = useState<LaunchBannerState | null>(null);
  useEffect(() => {
    let live = true;
    void Promise.all([readLaunchStatus(token), readLaunchFacts(token)]).then(([status, answer]) => {
      if (live) setState(launchBannerState(status, answer?.facts ?? null));
    });
    return () => {
      live = false;
    };
  }, [token]);

  if (!state) return null;
  if (state.kind === "vote-open") {
    return {
      short: t({ message: "Launch vote is open", context: "admin launch strip, phone" }),
      full: t({ message: "Journey to Launch: the village is voting on starting its Game", context: "admin launch strip" }),
    };
  }
  const { blocking, recommended, issuingUnvoted } = state;
  // What is left, as the journey page says it. A "done of total" count here was a score (R55).
  const open = plural(blocking, { one: "# blocking item open", other: "# blocking items open" });
  const what =
    blocking > 0
      ? open
      : issuingUnvoted
        ? t({ message: "nothing blocking", context: "admin launch strip, no blocking rows left" })
        : t({ message: "nothing blocking, ready when a founder asks the village", context: "admin launch strip, no blocking rows left" });
  const short =
    blocking > 0
      ? t({ message: `Launch · ${blocking} open`, context: "admin launch strip, phone" })
      : t({ message: "Launch · nothing blocking", context: "admin launch strip, phone" });
  const full = issuingUnvoted
    ? t({
        message: `Journey to Launch: ${tokens} are being issued and no launch vote has carried · ${what} · ${recommended} recommended remaining`,
        context: "admin launch strip, a village issuing before its vote",
      })
    : t({ message: `Journey to Launch: ${what} · ${recommended} recommended remaining`, context: "admin launch strip" });
  return { short, full };
}
