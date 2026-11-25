import { describe, expect, it } from "vitest";
import { conflictCounts, conflictGroups, footprintOf, oldestFirst, overlaps, staleAgainst, staleVersionOf, waitingConflicts, type AcceptedRecord, type ConflictInput } from "./proposalConflicts";
import { routeOf, type ProposalKind } from "./proposedChanges";

const route = (kind: ProposalKind, target: Record<string, unknown>) => {
  const r = routeOf(kind, target);
  return { method: r.method, path: r.path };
};
const fp = (kind: ProposalKind, target: Record<string, unknown>, body: Record<string, unknown>) => footprintOf(kind, target, route(kind, target), body);
const clash = (a: [ProposalKind, Record<string, unknown>, Record<string, unknown>], b: [ProposalKind, Record<string, unknown>, Record<string, unknown>]) => overlaps(fp(...a), fp(...b));

let n = 0;
const change = (kind: ProposalKind, target: Record<string, unknown>, body: Record<string, unknown>, at: string, extra: Partial<ConflictInput> = {}): ConflictInput => ({
  id: extra.id ?? `pc_${++n}`,
  at,
  kind,
  target,
  route: route(kind, target),
  body,
  summary: extra.summary ?? `change ${n}`,
  ...extra,
});

describe("what a change writes, and when two collide", () => {
  it("page words deep-merge: the same leaf collides, a sibling leaf does not", () => {
    const home = { section: "page-home" };
    expect(clash(["page_content", home, { hero: { headline: "A" } }], ["page_content", home, { hero: { headline: "B" } }])).toBe(true);
    expect(clash(["page_content", home, { hero: { headline: "A" } }], ["page_content", home, { hero: { badge: "Open" } }])).toBe(false);
    // A whole object at a path covers every leaf inside it.
    expect(clash(["page_content", home, { hero: { headline: "A", badge: "x" } }], ["page_content", home, { hero: { badge: "y" } }])).toBe(true);
    // A list is one leaf: the merge replaces it whole.
    expect(clash(["page_content", home, { hero: { points: ["a"] } }], ["page_content", home, { hero: { points: ["b", "c"] } }])).toBe(true);
    // Another page never collides.
    expect(clash(["page_content", home, { hero: { headline: "A" } }], ["page_content", { section: "page-visit" }, { hero: { headline: "A" } }])).toBe(false);
  });

  it("module settings deep-merge the same way", () => {
    const m = { id: "gratitude" };
    expect(clash(["module_config", m, { cycle: { days: 7 } }], ["module_config", m, { cycle: { days: 14 } }])).toBe(true);
    expect(clash(["module_config", m, { cycle: { days: 7 } }], ["module_config", m, { cycle: { label: "Moon" } }])).toBe(false);
    expect(clash(["module_config", m, { cycle: { days: 7 } }], ["module_lifecycle", m, { lifecycle: "public" }])).toBe(false);
  });

  it("a role card compares words, parameters, pay, archetypes and sections field by field", () => {
    const r = { roleId: "finance" };
    expect(clash(["role_card", r, { words: { aim: "A" } }], ["role_card", r, { words: { aim: "B" } }])).toBe(true);
    expect(clash(["role_card", r, { words: { aim: "A" } }], ["role_card", r, { words: { purpose: "B" } }])).toBe(false);
    expect(clash(["role_card", r, { parameters: { hours: 4 } }], ["role_card", r, { parameters: { hours: 8 } }])).toBe(true);
    expect(clash(["role_card", r, { parameters: { hours: 4 } }], ["role_card", r, { parameters: { term: "moon" } }])).toBe(false);
    expect(clash(["role_card", r, { pay: { kind: "none" } }], ["role_card", r, { pay: { kind: "stipend" } }])).toBe(true);
    expect(clash(["role_card", r, { archetypes: ["a"] }], ["role_card", r, { archetypes: ["b"] }])).toBe(true);
    expect(clash(["role_card", r, { pay: { kind: "none" } }], ["role_card", r, { archetypes: ["b"] }])).toBe(false);
    expect(clash(["role_card", r, { sections: { story: { text: "x" } } }], ["role_card", r, { sections: { story: { text: "y" } } }])).toBe(true);
    expect(clash(["role_card", r, { sections: { story: { text: "x" } } }], ["role_card", r, { sections: { rhythm: { text: "y" } } }])).toBe(false);
    expect(clash(["role_card", r, { words: { aim: "A" } }], ["role_card", { roleId: "other" }, { words: { aim: "A" } }])).toBe(false);
  });

  it("variables, a season's goals, the onboarding path, a module's lifecycle and the listed roles are always whole", () => {
    expect(clash(["variable", { key: "a.b" }, { value: "1" }], ["variable", { key: "a.b" }, { value: "2" }])).toBe(true);
    expect(clash(["variable", { key: "a.b" }, { value: "1" }], ["variable", { key: "a.c" }, { value: "1" }])).toBe(false);
    expect(clash(["season_goals", { seasonId: "s1" }, { goals: [{ text: "a" }] }], ["season_goals", { seasonId: "s1" }, { goals: [{ text: "b" }] }])).toBe(true);
    expect(clash(["season_goals", { seasonId: "s1" }, { goals: [] }], ["season_goals", { seasonId: "s2" }, { goals: [] }])).toBe(false);
    expect(clash(["onboarding_path", {}, { doc: { steps: { a: 1 } } }], ["onboarding_path", {}, { doc: { welcome: "x" } }])).toBe(true);
    expect(clash(["module_lifecycle", { id: "m" }, { lifecycle: "public" }], ["module_lifecycle", { id: "m" }, { lifecycle: "off" }])).toBe(true);
    expect(clash(["role_listing", {}, { ids: ["a"] }], ["role_listing", {}, { ids: ["b"] }])).toBe(true);
  });

  it("FAQs: one entry by id; a new FAQ collides with nothing", () => {
    const at = (id: string) => ({ pathway: "steward", id });
    expect(clash(["faq_edit", at("1"), { question: "a" }], ["faq_remove", at("1"), {}])).toBe(true);
    expect(clash(["faq_edit", at("1"), { question: "a" }], ["faq_edit", at("2"), { question: "b" }])).toBe(false);
    expect(fp("faq_add", { pathway: "steward" }, { question: "q" })).toBeNull();
  });

  it("a whole-document setting PUT collides with anything on the same document; a gathering's PUT only on the keys it names", () => {
    const put = (path: string): [ProposalKind, Record<string, unknown>, Record<string, unknown>] => ["setting", { method: "PUT", path }, { name: "x" }];
    expect(clash(put("/api/admin/brand"), ["setting", { method: "PATCH", path: "/api/admin/brand" }, { tagline: "y" }])).toBe(true);
    expect(clash(put("/api/admin/brand"), put("/api/admin/visit-config"))).toBe(false);
    // The season list saved whole collides with a season's goals.
    expect(clash(put("/api/admin/seasons"), ["season_goals", { seasonId: "s1" }, { goals: [] }])).toBe(true);
    const ev = (body: Record<string, unknown>): [ProposalKind, Record<string, unknown>, Record<string, unknown>] => ["setting", { method: "PUT", path: "/api/admin/events/e1" }, body];
    expect(clash(ev({ title: "a" }), ev({ title: "b" }))).toBe(true);
    expect(clash(ev({ title: "a" }), ev({ startsAt: "2026-12-01" }))).toBe(false);
    expect(fp("setting", { method: "POST", path: "/api/admin/events" }, { title: "a" })).toBeNull();
  });
});

describe("waiting against waiting", () => {
  it("names each side of a collision, and which one was proposed later", () => {
    const older = change("role_card", { roleId: "r" }, { words: { aim: "A" } }, "2026-11-10T10:00:00.000Z", { id: "old", summary: "Older aim" });
    const newer = change("role_card", { roleId: "r" }, { words: { aim: "B" } }, "2026-11-12T10:00:00.000Z", { id: "new", summary: "Newer aim" });
    const apart = change("role_card", { roleId: "r" }, { words: { purpose: "C" } }, "2026-11-11T10:00:00.000Z", { id: "apart" });
    const out = waitingConflicts([newer, apart, older]);
    expect(out.old).toEqual([{ id: "new", summary: "Newer aim", at: newer.at, later: true }]);
    expect(out.new).toEqual([{ id: "old", summary: "Older aim", at: older.at, later: false }]);
    expect(out.apart).toBeUndefined();
    expect(conflictCounts(out, {})).toEqual({ pairs: 1, stale: 0 });
  });
});

describe("stale: a later accept wrote what a waiting change writes", () => {
  const waiting = change("page_content", { section: "page-home" }, { hero: { headline: "Old draft" } }, "2026-11-10T10:00:00.000Z", { id: "w" });
  const acc = (id: string, decidedAt: string, body: Record<string, unknown>, section = "page-home"): AcceptedRecord => ({
    id,
    kind: "page_content",
    target: { section },
    route: route("page_content", { section }),
    body,
    summary: `accepted ${id}`,
    decidedAt,
  });

  it("an accept after it was proposed, on the same field, makes it stale", () => {
    expect(staleAgainst(waiting, [acc("a1", "2026-11-11T09:00:00.000Z", { hero: { headline: "Newer" } })])).toEqual([{ id: "a1", summary: "accepted a1", acceptedAt: "2026-11-11T09:00:00.000Z" }]);
  });
  it("an accept before it was proposed does not: it was drafted against that", () => {
    expect(staleAgainst(waiting, [acc("a0", "2026-11-09T09:00:00.000Z", { hero: { headline: "Newer" } })])).toEqual([]);
  });
  it("a later accept on another field or another page does not", () => {
    expect(staleAgainst(waiting, [acc("a2", "2026-11-11T09:00:00.000Z", { hero: { badge: "Open" } }), acc("a3", "2026-11-11T09:00:00.000Z", { hero: { headline: "x" } }, "page-visit")])).toEqual([]);
  });
  it("counts each stale waiting change once", () => {
    expect(conflictCounts({}, { w: [{ id: "a", summary: "", acceptedAt: "" }, { id: "b", summary: "", acceptedAt: "" }], v: [] })).toEqual({ pairs: 0, stale: 1 });
  });
});

describe("the order", () => {
  it("oldest first, then the batch's own order, then id", () => {
    const rows = [
      { id: "c", at: "2026-11-12T00:00:00.000Z", position: 0 },
      { id: "b", at: "2026-11-10T00:00:00.000Z", position: 1 },
      { id: "a", at: "2026-11-10T00:00:00.000Z", position: 1 },
      { id: "z", at: "2026-11-10T00:00:00.000Z", position: 0 },
    ];
    expect([...rows].sort(oldestFirst).map((r) => r.id)).toEqual(["z", "a", "b", "c"]);
  });
});

describe("content translations: one field each (Spanish drafts, 24 Nov 2026)", () => {
  const T = { method: "PUT", path: "/api/admin/content-translations" };
  const tr = (ref: string, field: string, locale = "es") => fp("setting", T, { kind: "page_section", ref, field, locale, text: "x" });

  it("two fields of one page in one language do not collide", () => {
    expect(overlaps(tr("page-home", "hero.title"), tr("page-home", "hero.subline"))).toBe(false);
  });
  it("the same field collides, and a nested address collides with its parent", () => {
    expect(overlaps(tr("page-home", "hero.title"), tr("page-home", "hero.title"))).toBe(true);
    expect(overlaps(tr("page-home", "steps.items.2"), tr("page-home", "steps.items.2.title"))).toBe(true);
  });
  it("another page or another language is another document", () => {
    expect(overlaps(tr("page-home", "hero.title"), tr("page-team", "hero.title"))).toBe(false);
    expect(overlaps(tr("page-home", "hero.title"), tr("page-home", "hero.title", "pt"))).toBe(false);
  });
  it("a waiting translation is not made stale by an accepted one of a different field", () => {
    const a = tr("page-home", "hero.title");
    expect(a).toEqual({ doc: "content-translations:page_section:page-home:es", whole: false, fields: ["hero.title"] });
  });
  it("any other PUT setting still writes its whole document", () => {
    expect(fp("setting", { method: "PUT", path: "/api/admin/brand" }, { name: "x" })?.whole).toBe(true);
  });
});

describe("deciding them (the lead, 25 Nov 2026: conflicts block, a stale change is seen first)", () => {
  const home = { section: "page-home" };
  it("gathers every change linked by a shared write into one card, oldest first, and leaves the rest alone", () => {
    const a = change("page_content", home, { hero: { headline: "A" } }, "2026-11-01T00:00:00.000Z", { id: "a" });
    const b = change("page_content", home, { hero: { headline: "B", badge: "x" } }, "2026-11-02T00:00:00.000Z", { id: "b" });
    // c collides with b only, through the badge: still the same card, so one person makes one choice.
    const c = change("page_content", home, { hero: { badge: "y" } }, "2026-11-03T00:00:00.000Z", { id: "c" });
    const apart = change("page_content", home, { intro: { lede: "z" } }, "2026-10-01T00:00:00.000Z", { id: "apart" });
    const other = change("page_content", { section: "page-steward" }, { hero: { headline: "A" } }, "2026-11-01T00:00:00.000Z", { id: "other" });
    expect(conflictGroups([c, apart, b, other, a])).toEqual([["a", "b", "c"]]);
    // Accepting one names only what it collides with directly: a over b, never c.
    expect(waitingConflicts([a, b, c]).a!.map((o) => o.id)).toEqual(["b"]);
    expect(conflictGroups([apart, other])).toEqual([]);
  });

  it("a stale change's version is what landed since, in any order, and empty when nothing did", () => {
    expect(staleVersionOf([])).toBe("");
    expect(staleVersionOf([{ id: "pc_b" }, { id: "pc_a" }])).toBe("pc_a,pc_b");
    expect(staleVersionOf([{ id: "pc_a" }, { id: "pc_b" }])).toBe(staleVersionOf([{ id: "pc_b" }, { id: "pc_a" }]));
  });
});
