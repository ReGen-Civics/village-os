/**
 * THE FRONT DOOR: WHICH AREAS ARE IN REAL USE (a reviewer's feedback, approved
 * by the lead on 24 Nov 2026).
 *
 * A menu entry marked `newcomers: "in-use"` (config/nav.ts) is shown to a
 * visitor, or to someone signed in whom the village has not admitted yet, only
 * once its area holds something real. Until then a newcomer would open a page
 * of standing examples or an empty page, and the front door would read as
 * unfinished. A member sees the entry either way.
 *
 * What counts as in use, per area, read from the public answers the pages
 * themselves read, once per page load:
 *   - feed, forum, tools, network: the module no longer shows its standing
 *     examples (`/api/examples`, the answer the examples banner reads; asked
 *     here without a token, which is a newcomer's answer: only an admin's
 *     differs, and an admin is never a newcomer);
 *   - places and photographs: at least one place has a photograph (`/api/places`);
 *   - pooling resources: at least one raising (`/api/crowdpool/campaigns`);
 *   - events: something on the calendar today or later beyond the season
 *     itself (`/api/events`);
 *   - seasonal festivals: the village has at least one season (the config).
 *
 * The reads live in their own chunk (areasInUseReads.ts), fetched only for a
 * newcomer, so the shell every page loads carries just this test.
 *
 * Unknown is not in use: while an answer is on its way, or when it fails, the
 * entry stays out for a newcomer, so nothing flashes in and then away.
 */
import { useEffect, useState } from "react";
import { useGameConfig } from "@/lib/gameApi";

/** What the reads answered (areasInUseReads.ts). `exampleModules` is null while unknown or when the read failed. */
export interface AreaAnswers {
  exampleModules: readonly string[] | null;
  places?: boolean;
  campaigns?: boolean;
  events?: boolean;
}

/** Which answer decides each address. An address not here is in use when its module shows no examples. */
const ANSWER_OF: Readonly<Record<string, "places" | "campaigns" | "events">> = {
  "/places": "places",
  "/photographs": "places",
  "/campaigns": "campaigns",
  "/events": "events",
};

/** Whether one `newcomers: "in-use"` entry is in use, given what is known. */
export function areaInUse(entry: { href: string; module?: string }, known: AreaAnswers & { seasons: number }): boolean {
  if (entry.href === "/seasonal-festivals") return known.seasons > 0;
  const answer = ANSWER_OF[entry.href];
  if (answer) return known[answer] === true;
  if (!entry.module || !known.exampleModules) return false;
  return !known.exampleModules.includes(entry.module);
}

/**
 * The test for `newcomers: "in-use"` entries. `active` is false for a member,
 * who sees every entry, so a member's page makes none of these reads.
 */
export function useAreaInUse(active: boolean): (entry: { href: string; module?: string }) => boolean {
  const cfg = useGameConfig();
  const [known, setKnown] = useState<AreaAnswers>({ exampleModules: null });
  useEffect(() => {
    if (!active) return;
    let live = true;
    import("./areasInUseReads")
      .then((m) => m.readAreas())
      .then((answers) => live && setKnown(answers))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [active]);
  const seasons = cfg?.season?.seasons?.length ?? 0;
  return (entry) => areaInUse(entry, { ...known, seasons });
}
