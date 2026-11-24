/**
 * Seasonal Festivals (MF11, Wave 1): the page two live surfaces already
 * linked to — the Journey tracker and the Tools hub — that never existed.
 * A dead link from your own onboarding content is a small broken promise;
 * this keeps it: the village's season calendar, live from /api/season,
 * with the rhythm each season carries.
 */
import Layout from "@/components/Layout";
import { useEffect, useState } from "react";
import { Link } from "wouter";
import { useModule } from "@/modules/ModuleProvider";
import { CalendarDays } from "lucide-react";
import { SeedOfLife, Vesica } from "@/components/sacred/glyphs";
import { CARD, CARD_FEATURED, EYEBROW, H1, H2, HINT, LEDE, LINK, QUIET, WORLD } from "@/components/journey/look";
import { useStoryPageShown } from "@/lib/brochure";
import { Trans } from "@lingui/react/macro";

export default function SeasonalFestivals() {
  const storyShown = useStoryPageShown();
  const workWithUsOn = storyShown("/work-with-us");
  /*
   * The lead, 24 Nov 2026: the season's goals stay public, with "If you can help us meet these, consider the
   * Village Steward path." Shown only where the village keeps its /steward page.
   */
  const stewardOn = storyShown("/steward");
  const [season, setSeason] = useState<any>(null);
  /**
   * The calendar is the other half of this page: seasons say WHEN the year
   * turns, the calendar says what is dated inside them. Gated, because the
   * events module ships off and its page renders NotFound until a village
   * turns it on.
   */
  const eventsModule = useModule("events");

  /**
   * Whether /api/season has answered (or failed). Before it has, the page
   * knows nothing about the calendar and says nothing: it used to print "The
   * season calendar hasn't been set yet" on every cold load, which is untrue
   * on a village that has one, and then drop the "Now" card in above it and
   * push the calendar 298px down the screen (measured cold at 390x844, a
   * 0.16 to 0.23 layout shift). The two cards' places are held instead.
   */
  const [seasonRead, setSeasonRead] = useState(false);

  useEffect(() => {
    fetch("/api/season")
      .then((r) => (r.ok ? r.json() : null))
      .then(setSeason)
      .catch(() => {})
      .finally(() => setSeasonRead(true));
  }, []);

  const fmt = (d: string) =>
    new Date(d + "T00:00:00").toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });

  /**
   * A season's dates. `endsOn` is allowed to be EMPTY, which means open-ended:
   * it runs until somebody starts the next one, which is what a founding
   * season does. Formatting that empty string produced "Invalid Date" on the
   * page, so say the true thing instead.
   */
  const span = (s: any) =>
    s.endsOn ? `${fmt(s.startsOn)} to ${fmt(s.endsOn)}` : `${fmt(s.startsOn)} onward, until the next season starts`;

  const currentGoals = ((season?.current?.goals ?? []) as any[]).filter((g) => String(g?.text ?? "").trim());

  return (
    <Layout>
      {/* The night world (public launch, 24 Nov 2026): the sheet's look, same words. */}
      <div className={WORLD}>
      <section className="pt-12 pb-4 sm:pt-16">
        <div className="container max-w-3xl">
          <p className={EYEBROW}>
            <Trans context="seasonal festivals page eyebrow">The village year</Trans>
          </p>
          <h1 className={`${H1} mt-2`}>Seasonal Festivals</h1>
          <p className={`${LEDE} mt-4`}>
            The village moves in seasons, each with its own energy, and each
            turned with a gathering. Festivals are how a season is opened,
            honored, and handed to the next.
          </p>
        </div>
      </section>

      <section className="pt-6 pb-16">
        <div className="container max-w-3xl space-y-4">
          {/* The "Now" card's place while the season is read: an empty card
              of its measured height (282px at 390, 262px from 768 up). */}
          {!seasonRead && (
            <div aria-hidden="true" className="bg-card border border-border rounded-2xl min-h-[17.5rem] md:min-h-[16.5rem]" />
          )}
          {season?.current && (
            <div className={CARD_FEATURED}>
              <div className="flex items-center gap-2 mb-1">
                <Vesica className="w-4 h-4 text-open" />
                <p className={EYEBROW}>Now</p>
              </div>
              <p className="font-display text-2xl font-bold text-card-foreground">{season.current.name}</p>
              {/*
                * `focus` is the season's description. This read `season.current.goal`
                * for its whole life, a key SeasonEntry has never had (the fields are
                * theme, focus, and goals[]), so the line silently never rendered. The
                * page types the payload as `any`, which is why tsc never said so.
                */}
              {season.current.focus && (
                <p className="text-base text-muted-foreground mt-1">{season.current.focus}</p>
              )}
              <p className={`${HINT} mt-2`}>{span(season.current)}</p>
            </div>
          )}

          {season?.current && currentGoals.length > 0 && <SeasonGoals goals={currentGoals} stewardOn={stewardOn} />}

          <div className={CARD}>
            <div className="flex items-center gap-2 mb-4">
              <CalendarDays className="w-5 h-5 text-notice" aria-hidden="true" />
              <h2 className="font-display text-2xl font-bold text-card-foreground">The year's turning</h2>
            </div>
            {/*
              * Filtered on `startsOn` alone. Requiring `endsOn` too dropped every
              * open-ended season, which is exactly what a founding season is, so
              * the village that had only ever declared one was told its calendar
              * "hasn't been set yet".
              */}
            {!seasonRead ? (
              // One season's row, its measured height (100px at 390, 84px from 768 up).
              <div aria-hidden="true" className="h-[6.25rem] md:h-[5.25rem]" />
            ) : (season?.seasons ?? []).filter((s: any) => s.startsOn).length === 0 ? (
              <p className="text-sm text-muted-foreground">
                The season calendar hasn't been set yet. It lives with the stewards.
              </p>
            ) : (
              <ul className="space-y-3">
                {(season?.seasons ?? [])
                  .filter((s: any) => s.startsOn)
                  .sort((a: any, b: any) => a.startsOn.localeCompare(b.startsOn))
                  .map((s: any) => (
                    <li key={s.id ?? s.name} className={QUIET}>
                      <p className="text-base font-medium text-foreground">{s.name}</p>
                      {s.focus && <p className="text-sm text-muted-foreground mt-0.5">{s.focus}</p>}
                      <p className="text-sm text-muted-foreground mt-1">{span(s)}</p>
                    </li>
                  ))}
              </ul>
            )}
            <p className="text-sm leading-relaxed text-muted-foreground mt-5">
              Festival dates ride the season turnings above. To take part in
              shaping one, start at{" "}
              <Link href="/quests" className={LINK}>Quests</Link>
              {workWithUsOn ? (
                <>
                  {" "}or say hello through{" "}
                  <Link href="/work-with-us" className={LINK}>Work With Us</Link>
                </>
              ) : null}
              .
              {eventsModule && (
                <>
                  {" "}Everything already dated sits on the{" "}
                  <Link href="/events" className={LINK}>Village Calendar</Link>.
                </>
              )}
            </p>
          </div>
        </div>
      </section>
      </div>
    </Layout>
  );
}

/**
 * The season's goals, one card each (the lead, 24 Nov 2026: the list read as
 * "a wall of text"). A goal written "Title: the rest" leads with its title in
 * the display face and carries the rest beneath it. Reached goals keep their
 * place in the order the stewards set and wear a filled seal; the count is the
 * village's, never a person's.
 */
function SeasonGoals({ goals, stewardOn }: { goals: { text: string; done?: boolean }[]; stewardOn: boolean }) {
  const reached = goals.filter((g) => g.done).length;
  return (
    <section className={CARD} aria-labelledby="season-goals">
      <p className={EYEBROW}>
        <Trans context="seasonal festivals: eyebrow over this season's goals">This season</Trans>
      </p>
      <div className="mt-1 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id="season-goals" className={H2}>
          <Trans context="seasonal festivals: heading over this season's goals">What we are tending</Trans>
        </h2>
        <p className={HINT}>
          <Trans context="seasonal festivals: how many of the season's goals the village has reached">
            {reached} of {goals.length} reached
          </Trans>
        </p>
      </div>
      <ol className="mt-5 grid gap-3 sm:grid-cols-2">
        {goals.map((g, i) => {
          const text = String(g.text).trim();
          const cut = text.indexOf(": ");
          const title = cut > 0 && cut < 60 ? text.slice(0, cut) : text;
          const rest = cut > 0 && cut < 60 ? text.slice(cut + 2) : "";
          return (
            <li
              key={i}
              className={`season-goal flex items-start gap-3 rounded-xl border p-3.5 ${g.done ? "border-border/60" : "border-border bg-muted"}`}
              data-done={g.done ? "" : undefined}
            >
              <span
                aria-hidden="true"
                className={`mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-full border ${g.done ? "border-notice bg-notice text-background" : "border-notice/60 text-notice"}`}
              >
                {g.done ? <SeedOfLife className="size-5" /> : <Vesica className="size-5" />}
              </span>
              <div className="min-w-0">
                <p className="font-display text-lg leading-snug text-foreground">{title}</p>
                {rest && <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">{rest}</p>}
                <p className="mt-1 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  {g.done ? (
                    <Trans context="seasonal festivals: a season goal the village has reached">Reached</Trans>
                  ) : (
                    <Trans context="seasonal festivals: a season goal still being worked on">Growing</Trans>
                  )}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
      {stewardOn && (
        <p className="mt-5 text-base text-foreground">
          <Trans context="seasonal festivals: under this season's goals, the invitation to the steward path">
            If you can help us meet these, consider the{" "}
            <Link href="/steward" className={LINK}>Village Steward path</Link>.
          </Trans>
        </p>
      )}
    </section>
  );
}
