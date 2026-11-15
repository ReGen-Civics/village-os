/**
 * D1 and D2 (launch security decisions, 2026-11-15): the admin doors that
 * close when the Game starts. The predicates are the whole rule, so they are
 * pinned here with the flag both ways; the routes call them, and the dial
 * write is driven end to end below with its collaborators stubbed.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

let started = false;
vi.mock("./gameStart", () => ({
  readGameStart: vi.fn(async () => ({ started, startedAt: null, ballotId: null, startedBy: null, note: "" })),
  founderPowerStands: vi.fn(async () => !started),
}));
vi.mock("./variables", () => ({
  setVariable: vi.fn(async (_pool: unknown, key: string, value: string) => ({ ok: true, key, value, previous: null })),
}));
vi.mock("./villageFloors", () => ({ floorDialRefusal: vi.fn(async () => null) }));

import {
  ADMIN_HAND_MINT_CLOSES_AT_LAUNCH,
  ADMIN_ROLES_CLOSED_AT_LAUNCH,
  ADMIN_GROUP_HOLDERS_CLOSED_AT_LAUNCH,
  GOVERNANCE_DIALS_AND_ADMIN_ROLES_CLOSE_AT_LAUNCH,
  HAND_MINT_CLOSED_AT_LAUNCH,
  VOTE_RULE_DIAL_CLOSED_AT_LAUNCH,
  VOTE_RULE_DIAL_EXTRAS,
  adminRolesClosed,
  handMintClosed,
  isVoteRuleDial,
  voteRuleDialClosed,
} from "./launchDoors";
import { writeDial, type DialWriteDeps } from "./dialWrite";
import { register as registerGroupAdmin } from "../routes/groupAdmin";
import { VARIABLES_BY_KEY, ringOf } from "../../shared/gameVariables";

describe("the constants default to the secure choice", () => {
  it("every door closes at launch unless somebody flips the line", () => {
    expect(ADMIN_HAND_MINT_CLOSES_AT_LAUNCH).toBe(true);
    expect(GOVERNANCE_DIALS_AND_ADMIN_ROLES_CLOSE_AT_LAUNCH).toBe(true);
  });
});

describe("D1: the admin hand mint closes at launch", () => {
  it("is open before launch and closed after", () => {
    expect(handMintClosed(false)).toBe(false);
    expect(handMintClosed(true)).toBe(true);
  });
  it("flipping the constant restores the old behaviour", () => {
    expect(handMintClosed(true, false)).toBe(false);
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
      "governance.default_method",
      "governance.vote_days",
      "governance.window_role_seat",
    ]) expect(isVoteRuleDial(k), k).toBe(true);
  });
  it("leaves ordinary dials and the founder's brake alone", () => {
    for (const k of ["gratitude.base_budget", "ledger.admin_mint_cycle_cap", "governance.auto_apply_enabled", "governance.hub_url"]) {
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

describe("D2b: making or removing admins", () => {
  it("is open before launch, closed after, and the flag restores it", () => {
    expect(adminRolesClosed(false)).toBe(false);
    expect(adminRolesClosed(true)).toBe(true);
    expect(adminRolesClosed(true, false)).toBe(false);
  });
});

describe("the refusals follow the house voice", () => {
  it("carries no em or en dash and no contrast framing", () => {
    for (const s of [HAND_MINT_CLOSED_AT_LAUNCH, VOTE_RULE_DIAL_CLOSED_AT_LAUNCH, ADMIN_ROLES_CLOSED_AT_LAUNCH, ADMIN_GROUP_HOLDERS_CLOSED_AT_LAUNCH]) {
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

describe("D2b through the admin access switch", () => {
  function harness(actorRole: string) {
    let handler: any;
    const app = { put: (_p: string, h: any) => { handler = h; } } as any;
    const rows = [{ id: "g1", name: "Stewards", grantsAdmin: false }];
    registerGroupAdmin(app, {
      isAdmin: async (req: any) => { req.adminUser = { id: "u1", role: actorRole }; return true; },
      getPool: () => ({}) as any,
      members: { all: async () => [{ id: "u1", role: actorRole }] },
      rolesRepo: { all: () => rows, replaceAll: async () => undefined },
      loadRoleHolders: () => [],
    });
    return async (on: boolean) => {
      const out: { status: number; body: any } = { status: 200, body: null };
      const res = { status(n: number) { out.status = n; return res; }, json(b: any) { out.body = b; return res; } };
      await handler({ params: { id: "g1" }, body: { on } }, res);
      return out;
    };
  }
  beforeEach(() => { started = false; });

  it("before launch a founder turns a group's admin access on", async () => {
    const r = await harness("founder")(true);
    expect(r.status).toBe(200);
    expect(r.body.grantsAdmin).toBe(true);
  });

  it("after launch an admin is refused, on and off", async () => {
    started = true;
    const flip = harness("admin");
    for (const on of [true, false]) {
      const r = await flip(on);
      expect(r.status).toBe(409);
      expect(r.body.code).toBe("admin_roles_closed_at_launch");
    }
  });
});
