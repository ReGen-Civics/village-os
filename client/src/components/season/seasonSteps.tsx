/**
 * THE SEASON PAGE'S TABS AND THE MEMBER'S STEPS (the season fold, 27 Nov 2026), apart from the page so the page
 * itself stays a light module: the tab names and the anchors that open them, the three steps (join, plan, align)
 * worked out from each tab's own answer, and the card that draws them with the one next act.
 */
import { ArrowRight, Check } from "lucide-react";
import { Trans } from "@lingui/react/macro";
import { SeedOfLife, Triad, Vesica } from "@/components/sacred/glyphs";
import { Fireflies } from "@/components/journey/nature";
import { BTN_PRIMARY, CARD_FEATURED, EYEBROW } from "@/components/journey/look";
import type { JoinState } from "./JoinSeason";
import type { PlanStatus } from "./YourPlan";
import type { AlignedStatus } from "./AlignedPanel";

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

export function tabFromHash(
  hash: string,
  shown: readonly SeasonTab[]
): SeasonTab | null {
  const t = TAB_OF_ANCHOR[hash.replace(/^#/, "")];
  return t && shown.includes(t) ? t : null;
}

export type StepState = "done" | "now" | "wait";
export interface Step {
  tab: SeasonTab;
  title: string;
  line: string;
  state: StepState;
  /** The gold button's words: where it goes, never the step's title again. */
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
    acts: Record<"join" | "plan" | "aligned", string>;
    joinLine: Record<"none" | "applied" | "picked", string>;
    planLine: {
      filed: string;
      changed: string;
      notFiled: string;
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
      act: words.acts.join,
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
            : words.planLine.notFiled,
      state: done ? "done" : before ? "wait" : "now",
      act: words.acts.plan,
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
      act: words.acts.aligned,
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

/** The steps card: where the member stands, and the one gold act that opens the first unfinished step's tab. */
export function StepsCard({
  steps,
  onOpen,
}: {
  steps: Step[];
  onOpen: (tab: SeasonTab) => void;
}) {
  const next = steps.find(s => s.state === "now") ?? null;
  const allDone = steps.length > 0 && steps.every(s => s.state === "done");
  const open = (tab: SeasonTab) => onOpen(tab);
  return (
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
                <Trans context="season page">Your season</Trans>
              </p>
              <h2
                id="season-you-h"
                className="mt-1 font-display text-2xl leading-snug text-card-foreground sm:text-3xl"
              >
                {allDone ? (
                  <Trans context="season page">Your season is set.</Trans>
                ) : (
                  <Trans context="season page">Where you stand</Trans>
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
    </>
  );
}
