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
 *   WAITING        a filter to the members with an application the village has
 *                  not answered yet
 *   NOT FILED YET  the members who have not filed, by name (Rye, 2026-10-09)
 *
 * No terms and no money reach this panel. An application's terms are read on
 * its own page, which every chip links.
 */
import { useEffect, useState } from "react";
import { Link } from "wouter";
import { CalendarDays } from "lucide-react";
import { Trans, useLingui } from "@lingui/react/macro";
import { BreathingLoader } from "@/components/natural";
import PlanCard from "@/components/seasonPlans/PlanCard";
import {
  fetchVillage,
  type VillagePayload,
} from "@/components/seasonPlans/seasonPlansApi";
import {
  BTN_SECONDARY,
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
  everyone: "Everyone",
  waiting: "Waiting on the village",
  noneWaiting: "Nobody is waiting on the village right now.",
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
  const [onlyWaiting, setOnlyWaiting] = useState(false);

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
      <div
        className={`${TILE} flex flex-wrap items-center justify-between gap-3`}
      >
        <p role="alert" className="text-foreground">
          {error}
        </p>
        <button
          type="button"
          className={BTN_SECONDARY}
          onClick={() => {
            setState("loading");
            setTries(n => n + 1);
          }}
        >
          <Trans context="season page, a read that failed">Try again</Trans>
        </button>
      </div>
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
  const shown = onlyWaiting ? people.filter(p => p.waiting) : people;
  const toggle = (on: boolean, label: string, pick: () => void) => (
    <button
      type="button"
      aria-pressed={on}
      onClick={pick}
      className={`jw-btn inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-semibold ${on ? "border-notice bg-notice text-background" : "border-border text-foreground hover:bg-muted"}`}
    >
      {label}
    </button>
  );

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

      <div
        className="flex flex-wrap gap-2"
        role="group"
        aria-label={t({ message: "Show", context: "SeasonPlans, aria-label" })}
      >
        {toggle(!onlyWaiting, SEASON_PLANS_WORDS.everyone, () =>
          setOnlyWaiting(false)
        )}
        {toggle(onlyWaiting, SEASON_PLANS_WORDS.waiting, () =>
          setOnlyWaiting(true)
        )}
      </div>

      {shown.length === 0 ? (
        <p className={HINT}>{SEASON_PLANS_WORDS.noneWaiting}</p>
      ) : (
        <ul className="grid gap-4 lg:grid-cols-2">
          {shown.map(card => (
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
