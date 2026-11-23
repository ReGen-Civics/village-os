import { describe, expect, it } from "vitest";
import { CONTRIBUTOR_REPLY_DAYS_VARIABLE, CONTRIBUTOR_ROUTES, partnerProblem, partnerProblems, replyDaysOf, routesExcept, type PartnerProposal } from "./contributorRoutes";

describe("the four ways to build (the lead, 23 Nov 2026)", () => {
  it("runs largest commitment first, and leaves out only what the caller names", () => {
    expect(CONTRIBUTOR_ROUTES).toEqual(["team", "venture", "partner", "quest"]);
    expect(routesExcept(["team"])).toEqual(["venture", "partner", "quest"]);
    expect(routesExcept()).toEqual(["team", "venture", "partner", "quest"]);
  });

  it("promises the village's one reply number, 1 to 60, and its default 7 for anything else", () => {
    expect(CONTRIBUTOR_REPLY_DAYS_VARIABLE).toBe("org.applicant_reply_days");
    expect(replyDaysOf(9)).toBe(9);
    expect(replyDaysOf("21")).toBe(21);
    for (const bad of [undefined, null, 0, 61, 2.5, "", "soon"]) expect(replyDaysOf(bad)).toBe(7);
  });
});

describe("a partner proposal", () => {
  const ok: PartnerProposal = { name: "Ana", email: "ana@example.org", project: "River Kitchen", link: "", serves: ["community"], offer: "Meals", wish: "A kitchen day" };
  it("can be sent with every required field and no link", () => {
    expect(partnerProblem(ok)).toBeNull();
    expect(partnerProblem({ ...ok, link: "https://river.example.org" })).toBeNull();
  });
  it("names the first thing to fix", () => {
    expect(partnerProblem({ ...ok, name: " " })).toBe("name");
    expect(partnerProblem({ ...ok, email: "ana" })).toBe("email");
    expect(partnerProblem({ ...ok, project: "" })).toBe("project");
    expect(partnerProblem({ ...ok, link: "river.example.org" })).toBe("link");
    expect(partnerProblem({ ...ok, serves: [] })).toBe("serves");
    expect(partnerProblem({ ...ok, serves: ["money" as never] })).toBe("serves");
    expect(partnerProblem({ ...ok, offer: "" })).toBe("offer");
    expect(partnerProblem({ ...ok, wish: "" })).toBe("wish");
  });
  it("lists every thing to fix, in the form's order", () => {
    expect(partnerProblems(ok)).toEqual([]);
    expect(partnerProblems({ ...ok, email: "ana", serves: [], wish: " " })).toEqual(["email", "serves", "wish"]);
  });
});
