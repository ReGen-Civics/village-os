/**
 * THE RUNG A MEMBER JUST CROSSED, CLAIMED ONCE FOR THE PROFILE'S FULL-SCREEN MOMENT.
 *
 * GameDashboard claimed this while it stood on My work. Its quest summary left the tab (QuestsDoor.tsx),
 * and the moment must not leave with it, so the profile claims it here from the same `/api/game/me` read.
 * The key mirrors the server's own notification dedupe key for the event, `stage:<stage>:<at>`, and
 * `claimMoment` is the check: a re-render or a second read never plays it twice, and a crossing from last
 * month plays not at all.
 */
import { useEffect } from "react";
import type { GameMe } from "@/lib/gameApi";
import { claimMoment } from "@/lib/celebrated";

export type ClaimedAdvance = NonNullable<GameMe["lastAdvance"]>;

export function useClaimedAdvance(me: GameMe | null, onAdvance: (advance: ClaimedAdvance) => void): void {
  const fresh = me?.lastAdvance ?? null;
  useEffect(() => {
    if (fresh && claimMoment(`stage:${fresh.toStage}:${fresh.at}`)) onAdvance(fresh);
    // Keyed on the crossing itself: a new read of the same crossing changes nothing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fresh?.toStage, fresh?.at]);
}
