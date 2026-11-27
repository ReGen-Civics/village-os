/**
 * Who reads which circle's measures (the lead, 27 Nov 2026: "admin for the
 * whole village and circle leads for their circle"). The route is driven with
 * its repos mocked, so the test owns every seat and every fact it counts.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  seatings: [] as Array<Record<string, unknown>>,
  circles: [] as Array<{ id: string; leadRoleId: string | null }>,
}));

vi.mock("../repos/roleMeasures", () => {
  const T0 = Date.UTC(2026, 0, 1);
  const app = (circleId: string | null, reply: number | null) => ({
    seasonId: "s1",
    circleId,
    confirmedAt: T0,
    firstReplyAt: reply === null ? null : T0 + reply * 3_600_000,
    firstInterviewAt: null,
    decidedAt: null,
  });
  return {
    // Garden: one application, answered in 5 hours. Kitchen: two, neither answered. One in no circle.
    applicationFacts: async () => [app("c-garden", 5), app("c-kitchen", null), app("c-kitchen", null), app(null, 1)],
    holderFacts: async () => [],
    circleLeadSeats: async () => state.circles,
    circleNames: async () => new Map([["c-garden", "Garden"], ["c-kitchen", "Kitchen"]]),
  };
});
vi.mock("../lib/orgChart", () => ({ listOrgAssignments: async () => state.seatings }));

import { register } from "./roleMeasures";

let who: string | null = null;
let admin = false;
let handler: (req: any, res: any) => Promise<unknown>;
register({ get: (_p: string, h: any) => (handler = h) } as any, {
  getPool: () => ({}) as any,
  authedUser: async () => (who ? ({ id: who } as any) : null),
  isAdmin: async () => !!who && admin,
  overLimit: async () => false,
});

const call = async (query: Record<string, string> = {}) => {
  const out: { status: number; body: any } = { status: 200, body: undefined };
  const res: any = { status: (c: number) => ((out.status = c), res), json: (b: unknown) => ((out.body = b), res) };
  await handler({ headers: {}, query }, res);
  return out;
};
const seat = (userId: string, orgRoleId: string, extra: Record<string, unknown> = {}) => ({ userId, orgRoleId, holderKind: "member", endedAt: null, lapsed: false, isExample: false, ...extra });
const circlesOf = (body: any) => body.rows.map((r: any) => r.circleId);

describe("GET /api/role-measures: who reads which circle", () => {
  beforeEach(() => {
    who = null;
    admin = false;
    state.circles = [
      { id: "c-garden", leadRoleId: "r-garden-lead" },
      { id: "c-kitchen", leadRoleId: "r-kitchen-lead" },
    ];
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
