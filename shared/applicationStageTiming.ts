/**
 * HOW LONG AN APPLICATION SPENDS AT EACH STAGE: one calculation for every page
 * that times the applicant's stages (the admin's role progress page today, the
 * applicant's own averages when that lane reads them).
 *
 * The stages are the lead's (shared/applicantOnboarding.ts `TRACK`, 27 Nov
 * 2026): Our review, References and proposal, Final conversation, Agreement.
 * Received is the instant the application is confirmed, and Start is the
 * decision itself, so neither has a length.
 *
 * DERIVED FROM STAMPS ALREADY KEPT, the way `trackStates` derives the stage
 * itself, so an application in flight is timed with no new column:
 *
 *   Our review            from the confirmed step
 *   References, proposal  from the moment Our review ended: the shortlist's
 *                         yes, then the first conversation written up or the
 *                         references asked for, whichever came first (with no
 *                         conversation before the final, the yes itself). A
 *                         member's application has no review: its references
 *                         asked for open the stage.
 *   Final conversation    from the final conversation opening
 *   Agreement             from the last final conversation written up
 *   (end)                 the decided step
 *
 * A stage is timed only once it has ended: the one an application stands at now
 * has no length yet. A stage it skipped has none. PURE: instants in, hours out.
 */

export const TIMED_STAGES = ["review", "references", "final_interview", "agreement"] as const;
export type TimedStage = (typeof TIMED_STAGES)[number];

/** The stamps one application carries. Epoch milliseconds; null where nothing was stamped. */
export interface StageTimingFacts {
  confirmedAt: number;
  /** When the shortlist said yes; null when it said no or has not answered. */
  shortlistYesAt: number | null;
  refsAskedAt: number | null;
  /** The conversations in their order, the final ones marked. */
  interviews: ReadonlyArray<{ final: boolean; openedAt: number | null; scoredAt: number | null }>;
  decidedAt: number | null;
}

const HOUR = 3_600_000;
const minOf = (...xs: Array<number | null>): number | null => {
  const v = xs.filter((x): x is number => x !== null);
  return v.length ? Math.min(...v) : null;
};

/** When the application entered each stage, or null for a stage it has not reached or skipped. */
export function stageEntries(f: StageTimingFacts): Record<TimedStage, number | null> {
  const talks = f.interviews.filter((i) => !i.final);
  const finals = f.interviews.filter((i) => i.final);
  const finalOpenedAt = minOf(...finals.map((i) => i.openedAt));
  const finalsDoneAt = finals.length > 0 && finals.every((i) => i.scoredAt !== null) ? Math.max(...finals.map((i) => i.scoredAt as number)) : null;
  let referencesAt: number | null = null;
  if (f.shortlistYesAt !== null) {
    const ended = talks.length === 0 ? f.shortlistYesAt : minOf(talks[0].scoredAt, f.refsAskedAt);
    referencesAt = ended === null ? null : Math.max(ended, f.shortlistYesAt);
  } else if (talks.length === 0 && finals.length === 0) {
    // A member's application: no review, no conversations; asking for references opens the stage.
    referencesAt = f.refsAskedAt;
  }
  if (referencesAt !== null && finalOpenedAt !== null && referencesAt > finalOpenedAt) referencesAt = finalOpenedAt;
  return { review: f.confirmedAt, references: referencesAt, final_interview: finalOpenedAt, agreement: finalsDoneAt };
}

/** Hours spent at each stage the application has finished. A stage it stands at, or skipped, is absent. */
export function stageHours(f: StageTimingFacts): Partial<Record<TimedStage, number>> {
  const at = stageEntries(f);
  const out: Partial<Record<TimedStage, number>> = {};
  TIMED_STAGES.forEach((stage, i) => {
    const from = at[stage];
    if (from === null) return;
    const later = TIMED_STAGES.slice(i + 1).map((s) => at[s]);
    const to = minOf(...later.filter((x) => x !== null && x >= from), f.decidedAt !== null && f.decidedAt >= from ? f.decidedAt : null);
    if (to === null) return;
    out[stage] = Math.round(((to - from) / HOUR) * 10) / 10;
  });
  return out;
}

/** The stage an undecided application stands at now, and since when; null once it is decided. */
export function stageNow(f: StageTimingFacts): { stage: TimedStage; since: number } | null {
  if (f.decidedAt !== null) return null;
  const at = stageEntries(f);
  let now: { stage: TimedStage; since: number } = { stage: "review", since: f.confirmedAt };
  for (const stage of TIMED_STAGES) {
    const e = at[stage];
    if (e !== null && e >= now.since) now = { stage, since: e };
  }
  return now;
}
