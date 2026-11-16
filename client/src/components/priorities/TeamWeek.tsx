/**
 * THIS WEEK, on "The season so far" (shared/priorities.ts): each person's top
 * priority, by name, A to Z. A line set in an earlier week carries forward
 * and says so. Nobody is ranked and nothing is counted.
 */
import { useEffect, useId, useState } from "react";
import { Link } from "wouter";
import { useLingui } from "@lingui/react/macro";
import { WEEK_API, type WeekPayload } from "@shared/priorities";
import { PRIORITY_OUTCOME_LABEL } from "@shared/sessionTemplates";
import { gameFetch } from "@/lib/gameApi";
import { CARD, CHIP_SOFT, EYEBROW, H2, HINT, LINK, TILE } from "@/components/journey/look";
import { dayWords } from "./priorityWords";

export default function TeamWeek() {
  const { t } = useLingui();
  const [week, setWeek] = useState<WeekPayload | null>(null);
  const headingId = useId();

  useEffect(() => {
    let alive = true;
    gameFetch(WEEK_API)
      .then(async (res) => (res.ok ? ((await res.json()) as WeekPayload) : null))
      .then((w) => alive && setWeek(w))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  if (!week) return null;
  return (
    <section aria-labelledby={headingId} className={CARD} data-team-week>
      <p className={EYEBROW}>{t({ message: `Week of ${dayWords(week.weekOf)}`, context: "weekly top priority, the week it is for" })}</p>
      <h2 id={headingId} className={`mt-1 ${H2}`}>
        {t`This week, each person's top priority`}
      </h2>
      {week.team.length ? (
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {week.team.map((p) => (
            <li key={`${p.name}-${p.line.weekOf}`} className={TILE}>
              <p className="text-sm font-semibold text-muted-foreground">{p.name}</p>
              <p className="mt-1 text-foreground">{p.line.text}</p>
              <p className="mt-2 flex flex-wrap gap-2">
                {p.line.servesGoal && <span className={CHIP_SOFT}>{t({ message: `Serves: ${p.line.servesGoal}`, context: "weekly top priority, the season goal it serves" })}</span>}
                {p.line.outcome && <span className={CHIP_SOFT}>{PRIORITY_OUTCOME_LABEL[p.line.outcome]}</span>}
                {!p.thisWeek && <span className={CHIP_SOFT}>{t`From the week of ${dayWords(p.line.weekOf)}`}</span>}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <p className={`mt-3 ${HINT}`}>{t`Nobody has named a top priority yet this week.`}</p>
      )}
      <p className="mt-4">
        <Link href="/profile" className={LINK}>
          {week.mine ? t`Change yours on your profile` : t`Set yours on your profile`}
        </Link>
      </p>
    </section>
  );
}
