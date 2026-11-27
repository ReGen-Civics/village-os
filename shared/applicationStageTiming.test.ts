import { describe, expect, it } from "vitest";
import { stageEntries, stageHours, stageNow, type StageTimingFacts } from "./applicationStageTiming";

const H = 3_600_000;
const T0 = Date.UTC(2026, 10, 1);
const at = (h: number) => T0 + h * H;
const base: StageTimingFacts = { confirmedAt: T0, shortlistYesAt: null, refsAskedAt: null, interviews: [], decidedAt: null };

describe("stage timing", () => {
  it("times every stage an application finished, from the stamps it already keeps", () => {
    const f: StageTimingFacts = {
      ...base,
      shortlistYesAt: at(10),
      refsAskedAt: at(40),
      interviews: [
        { final: false, openedAt: at(10), scoredAt: at(30) },
        { final: false, openedAt: at(30), scoredAt: at(60) },
        { final: true, openedAt: at(80), scoredAt: at(100) },
      ],
      decidedAt: at(130),
    };
    expect(stageEntries(f)).toEqual({ review: T0, references: at(30), final_interview: at(80), agreement: at(100) });
    expect(stageHours(f)).toEqual({ review: 30, references: 50, final_interview: 20, agreement: 30 });
    expect(stageNow(f)).toBeNull();
  });

  it("ends our review when references are asked before the first conversation is written up", () => {
    const f: StageTimingFacts = { ...base, shortlistYesAt: at(5), refsAskedAt: at(8), interviews: [{ final: false, openedAt: at(5), scoredAt: null }] };
    expect(stageEntries(f).references).toBe(at(8));
    expect(stageHours(f)).toEqual({ review: 8 });
    expect(stageNow(f)).toEqual({ stage: "references", since: at(8) });
  });

  it("does not time the stage an application stands at, nor one it skipped", () => {
    expect(stageHours(base)).toEqual({});
    expect(stageNow(base)).toEqual({ stage: "review", since: T0 });
    // Not invited: decided straight from our review.
    expect(stageHours({ ...base, decidedAt: at(12) })).toEqual({ review: 12 });
  });

  it("times a member's application, which has no review, from its references", () => {
    const f: StageTimingFacts = { ...base, refsAskedAt: at(24), decidedAt: at(72) };
    expect(stageHours(f)).toEqual({ review: 24, references: 48 });
  });
});
