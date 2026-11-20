/**
 * COMING SOON (Rye, 16 Nov 2026): a role's four states are Open, Coming soon,
 * Held and Unlisted. Pinned here, pure:
 *
 *   - the listing rule: a coming-soon role is shown even while unlisted, and
 *     its circle shows to a visitor in a curating village, while an empty
 *     circle stays hidden;
 *   - it is applied for early: Apply stays, the "complete card" hold does not
 *     apply, and no pay range is offered;
 *   - the editor's one choice reads and writes the two columns;
 *   - the roles a lead will build are the coming-soon roles of the circles it leads;
 *   - the setting: both parameter readers take it, and it is stored in its column.
 *
 * Every absence carries a control.
 */
import { describe, expect, it } from "vitest";
import { circlesToShow, COMING_SOON_WORDS, columnsOfVisibility, invitesApplications, isComingSoon, isFutureVenture, isListed, isShown, planListOnly, rolesLeadWillBuild, visibilityOf, visibleTo } from "./roleListing";
import { PARAMETER_CARD_FIELDS, PARAMETER_COLUMNS, PARAMETER_KEYS, readParameter } from "./roleParameters";
import { parseRoleParams, roleParamColumns, roleParamsFromRow } from "./roleParams";
import { roleCardView } from "./roleCardView";
import { NOT_ROLE_WORDS } from "./roleProposals";

const CIRCLES = [
  { id: "anchor", parentCircleId: null },
  { id: "regen-community", parentCircleId: null },
  { id: "empty", parentCircleId: null },
];
const ROLES = [
  { id: "steward", circleId: "anchor", listed: true, active: true },
  { id: "builder", circleId: "regen-community", listed: false, comingSoon: true, active: true },
  { id: "draft", circleId: "anchor", listed: false, active: true },
];
const VISITOR = { seesUnlisted: false };

describe("the listing rule with coming soon", () => {
  it("shows a coming-soon role even while unlisted, and not an unlisted one without the mark", () => {
    expect(isShown({ listed: false, comingSoon: true })).toBe(true);
    expect(isShown({ listed: false })).toBe(false);
    expect(isShown({ listed: null })).toBe(true);
    expect(isComingSoon({ comingSoon: true })).toBe(true);
    expect(isComingSoon({})).toBe(false);
    // The listed column keeps its own meaning: coming soon does not list a role.
    const marked = { listed: false, comingSoon: true };
    expect(isListed(marked)).toBe(false);
    expect(visibleTo({ id: "builder", listed: false, comingSoon: true }, VISITOR)).toBe(true);
    expect(visibleTo({ id: "draft", listed: false }, VISITOR)).toBe(false);
  });

  it("puts the coming-soon role's circle on the public list in a curating village, and keeps an empty circle hidden", () => {
    expect(circlesToShow(CIRCLES, ROLES, VISITOR).map((c) => c.id)).toEqual(["anchor", "regen-community"]);
    // CONTROL: without the mark, the circle holding only an unlisted role is hidden from a visitor.
    const unmarked = ROLES.map((r) => (r.id === "builder" ? { ...r, comingSoon: false } : r));
    expect(circlesToShow(CIRCLES, unmarked, VISITOR).map((c) => c.id)).toEqual(["anchor"]);
  });

  it("offers no pay range: a coming-soon role does not invite applications the way an Open one does", () => {
    const open = { seats: 2, held: 0, state: "open", recruiting: true };
    expect(invitesApplications(open)).toBe(true);
    expect(invitesApplications({ ...open, comingSoon: true })).toBe(false);
    expect(invitesApplications({ ...open, futureVenture: true })).toBe(false);
  });

  it("shows a future venture even while unlisted, as its own state", () => {
    const venture = { id: "retreat", listed: false, futureVenture: true };
    expect(isFutureVenture(venture)).toBe(true);
    expect(isShown(venture)).toBe(true);
    expect(visibleTo(venture, VISITOR)).toBe(true);
    expect(COMING_SOON_WORDS.pitch).toHaveLength(5);
    expect(COMING_SOON_WORDS.leadBuilds).toBe("Roles this steward will build");
  });

  it("'List only these' still records the listed column, not the badge", () => {
    expect(planListOnly([{ id: "builder", listed: false, comingSoon: true } as never], ["x"]).before).toEqual([{ id: "builder", listed: false }]);
  });

  it("carries Rye's note word for word", () => {
    expect(COMING_SOON_WORDS.note).toBe("This role is not open yet, and the card may change before it opens. Leave your details and we will write to you when it does.");
  });
});

describe("the editor's one choice over the two columns", () => {
  it("reads Open, Coming soon and Unlisted, and writes them back", () => {
    expect(visibilityOf({})).toBe("open");
    expect(visibilityOf({ listed: false })).toBe("unlisted");
    expect(visibilityOf({ listed: false, comingSoon: true })).toBe("comingSoon");
    expect(visibilityOf({ listed: true, comingSoon: true })).toBe("comingSoon");
    expect(visibilityOf({ listed: false, comingSoon: true, futureVenture: true })).toBe("futureVenture");
    expect(columnsOfVisibility("open")).toEqual({ listed: true, comingSoon: false, futureVenture: false });
    expect(columnsOfVisibility("unlisted")).toEqual({ listed: false, comingSoon: false, futureVenture: false });
    // Coming soon and Future venture leave listed alone, so clearing them returns the role to what it was.
    expect(columnsOfVisibility("comingSoon")).toEqual({ comingSoon: true, futureVenture: false });
    expect(columnsOfVisibility("futureVenture")).toEqual({ comingSoon: false, futureVenture: true });
  });
});

describe("the roles a lead will build", () => {
  const circles = [
    { id: "anchor", leadRoleId: null },
    { id: "land", leadRoleId: "land-lead" },
    { id: "community", leadRoleId: "community-lead" },
  ];
  const roles = [
    { id: "land-lead", circleId: "anchor", comingSoon: false },
    { id: "builder", circleId: "land", comingSoon: true },
    { id: "gardener", circleId: "land", comingSoon: true },
    { id: "surveyor", circleId: "land", comingSoon: false },
    { id: "old", circleId: "land", comingSoon: true, active: false },
    { id: "demo", circleId: "land", comingSoon: true, isExample: true },
    { id: "host", circleId: "community", comingSoon: true },
    // A future venture has no lead, whatever circle it sits in.
    { id: "retreat", circleId: "land", comingSoon: false, futureVenture: true },
  ];
  it("are the live coming-soon roles of the circles it leads, in the chart's order", () => {
    expect(rolesLeadWillBuild("land-lead", roles, circles).map((r) => r.id)).toEqual(["builder", "gardener"]);
    expect(rolesLeadWillBuild("community-lead", roles, circles).map((r) => r.id)).toEqual(["host"]);
    // CONTROL: a role leading no circle builds nothing.
    expect(rolesLeadWillBuild("nobody", roles, circles)).toEqual([]);
  });
  it("follow a role that moves circle, with nothing else to set", () => {
    const moved = roles.map((r) => (r.id === "host" ? { ...r, circleId: "land" } : r));
    expect(rolesLeadWillBuild("land-lead", moved, circles).map((r) => r.id)).toEqual(["builder", "gardener", "host"]);
    expect(rolesLeadWillBuild("community-lead", moved, circles)).toEqual([]);
  });
});

describe("the card view keeps Apply on a coming-soon role", () => {
  it("is coming soon and allows Apply, even where the village holds incomplete cards back", () => {
    expect(roleCardView({ id: "r", card: {} })).toMatchObject({ comingSoon: false, applyAllowed: true });
    expect(roleCardView({ id: "r", comingSoon: true, card: {} })).toMatchObject({ comingSoon: true, applyAllowed: true });
    const gated = { gated: true, complete: false, missing: [] };
    expect(roleCardView({ id: "r", comingSoon: true, card: gated })).toMatchObject({ applyAllowed: true, beingWritten: false });
    expect(roleCardView({ id: "r", futureVenture: true, card: gated })).toMatchObject({ applyAllowed: true, futureVenture: true, comingSoon: false });
    // CONTROL: the same incomplete card on an Open role is held back.
    expect(roleCardView({ id: "r", card: gated })).toMatchObject({ applyAllowed: false, beingWritten: true });
  });
});

describe("the setting, in both parameter readers", () => {
  it("is a role-card parameter (the editor, the card text and role_card proposals) stored in coming_soon", () => {
    expect(PARAMETER_KEYS).toContain("comingSoon");
    expect(PARAMETER_COLUMNS.comingSoon).toBe("coming_soon");
    expect(PARAMETER_CARD_FIELDS.some((f) => f.key === "comingSoon" && f.heading === "Coming soon")).toBe(true);
    expect(readParameter("comingSoon", true)).toEqual({ ok: true, value: true });
    expect(readParameter("comingSoon", "no")).toEqual({ ok: true, value: false });
    expect(readParameter("comingSoon", "soon")).toEqual({ ok: false, problem: "Coming soon is yes or no." });
  });

  it("is an admin role parameter (PUT /api/admin/org/roles/:id), read back from the row", () => {
    const parsed = parseRoleParams({ comingSoon: true });
    expect(parsed.ok && roleParamColumns(parsed.value)).toEqual([["coming_soon", 1]]);
    const off = parseRoleParams({ comingSoon: false });
    expect(off.ok && roleParamColumns(off.value)).toEqual([["coming_soon", 0]]);
    expect(parseRoleParams({ comingSoon: "yes" })).toMatchObject({ ok: false });
    expect(roleParamsFromRow({ coming_soon: 1 }).comingSoon).toBe(true);
    expect(roleParamsFromRow({}).comingSoon).toBe(false);
  });

  it("is a steward decision, never a word a member proposes", () => {
    expect(NOT_ROLE_WORDS.has("comingSoon")).toBe(true);
  });
});
