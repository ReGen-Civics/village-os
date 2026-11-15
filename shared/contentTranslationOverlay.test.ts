/**
 * Laying a translation over the English (shared/contentTranslationOverlay.ts):
 * only the translated fields change, and a malformed answer changes nothing.
 */
import { describe, expect, it } from "vitest";
import { overlayPageRaw, overlaySeat, overlaySections, readPageTranslation, readRoleCardTranslation } from "./contentTranslationOverlay";
import type { ResolvedPage } from "./pageContent/types";
import type { RoleCardSections } from "./roleCardSections";

const page: ResolvedPage = {
  hero: { hidden: false, fields: { title: "Steward the {village}", intro: "Roles are how work gets done." }, lists: {} },
  steps: { hidden: false, fields: {}, lists: { items: [{ id: "apply", body: "Apply" }, { id: "meet", body: "Meet the circle" }] } },
};

describe("overlayPageRaw", () => {
  it("replaces only the translated fields and rows", () => {
    const out = overlayPageRaw(page, { "hero.title": "Cuida {village}", "steps.items.meet.body": "Conoce el círculo", "steps.items.1.body": "Conoce el círculo" });
    expect(out.hero.fields).toEqual({ title: "Cuida {village}", intro: "Roles are how work gets done." });
    expect(out.steps.lists.items).toEqual([{ id: "apply", body: "Apply" }, { id: "meet", body: "Conoce el círculo" }]);
    expect(page.hero.fields.title).toBe("Steward the {village}");
  });

  it("ignores an address the page does not have", () => {
    const out = overlayPageRaw(page, { "hero.nope": "x", "gone.title": "x", "steps.items.zzz.body": "x", "steps.items.9.body": "x", "hero": "x" });
    expect(out).toEqual(page);
  });
});

describe("the role card overlay", () => {
  it("lays the translated words over the seat and sections", () => {
    const t = readRoleCardTranslation({ locale: "es", seat: { aim: "Sostener", accountabilities: ["a", "b"], bad: 3 }, sections: { payNote: "Se paga" }, machine: ["role_card:aim"] })!;
    expect(t.seat).toEqual({ aim: "Sostener", accountabilities: ["a", "b"] });
    expect(overlaySeat({ id: "r", aim: "Hold", name: "Legal" }, t)).toEqual({ id: "r", aim: "Sostener", name: "Legal", accountabilities: ["a", "b"] });
    const sections = { payNote: "Paid", aiSupport: "AI" } as unknown as RoleCardSections;
    expect(overlaySections(sections, t)).toMatchObject({ payNote: "Se paga", aiSupport: "AI" });
    expect(overlaySections(null, t)).toBeNull();
  });

  it("reads nothing from a malformed answer", () => {
    expect(readRoleCardTranslation(null)).toBeNull();
    expect(readRoleCardTranslation({ seat: {} })).toBeNull();
    expect(readPageTranslation({ locale: "es" })).toBeNull();
    expect(readPageTranslation({ locale: "es", fields: { a: "x", b: 1 } })).toEqual({ locale: "es", fields: { a: "x" }, machine: [] });
  });
});
