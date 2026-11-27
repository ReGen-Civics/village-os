import { ArrowRight, Sunrise } from "lucide-react";
import { DaySun } from "@/components/sacred/glyphs";
import { Link } from "wouter";
import { useSeason } from "@/lib/gameApi";
import { useAuth } from "@/contexts/AuthContext";
import { civilDayWords } from "@shared/seasonPlans";
import { seasonView } from "@shared/seasonGoalsView";
import { useNewcomer } from "@/lib/newcomer";
import { Trans, useLingui } from "@lingui/react/macro";
import { BTN_NOTICE, EYEBROW, HINT, LINK, RING } from "@/components/journey/look";

/**
 * THE SEASON, AS ONE PICTURE (the lead, 27 Nov 2026: "Let's make a sexier diagram for the season of foundations and
 * get rid of repetitive text"). The strap used to say the season's name three times and its closing day twice:
 * the kicker, "<name> closes on <day>", and "Plan your season: <name>. Open until <day>. Plan your season". Now one
 * card says each thing once:
 *
 * - the season's name, once, and its one sentence;
 * - a ring of the season's goals, one segment each, the met ones lit, with the same count in words beside it
 *   (members only: a visitor or someone not yet admitted does not see the village's working number, 24 Nov 2026);
 * - a time line from the season's first day to its close, today marked, and the close said once as a date (the
 *   art rules: a date, never a countdown);
 * - one "Plan your season" button, while the planning window is open, for a signed-in member (season plans RC1). It opens
 *   the Your plan tab of the one season page, /season#plan (the season fold, 27 Nov 2026).
 *   The window's own closing day is said only when it differs from the season's.
 *
 * The ring and the line are SVG and CSS on the profile's tokens, so they follow dark and light and move nothing
 * (no animation to switch off for reduced motion). Every number in them is also in the words.
 */

const CARD = "rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-7";

/** The goals as a ring: one segment per goal, the met ones lit. Decoration only: the count is in the words beside it. */
export function GoalRing({ met, total }: { met: number; total: number }) {
  const r = 26;
  const c = 2 * Math.PI * r;
  const slot = c / total;
  // A small gap between segments, smaller when there are many.
  const gap = total > 1 ? Math.min(slot * 0.18, 4) : 0;
  const seg = slot - gap;
  return (
    <svg viewBox="0 0 64 64" className="size-20 shrink-0 sm:size-24" aria-hidden="true" data-season-ring="">
      {/* The first segment starts at the top and they run clockwise. */}
      <g transform="rotate(-90 32 32)">
      {Array.from({ length: total }, (_, i) => (
        <circle
          key={i}
          cx="32"
          cy="32"
          r={r}
          fill="none"
          strokeWidth="6"
          strokeLinecap="butt"
          className={i < met ? "stroke-notice" : "stroke-muted"}
          strokeDasharray={`${seg} ${c - seg}`}
          strokeDashoffset={-i * slot}
          data-goal-lit={i < met ? "" : undefined}
        />
      ))}
      </g>
      <text x="32" y="32" className="fill-foreground font-display" textAnchor="middle" dominantBaseline="central" fontSize="15">
        {met}/{total}
      </text>
    </svg>
  );
}

/** The season's time line: its first day to its close, today marked. The dates are said in words under it. */
export function SeasonLine({ startsOn, endsOn, day, of }: { startsOn: string; endsOn: string; day: number | null; of: number | null }) {
  const { t } = useLingui();
  const share = day !== null && of ? Math.min(1, Math.max(0, (day - 0.5) / of)) : null;
  const closesOn = civilDayWords(endsOn);
  return (
    <div className="grid gap-1.5" data-season-line="">
      <div className="relative mt-5 h-2 rounded-full bg-border" aria-hidden="true">
        {share !== null ? (
          <>
            <div className="absolute inset-y-0 left-0 rounded-full bg-notice/70" style={{ width: `${share * 100}%` }} />
            <span className="absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-card bg-notice" style={{ left: `${share * 100}%` }} data-season-today="" />
            <span className="absolute -top-5 -translate-x-1/2 text-[11px] font-semibold uppercase tracking-wider text-notice" style={{ left: `${share * 100}%` }}>
              {t({ message: "Today", context: "SeasonBanner, the marker on the season's time line" })}
            </span>
          </>
        ) : null}
      </div>
      <div className="flex flex-wrap justify-between gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span>{civilDayWords(startsOn)}</span>
        <span className="font-medium text-foreground" data-season-closes="">
          <Trans context="SeasonBanner, the season's closing day, said once">Closes on {closesOn}.</Trans>
        </span>
      </div>
    </div>
  );
}

/** "2026-12-31" from "2026-12-31" or a full ISO stamp; "" for anything else. Days are compared as civil days, never as Dates. */
function civilDayOf(iso: string | null | undefined): string {
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(iso ?? "");
  return m ? m[1] : "";
}

/**
 * "Plan your season", one button, while the window is open. Members only: a visitor has no seat to keep and no plan to
 * file. What it says beside the button is only what the card has not said already:
 * - the season being planned, when it is another season than the one on the card (a window often plans the NEXT
 *   season), with the window's own closing day;
 * - otherwise the window's closing day, only when it is another day than the season's close.
 */
function PlanButton({ window, cardSeason, cardCloses }: { window: { seasonName: string; closesOn: string }; cardSeason: string; cardCloses: string }) {
  const until = civilDayWords(window.closesOn);
  const planned = window.seasonName.trim();
  const otherSeason = !!planned && planned !== cardSeason.trim();
  const sameDay = !!civilDayOf(cardCloses) && civilDayOf(window.closesOn) === civilDayOf(cardCloses);
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2" data-season-plan="">
      <Link href="/season#plan" className={BTN_NOTICE}>
        <Trans context="SeasonBanner, the one button to plan the season">Plan your season</Trans>
        <ArrowRight className="size-4" aria-hidden="true" />
      </Link>
      {otherSeason ? (
        <span className={HINT}>
          <Trans context="SeasonBanner, beside the plan button when the window plans another season than the card's">For {planned}. Open until {until}.</Trans>
        </span>
      ) : sameDay ? null : (
        <span className={HINT}>
          <Trans context="SeasonBanner, beside the plan button when the window closes on another day than the season">Open until {until}.</Trans>
        </span>
      )}
    </div>
  );
}

/** The season strap. The server decides which season is current from today's
 *  date, so this can show an upcoming season or nothing at all, and it will
 *  never keep advertising a season that has already turned. */
export default function SeasonBanner() {
  const season = useSeason();
  const { user } = useAuth();
  // The count of season goals met is the village's own working number, the same kind as the commons block the
  // landing dropped (24 Nov 2026): a visitor or someone the village has not admitted yet does not see it; a member does.
  const newcomer = useNewcomer();
  if (!season) return null;
  const planWindow = user && season.planWindow?.state === "open" ? season.planWindow : null;

  const active = season.current;
  const next = season.upcoming;

  // Between seasons: name what's coming rather than lying about what's here.
  if (!active) {
    if (!next?.name) return null;
    return (
      <section className="border-y border-border/60 bg-card/40 py-8" data-season-banner="upcoming">
        <div className="container max-w-4xl">
          <div className={`${CARD} flex flex-wrap items-center gap-4`}>
            <span className={RING} aria-hidden="true">
              <Sunrise className="size-5" />
            </span>
            <div className="grid min-w-0 flex-1 gap-1">
              <p className={EYEBROW}>{next.name}</p>
              {next.focus && <p className="text-base text-foreground">{next.focus}</p>}
              <p className={HINT}>
                {season.daysUntilStart > 0 && next.startsOn ? `begins on ${civilDayWords(next.startsOn)}` : "begins today"}
              </p>
            </div>
            {planWindow ? <PlanButton window={planWindow} cardSeason={next.name} cardCloses="" /> : null}
          </div>
        </div>
      </section>
    );
  }

  if (!active.name) return null;
  const goals = (active.goals ?? []).filter((g) => g.text.trim());
  const met = goals.filter((g) => g.done).length;
  const showGoals = goals.length > 0 && !newcomer;
  // `daysLeft` is null for an open-ended season, and `null <= 14` is true in
  // JavaScript, so the reminder asks for a real number first. Two weeks is the
  // same window the season-end notifications open on
  // (server/lib/seasonReminders.ts).
  const daysLeft = season.daysLeft;
  // The end-of-season reminder is an instruction to the people who run the
  // governance, so a visitor never reads it: signed-in members only, the same
  // rule as the plan button (audit item 28).
  const turningSoon = !!user && daysLeft != null && daysLeft > 0 && daysLeft <= 14;
  const closes = !season.openEnded && !!active.endsOn && daysLeft != null && daysLeft >= 0;
  const view = seasonView(active, season.today ? new Date(`${season.today.slice(0, 10)}T12:00:00Z`) : new Date());

  return (
    <section className="border-y border-border/60 bg-card/40 py-8 sm:py-10" data-season-banner="current">
      <div className="container max-w-4xl">
        <div className={`${CARD} flex flex-col gap-5 sm:flex-row sm:items-center sm:gap-8`}>
          {showGoals ? (
            <div className="flex items-center gap-4 sm:flex-col sm:items-center sm:gap-2 sm:text-center">
              <GoalRing met={met} total={goals.length} />
              <span className="text-sm text-muted-foreground" data-season-goals-met="">
                <Trans context="SeasonBanner, span">{met} of {goals.length} season goal{goals.length === 1 ? "" : "s"} met
              </Trans></span>
            </div>
          ) : (
            <span className={`${RING} size-14`} aria-hidden="true">
              {/* The header's own sun, so one screen draws the sun one way (QA, 25 Nov 2026). */}
              <DaySun className="size-6" />
            </span>
          )}
          <div className="grid min-w-0 flex-1 gap-3">
            <div className="grid gap-1.5">
              <p className={`${EYEBROW} inline-flex items-center gap-2`}>
                {showGoals ? <DaySun className="size-4" aria-hidden="true" /> : null}
                {active.name}
              </p>
              {active.focus && <p className="font-display text-xl leading-snug text-foreground sm:text-2xl">{active.focus}</p>}
            </div>
            {closes && active.startsOn ? <SeasonLine startsOn={active.startsOn} endsOn={active.endsOn} day={view?.day ?? null} of={view?.of ?? null} /> : null}
            {turningSoon && (
              <p className="text-sm text-notice">
                <Trans context="SeasonBanner, span">Before the season turns, run the end-of-season governance: record what this season did, and seat
                people for the next season.{" "}
                <Link href="/seasonal-festivals" className={LINK}>
                  See the season
                </Link></Trans>
              </p>
            )}
            {planWindow ? <PlanButton window={planWindow} cardSeason={active.name} cardCloses={closes ? active.endsOn : ""} /> : null}
          </div>
        </div>
      </div>
    </section>
  );
}
