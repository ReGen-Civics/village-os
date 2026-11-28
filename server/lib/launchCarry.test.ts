/**
 * THE LAUNCH CARRIES THE MOMENT A THIRD FOUNDER SAYS YES (Rye, 2026-11-27).
 *
 * His words: the launch carries with "Not everyone, but at least 3 members
 * holding the founder role", and it "doesn't need to wait 7 days". The details
 * he accepted the same day are each a case here, driven through the real close
 * path (`closeBallot`, `routeOutcome`) on the S5 harness:
 *
 *  - it carries on the third yes with founders on the roll still silent, before
 *    its window ends, and its executor runs exactly once;
 *  - two yeses carry nothing, and nobody can close it early by hand;
 *  - a no HOLDS it however many say yes, and the hold comes off when that
 *    founder changes their answer, to a yes or to an abstention;
 *  - a founder may change yes to no until it carries, and no answer moves after;
 *  - a vote cast for somebody by the person they follow does not count;
 *  - a member who is not on the roll of founders is told why in the launch's
 *    own words;
 *  - when the window ends short of three yeses it closes `no_quorum`, and with
 *    a no still standing it closes `failed`;
 *  - the five-minute job carries a ballot whose rule was met while no process
 *    was there to close it;
 *  - and every other subject is untouched: an ordinary ballot with three yeses
 *    still waits for its window.
 *
 * No TEST_DATABASE_URL: the database cases skip, and an unfiltered run fails on
 * the way out (house rule).
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import mysql from "mysql2/promise";
import { testPool, provisionTestDb, testDbConfigured, type TestDb } from "../db/testDb";
import {
  ballotById,
  CARRIED_AT_ONCE_NOTE,
  CARRIES_BY_ITS_OWN_RULE,
  castVote,
  closeBallot,
  FOUNDERS_ONLY_VOTE,
  openBallot,
  type BallotRow,
} from "./ballots";
import { type CloseRouting, type LandingDeps, type SubjectCloser } from "./applyDue";
import { carryAtOnceIfMet, carryEveryMetBallot, type CarryDeps } from "./launchCarry";
import { dialsForSubject, launchQuorumPct, LAUNCH_YES_HEADS, VILLAGE_LAUNCH } from "../../shared/ballotSubjects";

const configured = testDbConfigured();
if (!configured) {
  console.warn("[launchCarry] TEST_DATABASE_URL not set - DB cases SKIPPED. A skip is not a pass.");
}

const HOUR = 60 * 60 * 1000;
let db: TestDb;
let pool: mysql.Pool;
let n = 0;

/** How many times each ballot's executor ran, so "exactly once" is a count. */
const executes = new Map<string, number>();
/** Which ballots' rolls were rung with the outcome. */
const told: string[] = [];

const quiet = async (): Promise<CloseRouting> => ({ applied: [], held: null, proposerTold: null });
const CLOSERS: Record<string, SubjectCloser> = {
  [VILLAGE_LAUNCH]: {
    settle: quiet,
    execute: async (b) => {
      executes.set(b.id, (executes.get(b.id) ?? 0) + 1);
      return { applied: [], held: null, proposerTold: null };
    },
  },
  mechanics: { settle: quiet, execute: async (b) => { executes.set(b.id, (executes.get(b.id) ?? 0) + 1); return { applied: [], held: null, proposerTold: null }; } },
};

const landing = (): LandingDeps => ({
  pool,
  vetoHours: () => 72,
  autoApplyEnabled: () => true,
  stewardCouncil: () => false,
  stewardVetoTiers: () => "all",
  nextBoundaryAfter: (after: Date) => new Date(after.getTime() + 20 * 24 * HOUR),
  cycleNumberAt: () => 1,
  landingExpiryCycles: () => 3,
  closerFor: (subjectType: string) => CLOSERS[subjectType],
  notify: async () => {},
  endedUnclosedCycle: async () => false,
  waitsForCycleClose: () => false,
  snapsToBoundary: () => false,
});

const carryDeps = (): CarryDeps => ({ pool, landing: landing(), tellRoll: (b) => { told.push(b.id); } });

/** Five founders, each at one: the roll the propose route freezes (server/lib/launchRoll.ts). */
const FOUNDERS = ["f-ana", "f-ben", "f-cai", "f-dee", "f-eli"];

/**
 * Open a launch ballot with the dials the route stamps, on a roll of founders:
 * unity from the subject, and the village's number frozen as a share of the roll.
 */
const openLaunch = async (founders: string[] = FOUNDERS, yesNeeded: number = LAUNCH_YES_HEADS): Promise<BallotRow> => {
  n += 1;
  const subject = dialsForSubject(VILLAGE_LAUNCH, "custom", { unityPct: 80, quorumPct: 100 });
  const dials = { unityPct: subject.unityPct, quorumPct: launchQuorumPct(yesNeeded, founders.length) };
  const opened = await openBallot(pool, {
    subjectType: VILLAGE_LAUNCH,
    subjectRef: `start-${n}`,
    title: `Start the Game ${n}`,
    docMarkdown: "# Start the Game",
    method: "custom",
    weightMode: "equal",
    unityPct: dials.unityPct,
    quorumPct: dials.quorumPct,
    durationDays: 7,
    openedBy: founders[0],
    electorate: founders.map((userId) => ({ userId, weight: 1 })),
  });
  if (!opened.ok) throw new Error(`launch ballot refused to open: ${opened.error}`);
  return opened.ballot;
};

const vote = async (ballotId: string, who: string, choice: string) => {
  const v = await castVote(pool, ballotId, who, choice);
  if (!v.ok) throw new Error(`vote refused: ${v.error}`);
  return carryAtOnceIfMet(carryDeps(), ballotId);
};

const statusOf = async (id: string) => (await ballotById(pool, id))?.status;

const expire = async (ballotId: string) => {
  await pool.query("UPDATE ballots SET closes_at = ? WHERE id = ?", [new Date(Date.now() - 60_000), ballotId]); // module-review-ok: fixture SQL against the S5 scratch schema, never a production table
};

describe.skipIf(!configured)("the launch carries at once (MySQL)", () => {
  beforeAll(async () => {
    db = await provisionTestDb();
    pool = testPool(db, { connectionLimit: 8 }); // module-review-ok: the S5 scratch-schema harness pool, the crews.test.ts shape
  });

  afterAll(async () => {
    await pool?.end();
    await db?.drop();
  });

  it("freezes unity 100 and three of five as its participation, even for a village whose own quorum is 100", async () => {
    const b = await openLaunch();
    expect(Number(b.unityPct)).toBe(100);
    // Three of five, which is what a member reads on the ballot. The village's
    // ordinary quorum of 100 is not on it.
    expect(Number(b.quorumPct)).toBe(60);
    expect(b.electorateCount).toBe(5);
    expect(LAUNCH_YES_HEADS).toBe(3);
  });

  it("a village that raised its number to FOUR carries on the fourth yes, and the number is the ballot's own", async () => {
    // Rye, 2026-11-06: the number is the village's. Frozen at open, so nothing
    // read here is a setting: the close reads the ballot's own row.
    const b = await openLaunch(FOUNDERS, 4);
    expect(Number(b.quorumPct)).toBe(80);
    for (const who of ["f-ana", "f-ben"]) expect((await vote(b.id, who, "yes")).carried).toBe(false);
    expect((await vote(b.id, "f-cai", "yes")).carried, "three yeses carried the shipped rule and do not carry this one").toBe(false);
    expect(await statusOf(b.id)).toBe("open");
    expect((await vote(b.id, "f-dee", "yes")).carried).toBe(true);
    expect(await statusOf(b.id)).toBe("passed");
    expect(executes.get(b.id)).toBe(1);
  });

  it("decides in whole heads, so a share that floating point misreads still carries on its count", async () => {
    // 23 of 40 is 57.5%, and 23 answers compute as 57.49999999999999. A
    // compared percentage would hold this vote one yes short forever.
    const forty = Array.from({ length: 40 }, (_, i) => `f-${String(i).padStart(2, "0")}`);
    const b = await openLaunch(forty, 23);
    expect(Number(b.quorumPct)).toBe(57.5);
    for (const who of forty.slice(0, 22)) expect((await castVote(pool, b.id, who, "yes")).ok).toBe(true);
    expect((await carryAtOnceIfMet(carryDeps(), b.id)).carried, "22 of the 23").toBe(false);
    expect((await vote(b.id, forty[22], "yes")).carried, "the 23rd").toBe(true);
  });

  it("carries on the THIRD yes with two founders silent, before its window ends, and executes once", async () => {
    const b = await openLaunch();
    expect((await vote(b.id, "f-ana", "yes")).carried).toBe(false);
    expect((await vote(b.id, "f-ben", "yes")).carried, "two yeses are not three").toBe(false);
    expect(await statusOf(b.id)).toBe("open");
    expect(executes.get(b.id) ?? 0).toBe(0);

    const third = await vote(b.id, "f-cai", "yes");
    expect(third.carried).toBe(true);
    const closed = await ballotById(pool, b.id);
    expect(closed?.status).toBe("passed");
    // Before its window: the close instant is days ahead of closes_at.
    expect(Date.parse(closed!.closedAt!)).toBeLessThan(Date.parse(closed!.closesAt) - 6 * 24 * HOUR);
    expect(closed?.closedBy).toBe("governance");
    expect(closed?.outcomeNote).toBe(CARRIED_AT_ONCE_NOTE);
    expect(executes.get(b.id), "the executor ran exactly once").toBe(1);
    expect(told).toContain(b.id);

    // ONCE IT HAS CARRIED, NO ANSWER MOVES. Dee never answered and cannot now,
    // and Ana cannot take her yes back.
    const late = await castVote(pool, b.id, "f-dee", "no");
    expect(late.ok).toBe(false);
    const takeBack = await castVote(pool, b.id, "f-ana", "no");
    expect(takeBack.ok).toBe(false);
    if (!takeBack.ok) expect(takeBack.error).toContain("Voting ended when it closed");
    // And asking again carries nothing a second time.
    expect((await carryAtOnceIfMet(carryDeps(), b.id)).carried).toBe(false);
    expect(executes.get(b.id)).toBe(1);
  });

  it("a NO holds it however many say yes, and nobody can close it early by hand", async () => {
    const b = await openLaunch();
    await vote(b.id, "f-ana", "yes");
    await vote(b.id, "f-ben", "no");
    await vote(b.id, "f-cai", "yes");
    const fourth = await vote(b.id, "f-dee", "yes");
    expect(fourth.carried, "three yeses and a standing no").toBe(false);
    expect(await statusOf(b.id)).toBe("open");

    // Held is not failed: even a closer who may close early is refused, so Ben can still withdraw.
    for (const closerMayCloseEarly of [true, false]) {
      const early = await closeBallot(pool, { ballotId: b.id, closedBy: "u-admin", outcomeNote: "A no was cast.", closerMayCloseEarly });
      expect(early.ok).toBe(false);
      if (!early.ok) expect(early.error).toBe(CARRIES_BY_ITS_OWN_RULE);
    }
    expect(await statusOf(b.id)).toBe("open");
    expect(executes.get(b.id) ?? 0).toBe(0);

    // BEN WITHDRAWS THE NO by changing his answer to an abstention. The hold
    // comes off and the three yeses already standing carry it at that moment.
    const withdrawn = await vote(b.id, "f-ben", "abstain");
    expect(withdrawn.carried).toBe(true);
    expect(await statusOf(b.id)).toBe("passed");
    expect(executes.get(b.id)).toBe(1);
  });

  it("a no changed to a YES also takes the hold off, and counts", async () => {
    const b = await openLaunch();
    await vote(b.id, "f-ana", "yes");
    await vote(b.id, "f-ben", "yes");
    expect((await vote(b.id, "f-cai", "no")).carried).toBe(false);
    // Two yeses and a no. Cai changes to yes: that is the third yes and no no stands.
    expect((await vote(b.id, "f-cai", "yes")).carried).toBe(true);
    expect(await statusOf(b.id)).toBe("passed");
  });

  it("a founder may change YES TO NO until it carries, and that holds it", async () => {
    const b = await openLaunch();
    await vote(b.id, "f-ana", "yes");
    await vote(b.id, "f-ben", "yes");
    // Ana thinks better of it before the third yes arrives.
    expect((await vote(b.id, "f-ana", "no")).carried).toBe(false);
    expect((await vote(b.id, "f-cai", "yes")).carried, "two yeses and Ana's no").toBe(false);
    expect((await vote(b.id, "f-dee", "yes")).carried, "three yeses and Ana's no").toBe(false);
    expect(await statusOf(b.id)).toBe("open");
  });

  it("does not count a vote cast for somebody by the person they follow", async () => {
    const b = await openLaunch();
    await vote(b.id, "f-ana", "yes");
    await vote(b.id, "f-ben", "yes");
    // Cai and Dee follow Ana, and her yes is copied onto their rows.
    for (const follower of ["f-cai", "f-dee"]) {
      await pool.query( // module-review-ok: fixture SQL against the S5 scratch schema, never a production table
        "INSERT INTO ballot_votes (ballot_id, user_id, choice, reason, followed_user_id) VALUES (?,?,?,NULL,?)",
        [b.id, follower, "yes", "f-ana"],
      );
    }
    expect((await carryAtOnceIfMet(carryDeps(), b.id)).carried, "four yes rows, two founders who said it").toBe(false);
    expect(await statusOf(b.id)).toBe("open");
    // Cai answers for herself: the row is hers now, and that is the third yes.
    expect((await vote(b.id, "f-cai", "yes")).carried).toBe(true);
  });

  it("tells a member who is not a founder why, in the launch's own words", async () => {
    const b = await openLaunch();
    // The route says so when the village's launch asks its founding members and this account is not one.
    const refused = await castVote(pool, b.id, "m-wren", "yes", undefined, { mayVoteNow: true, deniedByWarning: false, notAFoundingMember: true });
    expect(refused.ok).toBe(false);
    if (!refused.ok) expect(refused.error).toBe(FOUNDERS_ONLY_VOTE);
    // A village that asks every member on its launch never sets it, and reads the ordinary sentence.
    const everyMember = await castVote(pool, b.id, "m-wren", "yes", undefined, { mayVoteNow: true, deniedByWarning: false });
    expect(everyMember.ok).toBe(false);
    if (!everyMember.ok) expect(everyMember.error).toContain("It froze when this vote opened");
    // Control: on an ordinary ballot the same member reads the freeze, which is true there.
    const ordinary = await openBallot(pool, {
      subjectType: "mechanics", subjectRef: `gmp-carry-${++n}`, title: "An ordinary change", docMarkdown: "# A change",
      method: "custom", weightMode: "equal", unityPct: 60, quorumPct: 20, durationDays: 7, openedBy: "f-ana",
      electorate: FOUNDERS.map((userId) => ({ userId, weight: 1 })),
    });
    if (!ordinary.ok) throw new Error(ordinary.error);
    const offRoll = await castVote(pool, ordinary.ballot.id, "m-wren", "yes", undefined, { mayVoteNow: true, deniedByWarning: false });
    expect(offRoll.ok).toBe(false);
    if (!offRoll.ok) expect(offRoll.error).toContain("It froze when this vote opened");
  });

  it("when the window ends short of three yeses it is no_quorum, and with a no standing it is failed", async () => {
    const short = await openLaunch();
    await vote(short.id, "f-ana", "yes");
    await vote(short.id, "f-ben", "yes");
    await vote(short.id, "f-cai", "abstain");
    await expire(short.id);
    const closedShort = await closeBallot(pool, { ballotId: short.id, closedBy: "governance", outcomeNote: "The window ended.", closerMayCloseEarly: false });
    expect(closedShort.ok).toBe(true);
    if (closedShort.ok) expect(closedShort.outcome).toBe("no_quorum");

    // The no goes in first: with it standing, four yeses carry nothing.
    const stillHeld = await openLaunch();
    await vote(stillHeld.id, "f-eli", "no");
    for (const who of ["f-ana", "f-ben", "f-cai", "f-dee"]) await vote(stillHeld.id, who, "yes");
    expect(await statusOf(stillHeld.id)).toBe("open");
    await expire(stillHeld.id);
    const closedHeld = await closeBallot(pool, { ballotId: stillHeld.id, closedBy: "governance", outcomeNote: "The window ended.", closerMayCloseEarly: false });
    expect(closedHeld.ok).toBe(true);
    if (closedHeld.ok) expect(closedHeld.outcome).toBe("failed");
    expect(executes.get(stillHeld.id) ?? 0).toBe(0);
  });

  it("the five-minute job carries a ballot whose rule was met while nobody closed it", async () => {
    const b = await openLaunch();
    // Three yeses recorded and the process died before the carry: castVote alone, no close.
    for (const who of ["f-ana", "f-ben", "f-cai"]) expect((await castVote(pool, b.id, who, "yes")).ok).toBe(true);
    expect(await statusOf(b.id)).toBe("open");
    const unmet = await openLaunch();
    expect((await castVote(pool, unmet.id, "f-ana", "yes")).ok).toBe(true);

    const carried = await carryEveryMetBallot(carryDeps());
    expect(carried).toBeGreaterThanOrEqual(1);
    expect(await statusOf(b.id)).toBe("passed");
    expect(executes.get(b.id)).toBe(1);
    // The one whose rule is not met is left exactly where it was.
    expect(await statusOf(unmet.id)).toBe("open");
    // A second tick finds nothing new.
    await carryEveryMetBallot(carryDeps());
    expect(executes.get(b.id)).toBe(1);
  });

  it("leaves every other subject waiting for its window: three yeses on an ordinary ballot carry nothing early", async () => {
    const opened = await openBallot(pool, {
      subjectType: "mechanics", subjectRef: `gmp-carry-${++n}`, title: "An ordinary change", docMarkdown: "# A change",
      method: "custom", weightMode: "equal", unityPct: 60, quorumPct: 20, durationDays: 7, openedBy: "f-ana",
      electorate: FOUNDERS.map((userId) => ({ userId, weight: 1 })),
    });
    if (!opened.ok) throw new Error(opened.error);
    for (const who of FOUNDERS) expect((await castVote(pool, opened.ballot.id, who, "yes")).ok).toBe(true);
    expect((await carryAtOnceIfMet(carryDeps(), opened.ballot.id)).carried).toBe(false);
    expect(await statusOf(opened.ballot.id)).toBe("open");
    // And a facilitator still cannot pass it before its window, as before.
    const early = await closeBallot(pool, { ballotId: opened.ballot.id, closedBy: "u-admin", outcomeNote: "Everyone agreed.", closerMayCloseEarly: true });
    expect(early.ok).toBe(false);
    if (!early.ok) expect(early.error).toContain("passes when its window ends and not before");
    expect(executes.get(opened.ballot.id) ?? 0).toBe(0);
  });
});
