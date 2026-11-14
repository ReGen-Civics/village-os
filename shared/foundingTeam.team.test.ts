import { describe, expect, it } from "vitest";
import { foundingTeamFilled, type TeamCandidate, type TeamSeating } from "./foundingTeam";

const role = (id: string, over: Partial<TeamCandidate> = {}): TeamCandidate => ({ id, name: `Role ${id}`, circleId: "anchor", active: true, isExample: false, listed: true, ...over });
const sit = (orgRoleId: string, over: Partial<TeamSeating> = {}): TeamSeating => ({ orgRoleId, userId: `u-${orgRoleId}`, displayName: null, isExample: false, isAgent: false, ...over });
const names: Record<string, string> = { "u-ops": "Ana Lima", "u-ops2": "Ana Lima", "u-legal": "Mara Ruiz" };
const first = (s: TeamSeating) => (s.userId ? (names[s.userId] ?? "").split(" ")[0] || null : s.displayName);

describe("foundingTeamFilled", () => {
  const featured = [role("finance")];
  it("names the circle's filled roles with their holders' first names, unlisted ones included", () => {
    const roles = [role("finance"), role("ops", { listed: false }), role("legal"), role("open")];
    const seatings = [sit("ops"), sit("ops", { userId: "u-ops2" }), sit("legal")];
    expect(foundingTeamFilled(featured, roles, seatings, first)).toEqual([
      { id: "ops", name: "Role ops", holders: ["Ana"] },
      { id: "legal", name: "Role legal", holders: ["Mara"] },
    ]);
  });
  it("leaves out other circles, examples, ended roles and seatings, and roles only an agent holds", () => {
    const roles = [role("finance"), role("away", { circleId: "land" }), role("ex", { isExample: true }), role("gone", { active: false }), role("ended"), role("bot")];
    const seatings = [sit("away"), sit("ex"), sit("gone"), sit("ended", { endedAt: "2026-10-01" }), sit("bot", { isAgent: true, userId: null, displayName: "AI Secretary" })];
    expect(foundingTeamFilled(featured, roles, seatings, first)).toEqual([]);
  });
  it("still shows the role, with no names, when the village keeps names from this reader (control)", () => {
    expect(foundingTeamFilled(featured, [role("finance"), role("legal")], [sit("legal")], () => null)).toEqual([{ id: "legal", name: "Role legal", holders: [] }]);
  });
});
