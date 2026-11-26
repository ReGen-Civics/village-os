// @vitest-environment jsdom
/**
 * FACES ON THE ROLES PAGE (the lead, 26 Nov 2026: "Should we put our faces here and actually show humans? ... I like
 * humans"). A holder's PUBLISHED portrait stands in the roster's gold ring in place of their initial, and the initial
 * stays wherever there is none. The server reads published portraits only (server/lib/holderFaces.ts); these pin the
 * path from the founding team's answer to the drawn ring, and that nothing else becomes a face on the way.
 */
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@lingui/core";
import { Router } from "wouter";
import { foundingTeamFilled, type TeamSeating } from "@shared/foundingTeam";
import { rosterOf } from "./roster";
import RosterList from "./RosterCards";

afterEach(cleanup);

const team = [{ id: "steward", circleId: "core" }];
const roles = [
  { id: "steward", name: "Steward", circleId: "core", active: true },
  { id: "keeper", name: "Land Keeper", circleId: "core", active: true },
  { id: "cook", name: "Cook", circleId: "core", active: true },
];
const seat = (orgRoleId: string, userId: string | null, extra: Partial<TeamSeating> = {}): TeamSeating => ({ orgRoleId, userId, displayName: null, isExample: false, isAgent: false, ...extra });
const NAME: Record<string, string> = { u1: "Ana", u2: "Bo" };

describe("the founding team's answer", () => {
  it("carries each holder's face beside their name, by position, when the route read faces", () => {
    const filled = foundingTeamFilled(team, roles, [seat("keeper", "u1"), seat("keeper", "u2")], (s) => NAME[s.userId ?? ""] ?? null, (s) => (s.userId === "u2" ? "/api/uploads/bo.webp" : null));
    expect(filled).toEqual([{ id: "keeper", name: "Land Keeper", holders: ["Ana", "Bo"], faces: [null, "/api/uploads/bo.webp"] }]);
  });

  it("CONTROL: carries no faces at all when the route read none, as where the village shows no names", () => {
    const filled = foundingTeamFilled(team, roles, [seat("keeper", "u1")], (s) => NAME[s.userId ?? ""] ?? null);
    expect(filled).toEqual([{ id: "keeper", name: "Land Keeper", holders: ["Ana"] }]);
    expect(filled[0]).not.toHaveProperty("faces");
  });

  it("never gives an agent a face, since an agent is never a holder on the team", () => {
    const filled = foundingTeamFilled(team, roles, [seat("cook", "agent-1", { isAgent: true })], () => "Agent", () => "/api/uploads/agent.webp");
    expect(filled).toEqual([]);
  });
});

describe("the roster", () => {
  it("keeps a person's face across every role they hold, and the initial for those with none", () => {
    const roster = rosterOf([
      { id: "keeper", name: "Land Keeper", holders: ["Ana", "Bo"], faces: [null, "/api/uploads/bo.webp"] },
      { id: "cook", name: "Cook", holders: ["Bo"] },
    ]);
    expect(roster.map((e) => [e.name, e.face, e.roles.map((r) => r.id)])).toEqual([
      ["Ana", null, ["keeper"]],
      ["Bo", "/api/uploads/bo.webp", ["keeper", "cook"]],
    ]);
  });

  it("draws the face in the gold ring, and the initial where there is none", () => {
    i18n.loadAndActivate({ locale: "en", messages: {} });
    const { container } = render(
      <I18nProvider i18n={i18n}>
        <Router>
          <RosterList filled={[{ id: "keeper", name: "Land Keeper", holders: ["Ana", "Bo"], faces: [null, "/api/uploads/bo.webp"] }]} team="Core" variant="sheet" className="" />
        </Router>
      </I18nProvider>,
    );
    const faces = Array.from(container.querySelectorAll("img[data-roster-face]"));
    expect(faces.map((f) => f.getAttribute("src"))).toEqual(["/api/uploads/bo.webp"]);
    // Decorative: the card names the person in words beside it.
    expect(faces[0].getAttribute("alt")).toBe("");
    expect(container.textContent).toContain("A");
    expect(container.textContent).toContain("Bo");
  });
});
