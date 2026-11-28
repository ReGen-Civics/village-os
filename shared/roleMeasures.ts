/**
 * Measures of the role journey (L11): counts and medians per season and circle.
 * Administrators read every circle; a circle's lead reads their own circle
 * (`circlesLed` below; the server enforces it). Pure: it is handed anonymous
 * facts and returns numbers.
 *
 * ── WHAT IT NEVER HOLDS ──────────────────────────────────────────────────
 * No name, no user id, no application ref, no email. An input fact is a season,
 * a circle and STAMPED TIMES; an output row is the same two keys and numbers.
 * `MEASURE_KEYS` below is the closed key set a test holds both sides to.
 *
 * ── 0 AND NO DATA ARE DIFFERENT ──────────────────────────────────────────
 * Every number built from at least one recorded fact is shown, however few
 * people it counts (the lead, 27 Nov 2026: "show all data we have"). A real
 * zero stays 0: a count of nobody, or a share where none of the people counted
 * did it. NO DATA is `null`, and only that: a median with no recorded time, or
 * a share with nobody yet to count (`eligible` 0). A reader shows "no data"
 * for null and the number for anything else, 0 included (`NO_DATA`).
 */

import { TIMED_STAGES, stageHours, stageNow, type StageTimingFacts, type TimedStage } from "./applicationStageTiming";

/** What a measure holds when nothing was recorded for it. Never 0: 0 is a measured zero. */
export const NO_DATA = null;
const HOUR = 3_600_000;
const DAY = 86_400_000;

/** How an application was decided: adopted, declined, withdrawn by the applicant, or closed after 90 quiet days. */
export type Outcome = "adopted" | "declined" | "withdrawn" | "closed";

/** One application, as stamped. Times are epoch milliseconds. No ref, no person: only the door it came through. */
export interface ApplicationFact {
  seasonId: string | null;
  circleId: string | null;
  /** `open`: a proposal from outside (op-); `member`: a member's role application (sa-). */
  door: "open" | "member";
  confirmedAt: number;
  firstReplyAt: number | null;
  firstInterviewAt: number | null;
  decidedAt: number | null;
  outcome: Outcome | null;
  /** The stamps the stages are timed from (shared/applicationStageTiming.ts). */
  shortlistYesAt: number | null;
  refsAskedAt: number | null;
  /** When the last reference was followed up, once every one of them is; null while any is open, or none were given. */
  refsAllFollowedUpAt: number | null;
  /** The conversations, in order. */
  interviews: ReadonlyArray<{ final: boolean; openedAt: number | null; bookedAt: number | null; scoredAt: number | null; skipped: boolean; waiting?: boolean }>;
  /** A proposal from outside whose terms the village countered before it was decided. False for a member's application. */
  countered: boolean;
}

/** One adopted application that has seated somebody: when it was adopted, and when the seating began. */
export interface StartFact {
  seasonId: string | null;
  circleId: string | null;
  adoptedAt: number;
  startedAt: number;
}

/** One seating that began, with its path and renewals. Times are epoch milliseconds. */
export interface HolderFact {
  seasonId: string | null;
  circleId: string | null;
  startedAt: number;
  endedAt: number | null;
  /** When the onboarding path opened, and when its last item was done (null while any is open). */
  pathOpenedAt: number | null;
  pathDoneAt: number | null;
  /** Moon renewals whose term has ended: how each went. */
  renewalsDue: number;
  renewalsRenewed: number;
}

export interface Share {
  eligible: number;
  yes: number;
  /** 0 to 1 (0 is a real zero: nobody counted did it), or NO_DATA when `eligible` is 0. */
  share: number | null;
}

export interface MeasureRow {
  seasonId: string | null;
  circleId: string | null;
  applications: {
    count: number;
    answered: Share;
    medianHoursToReply: number | null;
    medianHoursToInterview: number | null;
    medianHoursToDecision: number | null;
  };
  /** Median hours at each stage, over the applications that finished it (shared/applicationStageTiming.ts). */
  stages: Record<TimedStage, number | null>;
  conversations: {
    /** Conversations opened, and of them booked. */
    booked: Share;
    /** Booked conversations that came to an end (written up, skipped, or their application decided), and of them written up. */
    held: Share;
  };
  references: {
    /** Median hours from asking for references to the last of them followed up. */
    medianHoursToFollowUp: number | null;
  };
  outcomes: {
    /** Decided applications that reached the final conversation, and of them adopted. */
    offer: Share;
    /** Adopted proposals from outside, and of them countered before agreement. */
    countered: Share;
    /** Of every application: withdrawn by the applicant, declined, closed after 90 quiet days. */
    withdrawn: Share;
    declined: Share;
    closed: Share;
  };
  start: {
    /** Median hours from adoption to the seating beginning. */
    medianHoursToStart: number | null;
  };
  holders: {
    count: number;
    pathCompleteBy30: Share;
    stillInRoleAt30: Share;
    stillInRoleAt90: Share;
    renewed: Share;
  };
}

/** The closed key sets, held by the key-set test. */
export const MEASURE_KEYS = {
  row: ["seasonId", "circleId", "applications", "stages", "conversations", "references", "outcomes", "start", "holders"],
  applications: ["count", "answered", "medianHoursToReply", "medianHoursToInterview", "medianHoursToDecision"],
  stages: [...TIMED_STAGES],
  conversations: ["booked", "held"],
  references: ["medianHoursToFollowUp"],
  outcomes: ["offer", "countered", "withdrawn", "declined", "closed"],
  start: ["medianHoursToStart"],
  // No quest step (the lead, 27 Nov 2026: "roles don't do quests normally ... not part of the flow").
  holders: ["count", "pathCompleteBy30", "stillInRoleAt30", "stillInRoleAt90", "renewed"],
  share: ["eligible", "yes", "share"],
} as const;

/** The median of what was recorded, or NO_DATA when nothing was. One value is its own median. */
export function median(values: readonly number[]): number | null {
  if (values.length === 0) return NO_DATA;
  const v = [...values].sort((a, b) => a - b);
  const mid = Math.floor(v.length / 2);
  return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
}

function share(eligible: number, yes: number): Share {
  return { eligible, yes, share: eligible === 0 ? NO_DATA : Math.round((yes / eligible) * 100) / 100 };
}

const hoursBetween = (from: number, to: number | null): number | null => (to === null || to < from ? null : Math.round(((to - from) / HOUR) * 10) / 10);
const known = (xs: ReadonlyArray<number | null>): number[] => xs.filter((x): x is number => x !== null);

/** The stamps an application's stages are timed from. */
export const timingOf = (a: ApplicationFact): StageTimingFacts => ({
  confirmedAt: a.confirmedAt,
  shortlistYesAt: a.shortlistYesAt,
  refsAskedAt: a.refsAskedAt,
  interviews: a.interviews,
  decidedAt: a.decidedAt,
  door: a.door,
  refsAllFollowedUpAt: a.refsAllFollowedUpAt,
  adopted: a.outcome === "adopted",
});

export function buildMeasures(apps: readonly ApplicationFact[], holders: readonly HolderFact[], now: number, starts: readonly StartFact[] = []): MeasureRow[] {
  const keyOf = (s: string | null, c: string | null) => `${s ?? ""}\u0000${c ?? ""}`;
  const rows = new Map<string, { seasonId: string | null; circleId: string | null; a: ApplicationFact[]; h: HolderFact[]; s: StartFact[] }>();
  const slot = (s: string | null, c: string | null) => {
    const k = keyOf(s, c);
    let r = rows.get(k);
    if (!r) rows.set(k, (r = { seasonId: s, circleId: c, a: [], h: [], s: [] }));
    return r;
  };
  for (const a of apps) slot(a.seasonId, a.circleId).a.push(a);
  for (const h of holders) slot(h.seasonId, h.circleId).h.push(h);
  for (const x of starts) slot(x.seasonId, x.circleId).s.push(x);

  const out: MeasureRow[] = [];
  for (const r of Array.from(rows.values())) {
    const reply = known(r.a.map((a) => hoursBetween(a.confirmedAt, a.firstReplyAt)));
    const interview = known(r.a.map((a) => hoursBetween(a.confirmedAt, a.firstInterviewAt)));
    const decision = known(r.a.map((a) => hoursBetween(a.confirmedAt, a.decidedAt)));

    const stageTimes = r.a.map((a) => stageHours(timingOf(a)));
    const stages = Object.fromEntries(TIMED_STAGES.map((st) => [st, median(known(stageTimes.map((t) => t[st] ?? null)))])) as Record<TimedStage, number | null>;

    const talks = r.a.flatMap((a) => a.interviews.map((i) => ({ ...i, decided: a.decidedAt !== null })));
    const opened = talks.filter((i) => i.openedAt !== null);
    const booked = talks.filter((i) => i.bookedAt !== null);
    const ended = booked.filter((i) => i.scoredAt !== null || i.skipped || i.decided);

    const followUp = known(r.a.map((a) => (a.refsAskedAt === null ? null : hoursBetween(a.refsAskedAt, a.refsAllFollowedUpAt))));

    const decided = r.a.filter((a) => a.outcome !== null);
    const reachedFinal = decided.filter((a) => a.interviews.some((i) => i.final && i.openedAt !== null));
    const adoptedOpen = r.a.filter((a) => a.door === "open" && a.outcome === "adopted");
    const count = (o: Outcome) => r.a.filter((a) => a.outcome === o).length;

    // A share counts only people whose window has closed, so a recent seating is not "failed" yet.
    const by = (days: number, done: (h: HolderFact) => boolean, opened: (h: HolderFact) => number | null): Share => {
      const eligible = r.h.filter((h) => {
        const o = opened(h);
        return o !== null && now >= o + days * DAY;
      });
      return share(eligible.length, eligible.filter(done).length);
    };
    const stayed = (days: number) => by(days, (h) => h.endedAt === null || h.endedAt >= h.startedAt + days * DAY, (h) => h.startedAt);
    const path = by(30, (h) => h.pathDoneAt !== null && h.pathOpenedAt !== null && h.pathDoneAt <= h.pathOpenedAt + 30 * DAY, (h) => h.pathOpenedAt);
    const due = r.h.reduce((n, h) => n + h.renewalsDue, 0);
    const renewed = r.h.reduce((n, h) => n + h.renewalsRenewed, 0);

    out.push({
      seasonId: r.seasonId,
      circleId: r.circleId,
      applications: {
        count: r.a.length,
        answered: share(r.a.length, r.a.filter((a) => a.firstReplyAt !== null).length),
        medianHoursToReply: median(reply),
        medianHoursToInterview: median(interview),
        medianHoursToDecision: median(decision),
      },
      stages,
      conversations: { booked: share(opened.length, opened.filter((i) => i.bookedAt !== null).length), held: share(ended.length, ended.filter((i) => i.scoredAt !== null).length) },
      references: { medianHoursToFollowUp: median(followUp) },
      outcomes: {
        offer: share(reachedFinal.length, reachedFinal.filter((a) => a.outcome === "adopted").length),
        countered: share(adoptedOpen.length, adoptedOpen.filter((a) => a.countered).length),
        withdrawn: share(r.a.length, count("withdrawn")),
        declined: share(r.a.length, count("declined")),
        closed: share(r.a.length, count("closed")),
      },
      start: { medianHoursToStart: median(known(r.s.map((x) => hoursBetween(x.adoptedAt, x.startedAt)))) },
      holders: { count: r.h.length, pathCompleteBy30: path, stillInRoleAt30: stayed(30), stillInRoleAt90: stayed(90), renewed: share(due, renewed) },
    });
  }
  return out.sort((a, b) => String(b.seasonId ?? "").localeCompare(String(a.seasonId ?? "")) || String(a.circleId ?? "").localeCompare(String(b.circleId ?? "")));
}

/**
 * RIGHT NOW: how many undecided applications stand at each stage today, per
 * circle, with how long the oldest has waited there. Counts and hours only,
 * never a person; `open` and `member` say which door they came through, so a
 * count can link to the review queue that lists them.
 */
export interface StageNowRow {
  circleId: string | null;
  stage: TimedStage;
  count: number;
  open: number;
  member: number;
  oldestHours: number;
}

export function rightNow(apps: readonly ApplicationFact[], now: number): StageNowRow[] {
  const by = new Map<string, StageNowRow>();
  for (const a of apps) {
    const at = stageNow(timingOf(a));
    if (!at) continue;
    const k = `${a.circleId ?? ""}\u0000${at.stage}`;
    const row = by.get(k) ?? { circleId: a.circleId, stage: at.stage, count: 0, open: 0, member: 0, oldestHours: 0 };
    row.count += 1;
    row[a.door] += 1;
    row.oldestHours = Math.max(row.oldestHours, Math.round(((now - at.since) / HOUR) * 10) / 10);
    by.set(k, row);
  }
  return Array.from(by.values());
}

/**
 * WHO READS WHICH CIRCLE (the lead, 27 Nov 2026: "admin for the whole village
 * and circle leads for their circle"). An administrator reads the village. Any
 * other member reads the circles whose lead seat (`circles.lead_role_id`) they
 * sit in now (`liveSeatIds`: live, held as a member, term not lapsed), and
 * nothing else; with none, they read nothing. The seat is the circle's own
 * record of who leads it, so a role named Steward that is a circle's lead seat
 * counts, and a role named Lead that no circle names does not.
 *
 * The lead seat must be one the circle still keeps: active (a seat the circle
 * rested, `rest_seat` or a season roll, opens nothing) and not a standing
 * example, the rule `keptSeat` in server/lib/circleStanding.ts applies to every
 * seat a room reads. A seat-based read scope outside the one gate, recorded in
 * shared/capabilities.ts and docs/ADR_2026-11_CIRCLE_LEADS_READ_MEASURES.md.
 */
export type MeasuresScope = { kind: "village" } | { kind: "circles"; circleIds: string[] } | { kind: "none" };

/** One circle and its lead seat, as the repo reads them: the seat's own active and example flags ride along. */
export interface CircleLeadSeat {
  id: string;
  leadRoleId: string | null;
  /** `org_roles.active` of the lead seat: false once the circle rests it. */
  leadActive: boolean;
  /** `org_roles.is_example` of the lead seat. */
  leadIsExample: boolean;
}

export function circlesLed(circles: readonly CircleLeadSeat[], liveSeatIds: readonly string[]): string[] {
  const seats = new Set(liveSeatIds);
  return circles.filter((c) => c.leadRoleId !== null && c.leadActive && !c.leadIsExample && seats.has(c.leadRoleId)).map((c) => c.id);
}

// No small-number threshold for a lead, ever: asked whether a lead whose circle has one or two applicants sees their exact times and outcomes, the lead answered "Show all, as now" (27 Nov 2026).
export function measuresScope(isAdmin: boolean, led: readonly string[]): MeasuresScope {
  if (isAdmin) return { kind: "village" };
  return led.length ? { kind: "circles", circleIds: Array.from(new Set(led)) } : { kind: "none" };
}

/** The rows a scope may read, narrowed to one circle when asked. A row in no circle is the village's: admins only. */
export function rowsInScope<R extends { circleId: string | null }>(rows: readonly R[], scope: MeasuresScope, circleId: string | null = null): R[] {
  const want = (r: R) => circleId === null || r.circleId === circleId;
  if (scope.kind === "village") return rows.filter(want);
  if (scope.kind === "none") return [];
  const mine = new Set(scope.circleIds);
  return rows.filter((r) => r.circleId !== null && mine.has(r.circleId) && want(r));
}
