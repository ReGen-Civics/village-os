/**
 * LISTING IN THE PROJECTION (role journey PR-A): an unlisted role is absent
 * from the payload for a visitor and a member, present with `listed: false`
 * for a steward, and present for its own holder. Every absence carries a
 * listed control.
 */
import { describe, expect, it } from "vitest";
import type { OrgAssignment, OrgRole } from "./orgChart";
import { mapSeatTier, orgSeatTier, projectSeats, type SeatProjectionCtx } from "./seatProjection";

const NOW = new Date("2026-10-01T12:00:00Z");
const base = (id: string, listed: boolean | null): OrgRole =>
  ({
    id, circleId: "c1", name: id, aim: null, domain: null, accountabilities: [], whyItMatters: null,
    seats: 1, criticality: "normal", active: true, recruiting: true, expiresEachSeason: null,
    statusOverride: null, statusOverrideExpiresAt: null, icon: null, color: null, order: 0,
    isExample: false, archetypes: [], authority: null, firstYearOutcomes: null, first90DayOutcomes: null,
    locationExpectations: null, compensationReality: null, evidenceRequired: null,
    representsCircle: false, howChosen: null, howChosenGloss: null,
    termsOffer: null, termsOfferAt: null, termsOfferBy: null, listed,
  }) as OrgRole;

const ROLES = [base("shown", null), base("also-shown", true), base("hidden", false)];
const held = (roleId: string, userId: string): OrgAssignment =>
  ({
    id: `a-${roleId}`, orgRoleId: roleId, holderKind: "member", userId, displayName: null, holderKey: `member:${userId}`,
    focus: null, note: null, seasonId: null, termEndsAt: null, startedAt: NOW, endedAt: null, endedReason: null,
    lapsed: false, lapsedReason: null, isExample: false, isAgent: false,
  }) as OrgAssignment;
const ctx = (route: "map" | "org", listing?: SeatProjectionCtx["listing"]): SeatProjectionCtx => ({
  route, now: NOW, nameOf: () => "Mara", firstName: (s) => s, ...(listing ? { listing } : {}),
});
const ids = (rows: Array<Record<string, unknown>>) => rows.map((r) => r.id);
const tierOrg = orgSeatTier({ editing: false, viewPeople: false, peopleArePublic: true, mapStructure: true });

describe("an unlisted role in the projection", () => {
  it("is absent for a visitor and a member on /api/org, with the listed roles present as the control", () => {
    expect(ids(projectSeats(ROLES, [], tierOrg, ctx("org")))).toEqual(["shown", "also-shown"]);
    const memberTier = orgSeatTier({ editing: false, viewPeople: true, peopleArePublic: true, mapStructure: true, terms: true });
    expect(ids(projectSeats(ROLES, [], memberTier, ctx("org", { seesUnlisted: false })))).toEqual(["shown", "also-shown"]);
  });
  it("is absent on /api/map too", () => {
    expect(ids(projectSeats(ROLES, [], mapSeatTier(false), ctx("map")))).toEqual(["shown", "also-shown"]);
  });
  it("shows to a steward with the chip flag, and the listed roles carry no flag", () => {
    const rows = projectSeats(ROLES, [], tierOrg, ctx("org", { seesUnlisted: true }));
    expect(ids(rows)).toEqual(["shown", "also-shown", "hidden"]);
    expect(rows.find((r) => r.id === "hidden")?.listed).toBe(false);
    expect("listed" in (rows.find((r) => r.id === "shown") as object)).toBe(false);
  });
  it("shows to its own holder, and not to another member", () => {
    const own = projectSeats(ROLES, [held("hidden", "u1")], tierOrg, ctx("org", { seesUnlisted: false, ownRoleIds: new Set(["hidden"]) }));
    expect(ids(own)).toContain("hidden");
    const other = projectSeats(ROLES, [held("hidden", "u1")], tierOrg, ctx("org", { seesUnlisted: false, ownRoleIds: new Set() }));
    expect(ids(other)).not.toContain("hidden");
  });
});

describe("a coming-soon role in the projection (Rye, 16 Nov 2026)", () => {
  const soon = { ...base("soon", false), comingSoon: true } as OrgRole;
  it("reaches a visitor on /api/org and /api/map, flagged coming soon, never as unlisted, and forming while nobody holds it", () => {
    const org = projectSeats([...ROLES, soon], [], tierOrg, ctx("org"));
    expect(ids(org)).toEqual(["shown", "also-shown", "soon"]);
    const row = org.find((r) => r.id === "soon")!;
    expect(row.comingSoon).toBe(true);
    expect("listed" in row).toBe(false);
    expect(row.state).toBe("forming");
    expect(ids(projectSeats([...ROLES, soon], [], mapSeatTier(false), ctx("map")))).toContain("soon");
    // CONTROL: a plain role carries no flag and reads open.
    const plain = org.find((r) => r.id === "shown")!;
    expect("comingSoon" in plain).toBe(false);
    expect(plain.state).toBe("open");
  });

  it("flags a future venture the same way, and a role only an agent holds without naming the agent", () => {
    const venture = { ...base("venture", false), futureVenture: true } as OrgRole;
    const byAgent = base("by-agent", true);
    const byPerson = base("by-person", true);
    const agent = { ...held("by-agent", "u-agent"), isAgent: true, holderKind: "documented", userId: null, displayName: "Sera" } as OrgAssignment;
    const rows = projectSeats([venture, byAgent, byPerson], [agent, held("by-person", "u1")], tierOrg, ctx("org"));
    expect(rows.find((r) => r.id === "venture")).toMatchObject({ futureVenture: true, state: "forming" });
    const a = rows.find((r) => r.id === "by-agent")!;
    expect(a.heldByAgent).toBe(true);
    expect(JSON.stringify(a)).not.toContain("Sera");
    // CONTROL: a role a person holds carries no agent flag.
    expect("heldByAgent" in rows.find((r) => r.id === "by-person")!).toBe(false);
  });
});
