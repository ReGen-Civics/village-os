/**
 * D2a (launch security decisions, 2026-11-15; Rye: ON): the dials that decide
 * how votes pass close to the dial write when the Game starts. The predicate
 * is pinned with the flag both ways, and the dial write is driven end to end
 * below with its collaborators stubbed.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

let started = false;
vi.mock("./gameStart", () => ({
  readGameStart: vi.fn(async () => ({ started, startedAt: null, ballotId: null, startedBy: null, note: "" })),
}));
vi.mock("./variables", () => ({
  setVariable: vi.fn(async (_pool: unknown, key: string, value: string) => ({ ok: true, key, value, previous: null })),
}));
vi.mock("./villageFloors", () => ({ floorDialRefusal: vi.fn(async () => null) }));

import {
  GOVERNANCE_DIALS_CLOSE_AT_LAUNCH,
  ISSUANCE_DIAL_CLOSED_AT_LAUNCH,
  ISSUANCE_DIALS_CLOSED_AT_LAUNCH,
  closesAtLaunch,
  VOTE_RULE_DIAL_CLOSED_AT_LAUNCH,
  VOTE_RULE_DIAL_EXTRAS,
  isVoteRuleDial,
  voteRuleDialClosed,
} from "./launchDoors";
import { writeDial, type DialWriteDeps } from "./dialWrite";
import { VARIABLES_BY_KEY, ringOf } from "../../shared/gameVariables";

describe("the constant defaults to the secure choice", () => {
  it("the vote-rule dials close at launch unless somebody flips the line", () => {
    expect(GOVERNANCE_DIALS_CLOSE_AT_LAUNCH).toBe(true);
  });
});

describe("D2a: the dials that decide how votes pass", () => {
  it("names unity, quorum, the tiers, the highest tier and the launch head count", () => {
    for (const k of [
      "governance.unity_pct",
      "governance.quorum_pct",
      "governance.tier_structural_quorum_pct",
      "governance.tier_constitutional_unity_pct",
      "governance.subject_mint_rule_unity_pct",
      "governance.highest_tier",
      "governance.launch_min_electorate",
      "governance.launch_roll",
      "governance.default_method",
      "governance.vote_days",
      "governance.window_role_seat",
    ]) expect(isVoteRuleDial(k), k).toBe(true);
  });
  it("leaves ordinary dials and the founder's brake alone", () => {
    for (const k of ["gratitude.base_budget", "governance.auto_apply_enabled", "governance.hub_url"]) {
      expect(isVoteRuleDial(k), k).toBe(false);
    }
  });
  it("every extra is a real dial the village's vote can reach, so closing it strands nothing", () => {
    for (const k of VOTE_RULE_DIAL_EXTRAS) {
      const def = VARIABLES_BY_KEY[k];
      expect(def, k).toBeTruthy();
      expect(ringOf(def!), k).toBe("open");
    }
  });
  it("closes after launch, keeps the break-glass, and the flag restores it", () => {
    expect(voteRuleDialClosed("governance.unity_pct", false, false)).toBe(false);
    expect(voteRuleDialClosed("governance.unity_pct", true, false)).toBe(true);
    expect(voteRuleDialClosed("governance.unity_pct", true, true), "founder-steward broke the glass").toBe(false);
    expect(voteRuleDialClosed("gratitude.base_budget", true, false)).toBe(false);
    expect(voteRuleDialClosed("governance.unity_pct", true, false, false)).toBe(false);
  });
});

describe("the refusals follow the house voice", () => {
  it("carries no em or en dash and no contrast framing", () => {
    for (const s of [VOTE_RULE_DIAL_CLOSED_AT_LAUNCH, ISSUANCE_DIAL_CLOSED_AT_LAUNCH]) {
      expect(s).not.toMatch(/[–—]/);
      expect(s.toLowerCase()).not.toContain("rather than");
    }
  });
});

function dialDeps(verdict: Partial<{ ok: boolean; source: string; reachedPast: boolean }>): DialWriteDeps {
  return {
    mayAct: async () => ({
      ok: true, reachedPast: false, villageHolds: false, source: "admin", message: "",
      needsOverride: false, overrideAvailable: false, holderName: null, ...verdict,
    }),
    overrideRefusal: () => null,
    authedUser: async () => ({ id: "u-admin" }),
    adminActor: () => ({ id: "u-admin" }),
    getPool: () => ({}) as any,
    recordMechanicsChange: async () => undefined,
    addActivity: async () => undefined,
    checkVoiceSecret: () => ({ ok: true }),
  };
}

describe("D2a through the dial write itself", () => {
  beforeEach(() => { started = false; });

  it("before launch an admin sets the quorum", async () => {
    const a = await writeDial(dialDeps({}), {} as any, "governance.quorum_pct", "30");
    expect(a.status).toBe(200);
  });

  it("after launch an admin is refused the quorum and told to propose it", async () => {
    started = true;
    const a = await writeDial(dialDeps({}), {} as any, "governance.quorum_pct", "30");
    expect(a.status).toBe(409);
    expect(a.body.error).toBe(VOTE_RULE_DIAL_CLOSED_AT_LAUNCH);
    expect(a.body.proposeInstead).toBe(true);
  });

  it("after launch the head count for the launch is closed too", async () => {
    started = true;
    const a = await writeDial(dialDeps({}), {} as any, "governance.launch_min_electorate", "1");
    expect(a.status).toBe(409);
  });

  it("who the launch asks is the founder's to set before the Game starts, and closed to the panel after (Rye, 2026-11-06 and 2026-11-27)", async () => {
    // Before: a founder builds the Game, this setting included.
    started = false;
    const before = await writeDial(dialDeps({}), {} as any, "governance.launch_roll", "members");
    expect(before.status).toBe(200);
    // After: a village that is issuing and has not held its launch vote must
    // not have its panel choose who answers. The village's highest vote does.
    started = true;
    const after = await writeDial(dialDeps({}), {} as any, "governance.launch_roll", "founders");
    expect(after.status).toBe(409);
    expect((after.body as any).proposeInstead).toBe(true);
    expect((after.body as any).code).toBe("vote_rule_dial_closed_at_launch");
  });

  it("after launch an ordinary dial still writes", async () => {
    started = true;
    const a = await writeDial(dialDeps({}), {} as any, "gratitude.base_budget", "12");
    expect(a.status).toBe(200);
  });

  it("after launch the founder-steward who broke the glass keeps the door", async () => {
    started = true;
    const a = await writeDial(dialDeps({ source: "override", reachedPast: true }), {} as any, "governance.quorum_pct", "30");
    expect(a.status).toBe(200);
  });
});

describe("the issuance cap closes at launch beside the vote rules (2026-11-18)", () => {
  beforeEach(() => { started = false; });
  const CAP = "ledger.admin_mint_cycle_cap";

  it("is named, is an open-ring dial the village's vote can reach, and is no vote rule", () => {
    expect(ISSUANCE_DIALS_CLOSED_AT_LAUNCH).toContain(CAP);
    expect(ringOf(VARIABLES_BY_KEY[CAP]!)).toBe("open");
    expect(closesAtLaunch(CAP)).toBe(true);
    expect(isVoteRuleDial(CAP)).toBe(false);
    expect(voteRuleDialClosed(CAP, false, false), "before launch").toBe(false);
    expect(voteRuleDialClosed(CAP, true, false), "after launch").toBe(true);
    expect(voteRuleDialClosed(CAP, true, true), "founder-steward broke the glass").toBe(false);
  });

  it("before launch the founder sets it", async () => {
    const a = await writeDial(dialDeps({}), {} as any, CAP, "500");
    expect(a.status).toBe(200);
  });

  it("after launch a plain admin is refused and told it is the village's vote", async () => {
    started = true;
    const a = await writeDial(dialDeps({}), {} as any, CAP, "500000");
    expect(a.status).toBe(409);
    expect(a.body.error).toBe(ISSUANCE_DIAL_CLOSED_AT_LAUNCH);
    expect(a.body.proposeInstead).toBe(true);
  });

  it("after launch the founder seated as a steward who broke the glass may still write it", async () => {
    started = true;
    const a = await writeDial(dialDeps({ source: "override", reachedPast: true }), {} as any, CAP, "500");
    expect(a.status).toBe(200);
  });

  it("CONTROL: with the flag off, the cap writes after launch as before", () => {
    expect(voteRuleDialClosed(CAP, true, false, false)).toBe(false);
  });
});
