/**
 * Faces on Roles (the lead, 26 Nov 2026): the client keeps a holder's face only when it is a file the village's own
 * upload store serves. Anything else in the answer, a stranger's URL, a path that climbs, a script link, reads as no
 * face, and the roster draws the initial.
 */
import { describe, expect, it, vi } from "vitest";

const answer = vi.hoisted(() => ({ body: {} as unknown }));
vi.mock("@/lib/gameApi", () => ({ gameFetch: vi.fn(async () => new Response(JSON.stringify(answer.body), { status: 200 })) }));

import { readFoundingTeam } from "./roleCardApi";

describe("the founding team's faces, as the client reads them", () => {
  it("keeps the village's own uploads and drops everything else, position by position", async () => {
    answer.body = {
      on: false,
      roleIds: [],
      team: [
        {
          id: "keeper",
          name: "Land Keeper",
          holders: ["Ana", "Bo", "Cy", "Di", "Ed"],
          faces: ["/api/uploads/ana.webp", "https://elsewhere.example/bo.jpg", "/api/uploads/../secret", "javascript:alert(1)", null],
        },
      ],
    };
    const t = await readFoundingTeam();
    expect(t.team).toEqual([{ id: "keeper", name: "Land Keeper", holders: ["Ana", "Bo", "Cy", "Di", "Ed"], faces: ["/api/uploads/ana.webp", null, null, null, null] }]);
  });

  it("CONTROL: a team with no faces reads as before, with no faces field", async () => {
    answer.body = { on: false, roleIds: [], team: [{ id: "keeper", name: "Land Keeper", holders: ["Ana"] }] };
    const t = await readFoundingTeam();
    expect(t.team).toEqual([{ id: "keeper", name: "Land Keeper", holders: ["Ana"] }]);
  });
});
