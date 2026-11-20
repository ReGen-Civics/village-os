/**
 * THE APPLICATION'S SAVED DRAFT: what it keeps, what it never keeps, and how
 * long it lasts (components/fireflyPath/applyDraft.ts).
 */
import { OPEN_WHY_MAX } from "@shared/openProposals";
import { GOAL_LIMITS } from "@shared/proposalGoals";
import { PROPOSAL_LINKS_MAX } from "@shared/proposalAttachments";
import { describe, expect, it } from "vitest";
import { DRAFT_DAYS, draftKey, fromDraft, toDraft } from "./applyDraft";

const NOW = new Date("2026-11-11T20:00:00Z");
const STATE = {
  step: 2,
  reached: 3,
  knowUs: ["Visit the land"],
  why: "Because the land asks.",
  name: "Rowan",
  email: "rowan@example.test",
  about: { based: "Uvita", languages: "Spanish", story: "" },
  selfKnowledge: "Projector",
  links: [{ label: "Work", url: "https://example.org" }],
  aim: "Books kept true.",
  items: [{ title: "A model", doneWhen: "it runs", moves: "", serves: "g-1", date: "", roleId: "r1" }],
  marks: { aim: "Books kept true." },
  terms: { answers: {}, commitmentPct: 50 },
  rampUp: true,
  practical: { timeZone: "America/Costa_Rica", windows: ["weekday-mornings"], earliestStart: "2026-12-01" },
  pieceSuggestions: [{ roleId: "r-gate", piece: "purpose" as const, kind: "deliver" as const, text: "A dawn rota, every week." }],
};

describe("the saved draft", () => {
  it("keeps the applicant's own words and the step, and reads back what it wrote", () => {
    const back = fromDraft(JSON.parse(JSON.stringify(toDraft(STATE, NOW))), NOW, 5);
    expect(back).toMatchObject({ ...STATE, savedAt: NOW.toISOString() });
  });

  it("never holds references, the consent, files or the agreements, whatever the page hands it", () => {
    const loaded = { ...STATE, about: { ...STATE.about, references: [{ name: "Ines", how: "fence", contact: "ines@example.org" }], consent: true }, files: ["portfolio.pdf"], agreed: { nda: true } } as any;
    const written = JSON.stringify(toDraft(loaded, NOW));
    for (const never of ["Ines", "ines@example.org", "consent", "portfolio.pdf", "references", "agreed", "nda"]) expect(written).not.toContain(never);
  });

  it("keeps the roles added to the application, each with its own commitment, ask and split, and drops what is not one (the lead, 18 Nov 2026)", () => {
    const extras = [
      { roleId: "r-host", terms: { answers: {}, commitmentPct: 40, payAsk: { kind: "amount" as const, monthly: 3000 }, paySplit: [{ label: "Cash", pct: 70 }, { label: "Equity", pct: 30 }] } },
      { roleId: "r-well", terms: { answers: {}, commitmentPct: 20, payAsk: null } },
    ];
    const back = fromDraft(JSON.parse(JSON.stringify(toDraft({ ...STATE, extras }, NOW))), NOW, 5);
    expect(back?.extras).toEqual([
      { roleId: "r-host", terms: { answers: {}, commitmentPct: 40, payAsk: { kind: "amount", monthly: 3000 }, paySplit: [{ label: "Cash", pct: 70 }, { label: "Equity", pct: 30 }] } },
      { roleId: "r-well", terms: { answers: {}, commitmentPct: 20, payAsk: null } },
    ]);
    // A stored list read tolerantly: no id, the same role twice, and more than two are dropped; a split not adding to 100 goes.
    const raw = { ...JSON.parse(JSON.stringify(toDraft(STATE, NOW))), extras: [{ terms: {} }, { roleId: "a", terms: { commitmentPct: 30, paySplit: [{ label: "Cash", pct: 50 }] } }, { roleId: "a" }, { roleId: "b" }, { roleId: "c" }] };
    expect(fromDraft(raw, NOW, 5)?.extras?.map((x) => [x.roleId, x.terms.commitmentPct, x.terms.paySplit ?? null])).toEqual([["a", 30, null], ["b", null, null]]);
    // CONTROL: a draft saved before roles could be added reads with none.
    expect(fromDraft(JSON.parse(JSON.stringify(toDraft(STATE, NOW))), NOW, 5)).not.toHaveProperty("extras");
  });

  it("loads a long draft WHOLE (the lead, 19 Nov 2026): words typed under any cap come back exactly as kept", () => {
    // Longer than the old 1200 cap on "Why you, and why now", and longer than today's box, as a raised or lowered cap would leave it.
    const why = ["What I have built before:", "Why this role:", "Why now:", "What I would bring in my first month:"].map((p) => `${p} ${"word ".repeat(260)}`).join("\n\n");
    expect(why.length).toBeGreaterThan(4000);
    const long = { ...STATE, why, aim: "a".repeat(900), about: { based: "b".repeat(500), languages: "l".repeat(500), story: "s".repeat(800) }, selfKnowledge: "k".repeat(700), items: [{ ...STATE.items[0], title: "t".repeat(400), doneWhen: "d".repeat(500) }], marks: { aim: "a".repeat(900), story: "s".repeat(800) } };
    const back = fromDraft(JSON.parse(JSON.stringify(toDraft(long, NOW))), NOW, 5);
    expect(back?.why).toBe(why);
    expect(back).toMatchObject({ aim: long.aim, about: long.about, selfKnowledge: long.selfKnowledge, marks: long.marks });
    expect(back?.items[0]).toMatchObject({ title: long.items[0].title, doneWhen: long.items[0].doneWhen });
  });

  it("loads a draft longer than any box, with more items and links than the old counts, WHOLE (the ops request of 19 Nov 2026)", () => {
    const why = "w".repeat(OPEN_WHY_MAX + 500);
    const items = Array.from({ length: GOAL_LIMITS.max }, (_, i) => ({ ...STATE.items[0], title: `t${i} ${"x".repeat(9000)}`, doneWhen: "d".repeat(9000) }));
    const links = Array.from({ length: PROPOSAL_LINKS_MAX }, (_, i) => ({ label: `l${i}`, url: `https://example.test/${i}` }));
    const long = { ...STATE, why, aim: "a".repeat(9000), about: { based: "b".repeat(9000), languages: "l".repeat(9000), story: "s".repeat(9000) }, selfKnowledge: "k".repeat(9000), items, links };
    const back = fromDraft(JSON.parse(JSON.stringify(toDraft(long, NOW))), NOW, 5);
    expect(back?.why).toBe(why);
    expect(back).toMatchObject({ aim: long.aim, about: long.about, selfKnowledge: long.selfKnowledge });
    expect(back?.items).toHaveLength(GOAL_LIMITS.max);
    expect(back?.items[GOAL_LIMITS.max - 1].title).toBe(items[GOAL_LIMITS.max - 1].title);
    expect(back?.links).toHaveLength(PROPOSAL_LINKS_MAX);
  });

  it("is one per role and per personal link", () => {
    expect(draftKey("r1", "")).not.toBe(draftKey("r2", ""));
    expect(draftKey("r1", "")).not.toBe(draftKey("r1", "tok"));
  });

  it("an old, broken or foreign draft is no draft, and a step out of range is held to the steps", () => {
    const old = new Date(NOW.getTime() - (DRAFT_DAYS + 1) * 24 * 60 * 60_000);
    expect(fromDraft(toDraft(STATE, old), NOW, 5)).toBeNull();
    for (const bad of [null, "text", [], { savedAt: "not a date" }]) expect(fromDraft(bad, NOW, 5)).toBeNull();
    expect(fromDraft({ ...toDraft(STATE, NOW), step: 99, reached: -4 }, NOW, 5)).toMatchObject({ step: 5, reached: 5 });
    expect(fromDraft({ ...toDraft(STATE, NOW), terms: { answers: [], commitmentPct: 7.5 } }, NOW, 5)?.terms).toEqual({ answers: {}, commitmentPct: null, payAsk: null });
  });
});
