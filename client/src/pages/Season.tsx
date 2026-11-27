/**
 * `/season`: THE SEASON, ONE PAGE (the season fold, 27 Nov 2026).
 *
 * Three pages became this one: Season Plans (`/season-plans` and
 * `/season-plans/mine`), Join the Season (`/season-places`) and Aligned
 * (`/aligned`). Each old address redirects here with its anchor
 * (client/src/App.tsx), so a saved link or an emailed one still lands on the
 * right tab.
 *
 *   THE HERO        the season's name and focus, its goals as a ring (members
 *                   only), its time line, and YOUR SEASON: the member's own
 *                   three steps (join, plan, align) with the one next act
 *   THE TABS        The season (the commons and everyone's plans), Join
 *                   (module season-places), Your plan (module governance) and
 *                   Aligned. A tab is a hash: #season, #join, #plan, #aligned.
 *
 * Every tab stays mounted and the others are hidden, so a half-written plan
 * survives a look at the register, and the steps can read every tab's answer.
 * The steps are the member's own record and never a score: nothing here ranks
 * a person, and a count shown is the village's (goals met) or the member's own
 * (texts waiting on them).
 */
import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { ArrowRight, Check } from "lucide-react";
import { Trans, useLingui } from "@lingui/react/macro";
import Layout from "@/components/Layout";
import { SignInDoors } from "@/components/modules/ModuleGate";
import { useModule, useModules } from "@/modules/ModuleProvider";
import { useAuth } from "@/contexts/AuthContext";
import { useSeason } from "@/lib/gameApi";
import { useNewcomer } from "@/lib/newcomer";
import { GoalRing, SeasonLine } from "@/components/SeasonBanner";
import { DaySun, SeedOfLife, Triad, Vesica } from "@/components/sacred/glyphs";
import CommonsPanel from "@/components/commons/CommonsPanel";
import JoinSeason, { type JoinState } from "@/components/season/JoinSeason";
import YourPlan, {
  commonsFor,
  MY_SEASON_WORDS,
  type PlanStatus,
} from "@/components/season/YourPlan";
import VillagePlans from "@/components/season/VillagePlans";
import AlignedPanel, {
  type AlignedStatus,
} from "@/components/season/AlignedPanel";
import { Fireflies } from "@/components/journey/nature";
import {
  BTN_PRIMARY,
  CARD,
  CARD_FEATURED,
  EYEBROW,
  H1,
  HINT,
  LEDE,
  WORLD,
} from "@/components/journey/look";
import { seasonView, type SeasonGoalView } from "@shared/seasonGoalsView";
import { civilDayWords } from "@shared/seasonPlans";

export const SEASON_TABS = ["season", "join", "plan", "aligned"] as const;
export type SeasonTab = (typeof SEASON_TABS)[number];

/** Which tab an anchor opens. The old pages' anchors and their sections' ids land on the tab that holds them. */
export const TAB_OF_ANCHOR: Readonly<Record<string, SeasonTab>> = {
  season: "season",
  goals: "season",
  everyone: "season",
  join: "join",
  plan: "plan",
  aligned: "aligned",
  confidentiality: "aligned",
};

function tabFromHash(
  hash: string,
  shown: readonly SeasonTab[]
): SeasonTab | null {
  const t = TAB_OF_ANCHOR[hash.replace(/^#/, "")];
  return t && shown.includes(t) ? t : null;
}

type StepState = "done" | "now" | "wait";
interface Step {
  tab: SeasonTab;
  title: string;
  line: string;
  state: StepState;
  act: string;
}

/**
 * The member's three steps, in the order a season asks them: join it, plan it,
 * align with what it asks. A step whose tab is off for this village, or whose
 * read has not answered, is left out or waits; nothing is guessed.
 */
export function seasonSteps(
  input: {
    join: JoinState | null;
    plan: PlanStatus | null;
    aligned: AlignedStatus | null;
  },
  words: {
    join: string;
    plan: string;
    align: string;
    joinActs: string;
    planActs: string;
    alignActs: string;
    joinLine: Record<"none" | "applied" | "picked", string>;
    planLine: {
      filed: string;
      changed: string;
      notFiled: string;
      closed: string;
      before: (on: string) => string;
    };
    alignLine: {
      clear: string;
      waiting: (n: number) => string;
      agreement: string;
    };
  },
  opensOn: string | null
): Step[] {
  const out: Step[] = [];
  const j = input.join;
  if (j === "none" || j === "applied" || j === "picked") {
    out.push({
      tab: "join",
      title: words.join,
      line: words.joinLine[j],
      state: j === "picked" ? "done" : j === "applied" ? "wait" : "now",
      act: words.joinActs,
    });
  }
  const p = input.plan;
  if (p && p.state === "ready") {
    const done = p.filed && !p.changed;
    const before = p.window === "before";
    out.push({
      tab: "plan",
      title: words.plan,
      line: done
        ? words.planLine.filed
        : p.filed
          ? words.planLine.changed
          : before && opensOn
            ? words.planLine.before(opensOn)
            : p.window === "closed"
              ? words.planLine.closed
              : words.planLine.notFiled,
      state: done ? "done" : before ? "wait" : "now",
      act: words.planActs,
    });
  }
  const a = input.aligned;
  if (a && a.waiting !== null && a.agreement !== null) {
    const waiting = a.waiting + (a.agreement === "asked" ? 1 : 0);
    out.push({
      tab: "aligned",
      title: words.align,
      line:
        waiting === 0
          ? words.alignLine.clear
          : a.waiting === 0
            ? words.alignLine.agreement
            : words.alignLine.waiting(waiting),
      state: waiting === 0 ? "done" : "now",
      act: words.alignActs,
    });
  }
  return out;
}

/**
 * Each step's glyph, from the sacred set: three circles meeting for joining a circle's team, the seed of life for a
 * plan that grows, the vesica (two circles, each through the other's centre) for two parties aligning.
 */
const STEP_GLYPH: Record<SeasonTab, typeof SeedOfLife> = {
  season: SeedOfLife,
  join: Triad,
  plan: SeedOfLife,
  aligned: Vesica,
};

/** One step as a stone: a gold ring once done, filled gold while it is the next act, an edge while it waits on someone else. */
function Stone({ step, onGo }: { step: Step; onGo: () => void }) {
  const Glyph = STEP_GLYPH[step.tab];
  return (
    <button
      type="button"
      onClick={onGo}
      data-step={step.tab}
      data-state={step.state}
      className={`jw-btn flex min-h-11 w-full items-center gap-3 rounded-xl border p-3 text-left sm:flex-col sm:items-start sm:p-4 ${step.state === "now" ? "border-notice bg-notice/10" : "border-border bg-muted hover:border-notice"}`}
    >
      <span
        aria-hidden="true"
        className={`grid size-11 shrink-0 place-items-center rounded-full border-2 ${step.state === "done" ? "border-notice text-notice" : step.state === "now" ? "border-notice bg-notice text-background" : "border-border text-muted-foreground"}`}
      >
        {step.state === "done" ? (
          <Check className="size-5" />
        ) : (
          <Glyph className="size-6" />
        )}
      </span>
      <span className="min-w-0">
        <span className="block font-semibold text-foreground">
          {step.title}
        </span>
        <span
          className={`block text-sm ${step.state === "done" ? "text-open" : step.state === "now" ? "text-notice" : "text-muted-foreground"}`}
        >
          {step.line}
        </span>
      </span>
    </button>
  );
}

export default function Season() {
  const { t } = useLingui();
  const { user } = useAuth();
  const live = useSeason();
  const newcomer = useNewcomer();
  const modules = useModules();
  const governance = !!useModule("governance");
  const places = !!useModule("season-places");
  const tabsId = useId();

  const shown = useMemo<SeasonTab[]>(
    () =>
      SEASON_TABS.filter(tab =>
        tab === "join" ? places : tab === "plan" ? governance : true
      ),
    [places, governance]
  );
  const [tab, setTab] = useState<SeasonTab>("season");
  const [join, setJoin] = useState<JoinState | null>(null);
  const [plan, setPlan] = useState<PlanStatus | null>(null);
  const [aligned, setAligned] = useState<AlignedStatus | null>(null);
  const onJoin = useCallback((s: JoinState) => setJoin(s), []);
  const onPlan = useCallback((s: PlanStatus) => setPlan(s), []);
  const onAligned = useCallback((s: AlignedStatus) => setAligned(s), []);

  // The address picks the tab: a redirect from an old page, a link from the profile, or the back button.
  useEffect(() => {
    if (!modules.loaded) return;
    const go = () => {
      const next = tabFromHash(window.location.hash, shown);
      if (next) setTab(next);
    };
    go();
    window.addEventListener("hashchange", go);
    return () => window.removeEventListener("hashchange", go);
  }, [modules.loaded, shown]);

  const open = (next: SeasonTab, scroll = true) => {
    setTab(next);
    if (typeof window !== "undefined") {
      window.history.replaceState(
        window.history.state,
        "",
        `${window.location.pathname}${window.location.search}#${next}`
      );
      if (scroll)
        document
          .getElementById(`${tabsId}-bar`)
          ?.scrollIntoView?.({ block: "start" });
    }
  };

  const active = live?.current ?? null;
  const view = active
    ? seasonView(
        active,
        live?.today
          ? new Date(`${live.today.slice(0, 10)}T12:00:00Z`)
          : new Date()
      )
    : null;
  const seasonName =
    active?.name || live?.upcoming?.name || plan?.seasonName || "";
  const focus = active?.focus || live?.upcoming?.focus || "";
  const goals: SeasonGoalView[] = view?.goals.length
    ? view.goals
    : plan?.seasonId
      ? commonsFor({ id: plan.seasonId, goals: plan.goals }, live)
      : [];
  const met = goals.filter(g => g.done).length;
  const showRing = goals.length > 0 && !newcomer && !!user;
  const closes =
    !!active && !live?.openEnded && !!active.endsOn && !!active.startsOn;

  const steps = user
    ? seasonSteps(
        { join: places ? join : null, plan: governance ? plan : null, aligned },
        {
          join: t({ message: "Join the season", context: "season page, step" }),
          plan: t({
            message: "Plan your season",
            context: "season page, step",
          }),
          align: t({ message: "Align", context: "season page, step" }),
          joinActs: t({
            message: "Apply for this season",
            context: "season page, next act",
          }),
          planActs: t({
            message: "Plan your season",
            context: "season page, next act",
          }),
          alignActs: t({
            message: "Read and align",
            context: "season page, next act",
          }),
          joinLine: {
            none: t({
              message: "Not applied yet",
              context: "season page, join step",
            }),
            applied: t({
              message: "Applied. The picker picks next.",
              context: "season page, join step",
            }),
            picked: t({
              message: "You're in",
              context: "season page, join step",
            }),
          },
          planLine: {
            filed: t({ message: "Filed", context: "season page, plan step" }),
            changed: t({
              message: "Changes not filed yet",
              context: "season page, plan step",
            }),
            notFiled: t({
              message: "Not filed yet",
              context: "season page, plan step",
            }),
            closed: t({
              message: "The window has closed. You can still file.",
              context: "season page, plan step",
            }),
            before: (on: string) =>
              t({
                message: `Opens on ${civilDayWords(on)}`,
                context: "season page, plan step",
              }),
          },
          alignLine: {
            clear: t({
              message: "Nothing waits on you",
              context: "season page, align step",
            }),
            agreement: t({
              message: "The agreement waits on you",
              context: "season page, align step",
            }),
            waiting: (n: number) =>
              n === 1
                ? t({
                    message: "One waits on you",
                    context: "season page, align step",
                  })
                : t({
                    message: `${n} wait on you`,
                    context: "season page, align step",
                  }),
          },
        },
        live?.planWindow?.opensOn ?? null
      )
    : [];
  const next = steps.find(s => s.state === "now") ?? null;
  const allDone = steps.length > 0 && steps.every(s => s.state === "done");

  const tabLabel: Record<SeasonTab, string> = {
    season: t({ message: "Season", context: "season page, tab" }),
    join: t({ message: "Join", context: "season page, tab" }),
    plan: t({ message: "Your plan", context: "season page, tab" }),
    aligned: t({ message: "Aligned", context: "season page, tab" }),
  };

  return (
    <Layout>
      <div className={`${WORLD} pb-16 pt-6 sm:pt-10`}>
        <div className="container max-w-5xl space-y-5 px-4">
          {/* THE HERO: the season once, and where you stand in it. */}
          <header
            className={`${CARD} relative overflow-hidden`}
            data-season-hero=""
          >
            {/* The seed of life behind the season, faint: structure under the page, never a field of light behind text. */}
            <SeedOfLife
              strokeWidth={0.35}
              className="pointer-events-none absolute -right-24 -top-24 size-72 text-notice/15 sm:-right-24 sm:-top-32 sm:size-96"
              aria-hidden="true"
            />
            <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:gap-8">
              {showRing ? (
                <div className="flex items-center gap-4 sm:flex-col sm:gap-2 sm:text-center">
                  <GoalRing met={met} total={goals.length} />
                  <span
                    className="text-sm text-muted-foreground"
                    data-season-goals-met=""
                  >
                    <Trans context="season page, goals met beside the ring">
                      {met} of {goals.length} goals met
                    </Trans>
                  </span>
                </div>
              ) : null}
              <div className="grid min-w-0 flex-1 gap-2">
                <p className={`${EYEBROW} inline-flex items-center gap-2`}>
                  <DaySun className="size-4" aria-hidden="true" />
                  {seasonName || (
                    <Trans context="season page, eyebrow with no season named">
                      This season
                    </Trans>
                  )}
                </p>
                <h1 className={H1}>
                  {focus || (
                    <Trans context="season page, title with no focus set">
                      The season
                    </Trans>
                  )}
                </h1>
                {closes && active ? (
                  <SeasonLine
                    startsOn={active.startsOn}
                    endsOn={active.endsOn}
                    day={view?.day ?? null}
                    of={view?.of ?? null}
                  />
                ) : null}
                {!active && live?.upcoming?.startsOn ? (
                  <p className={LEDE}>
                    <Trans context="season page, the next season's first day">
                      Begins on {civilDayWords(live.upcoming.startsOn)}.
                    </Trans>
                  </p>
                ) : null}
              </div>
            </div>
          </header>

          {!user ? (
            <section
              className={`${CARD} text-center`}
              aria-labelledby="season-signin-h"
            >
              <h2
                id="season-signin-h"
                className="font-display text-2xl text-foreground"
              >
                <Trans context="season page, signed out">
                  Sign in to take part in the season.
                </Trans>
              </h2>
              <p className={`${HINT} mx-auto mt-2 max-w-md`}>
                <Trans context="season page, signed out line">
                  Join the season, plan your part, and align with what the
                  village asks.
                </Trans>
              </p>
              <div className="mt-5">
                <SignInDoors next="/season" />
              </div>
            </section>
          ) : (
            <>
              {steps.length > 0 && (
                <section
                  aria-labelledby="season-you-h"
                  className={CARD_FEATURED}
                  data-season-steps=""
                >
                  <div className="flex flex-wrap items-end justify-between gap-3">
                    <div>
                      <p className={EYEBROW}>
                        <Trans context="season page, the member's steps eyebrow">
                          Your season
                        </Trans>
                      </p>
                      <h2
                        id="season-you-h"
                        className="mt-1 font-display text-2xl leading-snug text-card-foreground sm:text-3xl"
                      >
                        {allDone ? (
                          <Trans context="season page, every step done">
                            Your season is set.
                          </Trans>
                        ) : next ? (
                          <Trans context="season page, the steps heading">
                            Where you stand
                          </Trans>
                        ) : (
                          <Trans context="season page, waiting on others">
                            Waiting on the village.
                          </Trans>
                        )}
                      </h2>
                    </div>
                    {next ? (
                      <Fireflies>
                        <button
                          type="button"
                          className={BTN_PRIMARY}
                          onClick={() => open(next.tab)}
                          data-season-next=""
                        >
                          {next.act}
                          <ArrowRight className="size-4" aria-hidden="true" />
                        </button>
                      </Fireflies>
                    ) : null}
                  </div>
                  <ol
                    className={`mt-4 grid gap-2 ${steps.length === 3 ? "sm:grid-cols-3" : steps.length === 2 ? "sm:grid-cols-2" : ""}`}
                  >
                    {steps.map(s => (
                      <li key={s.tab}>
                        <Stone step={s} onGo={() => open(s.tab)} />
                      </li>
                    ))}
                  </ol>
                </section>
              )}

              {/* THE TABS. Sticky under the site header, so the four doors stay one tap away on a long tab. */}
              <div
                id={`${tabsId}-bar`}
                role="tablist"
                aria-label={t({
                  message: "The season's parts",
                  context: "season page, tabs",
                })}
                className={`sticky top-24 z-30 grid scroll-mt-24 rounded-2xl border border-border bg-card/95 p-1 shadow-sm backdrop-blur`}
                style={{
                  gridTemplateColumns: `repeat(${shown.length}, minmax(0, 1fr))`,
                }}
              >
                {shown.map(x => (
                  <button
                    key={x}
                    id={`${tabsId}-tab-${x}`}
                    type="button"
                    role="tab"
                    aria-selected={tab === x}
                    aria-controls={`${tabsId}-panel-${x}`}
                    onClick={() => open(x, false)}
                    className={`jw-btn relative flex min-h-11 items-center justify-center rounded-xl px-2 text-sm ${tab === x ? "bg-notice font-semibold text-background" : "font-medium text-muted-foreground hover:text-foreground"}`}
                  >
                    {tabLabel[x]}
                  </button>
                ))}
              </div>

              <div
                id={`${tabsId}-panel-season`}
                role="tabpanel"
                aria-labelledby={`${tabsId}-tab-season`}
                hidden={tab !== "season"}
                className="space-y-5"
              >
                {goals.length > 0 ? (
                  <section
                    id="goals"
                    className={CARD}
                    aria-label={MY_SEASON_WORDS.commonsHeading}
                  >
                    <CommonsPanel
                      goals={goals}
                      head={
                        <>
                          <p className={EYEBROW}>
                            {MY_SEASON_WORDS.commonsEyebrow}
                          </p>
                          <h2 className="mt-2 font-display text-2xl text-card-foreground">
                            {MY_SEASON_WORDS.commonsHeading}
                          </h2>
                          <p className={`mt-2 ${HINT}`}>
                            <Trans context="season page, the commons line">
                              The village's goals for this season. Moss spreads
                              into a goal when the whole village reaches it.
                            </Trans>
                          </p>
                        </>
                      }
                    />
                  </section>
                ) : (
                  <section id="goals" className={CARD}>
                    <p className={HINT}>
                      <Trans context="season page, no goals set">
                        The village has not set this season's goals yet.
                      </Trans>
                    </p>
                  </section>
                )}
                {governance ? (
                  <div id="everyone">
                    <VillagePlans />
                  </div>
                ) : null}
              </div>

              {places ? (
                <div
                  id={`${tabsId}-panel-join`}
                  role="tabpanel"
                  aria-labelledby={`${tabsId}-tab-join`}
                  hidden={tab !== "join"}
                >
                  <JoinSeason onStatus={onJoin} />
                </div>
              ) : null}

              {governance ? (
                <div
                  id={`${tabsId}-panel-plan`}
                  role="tabpanel"
                  aria-labelledby={`${tabsId}-tab-plan`}
                  hidden={tab !== "plan"}
                >
                  <YourPlan onStatus={onPlan} />
                </div>
              ) : null}

              <div
                id={`${tabsId}-panel-aligned`}
                role="tabpanel"
                aria-labelledby={`${tabsId}-tab-aligned`}
                hidden={tab !== "aligned"}
              >
                <AlignedPanel onStatus={onAligned} />
              </div>
            </>
          )}
        </div>
      </div>
    </Layout>
  );
}
