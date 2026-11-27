import { describe, expect, it } from "vitest";
import { stageEntries, stageHours, stageNow, type StageTimingFacts } from "./applicationStageTiming";
import { trackStates } from "./applicantOnboarding";

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

describe("the stage clock stands where the track stands (shared/applicantOnboarding.ts trackStates)", () => {
  type State = "waiting" | "open" | "scored" | "skipped";
  /** One application's conversations, as the clock reads them and as the track reads them. */
  const both = (o: { shortlistYes: boolean; refsAsked: boolean; talks: Array<{ final: boolean; state: State; opened?: number; scored?: number }> }) => {
    const clock: StageTimingFacts = {
      ...base,
      shortlistYesAt: o.shortlistYes ? at(9) : null,
      refsAskedAt: o.refsAsked ? at(20) : null,
      interviews: o.talks.map((t) => ({
        final: t.final,
        openedAt: t.opened === undefined ? null : at(t.opened),
        scoredAt: t.scored === undefined ? null : at(t.scored),
        skipped: t.state === "skipped",
        waiting: t.state === "waiting",
      })),
    };
    const track = trackStates({
      decided: null,
      reviewStage: null,
      firstReplied: true,
      shortlist: o.shortlistYes ? "yes" : null,
      refsAsked: o.refsAsked,
      refsGiven: false,
      references: [],
      interviews: o.talks.map((t) => ({ state: t.state, final: t.final })),
    });
    return { clock: stageNow(clock)?.stage, track: track.now };
  };

  it("agrees when the first conversation is skipped and references are not asked yet", () => {
    const r = both({ shortlistYes: true, refsAsked: false, talks: [{ final: false, state: "skipped", opened: 9 }, { final: true, state: "waiting" }] });
    expect(r.clock).toBe("references");
    expect(r.clock).toBe(r.track);
  });

  it("agrees when the final conversation is skipped after it opened", () => {
    const r = both({ shortlistYes: true, refsAsked: true, talks: [{ final: false, state: "scored", opened: 9, scored: 12 }, { final: true, state: "skipped", opened: 40 }] });
    expect(r.clock).toBe("agreement");
    expect(r.clock).toBe(r.track);
  });

  it("agrees when the final conversation is skipped straight from waiting", () => {
    const r = both({ shortlistYes: true, refsAsked: true, talks: [{ final: false, state: "scored", opened: 9, scored: 12 }, { final: true, state: "skipped" }] });
    expect(r.clock).toBe("agreement");
    expect(r.clock).toBe(r.track);
  });

  it("agrees along the ordinary path, stage by stage", () => {
    const cases: Array<Parameters<typeof both>[0]> = [
      { shortlistYes: false, refsAsked: false, talks: [{ final: false, state: "waiting" }, { final: true, state: "waiting" }] },
      { shortlistYes: true, refsAsked: false, talks: [{ final: false, state: "open", opened: 9 }, { final: true, state: "waiting" }] },
      { shortlistYes: true, refsAsked: true, talks: [{ final: false, state: "scored", opened: 9, scored: 15 }, { final: true, state: "waiting" }] },
      { shortlistYes: true, refsAsked: true, talks: [{ final: false, state: "scored", opened: 9, scored: 15 }, { final: true, state: "open", opened: 40 }] },
      { shortlistYes: true, refsAsked: true, talks: [{ final: false, state: "scored", opened: 9, scored: 15 }, { final: true, state: "scored", opened: 40, scored: 50 }] },
    ];
    for (const c of cases) {
      const r = both(c);
      expect(r.clock, JSON.stringify(c)).toBe(r.track);
    }
  });
});
