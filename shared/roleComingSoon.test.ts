/**
 * COMING SOON (Rye, 16 Nov 2026: "list all the regenerative circle roles but
 * say they're 'coming soon'"). Pinned here, pure:
 *
 *   - the listing rule: a coming-soon role is shown even while unlisted, and
 *     its circle shows to a visitor in a curating village, while an empty
 *     circle stays hidden;
 *   - it never invites applications, and the card view takes Apply away;
 *   - the setting: both parameter readers take it, and it is stored in its column.
 *
 * Every absence carries a control.
 */
import { describe, expect, it } from "vitest";
import { circlesToShow, COMING_SOON_WORDS, invitesApplications, isComingSoon, isListed, isShown, planListOnly, visibleTo } from "./roleListing";
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

  it("never invites applications, whatever the places and the door say", () => {
    const open = { seats: 2, held: 0, state: "open", recruiting: true };
    expect(invitesApplications(open)).toBe(true);
    expect(invitesApplications({ ...open, comingSoon: true })).toBe(false);
  });

  it("'List only these' still records the listed column, not the badge", () => {
    expect(planListOnly([{ id: "builder", listed: false, comingSoon: true } as never], ["x"]).before).toEqual([{ id: "builder", listed: false }]);
  });

  it("says the refusal in a plain sentence that names the role", () => {
    expect(COMING_SOON_WORDS.refused("Regenerative Builder")).toBe("Regenerative Builder is coming soon. It does not take applications yet.");
  });
});

describe("the card view takes Apply away from a coming-soon role", () => {
  it("is coming soon and allows no Apply, with a plain role as the control", () => {
    expect(roleCardView({ id: "r", card: {} })).toMatchObject({ comingSoon: false, applyAllowed: true });
    expect(roleCardView({ id: "r", comingSoon: true, card: {} })).toMatchObject({ comingSoon: true, applyAllowed: false });
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
