/**
 * THE LEAD'S EIGHT ANSWERS (27 Nov 2026), the pure parts: real averages, local times, the all-hands invite, the buddy
 * line, and the one booking reminder. Pure.
 */
import { describe, expect, it } from "vitest";
import { AVERAGE_MIN_SAMPLE, stageAverages } from "./stageAverages";
import { stageHours, type StageTimingFacts } from "./applicationStageTiming";
import { allHandsInvite, zonedInstant } from "./startDay";
import { adoptedAccountLetter } from "./openProposalDecide";
import { bookingNudgeKey, bookingNudgeLetter } from "./applicantStageLetters";

const D = 86_400_000;
/** An application whose review took `days`: confirmed at 0, shortlisted and its first conversation written up then. */
const reviewed = (days: number): StageTimingFacts => ({ confirmedAt: 0, shortlistYesAt: days * D, refsAskedAt: null, interviews: [{ final: false, openedAt: D, scoredAt: days * D }], decidedAt: null });

describe("the village's real averages (the lead: 'actual averages based on our work'), on the admin's one calculation", () => {
  it("says nothing until enough have finished a stage, then the mean in whole days", () => {
    expect(stageAverages([reviewed(2), reviewed(4)]).review).toBeUndefined();
    expect(AVERAGE_MIN_SAMPLE).toBe(3);
    expect(stageAverages([reviewed(2), reviewed(4), reviewed(6)]).review).toBe(4);
    // The same hours the admin's page reads (shared/applicationStageTiming.ts `stageHours`).
    expect(stageHours(reviewed(4)).review).toBe(96);
    // A stage nobody finished says nothing.
    expect(stageAverages([reviewed(2), reviewed(4), reviewed(6)]).references).toBeUndefined();
  });
  it("counts only applications that PASSED a stage: closed, withdrawn and declined ones stopped there; a skipped call is done but never timed as a guess", () => {
    const passers = [reviewed(2), reviewed(4), reviewed(6)];
    // Three that stopped at Our review (closed after 90 days, withdrawn, declined): never counted as a 90-day review.
    const stopped = [0, 1, 2].map((): StageTimingFacts => ({ confirmedAt: 0, shortlistYesAt: null, refsAskedAt: null, interviews: [{ final: false, openedAt: D, scoredAt: null, waiting: false }], decidedAt: 90 * D, adopted: false }));
    expect(stageAverages([...passers, ...stopped]).review).toBe(4);
    // A first call SKIPPED (no time kept): the application moved on, but its review is never timed from a guess.
    const skipped: StageTimingFacts = { confirmedAt: 0, shortlistYesAt: 5 * D, refsAskedAt: null, interviews: [{ final: false, openedAt: null, scoredAt: null, skipped: true, waiting: false }], decidedAt: null };
    expect(stageHours(skipped).review).toBeUndefined();
    expect(stageAverages([...passers, skipped]).review).toBe(4);
    // A final that has left waiting with no opening time recorded has opened (the track's rule), and its stage is not timed from a guess.
    const finalOpened: StageTimingFacts = { confirmedAt: 0, shortlistYesAt: D, refsAskedAt: 2 * D, interviews: [{ final: false, openedAt: D, scoredAt: 2 * D }, { final: true, openedAt: null, scoredAt: null, waiting: false }], decidedAt: null };
    expect(stageHours(finalOpened).references).toBeUndefined();
  });

  it("never less than a day", () => {
    const quick = [0, 1, 2].map(() => ({ ...reviewed(0), shortlistYesAt: 3_600_000, interviews: [{ final: false, openedAt: 0, scoredAt: 3_600_000 }] }));
    expect(stageAverages(quick).review).toBe(1);
  });
});

describe("local times (the lead: 'Yes local times!')", () => {
  it("reads a wall time in the village's zone as the right instant", () => {
    // 12:00 in Costa Rica (UTC-6, no summer time) is 18:00 UTC.
    expect(zonedInstant("2026-11-30", "12:00", "America/Costa_Rica")?.toISOString()).toBe("2026-11-30T18:00:00.000Z");
    expect(zonedInstant("2026-11-30", "noon", "America/Costa_Rica")).toBeNull();
  });
  it("the all-hands invite is one hour on the start day, with its link", () => {
    const ics = allHandsInvite({ uid: "u1", dayIso: "2026-11-30", time: "12:00", zone: "America/Costa_Rica", title: "All-hands meeting", link: "https://meet.example.test/x", now: new Date("2026-11-27T00:00:00Z") })!;
    expect(ics).toContain("DTSTART:20261130T180000Z");
    expect(ics).toContain("DTEND:20261130T190000Z");
    expect(ics).toContain("URL:https://meet.example.test/x");
    expect(ics.split("\r\n")[0]).toBe("BEGIN:VCALENDAR");
  });
});

describe("the buddy and the reminder", () => {
  it("the start letter names the buddy and their role", () => {
    const l = adoptedAccountLetter({ firstName: "Rowan", village: "V", roleNames: ["Lead Role"], season: "Season of Roots", startsOn: "1 January 2027", lang: "en", signIn: "https://v.example.test/profile", buddy: { name: "Iva", role: "Ops" } } as any);
    expect(l.text).toContain("Your buddy is Iva (Ops). They'll help you through your first week.");
  });
  it("the booking reminder: gentle, once per conversation, its own link only", () => {
    expect(bookingNudgeKey("op-1", 7)).toBe("open-proposal:op-1:nudge:book:7");
    const n = bookingNudgeLetter({ firstName: "Rowan", role: "Community", links: ["https://cal.example.test/c"], statusLink: null, lang: "en" });
    expect(n.subject).toBe("A gentle reminder: your conversation with Community");
    expect(n.text).toContain("If you've booked it already, thank you, and please ignore this.");
    expect(n.text).toContain("Book it here: https://cal.example.test/c");
  });
});
