import { Sun, Sunrise } from "lucide-react";
import { Link } from "wouter";
import { useSeason } from "@/lib/gameApi";
import { useAuth } from "@/contexts/AuthContext";
import { civilDayWords } from "@shared/seasonPlans";
import { useNewcomer } from "@/lib/newcomer";
import { Trans } from "@lingui/react/macro";

/**
 * "Plan your season", while the window is open (season plans RC1). Members
 * only: a visitor has no seat to keep and no plan to file. The window comes
 * with /api/season, so the banner makes no second request.
 */
function PlanLine({ window }: { window: { seasonName: string; closesOn: string } }) {
  return (
    <span className="basis-full text-amber-on-band text-sm">
      <Trans context="SeasonBanner, span">Plan your season{window.seasonName ? `: ${window.seasonName}` : ""}. Open until {civilDayWords(window.closesOn)}.{" "}
      <Link href="/season-plans/mine" className="underline font-medium">
        Plan your season
      </Link></Trans>
    </span>
  );
}

/** The season strap. The server decides which season is current from today's
 *  date, so this can show an upcoming season or nothing at all — but it will
 *  never keep advertising a season that has already turned. */
export default function SeasonBanner() {
  const season = useSeason();
  const { user } = useAuth();
  // The count of season goals met is the village's own working number, the same kind as the commons block the
  // landing dropped (24 Nov 2026): a visitor or someone the village has not admitted yet does not see it; a member does.
  const newcomer = useNewcomer();
  if (!season) return null;
  const plan = user && season.planWindow?.state === "open" ? <PlanLine window={season.planWindow} /> : null;

  const active = season.current;
  const next = season.upcoming;

  // Between seasons: name what's coming rather than lying about what's here.
  if (!active) {
    if (!next?.name) return null;
    return (
      <section className="bg-teal-band text-white py-4">
        <div className="container flex flex-wrap items-center justify-center gap-x-6 gap-y-1 text-center">
          <span className="inline-flex items-center gap-2 text-amber-on-band font-semibold text-sm tracking-widest uppercase">
            <Sunrise className="w-4 h-4" /> {next.name}
          </span>
          {next.focus && <span className="text-white text-sm">{next.focus}</span>}
          <span className="text-white text-xs">
            {season.daysUntilStart > 0 && next.startsOn ? `begins on ${civilDayWords(next.startsOn)}` : "begins today"}
          </span>
          {plan}
        </div>
      </section>
    );
  }

  if (!active.name) return null;
  const goals = (active.goals ?? []).filter((g) => g.text.trim());
  const met = goals.filter((g) => g.done).length;
  // `daysLeft` is null for an open-ended season, and `null <= 14` is true in
  // JavaScript, so the reminder asks for a real number first. Two weeks is the
  // same window the season-end notifications open on
  // (server/lib/seasonReminders.ts).
  const daysLeft = season.daysLeft;
  // The end-of-season reminder is an instruction to the people who run the
  // governance, so a visitor never reads it: signed-in members only, the same
  // rule as the plan line (audit item 28).
  const turningSoon = !!user && daysLeft != null && daysLeft > 0 && daysLeft <= 14;

  return (
    <section className="bg-teal-band text-white py-4">
      <div className="container flex flex-wrap items-center justify-center gap-x-6 gap-y-1 text-center">
        <span className="inline-flex items-center gap-2 text-amber-on-band font-semibold text-sm tracking-widest uppercase">
          <Sun className="w-4 h-4" /> {active.name}
        </span>
        {active.focus && <span className="text-white text-sm">{active.focus}</span>}
        {goals.length > 0 && !newcomer && (
          <span className="text-white text-xs" data-season-goals-met="">
            <Trans context="SeasonBanner, span">{met} of {goals.length} season goal{goals.length === 1 ? "" : "s"} met
          </Trans></span>
        )}
        {/* A date, never a countdown (the art rules, batch 158): it once read "49 days until the season turns". */}
        {!season.openEnded && active.endsOn && daysLeft != null && daysLeft >= 0 && (
          <span className="text-white text-xs" data-season-closes="">
            <Trans context="SeasonBanner, span">{active.name} closes on {civilDayWords(active.endsOn)}.
          </Trans></span>
        )}
        {turningSoon && (
          <span className="basis-full text-amber-on-band text-sm">
            <Trans context="SeasonBanner, span">Before the season turns, run the end-of-season governance: record what this season did, and seat
            people for the next season.{" "}
            <Link href="/seasonal-festivals" className="underline font-medium">
              See the season
            </Link></Trans>
          </span>
        )}
        {plan}
      </div>
    </section>
  );
}
