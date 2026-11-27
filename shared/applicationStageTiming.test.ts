import { describe, expect, it } from "vitest";
import { stageEntries, stageHours, stageNow, type StageTimingFacts } from "./applicationStageTiming";
import { memberTrackOf, trackStates } from "./applicantOnboarding";

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
      adopted: true,
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
    // Not invited: decided straight from our review, which it never passed.
    expect(stageHours({ ...base, decidedAt: at(12) })).toEqual({});
  });

  it("keeps a proposal from outside at our review until the shortlist says yes, references asked or not", () => {
    const f: StageTimingFacts = { ...base, refsAskedAt: at(24) };
    expect(stageNow(f)).toEqual({ stage: "review", since: T0 });
    // Declined at our review: it never passed it, so nothing is timed.
    expect(stageHours({ ...f, decidedAt: at(72) })).toEqual({});
  });

  it("times a member's application on its own track: references from the start, agreement once followed up", () => {
    const f: StageTimingFacts = { ...base, door: "member", refsAskedAt: at(5), refsAllFollowedUpAt: at(30), decidedAt: at(50), adopted: true };
    expect(stageEntries(f)).toEqual({ review: null, references: T0, final_interview: null, agreement: at(30) });
    expect(stageHours(f)).toEqual({ references: 30, agreement: 20 });
  });
});

describe("only a stage passed is timed: a decision ends Agreement, and only as an adoption", () => {
  const D = 24;
  const passed = (days: number): StageTimingFacts => ({ ...base, shortlistYesAt: at(days * D), interviews: [], decidedAt: null });
  it("leaves out declined, withdrawn and closed applications from the stage where they stopped", () => {
    // Each of these stopped at our review after a long wait: none passed it.
    for (const wait of [30, 60, 90]) expect(stageHours({ ...base, decidedAt: at(wait * D), adopted: false })).toEqual({});
    // Three that passed our review, at 2, 4 and 9 days: their times are the whole of the stage's measure.
    expect([2, 4, 9].map((d) => stageHours(passed(d)).review)).toEqual([2 * D, 4 * D, 9 * D]);
  });
  it("ends Agreement at an adoption, and at no other decision", () => {
    const f: StageTimingFacts = { ...base, shortlistYesAt: at(5), refsAskedAt: at(10), interviews: [{ final: true, openedAt: at(20), scoredAt: at(30) }], decidedAt: at(50) };
    expect(stageHours({ ...f, adopted: true }).agreement).toBe(20);
    expect(stageHours({ ...f, adopted: false }).agreement).toBeUndefined();
    // The stages it did pass keep their times either way.
    expect(stageHours({ ...f, adopted: false })).toEqual({ review: 5, references: 15, final_interview: 10 });
  });
});

describe("a skipped stretch is left out of the stage's median, neither 0 nor a guess", () => {
  const talked = { final: false, openedAt: at(9), scoredAt: at(12) };
  it("leaves out a final conversation skipped after it opened, and the agreement that began at the skip", () => {
    const f: StageTimingFacts = { ...base, shortlistYesAt: at(5), refsAskedAt: at(20), interviews: [talked, { final: true, openedAt: at(40), scoredAt: null, skipped: true }], decidedAt: at(90) };
    expect(stageHours(f)).toEqual({ review: 12, references: 28 });
  });
  it("leaves out a final skipped straight from waiting, and the stretches around it", () => {
    const f: StageTimingFacts = { ...base, shortlistYesAt: at(5), refsAskedAt: at(20), interviews: [talked, { final: true, openedAt: null, scoredAt: null, skipped: true }], decidedAt: at(90) };
    expect(stageHours(f)).toEqual({ review: 12 });
  });
  it("leaves out our review when it ended at a skipped first conversation", () => {
    const f: StageTimingFacts = { ...base, shortlistYesAt: at(5), interviews: [{ final: false, openedAt: at(8), scoredAt: null, skipped: true }, { final: true, openedAt: at(30), scoredAt: at(50) }], decidedAt: at(60), adopted: true };
    expect(stageHours(f)).toEqual({ final_interview: 20, agreement: 10 });
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

describe("a member's application stands where its own track stands (memberTrackOf)", () => {
  const cases = [
    { name: "refs not asked yet", refsAsked: false, refsGiven: false, followed: false },
    { name: "refs asked, none given", refsAsked: true, refsGiven: false, followed: false },
    { name: "refs given, follow-up open", refsAsked: true, refsGiven: true, followed: false },
    { name: "refs given and followed up", refsAsked: true, refsGiven: true, followed: true },
  ];
  for (const c of cases) {
    it(c.name, () => {
      const track = memberTrackOf({ decided: null, refsAsked: c.refsAsked, refsGiven: c.refsGiven, references: c.refsGiven ? [{ followedUp: c.followed }] : [] }).now;
      const clock = stageNow({
        ...base,
        door: "member",
        refsAskedAt: c.refsAsked ? at(10) : null,
        refsAllFollowedUpAt: c.refsGiven && c.followed ? at(30) : null,
      })?.stage;
      expect(clock).toBe(track);
    });
  }
});
