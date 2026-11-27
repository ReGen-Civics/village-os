/**
 * Who reads which circle's measures (the lead, 27 Nov 2026: "admin for the
 * whole village and circle leads for their circle"). The route is driven with
 * its repos mocked, so the test owns every seat and every fact it counts.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  seatings: [] as Array<Record<string, unknown>>,
  circles: [] as Array<{ id: string; leadRoleId: string | null; leadActive: boolean; leadIsExample: boolean }>,
  seatsFail: false,
  /** The rate-limit keys that are over their limit, by prefix. */
  limited: [] as string[],
}));

vi.mock("../repos/roleMeasures", () => {
  const T0 = Date.UTC(2026, 0, 1);
  const app = (circleId: string | null, reply: number | null) => ({
    seasonId: "s1",
    circleId,
    door: "open",
    confirmedAt: T0,
    firstReplyAt: reply === null ? null : T0 + reply * 3_600_000,
    firstInterviewAt: null,
    decidedAt: null,
    outcome: null,
    shortlistYesAt: null,
    refsAskedAt: null,
    refsAllFollowedUpAt: null,
    interviews: [],
    countered: false,
  });
  return {
    // Garden: one application, answered in 5 hours. Kitchen: two, neither answered. One in no circle.
    applicationFacts: async () => [app("c-garden", 5), app("c-kitchen", null), app("c-kitchen", null), app(null, 1)],
    holderFacts: async () => [],
    startFacts: async () => [],
    circleLeadSeats: async () => state.circles,
    circleNames: async () => new Map([["c-garden", "Garden"], ["c-kitchen", "Kitchen"]]),
  };
});
vi.mock("../lib/orgChart", () => ({
  listOrgAssignments: async () => {
    if (state.seatsFail) throw new Error("db down");
    return state.seatings;
  },
}));

import { register } from "./roleMeasures";

let who: string | null = null;
let admin = false;
const handlers = new Map<string, (req: any, res: any) => Promise<unknown>>();
register({ get: (path: string, h: any) => handlers.set(path, h) } as any, {
  getPool: () => ({}) as any,
  authedUser: async () => (who ? ({ id: who } as any) : null),
  isAdmin: async () => !!who && admin,
  overLimit: async (key: string) => state.limited.some((p) => key.startsWith(p)),
});

const callAt = async (path: string, query: Record<string, string> = {}) => {
  const out: { status: number; body: any } = { status: 200, body: undefined };
  const res: any = { status: (c: number) => ((out.status = c), res), json: (b: unknown) => ((out.body = b), res) };
  await handlers.get(path)!({ headers: {}, query }, res);
  return out;
};
const call = (query: Record<string, string> = {}) => callAt("/api/role-measures", query);
const seat = (userId: string, orgRoleId: string, extra: Record<string, unknown> = {}) => ({ userId, orgRoleId, holderKind: "member", endedAt: null, lapsed: false, isExample: false, ...extra });
const circlesOf = (body: any) => body.rows.map((r: any) => r.circleId);

describe("GET /api/role-measures: who reads which circle", () => {
  beforeEach(() => {
    who = null;
    admin = false;
    state.circles = [
      { id: "c-garden", leadRoleId: "r-garden-lead", leadActive: true, leadIsExample: false },
      { id: "c-kitchen", leadRoleId: "r-kitchen-lead", leadActive: true, leadIsExample: false },
    ];
    state.seatsFail = false;
    state.limited = [];
    state.seatings = [seat("lead-g", "r-garden-lead"), seat("member", "r-planter")];
  });

  it("refuses a visitor", async () => {
    expect((await call()).status).toBe(401);
  });

  it("gives an admin every circle, and the roles in no circle", async () => {
    who = "admin";
    admin = true;
    const out = await call();
    expect(out.status).toBe(200);
    expect(out.body.scope).toBe("village");
    expect(circlesOf(out.body).sort()).toEqual(["c-garden", "c-kitchen", null].sort());
  });

  it("gives a circle's lead their own circle only", async () => {
    who = "lead-g";
    const out = await call();
    expect(out.status).toBe(200);
    expect(out.body.scope).toBe("circles");
    expect(circlesOf(out.body)).toEqual(["c-garden"]);
  });

  it("refuses a lead who asks for another circle by its id", async () => {
    who = "lead-g";
    const out = await call({ circle: "c-kitchen" });
    expect(out.status).toBe(403);
    expect(out.body.rows).toBeUndefined();
    expect((await call({ circle: "c-garden" })).body.rows.map((r: any) => r.circleId)).toEqual(["c-garden"]);
  });

  it("refuses a plain member, a member whose lead term has lapsed, and one who left the seat", async () => {
    who = "member";
    expect((await call()).status).toBe(403);
    state.seatings = [seat("lead-g", "r-garden-lead", { lapsed: true })];
    who = "lead-g";
    expect((await call()).status).toBe(403);
    state.seatings = [seat("lead-g", "r-garden-lead", { endedAt: "2026-11-01" })];
    expect((await call()).status).toBe(403);
  });

  it("refuses a live holder of a lead seat the circle has rested", async () => {
    who = "lead-g";
    state.circles[0] = { ...state.circles[0], leadActive: false };
    expect((await call()).status).toBe(403);
    expect((await call({ circle: "c-garden" })).status).toBe(403);
  });

  it("refuses a holder of an example lead seat", async () => {
    who = "lead-g";
    state.circles[0] = { ...state.circles[0], leadIsExample: true };
    expect((await call()).status).toBe(403);
  });

  it("only ever refuses a member who leads nothing: never the rate limit, never a 500", async () => {
    who = "member";
    state.limited = ["role-measures:"];
    expect((await call()).status).toBe(403);
    state.limited = [];
    state.seatsFail = true;
    expect((await call()).status).toBe(403);
    // A lead the scope lets in does meet the rate limit, and says so.
    state.seatsFail = false;
    state.limited = ["role-measures:"];
    who = "lead-g";
    const out = await call();
    expect(out.status).toBe(429);
    expect(out.body.error).toBe("Slow down a little.");
  });

  it("throttles the seat reads themselves, and answers that as a refusal", async () => {
    who = "member";
    state.limited = ["role-measures-gate:"];
    expect((await call()).status).toBe(403);
    // A lead who would read their circle is refused too while the gate is over: it stands before the seat reads.
    who = "lead-g";
    expect((await call()).status).toBe(403);
    // An admin who trips it is told to slow down, never that the page is not for them.
    who = "admin";
    admin = true;
    const out = await call();
    expect(out.status).toBe(429);
    expect(out.body.error).toBe("Slow down a little.");
    state.limited = [];
    admin = false;
    who = "lead-g";
    expect((await call()).status).toBe(200);
  });

  it("returns right now and the whole-season totals, scoped like the rows", async () => {
    who = "lead-g";
    const body = (await call()).body;
    expect(body.rightNow.map((r: any) => r.circleId)).toEqual(["c-garden"]);
    expect(body.rightNow[0]).toMatchObject({ stage: "review", count: 1, open: 1, member: 0 });
    expect(body.totals).toHaveLength(1);
    expect(body.totals[0]).toMatchObject({ circleId: null, applications: { count: 1 } });
    admin = true;
    who = "admin";
    const all = (await call()).body;
    expect(all.totals[0].applications.count).toBe(4);
    expect(all.rightNow.reduce((n: number, r: any) => n + r.count, 0)).toBe(4);
  });

  it("tells a circle's page whether to offer its door: admin, the circles a lead leads, or none", async () => {
    who = "member";
    expect((await callAt("/api/role-measures/scope")).body).toEqual({ scope: "none" });
    who = "lead-g";
    expect((await callAt("/api/role-measures/scope")).body).toEqual({ scope: "circles", circleIds: ["c-garden"] });
    who = "admin";
    admin = true;
    expect((await callAt("/api/role-measures/scope")).body).toEqual({ scope: "village" });
    who = null;
    expect((await callAt("/api/role-measures/scope")).status).toBe(401);
  });

  it("shows counts under three, and a real zero as 0", async () => {
    who = "admin";
    admin = true;
    const rows = (await call()).body.rows;
    const garden = rows.find((r: any) => r.circleId === "c-garden");
    const kitchen = rows.find((r: any) => r.circleId === "c-kitchen");
    // One application: its count, its share and its median all show.
    expect(garden.applications.count).toBe(1);
    expect(garden.applications.answered).toEqual({ eligible: 1, yes: 1, share: 1 });
    expect(garden.applications.medianHoursToReply).toBe(5);
    // Two applications, none answered: a real zero, never "no data".
    expect(kitchen.applications.count).toBe(2);
    expect(kitchen.applications.answered).toEqual({ eligible: 2, yes: 0, share: 0 });
    // Nothing recorded: no data.
    expect(kitchen.applications.medianHoursToReply).toBeNull();
    expect(garden.holders.stillInRoleAt90).toEqual({ eligible: 0, yes: 0, share: null });
  });
});
