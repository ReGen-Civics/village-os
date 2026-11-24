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
import { CalendarDays, Check, Sprout } from "lucide-react";
import { CARD, CARD_FEATURED, CHIP_SOFT, EYEBROW, H1, HINT, LEDE, LINK, QUIET, RING, WORLD } from "@/components/journey/look";
import { useStoryPageShown } from "@/lib/brochure";
import { Trans, useLingui } from "@lingui/react/macro";

export default function SeasonalFestivals() {
  const { t } = useLingui();
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
  // The same words and contexts as the /roles goals block (components/roleDraft/SeasonGoals.tsx), so both read alike in every language.
  const goals = currentGoals;
  const reached = goals.filter((g) => g.done).length;

  return (
    <Layout>
      {/* The night world (public launch, 24 Nov 2026): the sheet's look, same words. */}
      <div className={WORLD}>
      <section className="pt-12 pb-4 sm:pt-16">
        <div className="container max-w-2xl">
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
        <div className="container max-w-2xl space-y-4">
          {/* The "Now" card's place while the season is read: an empty card
              of its measured height (282px at 390, 262px from 768 up). */}
          {!seasonRead && (
            <div aria-hidden="true" className="bg-card border border-border rounded-2xl min-h-[17.5rem] md:min-h-[16.5rem]" />
          )}
          {season?.current && (
            <div className={CARD_FEATURED}>
              <div className="flex items-center gap-2 mb-1">
                <Sprout className="w-4 h-4 text-open" aria-hidden="true" />
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
              {/*
                * Each goal its own tile (the lead, 24 Nov 2026: "a wall of text ... a
                * different design to show each seasonal goal"), drawn the way the /roles
                * goals block draws them: its number in a gold ring, and a reached goal's
                * ring filled with a check and the word Done beside it, never "Done:"
                * glued into the goal's own words. One column: the card is narrow, and
                * two columns squeezed a reached goal's words beside its chip.
                */}
              {goals.length > 0 && reached > 0 && (
                <p className={`mt-4 ${HINT}`}>
                  {t({ message: `${reached} of ${goals.length} reached so far`, context: "roles page season goals: how many of the village's goals are done" })}
                </p>
              )}
              {goals.length > 0 && (
                <ol className="mt-3 grid gap-2">
                  {goals.map((g: any, i: number) => (
                    <li
                      key={String(g.id ?? i)}
                      data-done={g.done || undefined}
                      className="flex min-h-14 items-center gap-3 rounded-xl border border-border bg-muted px-3 py-2.5 sm:gap-4 sm:px-4"
                    >
                      <span aria-hidden="true" className={`${RING} font-display text-lg ${g.done ? "bg-notice text-background" : ""}`}>
                        {g.done ? <Check className="size-5 text-background" strokeWidth={3} /> : i + 1}
                      </span>
                      <span className="min-w-0 flex-1 text-base leading-snug text-card-foreground">{g.text}</span>
                      {g.done && <span className={`shrink-0 ${CHIP_SOFT}`}>{t({ message: "Done", context: "roles page goal" })}</span>}
                    </li>
                  ))}
                </ol>
              )}
              {currentGoals.length > 0 && stewardOn && (
                <p className="text-base text-foreground mt-3">
                  <Trans context="seasonal festivals: under this season's goals, the invitation to the steward path">
                    If you can help us meet these, consider the{" "}
                    <Link href="/steward" className={LINK}>Village Steward path</Link>.
                  </Trans>
                </p>
              )}
              <p className={`${HINT} mt-2`}>{span(season.current)}</p>
            </div>
          )}

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
