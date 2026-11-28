/**
 * THE VILLAGE'S REAL AVERAGES, STAGE BY STAGE, AS THE APPLICANT READS THEM (the lead, 27 Nov 2026: "Let's have this be
 * based on our averages, so track them and give them actual averages based on our work. Keep the one moon cycle
 * promise so we can over deliver").
 *
 * ONE CALCULATION. Each application's time at each stage comes from `stageHours` (shared/applicationStageTiming.ts),
 * the same one the admin's role progress page reads, so the applicant's averages and the admin's medians agree. That
 * file derives every stage's entry from stamps already kept; nothing new is recorded.
 *
 * An average is said only once at least `AVERAGE_MIN_SAMPLE` applications have finished that stage; until then nothing
 * is said. Only averages ever leave here, never one application's times. The first email keeps its own promise ("within
 * one moon cycle"), untouched.
 *
 * PURE.
 */
import { stageHours, TIMED_STAGES, type StageTimingFacts, type TimedStage } from "./applicationStageTiming";
import { median } from "./roleMeasures";

export const AVERAGE_MIN_SAMPLE = 3;

export type AveragedStage = TimedStage;

/** Each stage's median in whole days (at least 1), or nothing for a stage fewer than the sample have finished. */
export function stageAverages(apps: readonly StageTimingFacts[]): Partial<Record<AveragedStage, number>> {
  const spans: Record<TimedStage, number[]> = { review: [], references: [], final_interview: [], agreement: [] };
  for (const a of apps) {
    const hours = stageHours(a);
    for (const stage of TIMED_STAGES) {
      const h = hours[stage];
      if (typeof h === "number" && h >= 0) spans[stage].push(h);
    }
  }
  const out: Partial<Record<AveragedStage, number>> = {};
  for (const stage of TIMED_STAGES) {
    const list = spans[stage];
    if (list.length < AVERAGE_MIN_SAMPLE) continue;
    // THE MEDIAN (QA round 5): the same statistic the admin's role progress page shows, so the two never disagree.
    out[stage] = Math.max(1, Math.round((median(list) as number) / 24));
  }
  return out;
}
