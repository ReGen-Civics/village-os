/**
 * EVERYONE'S PLAN FOR THE SEASON, on the Season tab of `/season` (season plans
 * RC1). It was the page `/season-plans` until the season fold (27 Nov 2026).
 *
 * Members only. The read behind it answers 401 to a signed-in guest (terms.read
 * opens at the member rung), and this panel says so in a sentence.
 *
 *   HOW MANY       how many have filed, and the planning window
 *   ONE CARD EACH  every present member, ordered by name and never by progress
 *                  (PlanCard)
 *   (The "Waiting on the village" filter left with the season fold: each card
 *   already names where its applications stand, and an application that waits
 *   reaches the people who answer it on its own: in the holder's "Waiting on
 *   you" on the profile and the Today strip, and as a ballot when it goes to a
 *   vote.)
 *   NOT FILED YET  the members who have not filed, by name (Rye, 2026-10-09)
 *
 * No terms and no money reach this panel. An application's terms are read on
 * its own page, which every chip links.
 */
import { useEffect, useState } from "react";
import { Link } from "wouter";
import { CalendarDays } from "lucide-react";
import { useLingui } from "@lingui/react/macro";
import { BreathingLoader } from "@/components/natural";
import ReadFailed from "./ReadFailed";
import PlanCard from "@/components/seasonPlans/PlanCard";
import {
  fetchVillage,
  type VillagePayload,
} from "@/components/seasonPlans/seasonPlansApi";
import {
  CARD,
  CHIP_SOFT,
  EYEBROW,
  H2,
  HINT,
  LINK,
  TILE,
} from "@/components/journey/look";
import { civilDayWords } from "@shared/seasonPlans";

export const SEASON_PLANS_WORDS = {
  eyebrow: "Everyone's plans",
  title: "The village's season",
  membersOnly: "Members read the village's season plans.",
  membersOnlyLine:
    "Each plan names the roles people hold and ask for, so this opens at the member rung.",
  noSeason: "There is no season to plan yet.",
  noSeasonLine: "Planning opens one moon before the next season starts.",
  filed: (n: number, of: number) => `${n} of ${of} have filed`,
  window: (opens: string, closes: string) =>
    `Planning runs from ${civilDayWords(opens)} to ${civilDayWords(closes)}.`,
  notFiled: "Not filed yet",
  allFiled: "Everyone has filed.",
} as const;

export default function VillagePlans() {
  const { t } = useLingui();
  const [data, setData] = useState<VillagePayload | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "members" | "error">(
    "loading"
  );
  const [error, setError] = useState("");

  const [tries, setTries] = useState(0);
  useEffect(() => {
    let alive = true;
    void fetchVillage().then(answer => {
      if (!alive) return;
      if (answer.ok) {
        setData(answer.data);
        setState("ready");
      } else if (answer.status === 401) setState("members");
      else {
        setError(answer.error);
        setState("error");
      }
    });
    return () => {
      alive = false;
    };
  }, [tries]);

  const head = (
    <>
      <p className={EYEBROW}>{SEASON_PLANS_WORDS.eyebrow}</p>
      <h2 id="everyone-h" className={`${H2} mt-1`}>
        {SEASON_PLANS_WORDS.title}
      </h2>
    </>
  );

  if (state === "loading") {
    return (
      <section aria-labelledby="everyone-h" className={CARD}>
        {head}
        <div className="flex justify-center py-10">
          <BreathingLoader
            label={t({
              message: "Reading the village's plans",
              context: "SeasonPlans, label",
            })}
          />
        </div>
      </section>
    );
  }
  if (state === "members") {
    return (
      <section aria-labelledby="everyone-h" className={CARD}>
        {head}
        <p className="mt-2 font-semibold text-foreground">
          {SEASON_PLANS_WORDS.membersOnly}
        </p>
        <p className={`${HINT} mt-1`}>{SEASON_PLANS_WORDS.membersOnlyLine}</p>
      </section>
    );
  }
  if (state === "error" || !data) {
    return (
      <ReadFailed
        message={error}
        onRetry={() => {
          setState("loading");
          setTries(n => n + 1);
        }}
      />
    );
  }
  if (!data.season) {
    return (
      <section aria-labelledby="everyone-h" className={CARD}>
        {head}
        <p className="mt-2 font-semibold text-foreground">
          {SEASON_PLANS_WORDS.noSeason}
        </p>
        <p className={`${HINT} mt-1`}>{SEASON_PLANS_WORDS.noSeasonLine}</p>
      </section>
    );
  }

  const people = data.people ?? [];
  return (
    <section aria-labelledby="everyone-h" className={`${CARD} space-y-5`}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>{head}</div>
        <span className={CHIP_SOFT} data-plans-filed="">
          {SEASON_PLANS_WORDS.filed(data.filedCount, data.memberCount)}
        </span>
      </div>
      {data.window && (
        <p className={`${HINT} inline-flex items-center gap-1.5`}>
          <CalendarDays className="size-4" aria-hidden="true" />
          {SEASON_PLANS_WORDS.window(data.window.opensOn, data.window.closesOn)}
        </p>
      )}

      {people.length > 0 && (
        <ul className="grid gap-4 lg:grid-cols-2">
          {people.map(card => (
            <li key={card.userId}>
              <PlanCard card={card} headingLevel={3} />
            </li>
          ))}
        </ul>
      )}

      <div aria-labelledby="sp-not-filed" role="group" className={TILE}>
        <h3 id="sp-not-filed" className="font-semibold text-foreground">
          {SEASON_PLANS_WORDS.notFiled}
        </h3>
        {data.notFiled.length === 0 ? (
          <p className={`${HINT} mt-1`}>{SEASON_PLANS_WORDS.allFiled}</p>
        ) : (
          <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-foreground">
            {data.notFiled.map(p => (
              <li key={p.userId}>
                {p.handle ? (
                  <Link
                    href={`/profile/${encodeURIComponent(p.handle)}`}
                    className={LINK}
                  >
                    {p.name}
                  </Link>
                ) : (
                  p.name
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
