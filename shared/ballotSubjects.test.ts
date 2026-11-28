/**
 * The per-subject threshold seam (R68), and the three properties that make it
 * a seam and not a special case for launch:
 *
 *  - a subject the registry does not name behaves exactly as it does today;
 *  - a floor RAISES and never lowers, so a village that asks for more keeps
 *    its own number;
 *  - the stamped dials are the dials the evaluator actually reads, which is
 *    the whole reason a subject may fix its method.
 *
 * The last describe block adds a fourth: a roll of three HEADS is not the same
 * fact as a roll of three VOICES, and a subject that asks every seat to weigh
 * something refuses a roll with a seat at zero.
 *
 * THE LAUNCH CASES WERE REWRITTEN ON 2026-11-27. Rye: the launch carries with
 * "Not everyone, but at least 3 members holding the founder role", and it
 * "doesn't need to wait 7 days". Until then these cases pinned 100 unity and
 * 100 quorum with a yes from every seat. They now pin: three founder yeses,
 * no founder's no, numbers the village's dials never reach, and a vote that
 * carries at once.
 */
import { describe, expect, it } from "vitest";
import {
  consecutiveNoQuorum,
  criticalityOfItems,
  delegatedRowsCountOn,
  delegationRefusalSentence,
  atOnceEvaluation,
  carriesAtOnce,
  rollIsFounders,
  yesHeadsFrozenAs,
  launchQuorumPct,
  launchRollKindFrom,
  launchRuleSentence,
  LAUNCH_ROLL_KEY,
  LAUNCH_ROLL_KINDS,
  LAUNCH_YES_HEADS,
  dialsForSubject,
  electorateFloorProblem,
  launchMinElectorate,
  LAUNCH_MIN_ELECTORATE_FLOOR,
  evaluationRulesFor,
  floorForCriticality,
  floorForSubject,
  highestTier,
  highestTierFrom,
  isMetaSetting,
  metaSettingTrialRefusal,
  methodForSubject,
  methodForSubjects,
  overrideDials,
  quorumMissReading,
  rerunOffer,
  rollProblem,
  stalemateWarningFor,
  subjectInPeople,
  thresholdChangePrice,
  thresholdSettingsFrom,
  thresholdsFor,
  thresholdsForSubject,
  tierInPeople,
  weightFloorProblem,
  CHANGE_ITEM_KINDS,
  HIGHEST_TIER_KEY,
  NO_QUORUM_ENDED,
  SELF_PRICED_THRESHOLD_KEYS,
  CRITICALITY_FOR_ITEM_KIND,
  GOVERNANCE_MODE,
  MINT_RULE,
  SUBJECT_FOR_ITEM_KIND,
  SUBJECT_SETTING_KEYS,
  SUBJECT_THRESHOLDS,
  THRESHOLD_PERCENT_KEYS,
  TIER_SETTING_KEYS,
  VILLAGE_LAUNCH,
} from "./ballotSubjects";
import {
  dialsForMethod,
  evaluateBallot,
  quorumPctOf,
  unityPctOf,
  CRITICALITIES,
  TIER_FLOORS,
  type BallotMethod,
} from "./governanceEngine";
import { criticalityOf, VARIABLES_BY_KEY } from "./gameVariables";

const village = { unityPct: 80, quorumPct: 20 };

describe("per-subject thresholds", () => {
  it("leaves an unnamed subject exactly where it is today", () => {
    for (const method of ["custom", "majority", "consensus", "consent"] as BallotMethod[]) {
      expect(dialsForSubject("mechanics", method, village)).toEqual(dialsForMethod(method, village));
      expect(dialsForSubject("advisory", method, village)).toEqual(dialsForMethod(method, village));
    }
    expect(thresholdsForSubject("mechanics")).toBeNull();
    expect(methodForSubject("mechanics", "consent")).toBe("consent");
    expect(methodForSubject("mechanics", "hypha")).toBe("hypha");
    expect(electorateFloorProblem("mechanics", 1)).toBeNull();
  });

  it("freezes the launch at unity 100 and quorum 0, which is its rule said in the engine's numbers", () => {
    // Unity 100 on a roll where every founder counts once is "no founder has
    // said no". The participation it asks is three yes heads, never a percent.
    expect(dialsForSubject(VILLAGE_LAUNCH, "custom", village)).toEqual({ unityPct: 100, quorumPct: 0 });
    expect(SUBJECT_THRESHOLDS[VILLAGE_LAUNCH].minYesHeads).toBe(LAUNCH_YES_HEADS);
    expect(LAUNCH_YES_HEADS).toBe(3);
    expect(rollIsFounders(VILLAGE_LAUNCH)).toBe(true);
    expect(carriesAtOnce(VILLAGE_LAUNCH)).toBe(true);
    // Control: nothing else is a roll of founders, and nothing else carries at once.
    for (const subject of Object.keys(SUBJECT_THRESHOLDS).filter((s) => s !== VILLAGE_LAUNCH)) {
      expect(rollIsFounders(subject), subject).toBe(false);
      expect(carriesAtOnce(subject), subject).toBe(false);
    }
    expect(carriesAtOnce("mechanics")).toBe(false);
    expect(rollIsFounders("mechanics")).toBe(false);
  });

  it("keeps the village's own dials OFF the launch, and still never lowers a village anywhere else", () => {
    // "Not everyone" (Rye, 2026-11-27). A village at 100 and 100 on everything
    // would otherwise freeze a quorum of 100 here and ask every founder to
    // answer, which is the rule this one replaced. `fixedDials` is that line.
    const strict = { unityPct: 100, quorumPct: 100 };
    expect(dialsForSubject(VILLAGE_LAUNCH, "custom", strict)).toEqual({ unityPct: 100, quorumPct: 0 });
    // Control: every other subject still takes the village's higher number.
    expect(dialsForSubject("mechanics", "custom", strict)).toEqual(strict);
    expect(dialsForSubject(MINT_RULE, "custom", strict)).toEqual(strict);
    // And in a bundle the launch's numbers go back to being a floor, the stricter reading.
    expect(dialsForSubject([VILLAGE_LAUNCH, "mechanics"], "custom", strict)).toEqual(strict);
  });

  it("fixes the launch method, so the frozen numbers are the numbers that decide", () => {
    // The defect this exists to stop: a village on `majority` would freeze
    // 100/100 into the row and `evaluateBallot` would carry it at 51%.
    expect(methodForSubject(VILLAGE_LAUNCH, "majority")).toBe("custom");
    expect(methodForSubject(VILLAGE_LAUNCH, "consent")).toBe("custom");
    // A village that decides its rule changes on Hypha still starts its own
    // Game here. There is no chain leg for a village beginning.
    expect(methodForSubject(VILLAGE_LAUNCH, "hypha")).toBe("custom");

    const method = methodForSubject(VILLAGE_LAUNCH, "majority") as BallotMethod;
    const dials = dialsForSubject(VILLAGE_LAUNCH, method, village);
    const rules = evaluationRulesFor(VILLAGE_LAUNCH);
    const read = (yes: number, no: number, abstain: number, roll: number) =>
      evaluateBallot({
        method,
        ...dials,
        totalWeight: roll,
        tallies: { yesW: yes, noW: no, abstainW: abstain },
        abstainPolicy: rules.abstainPolicy,
        minYesHeads: rules.minYesHeads,
        heads: { yesHeads: yes, noHeads: no, abstainHeads: abstain, electorateCount: roll },
      });
    // Three founders, two said yes: short of the three it asks, and nobody refused.
    expect(read(2, 0, 0, 3)).toBe("no_quorum");
    // Two yes and one no: a refusal is standing.
    expect(read(2, 1, 0, 3)).toBe("failed");
    // The third yes carries it.
    expect(read(3, 0, 0, 3)).toBe("passed");
  });

  it("carries on THREE founder yeses and never needs everyone (Rye, 2026-11-27)", () => {
    const method = methodForSubject(VILLAGE_LAUNCH, "custom") as BallotMethod;
    const dials = dialsForSubject(VILLAGE_LAUNCH, method, village);
    const rules = evaluationRulesFor(VILLAGE_LAUNCH);
    const read = (yes: number, no: number, abstain: number, roll: number) =>
      evaluateBallot({
        method,
        ...dials,
        totalWeight: roll,
        tallies: { yesW: yes, noW: no, abstainW: abstain },
        abstainPolicy: rules.abstainPolicy,
        minYesHeads: rules.minYesHeads,
        heads: { yesHeads: yes, noHeads: no, abstainHeads: abstain, electorateCount: roll },
      });
    // Seven founders on the roll and three have answered, all yes. It carries
    // with four founders silent, which the every-seat rule refused.
    expect(read(3, 0, 0, 7)).toBe("passed");
    expect(read(3, 0, 0, 50)).toBe("passed");
    // A NO HOLDS IT, however many say yes. Six yes and one no on a roll of seven.
    expect(read(6, 1, 0, 7)).toBe("failed");
    expect(read(3, 1, 0, 7)).toBe("failed");
    // Withdrawn by changing the no to an abstention: the hold is off and it carries.
    expect(read(3, 0, 1, 7)).toBe("passed");
    // Withdrawn by changing the no to a yes.
    expect(read(4, 0, 0, 7)).toBe("passed");
    // Two yes is never three, with or without the rest of the roll answering.
    expect(read(2, 0, 0, 7)).toBe("no_quorum");
    expect(read(2, 0, 5, 7), "abstentions are not yeses").toBe("no_quorum");
    // Control for the head floor itself: the same tallies with the heads left
    // out fail closed, so the rule is conducted and never skipped.
    expect(
      evaluateBallot({ method, ...dials, totalWeight: 7, tallies: { yesW: 3, noW: 0, abstainW: 0 }, minYesHeads: rules.minYesHeads }),
    ).toBe("failed");
  });

  /*
   * REWRITTEN 2026-09-02, and its last clause again on 2026-11-27. This case
   * used to read "two yes and one abstain carries". The founder's Q3 ruling
   * made an abstention on THIS subject not a yes, and that still stands: the
   * subject carries its own abstain policy and its own yes-head floor, and the
   * engine still owns the arithmetic. What changed on 2026-11-27 is the count
   * the yeses are held to: three founders, where it used to be every seat.
   * Every other subject is unchanged and the case below proves it on the same
   * numbers.
   */
  it("does NOT carry the Birthing on an abstention, because an abstention is not a yes", () => {
    const method = methodForSubject(VILLAGE_LAUNCH, "custom") as BallotMethod;
    const dials = dialsForSubject(VILLAGE_LAUNCH, method, village);
    const rules = evaluationRulesFor(VILLAGE_LAUNCH);
    // Three on the roll, all three answered, one took no side. It is short of
    // participation, which is a question not yet answered rather than a no,
    // so the village can be asked again on a fresh freeze.
    expect(
      evaluateBallot({
        method,
        ...dials,
        totalWeight: 3,
        tallies: { yesW: 2, noW: 0, abstainW: 1 },
        abstainPolicy: rules.abstainPolicy,
        minYesHeads: rules.minYesHeads,
        heads: { yesHeads: 2, noHeads: 0, abstainHeads: 1, electorateCount: 3 },
      }),
    ).toBe("no_quorum");
    // A vote nobody cast does not carry it either.
    expect(
      evaluateBallot({
        method,
        ...dials,
        totalWeight: 3,
        tallies: { yesW: 2, noW: 0, abstainW: 0 },
        abstainPolicy: rules.abstainPolicy,
        minYesHeads: rules.minYesHeads,
        heads: { yesHeads: 2, noHeads: 0, abstainHeads: 0, electorateCount: 3 },
      }),
    ).toBe("no_quorum");
    // Three founders say yes and it carries, which is the whole of the ruling.
    expect(
      evaluateBallot({
        method,
        ...dials,
        totalWeight: 3,
        tallies: { yesW: 3, noW: 0, abstainW: 0 },
        abstainPolicy: rules.abstainPolicy,
        minYesHeads: rules.minYesHeads,
        heads: { yesHeads: 3, noHeads: 0, abstainHeads: 0, electorateCount: 3 },
      }),
    ).toBe("passed");
  });

  it("leaves the Hypha abstain rule exactly where it is on every other subject", () => {
    // The same numbers on an ordinary rule change: two yes, one abstention,
    // 100% quorum asked for. The abstention carries it to quorum and takes no
    // side, which is what it has always done and still does.
    const strict = { unityPct: 100, quorumPct: 100 };
    const dials = dialsForSubject("mechanics", "custom", strict);
    const rules = evaluationRulesFor("mechanics");
    expect(rules).toEqual({ abstainPolicy: "counts_toward_quorum", minYesHeads: undefined, carriesAtOnce: false });
    expect(
      evaluateBallot({
        method: "custom",
        ...dials,
        totalWeight: 3,
        tallies: { yesW: 2, noW: 0, abstainW: 1 },
        abstainPolicy: rules.abstainPolicy,
        minYesHeads: rules.minYesHeads,
      }),
    ).toBe("passed");
  });

  it("says how many more FOUNDERS before a launch vote can open", () => {
    expect(electorateFloorProblem(VILLAGE_LAUNCH, 0)).toBe(
      "No founding member is on the roll today. 3 more founding members and the village can vote to start its Game.",
    );
    expect(electorateFloorProblem(VILLAGE_LAUNCH, 1)).toBe(
      "One founding member is on the roll today. 2 more founding members and the village can vote to start its Game.",
    );
    expect(electorateFloorProblem(VILLAGE_LAUNCH, 2)).toBe(
      "2 founding members are on the roll today. One more founding member and the village can vote to start its Game.",
    );
    expect(electorateFloorProblem(VILLAGE_LAUNCH, 3)).toBeNull();
    expect(electorateFloorProblem(VILLAGE_LAUNCH, 40)).toBeNull();
  });

  it("reads the village's own head count for the launch, never below the floor, and only for the launch (Rye, 2026-11-06; D3)", () => {
    expect(electorateFloorProblem(VILLAGE_LAUNCH, 2, 5)).toContain("3 more founding members");
    expect(electorateFloorProblem(VILLAGE_LAUNCH, 5, 5)).toBeNull();
    // D3: a dial below LAUNCH_MIN_ELECTORATE_FLOOR is held at the floor.
    expect(LAUNCH_MIN_ELECTORATE_FLOOR).toBe(3);
    // The floor and the yes count are one number: a roll that may open can always carry.
    expect(LAUNCH_MIN_ELECTORATE_FLOOR).toBe(LAUNCH_YES_HEADS);
    expect(electorateFloorProblem(VILLAGE_LAUNCH, 2, 2), "two is one short of the floor").toContain("One more founding member");
    expect(electorateFloorProblem(VILLAGE_LAUNCH, 1, 1), "one person cannot launch alone").toContain("2 more founding members");
    expect(electorateFloorProblem(VILLAGE_LAUNCH, 0, 0)).toContain("3 more founding members");
    expect(electorateFloorProblem(VILLAGE_LAUNCH, 3, 1)).toBeNull();
    expect(rollProblem(VILLAGE_LAUNCH, [{ weight: 1 }, { weight: 1 }], 2)).toContain("One more founding member");
    expect(launchMinElectorate(1)).toBe(3);
    expect(launchMinElectorate(7)).toBe(7);
    // Flipping the floor to 1 restores the dial's full range, never below one.
    expect(launchMinElectorate(2, 1)).toBe(2);
    expect(launchMinElectorate(0, 1), "a zero is read as one").toBe(1);
    // Control: with no village value the registry's three still holds.
    expect(rollProblem(VILLAGE_LAUNCH, [{ weight: 1 }, { weight: 1 }])).toContain("One more founding member");
    // Another subject never reads the launch's dial.
    expect(electorateFloorProblem("mechanics", 0, 9)).toBeNull();
  });

  it("says how many more MEMBERS when the village's launch asks every member", () => {
    expect(electorateFloorProblem(VILLAGE_LAUNCH, 2, 3, "members")).toBe(
      "2 members hold a voice in this village today. One more member and the village can vote to start its Game.",
    );
    expect(electorateFloorProblem(VILLAGE_LAUNCH, 3, 3, "members")).toBeNull();
    expect(rollProblem(VILLAGE_LAUNCH, [{ weight: 1 }], 3, "members")).toContain("2 more members");
    // Control: the same count on the roll as shipped is said in founding members.
    expect(electorateFloorProblem(VILLAGE_LAUNCH, 2, 3, "founders")).toContain("One more founding member");
  });

  it("keeps every registry entry sane, whatever a later lane adds", () => {
    for (const [subject, t] of Object.entries(SUBJECT_THRESHOLDS)) {
      expect(subject.length, subject).toBeLessThanOrEqual(24); // ballots.subject_type is varchar(24)
      expect(t.minUnityPct, subject).toBeGreaterThanOrEqual(0);
      expect(t.minUnityPct, subject).toBeLessThanOrEqual(100);
      expect(t.minQuorumPct, subject).toBeGreaterThanOrEqual(0);
      expect(t.minQuorumPct, subject).toBeLessThanOrEqual(100);
      expect(t.minElectorate, subject).toBeGreaterThanOrEqual(0);
      expect(t.why.trim().length, subject).toBeGreaterThan(0);
      /*
       * A floor above 50 on a subject that has NOT fixed its method is the
       * defect this whole file exists to stop: `majority` and `consent` ignore
       * `unity_pct`, so the number would be frozen, rendered and never read.
       */
      if (t.minUnityPct > 50) expect(t.method, subject).toBe("custom");
      /*
       * A subject that asks for 100% QUORUM and does not also ask every seat
       * to weigh something is asking a question its own answer cannot make
       * true: `quorumPctOf` divides by the frozen total weight, so a roll
       * carrying zero-weight seats reaches 100% without them. The bypass this
       * clause exists to stop is measured directly two describes down.
       */
      if (t.minQuorumPct >= 100) expect(t.everySeatWeighs, subject).toBe(true);
      /*
       * A subject that carries at once has no steward window to honour, so it
       * must be one the landing engine gives none (NO_WINDOW_SUBJECTS), and it
       * must say how many yes heads carry it, or "the moment its rule is met"
       * would be the moment the first yes arrived.
       */
      if (t.carriesAtOnce) {
        expect(typeof t.minYesHeads, subject).toBe("number");
        expect(t.method, subject).toBe("custom");
      }
      // Numbers that are the whole rule need the one method that reads them.
      if (t.fixedDials) expect(t.method, subject).toBe("custom");
    }
  });
});

/**
 * THE LAUNCH'S NUMBER AND ITS ROLL ARE THE VILLAGE'S OWN (Rye, 2026-11-06:
 * "EVERYTHING can change with the highest village vote", and no action may be
 * left without a vote path). The rule of 2026-11-27 is what they ship as.
 */
describe("the launch rule is the village's to change, and frozen on the ballot", () => {
  /**
   * The engine's reading of a launch ballot frozen for `need` yeses on a roll
   * of `roll`, each seat at one, built the way `closeBallot` builds it: from
   * the frozen share and the frozen roll size, through `atOnceEvaluation`.
   */
  const read = (need: number, roll: number, yes: number, no = 0, abstain = 0) => {
    const rules = evaluationRulesFor(VILLAGE_LAUNCH);
    const atOnce = atOnceEvaluation(VILLAGE_LAUNCH, { quorumPct: launchQuorumPct(need, roll), electorateCount: roll });
    if (!atOnce) throw new Error("the launch is a subject that carries at once");
    return evaluateBallot({
      method: "custom",
      unityPct: SUBJECT_THRESHOLDS[VILLAGE_LAUNCH].minUnityPct,
      quorumPct: atOnce.quorumPct,
      totalWeight: roll,
      tallies: { yesW: yes, noW: no, abstainW: abstain },
      abstainPolicy: rules.abstainPolicy,
      minYesHeads: atOnce.minYesHeads,
      heads: { yesHeads: yes, noHeads: no, abstainHeads: abstain, electorateCount: roll },
    });
  };

  it("freezes the count as a share of the roll and reads it back as EXACTLY that count, on every roll", () => {
    // The whole claim, exhaustively: on a roll of r with n asked for, the
    // stored share reads back as n, n yeses carry, and n minus one do not, for
    // every r up to 400 and every n from the floor to the whole roll. The
    // stored number is rounded down to the two decimals `ballots.quorum_pct`
    // holds, which is what could break it.
    let checked = 0;
    for (let roll = LAUNCH_YES_HEADS; roll <= 400; roll++) {
      for (let need = LAUNCH_YES_HEADS; need <= roll; need++) {
        const stored = launchQuorumPct(need, roll);
        if (Math.round(stored * 100) / 100 !== stored || stored > 100) throw new Error(`${need} of ${roll} does not fit the column: ${stored}`);
        if (yesHeadsFrozenAs(stored, roll) !== need) throw new Error(`${need} of ${roll} read back as ${yesHeadsFrozenAs(stored, roll)}`);
        if (read(need, roll, need) !== "passed") throw new Error(`${need} yeses did not carry a roll of ${roll} asking ${need}`);
        if (read(need, roll, need - 1) !== "no_quorum") throw new Error(`${need - 1} yeses carried a roll of ${roll} asking ${need}`);
        checked += 1;
      }
    }
    expect(checked).toBeGreaterThan(70_000);
    // Larger rolls, sampled up to the bound the reading is exact for.
    for (const roll of [999, 1000, 2500, 4096, 4999]) {
      for (const need of [3, 4, 17, Math.floor(roll / 3), Math.floor(roll / 2), roll - 1, roll]) {
        expect(yesHeadsFrozenAs(launchQuorumPct(need, roll), roll), `${need} of ${roll}`).toBe(need);
      }
    }
    // The corners, by hand.
    expect(launchQuorumPct(3, 3)).toBe(100);
    expect(launchQuorumPct(3, 5)).toBe(60);
    expect(launchQuorumPct(3, 7)).toBe(42.85);
    expect(launchQuorumPct(9, 3), "more asked than the roll holds is the whole roll").toBe(100);
    expect(launchQuorumPct(3, 0)).toBe(100);
    /*
     * THE CASE THAT MADE THIS A COUNT AND NEVER A COMPARED PERCENTAGE. 23 of 40
     * is 57.5%, and the engine's own share for 23 answers is 57.49999999999999
     * in floating point, so comparing percentages reads 23 yeses as short.
     */
    expect((23 / 40) * 100).toBeLessThan(57.5);
    expect(read(23, 40, 23)).toBe("passed");
    expect(read(23, 40, 22)).toBe("no_quorum");
    // Control: every other subject is handed no such reading and keeps its frozen dials.
    expect(atOnceEvaluation("mechanics", { quorumPct: 60, electorateCount: 5 })).toBeNull();
    expect(atOnceEvaluation(MINT_RULE, { quorumPct: 60, electorateCount: 5 })).toBeNull();
  });

  it("a village that raised its number to five carries on the FIFTH yes, never the third", () => {
    expect(read(5, 9, 3)).toBe("no_quorum");
    expect(read(5, 9, 4)).toBe("no_quorum");
    expect(read(5, 9, 5)).toBe("passed");
    // A no still holds it, whatever the number is.
    expect(read(5, 9, 8, 1)).toBe("failed");
    // An abstention is not one of the five.
    expect(read(5, 9, 4, 0, 5)).toBe("no_quorum");
    // Control: the same roll at the shipped number carries on three.
    expect(read(3, 9, 3)).toBe("passed");
  });

  it("can never be asked for fewer than three, whatever is stored", () => {
    for (const stored of [0, 1, 2, -4, Number.NaN]) expect(launchMinElectorate(stored)).toBe(LAUNCH_YES_HEADS);
    // And the engine holds the floor a second way: a ballot stamped for one
    // yes still asks three heads, so a mis-stamped number carries nothing.
    expect(read(1, 9, 1)).toBe("no_quorum");
    expect(read(1, 9, 2)).toBe("no_quorum");
    expect(read(1, 9, 3)).toBe("passed");
  });

  it("names who counts as a setting with two values, and an unreadable value is the rule as shipped", () => {
    expect(LAUNCH_ROLL_KINDS).toEqual(["founders", "members"]);
    expect(launchRollKindFrom("members")).toBe("members");
    expect(launchRollKindFrom("founders")).toBe("founders");
    for (const junk of ["", "everyone", "MEMBERS", null, undefined, 3]) {
      expect(launchRollKindFrom(junk), String(junk)).toBe("founders");
    }
  });

  it("both settings are real dials at the village's highest tier, so only its highest vote moves them after the Game starts", () => {
    const roll = VARIABLES_BY_KEY[LAUNCH_ROLL_KEY];
    expect(roll, "the key the route reads is the key the registry defines").toBeTruthy();
    expect(LAUNCH_ROLL_KEY).toBe("governance.launch_roll");
    expect(roll.type).toBe("choice");
    expect(roll.default).toBe("founders");
    expect((roll.choices ?? []).map((c) => c.value)).toEqual([...LAUNCH_ROLL_KINDS]);
    expect(criticalityOf(roll)).toBe("constitutional");
    expect(criticalityOf(VARIABLES_BY_KEY["governance.launch_min_electorate"])).toBe("constitutional");
    expect(VARIABLES_BY_KEY["governance.launch_min_electorate"].default).toBe(String(LAUNCH_YES_HEADS));
  });

  it("says the rule in one sentence at the village's own number and roll, and the registry's is that sentence as shipped", () => {
    expect(SUBJECT_THRESHOLDS[VILLAGE_LAUNCH].why).toBe(launchRuleSentence({ yesNeeded: LAUNCH_YES_HEADS, roll: "founders" }));
    expect(launchRuleSentence({ yesNeeded: 5, roll: "founders" })).toBe(
      "Only founding members vote on starting the Game. It carries the moment five of them have said yes, unless one of them has said no. A no holds it until that founding member changes their answer.",
    );
    expect(launchRuleSentence({ yesNeeded: 3, roll: "members" })).toBe(
      "Every member who holds a voice votes on starting the Game, each counted once. It carries the moment three of them have said yes, unless one of them has said no. A no holds it until that member changes their answer.",
    );
    expect(launchRuleSentence({ yesNeeded: 40, roll: "members" })).toContain("the moment 40 of them have said yes");
  });
});

describe("a roll of three heads is not a roll of three voices", () => {
  const seats = (...weights: number[]) => weights.map((weight) => ({ weight }));

  it("REPRODUCES the bypass the weight floor closes, in arithmetic", () => {
    /*
     * Measured against the shipped engine on 2026-08-30. Custom weight mode,
     * the founder allocated 1 and nobody else allocated at all. Every guard
     * that existed passes and one person carries the vote.
     */
    const roll = seats(1, 0, 0);
    const totalWeight = roll.reduce((s, e) => s + e.weight, 0);
    expect(electorateFloorProblem(VILLAGE_LAUNCH, roll.length)).toBeNull(); // three heads
    expect(roll.length).toBeGreaterThan(0); // openBallot's roll guard
    expect(totalWeight).toBeGreaterThan(0); // openBallot's weight guard

    const method = methodForSubject(VILLAGE_LAUNCH, "custom") as BallotMethod;
    const dials = dialsForSubject(VILLAGE_LAUNCH, method, { unityPct: 80, quorumPct: 20 });
    const tallies = { yesW: 1, noW: 0, abstainW: 0 }; // the founder alone
    expect(quorumPctOf(tallies, totalWeight)).toBe(100);
    expect(unityPctOf(tallies)).toBe(100);
    // On weight alone one person still carries it, which is the bypass.
    expect(evaluateBallot({ method, ...dials, totalWeight, tallies })).toBe("passed");
    // Since 2026-11-27 the head rule stops it a second way: one yes is not three.
    expect(
      evaluateBallot({
        method, ...dials, totalWeight, tallies,
        minYesHeads: evaluationRulesFor(VILLAGE_LAUNCH).minYesHeads,
        heads: { yesHeads: 1, noHeads: 0, abstainHeads: 0, electorateCount: 3 },
      }),
    ).toBe("no_quorum");

    // And the one thing that now stands between that roll and this engine.
    expect(rollProblem(VILLAGE_LAUNCH, roll)).toContain("no voting weight");
  });

  it("says how many seats weigh nothing, in words, and counts them right", () => {
    expect(weightFloorProblem(VILLAGE_LAUNCH, seats(1, 0, 0))).toBe(
      "2 of the 3 members on the roll carry no voting weight today. " +
        "This vote asks every one of them, so it opens once each of them carries some weight.",
    );
    expect(weightFloorProblem(VILLAGE_LAUNCH, seats(1, 1, 0))).toContain("One of the 3 members");
    expect(weightFloorProblem(VILLAGE_LAUNCH, seats(1, 1, 1))).toBeNull();
  });

  it("treats a negative or unset weight as no weight, because both are", () => {
    expect(weightFloorProblem(VILLAGE_LAUNCH, seats(1, 1, -3))).toContain("One of the 3");
    expect(weightFloorProblem(VILLAGE_LAUNCH, [{ weight: Number.NaN }, { weight: 1 }, { weight: 1 }])).toContain(
      "One of the 3",
    );
  });

  it("a skewed roll still decides in HEADS: the lightest founder's no holds it, the heaviest alone does not carry it", () => {
    // The launch roll is frozen at one each since 2026-11-27 (server/lib/
    // launchRoll.ts), so this roll cannot be built by the route. The rule is
    // pinned on it anyway, so it holds for a roll built any other way.
    const roll = seats(100, 5, 1);
    expect(rollProblem(VILLAGE_LAUNCH, roll)).toBeNull();
    const method = methodForSubject(VILLAGE_LAUNCH, "custom") as BallotMethod;
    const dials = dialsForSubject(VILLAGE_LAUNCH, method, { unityPct: 80, quorumPct: 20 });
    const rules = evaluationRulesFor(VILLAGE_LAUNCH);
    const totalWeight = 106;
    const read = (tallies: { yesW: number; noW: number; abstainW: number }, heads: { yesHeads: number; noHeads: number; abstainHeads: number }) =>
      evaluateBallot({ method, ...dials, totalWeight, tallies, abstainPolicy: rules.abstainPolicy, minYesHeads: rules.minYesHeads, heads: { ...heads, electorateCount: 3 } });
    // The heaviest founder alone: 100 of 106 of the weight and one head of three.
    expect(read({ yesW: 100, noW: 0, abstainW: 0 }, { yesHeads: 1, noHeads: 0, abstainHeads: 0 })).toBe("no_quorum");
    // Two say yes, the lightest says no: 105 against 1 is not unanimous.
    expect(read({ yesW: 105, noW: 1, abstainW: 0 }, { yesHeads: 2, noHeads: 1, abstainHeads: 0 })).toBe("failed");
    expect(read({ yesW: 106, noW: 0, abstainW: 0 }, { yesHeads: 3, noHeads: 0, abstainHeads: 0 })).toBe("passed");
  });

  it("asks the head count FIRST, so a young village hears the kinder fact", () => {
    // Two founders, neither carrying weight. Both things are true; "one more
    // founder" is the one that says what to do next.
    expect(rollProblem(VILLAGE_LAUNCH, seats(0, 0))).toContain("One more founding member");
  });

  it("asks nothing of a subject that did not ask for it", () => {
    expect(weightFloorProblem("mechanics", seats(0, 0, 0))).toBeNull();
    expect(rollProblem("mechanics", seats(0, 0, 0))).toBeNull();
    // mint_rule raises quorum to 50 and deliberately keeps no roll floor.
    expect(weightFloorProblem("mint_rule", seats(1, 0))).toBeNull();
  });
});


/**
 * THE FLOORS ARE SETTINGS NOW, AND THE REGISTRY IS THE FLOOR UNDER THEM.
 *
 * Section 7A's rule is that a governance number must be changeable without a
 * deploy. These cases pin the half that makes it safe: the setting can only
 * ever raise the platform's own number, in both layers that read it.
 */
describe("threshold settings, with the registry as floors", () => {
  const village = { unityPct: 80, quorumPct: 20 };
  const settingsOf = (values: Record<string, number>) => thresholdSettingsFrom((key) => values[key] ?? 0);

  it("falls back to the registry when a village has set nothing", () => {
    const registry = settingsOf({});
    for (const c of CRITICALITIES) expect(registry.tiers[c], c).toEqual(TIER_FLOORS[c]);
    expect(registry.subjects[MINT_RULE]).toEqual({
      unityPct: SUBJECT_THRESHOLDS[MINT_RULE].minUnityPct,
      quorumPct: SUBJECT_THRESHOLDS[MINT_RULE].minQuorumPct,
    });
  });

  it("REFUSES to be lowered, whatever is stored, on every tier and every subject", () => {
    const sabotaged = settingsOf({
      [TIER_SETTING_KEYS.constitutional.unity]: 10,
      [TIER_SETTING_KEYS.constitutional.quorum]: 10,
      [TIER_SETTING_KEYS.structural.unity]: 0,
      [TIER_SETTING_KEYS.structural.quorum]: 0,
      [SUBJECT_SETTING_KEYS[MINT_RULE].quorum]: 1,
    });
    expect(sabotaged.tiers.constitutional).toEqual(TIER_FLOORS.constitutional);
    expect(sabotaged.tiers.structural).toEqual(TIER_FLOORS.structural);
    expect(sabotaged.subjects[MINT_RULE].quorumPct).toBe(SUBJECT_THRESHOLDS[MINT_RULE].minQuorumPct);
  });

  it("lets a village RAISE a tier, and the raise reaches the ballot", () => {
    const raised = settingsOf({ [TIER_SETTING_KEYS.structural.quorum]: 75 });
    expect(floorForCriticality("structural", raised).quorumPct).toBe(75);
    expect(floorForCriticality("routine", raised)).toEqual(TIER_FLOORS.routine);
  });

  it("lets a village raise ONE subject without moving the tier under it", () => {
    const raised = settingsOf({ [SUBJECT_SETTING_KEYS[MINT_RULE].quorum]: 90 });
    expect(floorForSubject(MINT_RULE, raised).quorumPct).toBe(90);
    expect(floorForCriticality("structural", raised).quorumPct).toBe(TIER_FLOORS.structural.quorumPct);
    // And the ballot freezes it.
    expect(dialsForSubject(MINT_RULE, "custom", village, raised).quorumPct).toBe(90);
  });

  it("prices the Birthing at its own rule with no setting to move it", () => {
    expect(SUBJECT_SETTING_KEYS[VILLAGE_LAUNCH]).toBeUndefined();
    const raised = settingsOf({ [TIER_SETTING_KEYS.constitutional.quorum]: 99 });
    // A raised tier does not reach it either: unity 100, quorum 0, three yes heads.
    expect(dialsForSubject(VILLAGE_LAUNCH, "custom", village, raised)).toEqual({ unityPct: 100, quorumPct: 0 });
  });

  it("names every threshold key exactly once, so no control edits two things", () => {
    expect(new Set(THRESHOLD_PERCENT_KEYS).size).toBe(THRESHOLD_PERCENT_KEYS.length);
    for (const c of CRITICALITIES) {
      expect(THRESHOLD_PERCENT_KEYS, c).toContain(TIER_SETTING_KEYS[c].unity);
      expect(THRESHOLD_PERCENT_KEYS, c).toContain(TIER_SETTING_KEYS[c].quorum);
    }
  });
});

describe("the constitutional subject: how votes are counted", () => {
  it("asks 97 and 97, which is the tier and not a second copy of the number", () => {
    const t = SUBJECT_THRESHOLDS[GOVERNANCE_MODE];
    expect(t.criticality).toBe("constitutional");
    expect({ unityPct: t.minUnityPct, quorumPct: t.minQuorumPct }).toEqual(TIER_FLOORS.constitutional);
  });

  it("fixes the method, because a 97 nobody reads is a lie with a number on it", () => {
    expect(methodForSubject(GOVERNANCE_MODE, "majority")).toBe("custom");
    expect(methodForSubject(GOVERNANCE_MODE, "hypha")).toBe("custom");
  });

  it("is a subject type the ballots column can hold", () => {
    expect(GOVERNANCE_MODE.length).toBeLessThanOrEqual(24);
  });
});

describe("a bundle is priced at its hardest part", () => {
  const village = { unityPct: 80, quorumPct: 20 };

  it("takes one subject exactly as it always did", () => {
    expect(dialsForSubject([MINT_RULE], "custom", village)).toEqual(dialsForSubject(MINT_RULE, "custom", village));
    expect(dialsForSubject(["mechanics"], "custom", village)).toEqual(dialsForMethod("custom", village));
  });

  it("takes the HIGHEST floor among the elements, each dial on its own", () => {
    // A mint rule asks 50 of quorum and nothing of unity; a mode switch asks
    // 97 of both. The bundle asks 97 and 97.
    expect(dialsForSubject([MINT_RULE, GOVERNANCE_MODE], "custom", village)).toEqual({
      unityPct: 97,
      quorumPct: 97,
    });
    // A mint rule beside an ordinary rule change asks the mint rule's quorum
    // and leaves unity where the village put it.
    expect(dialsForSubject(["mechanics", MINT_RULE], "custom", village)).toEqual({
      unityPct: 80,
      quorumPct: 50,
    });
  });

  it("never lowers the village, whatever the bundle holds", () => {
    const strict = { unityPct: 100, quorumPct: 100 };
    expect(dialsForSubject(["mechanics", MINT_RULE, GOVERNANCE_MODE], "custom", strict)).toEqual(strict);
  });

  it("prices an empty bundle as the village's own dials and refuses to invent a floor", () => {
    expect(dialsForSubject([], "custom", village)).toEqual(dialsForMethod("custom", village));
  });

  it("says so when two elements want two different methods, instead of picking one", () => {
    expect(methodForSubjects(["mechanics"])).toEqual({ method: null, conflict: null });
    expect(methodForSubjects([MINT_RULE, GOVERNANCE_MODE]).method).toBe("custom");
    // Both fixed subjects today conduct `custom`, so there is nothing to
    // collide yet; the shape is pinned so the next subject that fixes a
    // different method is caught rather than silently overruled.
    expect(methodForSubjects([VILLAGE_LAUNCH, GOVERNANCE_MODE]).conflict).toBeNull();
  });

  it("takes the strictest evaluation rules among the elements", () => {
    expect(evaluationRulesFor([VILLAGE_LAUNCH, "mechanics"])).toEqual({
      abstainPolicy: "no_answer",
      minYesHeads: LAUNCH_YES_HEADS,
      // A bundle never carries at once: one of its parts may have a steward window.
      carriesAtOnce: false,
    });
    expect(evaluationRulesFor(VILLAGE_LAUNCH).carriesAtOnce).toBe(true);
    expect(evaluationRulesFor(["mechanics", MINT_RULE])).toEqual({
      abstainPolicy: "counts_toward_quorum",
      minYesHeads: undefined,
      carriesAtOnce: false,
    });
  });
});

describe("thresholdsFor, the one helper every surface reads", () => {
  const village = { unityPct: 80, quorumPct: 20 };

  it("answers for a subject, a bundle and a bare tier alike", () => {
    expect(thresholdsFor({ subjects: [MINT_RULE] }, "custom", village)).toMatchObject({ quorumPct: 50 });
    expect(thresholdsFor({ criticality: "constitutional" }, "custom", village)).toMatchObject({
      unityPct: 97,
      quorumPct: 97,
    });
    expect(thresholdsFor({ criticality: "routine" }, "custom", village)).toMatchObject(village);
  });

  it("carries the warning when the numbers land above the recommended ceiling", () => {
    expect(thresholdsFor({ criticality: "constitutional" }, "custom", village).warning).toBeNull();
    const strict = thresholdsFor({ subjects: ["mechanics"] }, "custom", { unityPct: 100, quorumPct: 20 });
    expect(strict.warning).toContain("stalemate");
  });

  it("EXEMPTS the Birthing, where one founder's no holding the vote is the rule", () => {
    const launch = thresholdsFor({ subjects: [VILLAGE_LAUNCH] }, "custom", village);
    expect(launch).toMatchObject({ unityPct: 100, quorumPct: 0 });
    expect(launch.warning).toBeNull();
  });

  it("reports the method a subject fixed, so a surface never says the wrong one", () => {
    expect(thresholdsFor({ subjects: [VILLAGE_LAUNCH] }, "majority", village).method).toBe("custom");
    expect(thresholdsFor({ subjects: ["mechanics"] }, "majority", village).method).toBeNull();
  });
});

describe("the warning where a dial is edited", () => {
  it("says nothing about a key that is not a threshold", () => {
    expect(stalemateWarningFor("gratitude.base_budget", "100")).toBeNull();
    expect(stalemateWarningFor("governance.vote_days", "30")).toBeNull();
  });

  it("warns on the village's own dials and on every tier dial, above 97 only", () => {
    expect(stalemateWarningFor("governance.unity_pct", "97")).toBeNull();
    expect(stalemateWarningFor("governance.unity_pct", "98")).toContain("stalemate");
    expect(stalemateWarningFor("governance.quorum_pct", "100")).toContain("stalemate");
    expect(stalemateWarningFor(TIER_SETTING_KEYS.constitutional.quorum, "99")).toContain("stalemate");
  });

  it("says nothing about a value that is not a number yet, which is every half-typed one", () => {
    expect(stalemateWarningFor("governance.unity_pct", "")).toBeNull();
    expect(stalemateWarningFor("governance.unity_pct", "9x")).toBeNull();
  });
});

describe("the typed items a change set is made of", () => {
  it("prices every kind, so a kind cannot arrive without a bar", () => {
    for (const kind of CHANGE_ITEM_KINDS) {
      expect(SUBJECT_FOR_ITEM_KIND[kind], kind).toBeTruthy();
      if (kind !== "dial") {
        expect(CRITICALITY_FOR_ITEM_KIND[kind], kind).toBeTruthy();
        expect(CRITICALITIES, kind).toContain(CRITICALITY_FOR_ITEM_KIND[kind]);
      }
    }
  });

  it("sends a mode switch to the constitutional subject and nowhere else", () => {
    expect(SUBJECT_FOR_ITEM_KIND.mode_switch).toBe(GOVERNANCE_MODE);
    expect(CRITICALITY_FOR_ITEM_KIND.mode_switch).toBe("constitutional");
  });

  it("prices a mixed bundle at its most critical element", () => {
    expect(criticalityOfItems([])).toBe("routine");
    expect(criticalityOfItems(["routine", "structural"])).toBe("structural");
    expect(criticalityOfItems(["routine", "constitutional", "structural"])).toBe("constitutional");
  });
});

/**
 * THE OVERRIDE TIER (19E). A vetoed proposal brought back and passed again at
 * the village's highest set tier lands whatever a steward says, so the
 * setting naming that tier is priced at itself.
 */
describe("the highest set tier, and the veto override", () => {
  const tierOf = (value: string) =>
    thresholdSettingsFrom(
      () => 0,
      (key) => (key === HIGHEST_TIER_KEY ? value : ""),
    );

  it("reads the setting, and the override tier is what it names", () => {
    expect(highestTier(tierOf("structural"))).toBe("structural");
    expect(overrideDials(tierOf("structural"))).toEqual(TIER_FLOORS.structural);
    expect(highestTier(tierOf("constitutional"))).toBe("constitutional");
    expect(overrideDials(tierOf("constitutional"))).toEqual(TIER_FLOORS.constitutional);
  });

  it("answers the top of the ladder when nothing was set or the value is not a tier", () => {
    const top = CRITICALITIES[CRITICALITIES.length - 1];
    expect(highestTierFrom()).toBe(top);
    expect(highestTierFrom(() => "")).toBe(top);
    expect(highestTierFrom(() => "whatever-a-fork-typed")).toBe(top);
    expect(highestTier()).toBe(top);
  });

  it("carries a village's raised tier into the override, so the override is never the cheaper number", () => {
    const raised = thresholdSettingsFrom(
      (key) => (key === TIER_SETTING_KEYS.structural.quorum ? 90 : 0),
      (key) => (key === HIGHEST_TIER_KEY ? "structural" : ""),
    );
    expect(overrideDials(raised)).toEqual({ unityPct: 80, quorumPct: 90 });
  });
});

/**
 * THRESHOLDS FOR THRESHOLDS (19B). "they also can be changed by reaching the
 * same amount they are set at can change their threshold again."
 */
describe("a threshold change is priced at that threshold's current bar", () => {
  it("prices a tier's own dials at that tier", () => {
    const registry = thresholdSettingsFrom(() => 0);
    expect(thresholdChangePrice(TIER_SETTING_KEYS.constitutional.unity, registry)).toEqual(
      TIER_FLOORS.constitutional,
    );
    expect(thresholdChangePrice(TIER_SETTING_KEYS.structural.quorum, registry)).toEqual(
      TIER_FLOORS.structural,
    );
    expect(thresholdChangePrice(TIER_SETTING_KEYS.routine.unity, registry)).toEqual(TIER_FLOORS.routine);
  });

  it("follows the bar a village has actually set, up or down, so 97 costs 97 to move", () => {
    const raised = thresholdSettingsFrom((key) =>
      key === TIER_SETTING_KEYS.structural.unity || key === TIER_SETTING_KEYS.structural.quorum ? 97 : 0,
    );
    expect(thresholdChangePrice(TIER_SETTING_KEYS.structural.unity, raised)).toEqual({
      unityPct: 97,
      quorumPct: 97,
    });
  });

  it("prices the highest-tier setting at itself", () => {
    const structural = thresholdSettingsFrom(
      () => 0,
      (key) => (key === HIGHEST_TIER_KEY ? "structural" : ""),
    );
    expect(thresholdChangePrice(HIGHEST_TIER_KEY, structural)).toEqual(TIER_FLOORS.structural);
    const constitutional = thresholdSettingsFrom(
      () => 0,
      (key) => (key === HIGHEST_TIER_KEY ? "constitutional" : ""),
    );
    expect(thresholdChangePrice(HIGHEST_TIER_KEY, constitutional)).toEqual(TIER_FLOORS.constitutional);
  });

  it("prices a subject's own floor at that subject, and the village dials at the structural tier", () => {
    const registry = thresholdSettingsFrom(() => 0);
    expect(thresholdChangePrice(SUBJECT_SETTING_KEYS[MINT_RULE].quorum, registry)).toEqual(
      floorForSubject(MINT_RULE, registry),
    );
    expect(thresholdChangePrice("governance.unity_pct", registry)).toEqual(TIER_FLOORS.structural);
    expect(thresholdChangePrice("governance.quorum_pct", registry)).toEqual(TIER_FLOORS.structural);
  });

  it("answers null for a key that sets no bar of its own, which is not the same as free", () => {
    expect(thresholdChangePrice("gratitude.base_budget")).toBeNull();
    expect(thresholdChangePrice("governance.vote_days")).toBeNull();
  });

  it("names every self-priced key, so a control can find them without a second list", () => {
    for (const key of SELF_PRICED_THRESHOLD_KEYS) {
      expect(thresholdChangePrice(key), key).not.toBeNull();
    }
    expect(SELF_PRICED_THRESHOLD_KEYS).toContain(HIGHEST_TIER_KEY);
  });
});

/** A tier and a subject, read against a real roll in people as well as weight. */
describe("a tier read in people", () => {
  const concentrated = [
    { weight: 40 },
    { weight: 32 },
    { weight: 25 },
    ...Array.from({ length: 6 }, () => ({ weight: 0.5 })),
  ];
  const equalNine = Array.from({ length: 9 }, () => ({ weight: 1 }));

  it("says the constitutional bar in weight and in people on a concentrated roll", () => {
    const reading = tierInPeople("constitutional", concentrated);
    expect(reading.dials).toEqual(TIER_FLOORS.constitutional);
    expect(reading.fewestForQuorum).toBe(3);
    expect(reading.sentence).toContain("at least 3 of 9 people");
    expect(reading.needsEveryone).toBe(false);
    expect(reading.rollWarning).toBeNull();
    expect(reading.ceilingWarning).toBeNull();
  });

  it("says the same bar in heads on an equal roll, and warns that it is everybody", () => {
    const reading = tierInPeople("constitutional", equalNine);
    expect(reading.equalWeights).toBe(true);
    expect(reading.fewestForQuorum).toBe(9);
    expect(reading.needsEveryone).toBe(true);
    expect(reading.sentence).toContain("at least 9 of 9 people");
    // THRESHOLDS-FIX, 19G: the count in this sentence is now the seats the
    // quorum reaches, which on a roll of nine ordinary members is the nine.
    expect(reading.rollWarning).toContain("every one of the 9 people this count reaches");
  });

  it("warns above 97 without refusing, which is his ruling and not the audit's", () => {
    const above = thresholdSettingsFrom((key) =>
      key === TIER_SETTING_KEYS.constitutional.quorum ? 99 : 0,
    );
    const reading = tierInPeople("constitutional", concentrated, above);
    expect(reading.dials.quorumPct).toBe(99);
    expect(reading.ceilingWarning).toContain("stalemate");
  });

  it("reads a subject the same way, and exempts the Birthing from both warnings", () => {
    const launch = subjectInPeople(VILLAGE_LAUNCH, equalNine);
    // Its weighted numbers ask no turnout: the three yes heads are the participation.
    expect(launch.dials).toEqual({ unityPct: 100, quorumPct: 0 });
    expect(launch.rollWarning).toBeNull();
    expect(launch.ceilingWarning).toBeNull();
    expect(launch.reachWarning).toBeNull();
  });
});

/** Delegated rows on a vote that asks everyone to agree in person. */
describe("delegated rows at 100 unity", () => {
  it("refuses a delegated row on the Birthing, whatever its stamped bar says", () => {
    expect(delegatedRowsCountOn({ subjectType: VILLAGE_LAUNCH, unityPct: 100 })).toBe(false);
    expect(delegatedRowsCountOn({ subjectType: VILLAGE_LAUNCH, unityPct: 80 })).toBe(false);
  });

  it("refuses a delegated row on any subject conducted at 100 unity", () => {
    expect(delegatedRowsCountOn({ subjectType: "mechanics", unityPct: 100 })).toBe(false);
    expect(delegatedRowsCountOn({ subjectType: GOVERNANCE_MODE, unityPct: 100 })).toBe(false);
  });

  it("counts a delegated row everywhere else, including the constitutional 97", () => {
    expect(delegatedRowsCountOn({ subjectType: "mechanics", unityPct: 80 })).toBe(true);
    expect(delegatedRowsCountOn({ subjectType: GOVERNANCE_MODE, unityPct: 97 })).toBe(true);
    expect(delegatedRowsCountOn({ unityPct: 0 })).toBe(true);
  });

  it("says why, in one sentence the page can render", () => {
    expect(delegationRefusalSentence()).toContain("in person");
  });
});

/**
 * THE STALEMATE RE-RUN, with the founder's abuse guard: "we have to do this in
 * a way where they can't be abused by people who don't like the outcome."
 */
describe("the stalemate re-run", () => {
  const gone = { userId: "u-gone", weight: 60, ledgerRef: "mem-2026-09-03-1" };
  const base = {
    subjectType: "mechanics",
    status: "open",
    quorumPct: 50,
    totalWeight: 100,
    departed: [gone],
    votedUserIds: ["u-a", "u-b"],
  };

  it("is offered when a departed seat makes quorum unreachable, and carries the votes still here", () => {
    const offer = rerunOffer(base);
    expect(offer.offered).toBe(true);
    if (offer.offered) {
      expect(offer.carryForward).toEqual(["u-a", "u-b"]);
      expect(offer.sentence).toContain("left the village");
    }
  });

  it("is never offered after the ballot closes", () => {
    const offer = rerunOffer({ ...base, status: "no_quorum" });
    expect(offer).toMatchObject({ offered: false, reason: "closed" });
  });

  it("needs the membership record, so a self-declared absence opens nothing", () => {
    const offer = rerunOffer({ ...base, departed: [{ userId: "u-gone", weight: 60 }] });
    expect(offer).toMatchObject({ offered: false, reason: "nobody_left" });
  });

  it("is refused when the departed seat already voted against the outcome a re-run would change", () => {
    const offer = rerunOffer({ ...base, departed: [{ ...gone, choice: "no" }] });
    expect(offer).toMatchObject({ offered: false, reason: "departed_voted_against" });
  });

  it("is refused while quorum is still reachable with the members who are here", () => {
    const offer = rerunOffer({ ...base, departed: [{ ...gone, weight: 40 }] });
    expect(offer).toMatchObject({ offered: false, reason: "quorum_still_reachable" });
  });

  it("exempts the Birthing, whose re-runnability is designed", () => {
    const offer = rerunOffer({ ...base, subjectType: VILLAGE_LAUNCH });
    expect(offer).toMatchObject({ offered: false, reason: "exempt" });
  });

  it("drops a departed member from the carry list and keeps the rest", () => {
    const offer = rerunOffer({ ...base, votedUserIds: ["u-a", "u-gone", "u-a"] });
    expect(offer.offered).toBe(true);
    if (offer.offered) expect(offer.carryForward).toEqual(["u-a"]);
  });

  it("says it could not tell on a weightless roll, and never calls that a stalemate", () => {
    const offer = rerunOffer({ ...base, totalWeight: 0 });
    expect(offer).toMatchObject({ offered: false, reason: "no_weight" });
  });
});

/**
 * -- THE DIALS A TRIAL MAY NEVER TOUCH (audit 2, risk 1) ---------------------
 *
 * Red before the class existed: 21.2's exclusion list left out quorum, unity
 * and every tier dial, so one cheap proposal could open a moon in which
 * permanent changes were priced at a bar nobody agreed to.
 */
describe("meta settings", () => {
  it("names quorum, unity and every tier dial", () => {
    expect(isMetaSetting("governance.quorum_pct")).toBe(true);
    expect(isMetaSetting("governance.unity_pct")).toBe(true);
    for (const c of CRITICALITIES) {
      expect(isMetaSetting(TIER_SETTING_KEYS[c].unity), c).toBe(true);
      expect(isMetaSetting(TIER_SETTING_KEYS[c].quorum), c).toBe(true);
    }
    for (const key of THRESHOLD_PERCENT_KEYS) expect(isMetaSetting(key), key).toBe(true);
  });

  it("names the veto map, the window, the cooldown and the two counting dials", () => {
    for (const key of [
      "governance.steward_subjects",
      "governance.auto_execute_subjects",
      "governance.veto_hours",
      "governance.steward_council",
      "governance.highest_tier",
      "governance.trial_cooldown_cycles",
      "governance.nonhuman_in_quorum",
      "governance.absent_cycles",
    ]) {
      expect(isMetaSetting(key), key).toBe(true);
    }
  });

  it("catches a window setting the windows lane has not written yet, by prefix", () => {
    expect(isMetaSetting("governance.window_mechanics")).toBe(true);
    expect(isMetaSetting("governance.window_grace_days")).toBe(true);
  });

  it("leaves an ordinary dial alone", () => {
    expect(isMetaSetting("governance.sensing_days")).toBe(false);
    expect(isMetaSetting("gratitude.pool")).toBe(false);
  });

  it("refuses a trial of a pricing dial, naming it and the rule", () => {
    const refusal = metaSettingTrialRefusal("governance.quorum_pct");
    expect(refusal).toContain("governance.quorum_pct");
    expect(refusal).toContain("at its own current bar");
    expect(metaSettingTrialRefusal(TIER_SETTING_KEYS.constitutional.quorum)).toContain(
      TIER_SETTING_KEYS.constitutional.quorum,
    );
  });

  it("refuses a bundle that hides one pricing dial among ordinary ones", () => {
    expect(
      metaSettingTrialRefusal(["governance.sensing_days", "governance.unity_pct"]),
    ).toContain("governance.unity_pct");
  });

  it("allows a trial of a dial that prices nothing", () => {
    expect(metaSettingTrialRefusal(["governance.sensing_days"])).toBeNull();
    expect(metaSettingTrialRefusal([])).toBeNull();
  });
});

/**
 * -- THREE CYCLES WITHOUT QUORUM (19F, 20.11) -------------------------------
 *
 * Red before the counter existed: the founder's "3 cycles without quorum it
 * just doesn't pass" had no count, no warning and no terminal state, so a
 * proposer read the same page after the ninth miss as after the first.
 */
describe("three cycles without quorum", () => {
  it("counts consecutive misses and stops at the first decided close", () => {
    expect(consecutiveNoQuorum([])).toBe(0);
    expect(consecutiveNoQuorum([{ status: "no_quorum" }, { status: "no_quorum" }])).toBe(2);
    expect(
      consecutiveNoQuorum([{ status: "no_quorum" }, { status: "failed" }, { status: "no_quorum" }]),
    ).toBe(1);
    expect(consecutiveNoQuorum([{ status: "passed" }])).toBe(0);
  });

  it("skips a ballot still running, which has said nothing either way", () => {
    expect(consecutiveNoQuorum([{ status: "open" }, { status: "no_quorum" }])).toBe(1);
  });

  it("says nothing on the first miss", () => {
    const r = quorumMissReading({ subjectType: "mechanics", misses: 1, quorumPct: 97 });
    expect(r.state).toBe("clear");
    expect(r.sentence).toBeNull();
    expect(r.remaining).toBe(2);
  });

  it("warns on the second, names the tier as the obstacle, and says the next one ends it", () => {
    const r = quorumMissReading({
      subjectType: "mechanics",
      misses: 2,
      quorumPct: 97,
      criticality: "constitutional",
    });
    expect(r.state).toBe("warned");
    expect(r.sentence).toContain("the constitutional tier, which asks for 97% of the weight");
    expect(r.sentence).toContain("ends this one for good");
    expect(r.remaining).toBe(1);
  });

  it("ends it on the third, names the state, and leaves one door", () => {
    const r = quorumMissReading({
      subjectType: "mechanics",
      misses: 3,
      quorumPct: 97,
      criticality: "constitutional",
      backers: 4,
    });
    expect(r.state).toBe("ended");
    expect(r.terminalState).toBe(NO_QUORUM_ENDED);
    expect(r.remaining).toBe(0);
    expect(r.sentence).toContain("three times in a row");
    expect(r.sentence).toContain("it was never counted");
    expect(r.door).toContain("Withdraw it and write it again");
    expect(r.door).toContain("All 4 of its backers come with it");
  });

  it("keeps the door true when nobody handed it a backer count", () => {
    const r = quorumMissReading({ subjectType: "mechanics", misses: 3, quorumPct: 20 });
    expect(r.door).toContain("Everyone backing it comes with it");
  });

  it("exempts the Birthing, which is asked again on a fresh roll every time", () => {
    const r = quorumMissReading({ subjectType: VILLAGE_LAUNCH, misses: 9, quorumPct: 100 });
    expect(r.state).toBe("clear");
    expect(r.terminalState).toBeNull();
  });
});

/**
 * -- THE RE-RUN, FOR A BLOC THAT CANNOT VOTE (audit 2, risks 11 and 90) ------
 *
 * Red before this: the offer only saw a member who had left, and the likelier
 * stalemate arrives from seats that are still on the roll and answer nothing.
 */
describe("a re-run for weight that cannot answer", () => {
  const base = {
    subjectType: "mechanics",
    status: "open",
    quorumPct: 90,
    totalWeight: 100,
    departed: [],
    votedUserIds: ["u-a"],
  };

  it("is offered when an unvotable bloc puts quorum out of reach, with nobody departed", () => {
    const offer = rerunOffer({
      ...base,
      unvotable: [
        { userId: "u-river", weight: 15, reason: "silent" as const },
        { userId: "u-hill", weight: 10, reason: "no_representative" as const },
      ],
    });
    expect(offer.offered).toBe(true);
    if (offer.offered) {
      expect(offer.sentence).toContain("2 votes on this roll hold weight that cannot answer");
      expect(offer.carryForward).toEqual(["u-a"]);
    }
  });

  it("still refuses when the silent seat already voted against", () => {
    const offer = rerunOffer({
      ...base,
      unvotable: [{ userId: "u-river", weight: 40, reason: "silent" as const, choice: "no" as const }],
    });
    expect(offer).toMatchObject({ offered: false, reason: "departed_voted_against" });
  });

  it("says so when every seat can still answer", () => {
    expect(rerunOffer({ ...base, unvotable: [] })).toMatchObject({ offered: false, reason: "nobody_left" });
  });

  it("still refuses while the votable weight can reach the bar", () => {
    const offer = rerunOffer({
      ...base,
      quorumPct: 50,
      unvotable: [{ userId: "u-river", weight: 15, reason: "silent" as const }],
    });
    expect(offer).toMatchObject({ offered: false, reason: "quorum_still_reachable" });
  });
});

describe("a tier read against the weight that votes", () => {
  const roll = [{ weight: 75 }, { weight: 10, nonHuman: true }, { weight: 15, nonHuman: true }];

  it("warns that the bar cannot be reached, without any dial being above 97", () => {
    const reading = tierInPeople("constitutional", roll);
    expect(reading.ceilingWarning).toBeNull();
    expect(reading.reachWarning).toContain("asks for 97%");
    expect(reading.quorumBase.excludedWeight).toBe(25);
    expect(reading.sentence).toContain("outside this count");
  });

  it("stays quiet on a roll every seat of which is in the count", () => {
    const reading = tierInPeople("structural", [{ weight: 1 }, { weight: 1 }]);
    expect(reading.reachWarning).toBeNull();
  });

  it("exempts the Birthing from the reach warning as it does from the other two", () => {
    expect(subjectInPeople(VILLAGE_LAUNCH, roll).reachWarning).toBeNull();
  });
});
