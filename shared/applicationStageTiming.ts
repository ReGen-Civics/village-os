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
 * THE SAME RULES AS THE TRACK (`trackStates` in shared/applicantOnboarding.ts),
 * so the stage an application stands at here is always the stage its track
 * shows: a conversation is done once it is written up OR skipped, and the final
 * conversation has opened once its state is anything but `waiting`. A skip
 * records no time (server/repos/applicationReview.ts), so a skipped
 * conversation is done at its opening when it had one, and otherwise at the
 * moment the stage before it began: the clock gives the skipped stretch no
 * length rather than inventing one.
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
  /**
   * The conversations in their order, the final ones marked. `skipped` and `waiting` are the conversation's state
   * (`skipped`, `waiting`); left out, a conversation is waiting until it has an opening time and never skipped.
   */
  interviews: ReadonlyArray<{ final: boolean; openedAt: number | null; scoredAt: number | null; skipped?: boolean; waiting?: boolean }>;
  decidedAt: number | null;
  /**
   * `member`: a member's first-role application, walked on its own track (`memberTrackOf`): no review and no
   * conversations; References from the moment it is received, Agreement once every reference is followed up.
   * Left out, the application is a proposal from outside, on `trackStates`.
   */
  door?: "open" | "member";
  /** When the last reference was followed up, once every one of them is. Read for a member's application. */
  refsAllFollowedUpAt?: number | null;
  /** The decision was to adopt. Only an adoption ends Agreement; any other decision ends nothing. */
  adopted?: boolean;
  /**
   * RULING 7 (the lead, 27 Nov 2026): when the proposal was SENT to the anchor circle (the `to_circle` step), which is
   * where Agreement begins; null while it has not been sent. Left out (a caller that does not know), Agreement begins
   * at the last final conversation's write-up, the rule before ruling 7.
   */
  toCircleAt?: number | null;
}

const HOUR = 3_600_000;
const minOf = (...xs: Array<number | null>): number | null => {
  const v = xs.filter((x): x is number => x !== null);
  return v.length ? Math.min(...v) : null;
};

type Talk = StageTimingFacts["interviews"][number];
/** Written up or skipped: the track's `done`. */
const isDone = (i: Talk) => i.scoredAt !== null || i.skipped === true;
/** Anything but waiting: the track's test for the final conversation having opened. */
const hasOpened = (i: Talk) => (i.waiting === undefined ? i.openedAt !== null || i.skipped === true || i.scoredAt !== null : !i.waiting);
/** When a done conversation was done: written up, or for a skip (which keeps no time) its opening, else `fallback`. */
const doneAt = (i: Talk, fallback: number | null): number | null => i.scoredAt ?? (i.skipped ? (i.openedAt ?? fallback) : null);

/**
 * When the application entered each stage, or null for a stage it has not reached or skipped, and which of those
 * instants are GUESSED: a skip keeps no time, so an entry placed at a skipped conversation's opening (or at the stage
 * before it) is the clock's best placement, never a measurement.
 */
function stageParts(f: StageTimingFacts): { at: Record<TimedStage, number | null>; guessed: Set<TimedStage> } {
  const guessed = new Set<TimedStage>();
  if (f.door === "member") {
    // A member's application (memberTrackOf): References from the start, Agreement once every reference is followed up.
    return { at: { review: null, references: f.confirmedAt, final_interview: null, agreement: f.refsAllFollowedUpAt ?? null }, guessed };
  }
  const talks = f.interviews.filter((i) => !i.final);
  const finals = f.interviews.filter((i) => i.final);
  let referencesAt: number | null = null;
  if (f.shortlistYesAt !== null) {
    const first = talks[0];
    const firstDone = first && isDone(first) ? doneAt(first, f.shortlistYesAt) : null;
    const ended = !first ? f.shortlistYesAt : minOf(firstDone, f.refsAskedAt);
    referencesAt = ended === null ? null : Math.max(ended, f.shortlistYesAt);
    // Our review ended at a skip, which keeps no time: the moment is placed, not measured.
    if (first && first.skipped && first.scoredAt === null && firstDone !== null && (f.refsAskedAt === null || firstDone < f.refsAskedAt)) guessed.add("references");
  }
  // A proposal from outside with no shortlist yes stays at Our review, references asked or not: the track's rule.
  const opened = finals.filter(hasOpened);
  // The final opened: at its opening time, or (opened with none recorded) the moment the stage before it began.
  const knownOpening = minOf(...opened.map((i) => i.openedAt));
  const finalOpenedAt = opened.length ? (knownOpening ?? referencesAt ?? f.confirmedAt) : null;
  if (opened.length && knownOpening === null) guessed.add("final_interview");
  if (referencesAt !== null && finalOpenedAt !== null && referencesAt > finalOpenedAt) referencesAt = finalOpenedAt;
  const finalsDone = finals.length > 0 && finals.every(isDone);
  const finalsDoneAt = finalsDone ? Math.max(...finals.map((i) => doneAt(i, finalOpenedAt) ?? finalOpenedAt ?? f.confirmedAt)) : null;
  if (f.toCircleAt !== undefined) {
    // Sent to the circle: a measured instant, never a guess. Not sent: no Agreement yet.
    return { at: { review: f.confirmedAt, references: referencesAt, final_interview: finalOpenedAt, agreement: f.toCircleAt }, guessed };
  }
  if (finalsDone && finals.some((i) => i.scoredAt === null)) guessed.add("agreement");
  return { at: { review: f.confirmedAt, references: referencesAt, final_interview: finalOpenedAt, agreement: finalsDoneAt }, guessed };
}

/** When the application entered each stage, or null for a stage it has not reached or skipped. */
export function stageEntries(f: StageTimingFacts): Record<TimedStage, number | null> {
  return stageParts(f).at;
}

/**
 * Hours spent at each stage the application PASSED. A stage ends only where the next one begins, and a decision ends
 * only Agreement, and only as an adoption: an application declined, withdrawn or closed after 90 quiet days stopped at
 * its stage and never passed it, so that stage is absent (counting its whole wait as a pass is how an average of
 * passers at 2, 4 and 9 days once read 43). A stage it stands at, or skipped, is absent, and so is a stage whose start
 * or end the clock had to place because a skip kept no time: a skipped stretch counts neither as 0 nor as a guess.
 */
export function stageHours(f: StageTimingFacts): Partial<Record<TimedStage, number>> {
  const { at, guessed } = stageParts(f);
  const out: Partial<Record<TimedStage, number>> = {};
  TIMED_STAGES.forEach((stage, i) => {
    const from = at[stage];
    if (from === null || guessed.has(stage)) return;
    const next = TIMED_STAGES.slice(i + 1).find((s) => at[s] !== null && (at[s] as number) >= from);
    if (next && guessed.has(next)) return;
    const adoptedAt = stage === "agreement" && f.adopted === true && f.decidedAt !== null && f.decidedAt >= from ? f.decidedAt : null;
    const to = next ? at[next] : adoptedAt;
    if (to === null) return;
    out[stage] = Math.round(((to - from) / HOUR) * 10) / 10;
  });
  return out;
}

/** The stage an undecided application stands at now, and since when; null once it is decided. */
export function stageNow(f: StageTimingFacts): { stage: TimedStage; since: number } | null {
  if (f.decidedAt !== null) return null;
  const at = stageEntries(f);
  let now: { stage: TimedStage; since: number } = { stage: f.door === "member" ? "references" : "review", since: f.confirmedAt };
  for (const stage of TIMED_STAGES) {
    const e = at[stage];
    if (e !== null && e >= now.since) now = { stage, since: e };
  }
  return now;
}
