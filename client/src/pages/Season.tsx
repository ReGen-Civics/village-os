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
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { Trans, useLingui } from "@lingui/react/macro";
import Layout from "@/components/Layout";
import { SignInDoors } from "@/components/modules/ModuleGate";
import { useModule, useModules } from "@/modules/ModuleProvider";
import { useAuth } from "@/contexts/AuthContext";
import { useSeason } from "@/lib/gameApi";
import { useNewcomer } from "@/lib/newcomer";
import { GoalRing, SeasonLine } from "@/components/SeasonBanner";
import { DaySun, SeedOfLife } from "@/components/sacred/glyphs";
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
import TabBoundary from "@/components/season/TabBoundary";
import { landOn } from "@/components/season/land";

/** Anchors on the Season tab that still land, because they name a place lower on it. */
const LANDS = new Set(["#everyone"]);
import { CARD, EYEBROW, H1, HINT, WORLD } from "@/components/journey/look";
import { seasonView, type SeasonGoalView } from "@shared/seasonGoalsView";
import { civilDayWords } from "@shared/seasonPlans";

import {
  SEASON_TABS,
  StepsCard,
  seasonSteps,
  tabFromHash,
  type SeasonTab,
} from "@/components/season/seasonSteps";
export {
  SEASON_TABS,
  TAB_OF_ANCHOR,
  seasonSteps,
  type SeasonTab,
} from "@/components/season/seasonSteps";

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

  /**
   * Open a tab. `scroll` brings the tab bar to the top of the screen, so the tab's own content is the first thing
   * under it; `keepHash` leaves an arrival's anchor in place (#confidentiality, which the Aligned tab scrolls to).
   */
  const open = useCallback(
    (next: SeasonTab, scroll = true, keepHash = false) => {
      setTab(next);
      if (typeof window === "undefined") return;
      if (!keepHash)
        window.history.replaceState(
          window.history.state,
          "",
          `${window.location.pathname}${window.location.search}#${next}`
        );
      // A tab lands on its own panel (scroll-mt-40 keeps it clear of the header and the sticky tab bar).
      if (scroll)
        requestAnimationFrame(() =>
          document.getElementById(`${tabsId}-panel-${next}`)?.scrollIntoView?.({
            block: "start",
            behavior: "instant" as ScrollBehavior,
          })
        );
    },
    [tabsId]
  );

  // The address picks the tab: a redirect from an old page, a notice, a link from the profile, or the back button.
  // Arriving for a tab other than Season opens it AND brings it up, once, so the first phone screen shows what the
  // link was for; a bare /season stays on the hero.
  const arrived = useRef(false);
  /** Set on an arrival for a tab other than Season, until the landing below has brought it up. */
  const landing = useRef(false);
  useEffect(() => {
    if (!modules.loaded || !user) return;
    const go = () => {
      const next = tabFromHash(window.location.hash, shown);
      if (!next) return;
      if (next === "season" && !LANDS.has(window.location.hash)) setTab(next);
      else open(next, true, true);
    };
    if (!arrived.current) {
      arrived.current = true;
      // The first arrival does not scroll here: the landing below does it once, after the page has settled.
      const next = tabFromHash(window.location.hash, shown);
      if (next) {
        setTab(next);
        if (next !== "season" || LANDS.has(window.location.hash))
          landing.current = true;
      }
    }
    window.addEventListener("hashchange", go);
    return () => window.removeEventListener("hashchange", go);
  }, [modules.loaded, user, shown, open]);

  /*
   * LANDING, ONCE THE PAGE HAS SETTLED. The steps card above the tabs grows as each tab's read answers, which moved
   * an early scroll off its mark (QA round 1: ?renew= left the role under the sticky bar). So the arrival is brought
   * up again once every step has answered (or after a short wait for one that never does): the agreement for
   * #confidentiality, the role for ?renew=, otherwise the tab bar with the tab's content under it.
   */
  const [waited, setWaited] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setWaited(true), 1500);
    return () => clearTimeout(id);
  }, []);
  const settled =
    waited ||
    ((!places || (join !== null && join !== "loading")) &&
      (!governance || plan !== null) &&
      aligned?.waiting != null &&
      aligned?.agreement != null);
  // The page does the only landing scroll (QA round 2): instant, and held for a moment against anything above it
  // folding (land.ts). Its target, most specific first: the agreement, the role to renew, everyone's plans, the panel.
  const stopLanding = useRef<() => void>(() => {});
  useEffect(() => {
    if (!settled || !landing.current) return;
    landing.current = false;
    const renew = new URLSearchParams(window.location.search).get("renew");
    const hash = window.location.hash;
    const target =
      (hash === "#confidentiality"
        ? document.getElementById("confidentiality")
        : null) ??
      (renew && tab === "plan"
        ? document.getElementById(`seat-${renew}`)
        : null) ??
      (hash === "#everyone" ? document.getElementById("everyone") : null) ??
      document.getElementById(`${tabsId}-panel-${tab}`);
    if (target) stopLanding.current = landOn(target);
  }, [settled, tab, tabsId]);
  useEffect(() => () => stopLanding.current(), []);

  /** The tab bar's keys: Left and Right move to the next tab, Home and End to the first and last (the ARIA tabs pattern). */
  const onTabKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const i = shown.indexOf(tab);
    const to =
      e.key === "ArrowRight"
        ? shown[(i + 1) % shown.length]
        : e.key === "ArrowLeft"
          ? shown[(i - 1 + shown.length) % shown.length]
          : e.key === "Home"
            ? shown[0]
            : e.key === "End"
              ? shown[shown.length - 1]
              : null;
    if (!to) return;
    e.preventDefault();
    open(to, false);
    document.getElementById(`${tabsId}-tab-${to}`)?.focus();
  };
  const failed = t({
    message: "This part of the season could not be drawn.",
    context: "season page",
  });

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
          join: t({ message: "Join the season", context: "season page" }),
          plan: t({
            message: "Plan your season",
            context: "season page",
          }),
          align: t({ message: "Read and align", context: "season page" }),
          acts: {
            join: t({
              message: "Open your application",
              context: "season page",
            }),
            plan: t({
              message: "Open your plan",
              context: "season page",
            }),
            aligned: t({
              message: "Open what waits on you",
              context: "season page",
            }),
          },
          joinLine: {
            none: t({
              message: "Not applied yet",
              context: "season page",
            }),
            applied: t({
              message: "Applied. The picker picks next.",
              context: "season page",
            }),
            picked: t({
              message: "You're in",
              context: "season page",
            }),
          },
          planLine: {
            filed: t({ message: "Filed", context: "season page" }),
            changed: t({
              message: "Changes not filed yet",
              context: "season page",
            }),
            notFiled: t({
              message: "Not filed yet",
              context: "season page",
            }),
            before: (on: string) =>
              t({
                message: `Opens on ${civilDayWords(on)}`,
                context: "season page",
              }),
          },
          alignLine: {
            clear: t({
              message: "Nothing waits on you",
              context: "season page",
            }),
            agreement: t({
              message: "The agreement waits on you",
              context: "season page",
            }),
            waiting: (n: number) =>
              n === 1
                ? t({
                    message: "One waits on you",
                    context: "season page",
                  })
                : t({
                    message: `${n} wait on you`,
                    context: "season page",
                  }),
          },
        },
        live?.planWindow?.opensOn ?? null
      )
    : [];

  const tabLabel: Record<SeasonTab, string> = {
    season: t({ message: "Season", context: "season page" }),
    join: t({ message: "Join", context: "season page" }),
    plan: t({ message: "Your plan", context: "season page" }),
    aligned: t({ message: "Aligned", context: "season page" }),
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
                    <Trans context="season page">
                      {met} of {goals.length} goals met
                    </Trans>
                  </span>
                </div>
              ) : null}
              <div className="grid min-w-0 flex-1 gap-2">
                <p className={`${EYEBROW} inline-flex items-center gap-2`}>
                  <DaySun className="size-4" aria-hidden="true" />
                  {seasonName || (
                    <Trans context="season page">
                      This season
                    </Trans>
                  )}
                </p>
                <h1 className={H1}>
                  {focus || (
                    <Trans context="season page">
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
                <Trans context="season page">
                  Sign in to take part in the season.
                </Trans>
              </h2>
              <div className="mt-5">
                <SignInDoors next="/season" />
              </div>
            </section>
          ) : (
            <>
              <StepsCard steps={steps} onOpen={open} />

              {/* THE TABS. Sticky under the site header, so the four doors stay one tap away on a long tab. */}
              <div
                id={`${tabsId}-bar`}
                role="tablist"
                onKeyDown={onTabKey}
                aria-label={t({
                  message: "The season's parts",
                  context: "season page",
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
                    tabIndex={tab === x ? 0 : -1}
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
                className="scroll-mt-40 space-y-5"
                aria-labelledby={`${tabsId}-tab-season`}
                hidden={tab !== "season"}
              >
                <TabBoundary message={failed}>
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
                              <Trans context="season page">
                                The village's goals for this season. Moss
                                spreads into a goal when the whole village
                                reaches it.
                              </Trans>
                            </p>
                          </>
                        }
                      />
                    </section>
                  ) : null}
                  {governance ? (
                    <div id="everyone" className="scroll-mt-40">
                      <VillagePlans />
                    </div>
                  ) : null}
                </TabBoundary>
              </div>

              {places ? (
                <div
                  id={`${tabsId}-panel-join`}
                  role="tabpanel"
                  className="scroll-mt-40"
                  aria-labelledby={`${tabsId}-tab-join`}
                  hidden={tab !== "join"}
                >
                  <TabBoundary message={failed}>
                    <JoinSeason onStatus={onJoin} />
                  </TabBoundary>
                </div>
              ) : null}

              {governance ? (
                <div
                  id={`${tabsId}-panel-plan`}
                  role="tabpanel"
                  className="scroll-mt-40"
                  aria-labelledby={`${tabsId}-tab-plan`}
                  hidden={tab !== "plan"}
                >
                  <TabBoundary message={failed}>
                    <YourPlan onStatus={onPlan} />
                  </TabBoundary>
                </div>
              ) : null}

              <div
                id={`${tabsId}-panel-aligned`}
                role="tabpanel"
                className="scroll-mt-40"
                aria-labelledby={`${tabsId}-tab-aligned`}
                hidden={tab !== "aligned"}
              >
                <TabBoundary message={failed}>
                  <AlignedPanel onStatus={onAligned} />
                </TabBoundary>
              </div>
            </>
          )}
        </div>
      </div>
    </Layout>
  );
}
