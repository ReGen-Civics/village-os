import { describe, expect, it } from "vitest";
import { cardPay, EMPTY_SECTIONS, hasSections, withoutGoneRelated, newerEdit, payShapeLines, readPayCeiling, readPayShape, readSections, readVillagePayShape, sectionsFromDoc, SECTION_PROBLEMS, SECTION_WORDS, splitLine, villagePayFrom } from "./roleCardSections";
import { payShapeOf } from "./foundingApplication";

const FULL = {
  idealBackground: ["Ideally a background in finance", "- Real estate development finance"],
  qualities: ["Owns the whole domain", "In it for the long run"],
  aiSupport: "An AI companion keeps the daily books moving and drafts the models.",
  aiCompanion: "Heron",
  paid: true,
  payShape: [
    { label: "Cash", pct: 40 },
    { label: "Equity", pct: "55" },
    { label: "Credits", pct: "5%" },
  ],
  payNote: "Indicative only. Equity, land credit, token and credit terms are still being defined and are subject to legal review.",
};

describe("readSections", () => {
  it("reads every founding section, trimming list markers and percent signs", () => {
    const r = readSections(FULL);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.idealBackground).toEqual(["Ideally a background in finance", "Real estate development finance"]);
    expect(r.value.payShape).toEqual([
      { label: "Cash", pct: 40 },
      { label: "Equity", pct: 55 },
      { label: "Credits", pct: 5 },
    ]);
    expect(r.value.paid).toBe(true);
    expect(payShapeLines(r.value.payShape)).toEqual(["Cash 40%", "Equity 55%", "Credits 5%"]);
  });

  it("reads a companion link and refuses a value that is not a web address", () => {
    const good = readSections({ companionUrl: "https://example.com/companions?seat=cook" });
    expect(good.ok).toBe(true);
    if (good.ok) expect(good.value.companionUrl).toBe("https://example.com/companions?seat=cook");
    const bad = readSections({ companionUrl: "not a link" });
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.problem).toBe(SECTION_PROBLEMS.notUrl);
    expect(hasSections({ ...EMPTY_SECTIONS, companionUrl: "https://example.com" })).toBe(true);
  });

  it("reads nothing as the empty set, which draws nothing (control: the full set draws)", () => {
    const r = readSections(undefined);
    expect(r.ok && hasSections(r.value)).toBe(false);
    const full = readSections(FULL);
    expect(full.ok && hasSections(full.value)).toBe(true);
  });

  it("refuses an amount or a range anywhere on the pay, in words (pay ranges stay hidden)", () => {
    for (const note of ["6,750 to 9,000 USD a month", "$6750 per month", "Up to 9000 usd"]) {
      const r = readSections({ ...FULL, payNote: note });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.problem).toBe(SECTION_PROBLEMS.amount);
    }
    const label = readPayShape([{ label: "Cash $6,750", pct: 40 }]);
    expect(label.ok).toBe(false);
    // Control: the footer the build list names is not an amount.
    expect(readSections(FULL).ok).toBe(true);
  });

  it("refuses shares over 100 percent, a share with no name, and a percent that is not whole", () => {
    expect(readPayShape([{ label: "Cash", pct: 60 }, { label: "Equity", pct: 55 }])).toEqual({ ok: false, problem: SECTION_PROBLEMS.total });
    expect(readPayShape([{ label: "", pct: 40 }]).ok).toBe(false);
    expect(readPayShape([{ label: "Cash", pct: 40.5 }])).toEqual({ ok: false, problem: SECTION_PROBLEMS.pct });
    // A blank row the editor left is skipped (control).
    expect(readPayShape([{ label: "", pct: "" }, { label: "Cash", pct: 100 }])).toEqual({ ok: true, value: [{ label: "Cash", pct: 100 }] });
  });

  it("refuses payment details and too many lines, naming the field", () => {
    const bank = readSections({ ...FULL, qualities: ["IBAN CR05015202001026284066"] });
    expect(bank.ok).toBe(false);
    if (!bank.ok) expect(bank.field).toBe("sections.qualities");
    const many = readSections({ ...FULL, idealBackground: Array.from({ length: 9 }, (_, i) => `Line ${i}`) });
    expect(many.ok).toBe(false);
  });
});

describe("the related roles a lead role will onboard (the lead, 24 Nov 2026)", () => {
  const real = new Set(["perma", "dev", "finance", "kitchen", ...Array.from({ length: 13 }, (_, i) => `r${i}`)]);
  const ctx = { roleId: "lead", isRole: (id: string) => real.has(id) };

  it("keeps the ids in the order given, and stores nothing when the list is empty", () => {
    const r = readSections({ ...FULL, relatedRoles: ["finance", "perma", " dev "] }, ctx);
    expect(r.ok && r.value.relatedRoles).toEqual(["finance", "perma", "dev"]);
    const none = readSections({ ...FULL, relatedRoles: [] }, ctx);
    expect(none.ok && "relatedRoles" in none.value).toBe(false);
    // A related list alone is not a founding section the full card draws.
    const alone = readSections({ relatedRoles: ["perma"] }, ctx);
    expect(alone.ok && hasSections(alone.value)).toBe(false);
  });

  it("refuses an id that is not a role, naming it", () => {
    expect(readSections({ ...FULL, relatedRoles: ["perma", "ghost"] }, ctx)).toEqual({ ok: false, problem: SECTION_PROBLEMS.relatedUnknown("ghost"), field: "sections.relatedRoles" });
    // Control: with no lookup (a stored document read back, the browser) the same id passes.
    expect(readSections({ ...FULL, relatedRoles: ["perma", "ghost"] }).ok).toBe(true);
  });

  it("refuses the card's own role", () => {
    expect(readSections({ ...FULL, relatedRoles: ["lead"] }, ctx)).toEqual({ ok: false, problem: SECTION_PROBLEMS.relatedSelf, field: "sections.relatedRoles" });
  });

  it("refuses the same role twice", () => {
    expect(readSections({ ...FULL, relatedRoles: ["dev", "perma", "dev"] }, ctx)).toEqual({ ok: false, problem: SECTION_PROBLEMS.relatedDuplicate("dev"), field: "sections.relatedRoles" });
  });

  it("refuses more than 12, and takes exactly 12 (control)", () => {
    const thirteen = Array.from({ length: 13 }, (_, i) => `r${i}`);
    expect(readSections({ ...FULL, relatedRoles: thirteen }, ctx)).toEqual({ ok: false, problem: SECTION_PROBLEMS.relatedTooMany, field: "sections.relatedRoles" });
    expect(readSections({ ...FULL, relatedRoles: thirteen.slice(0, 12) }, ctx).ok).toBe(true);
  });

  it("refuses a list that is not a list of ids", () => {
    expect(readSections({ ...FULL, relatedRoles: "perma" }, ctx)).toEqual({ ok: false, problem: SECTION_PROBLEMS.relatedList, field: "sections.relatedRoles" });
    expect(readSections({ ...FULL, relatedRoles: [3] }, ctx)).toEqual({ ok: false, problem: SECTION_PROBLEMS.relatedList, field: "sections.relatedRoles" });
  });

  it("drops a role removed since the list was written from the held sections, so an unrelated save still reads", () => {
    const held = { ...EMPTY_SECTIONS, relatedRoles: ["perma", "gone"] };
    expect(withoutGoneRelated(held, ctx.isRole).relatedRoles).toEqual(["perma"]);
    expect("relatedRoles" in withoutGoneRelated({ ...EMPTY_SECTIONS, relatedRoles: ["gone"] }, ctx.isRole)).toBe(false);
    expect(readSections({ ...withoutGoneRelated(held, ctx.isRole), qualities: ["Calm"] }, ctx).ok).toBe(true);
    // Control: laid over the held list as it is, the save refuses on the removed role.
    expect(readSections({ ...held, qualities: ["Calm"] }, ctx).ok).toBe(false);
  });
});

describe("the stored document", () => {
  it("reads one role's entry and its last save, and a bad entry as empty", () => {
    const doc = { roles: { a: { sections: FULL, edited: { by: "u1", at: "2026-11-11T10:00:00.000Z" } }, b: { sections: { payShape: "nope" } } } };
    const a = sectionsFromDoc(doc, "a");
    expect(a.sections.aiCompanion).toBe("Heron");
    expect(a.edited).toEqual({ by: "u1", at: "2026-11-11T10:00:00.000Z" });
    expect(sectionsFromDoc(doc, "b").sections).toEqual(EMPTY_SECTIONS);
    expect(sectionsFromDoc(null, "a").edited).toBeNull();
  });

  it("picks the newer of two edits", () => {
    const old = { by: "a", at: "2026-11-01T00:00:00Z" };
    const fresh = { by: "b", at: "2026-11-10T00:00:00Z" };
    expect(newerEdit(old, fresh)).toBe(fresh);
    expect(newerEdit(fresh, old)).toBe(fresh);
    expect(newerEdit(null, old)).toBe(old);
  });
});

describe("the 60/40/0 split and the fine print's asterisk (lead, 12 to 13 Nov)", () => {
  const card = (over: Record<string, unknown> = {}) => {
    const r = readSections({ paid: true, ...over });
    if (!r.ok) throw new Error(r.problem);
    return r.value;
  };
  const ceiling = { amount: 13000, currency: "USD", per: "month" };

  it("a share of 0 is read and said, never dropped, by both readers", () => {
    const setting = "cash 60, equity 40, village credits 0";
    expect(readVillagePayShape(setting)).toEqual([{ label: "cash", pct: 60 }, { label: "equity", pct: 40 }, { label: "village credits", pct: 0 }]);
    expect(payShapeOf(setting)).toEqual([{ label: "cash", pct: 60 }, { label: "equity", pct: 40 }, { label: "village credits", pct: 0 }]);
    expect(splitLine(readVillagePayShape(setting), "")).toBe("Default split: 60% cash, 40% equity, 0% village credits.");
    expect(cardPay(card(), villagePayFrom({ shape: "cash 60, equity 40, credits 0", atRisk: "", note: "" }))?.split).toBe("Default split: 60% cash, 40% equity, 0% credits.");
  });

  it("the shares still total no more than 100: a zero does not open the door to 101", () => {
    expect(readVillagePayShape("cash 61, equity 40, credits 0")).toEqual([]);
    expect(payShapeOf("cash 61, equity 40, credits 0")).toEqual([]);
    expect(readPayShape([{ label: "cash", pct: 61 }, { label: "equity", pct: 40 }, { label: "credits", pct: 0 }]).ok).toBe(false);
    expect(readPayShape([{ label: "cash", pct: 60 }, { label: "equity", pct: 40 }, { label: "credits", pct: "0" }])).toEqual({ ok: true, value: [{ label: "cash", pct: 60 }, { label: "equity", pct: 40 }, { label: "credits", pct: 0 }] });
  });

  it("the ceiling carries an asterisk only when the note opens with one", () => {
    const shape = "cash 60, equity 40, credits 0";
    const starred = cardPay(card({ payCeiling: ceiling }), villagePayFrom({ shape, atRisk: "", note: "*The total shown is the full band available for this role." }));
    expect(starred?.ceiling).toBe("Total compensation up to $13,000 a month*");
    const plain = cardPay(card({ payCeiling: ceiling }), villagePayFrom({ shape, atRisk: "", note: "Indicative only." }));
    expect(plain?.ceiling).toBe("Total compensation up to $13,000 a month");
    expect(cardPay(card({ payCeiling: ceiling }), villagePayFrom({ shape, atRisk: "", note: "" }))?.ceiling).toBe("Total compensation up to $13,000 a month");
    // The card's own note wins over the village's, and so does its asterisk, either way.
    expect(cardPay(card({ payCeiling: ceiling, payNote: "This role's own note." }), villagePayFrom({ shape, atRisk: "", note: "*Village note." }))?.ceiling).toBe("Total compensation up to $13,000 a month");
  });
});

describe("the two pay lines (lead, 11 Nov evening)", () => {
  const village = villagePayFrom({ shape: "cash 40, equity 55, village credits 5", atRisk: "Part of the pay depends on what the village raises.", note: "Indicative only." });
  const card = (over: Record<string, unknown> = {}) => {
    const r = readSections({ paid: true, paySplitNote: "To be decided in the onboarding process.", ...over });
    if (!r.ok) throw new Error(r.problem);
    return r.value;
  };

  it("ceiling set: both lines, the ceiling first, then the split, with the at-risk line and footer kept", () => {
    const pay = cardPay(card({ payCeiling: { amount: 9000, currency: "USD", per: "month" } }), village);
    expect(pay?.ceiling).toBe("Total compensation up to $9,000 a month");
    expect(pay?.split).toBe("Default split: 40% cash, 55% equity, 5% village credits. To be decided in the onboarding process.");
    expect(pay?.atRisk).toBe("Part of the pay depends on what the village raises.");
    expect(pay?.note).toBe("Indicative only.");
  });

  it("ceiling unset: only the split line", () => {
    const pay = cardPay(card(), village);
    expect(pay?.ceiling).toBeNull();
    expect(pay?.split).toContain("Default split: 40% cash");
  });

  it("split unset: only the ceiling line, and with neither, no pay block at all", () => {
    const none = villagePayFrom({ shape: "", atRisk: "", note: "" });
    const pay = cardPay(card({ payCeiling: { amount: 9000, currency: "USD", per: "month" } }), none);
    expect(pay?.ceiling).toBe("Total compensation up to $9,000 a month");
    expect(pay?.split).toBeNull();
    expect(cardPay(card(), none)).toBeNull();
  });

  it("a card's own shares replace the village's (control: the village's without them)", () => {
    expect(cardPay(card({ payShape: [{ label: "cash", pct: 70 }, { label: "equity", pct: 30 }] }), village)?.split).toContain("70% cash, 30% equity");
    expect(cardPay(card(), village)?.split).toContain("55% equity");
  });

  it("never takes a range or a minimum: the ceiling is one figure", () => {
    expect(readPayCeiling({ amount: 9000, currency: "USD", per: "month", minMinor: 675000 }).ok).toBe(false);
    expect(readPayCeiling({ min: 6750, max: 9000, currency: "USD" }).ok).toBe(false);
    expect(readPayCeiling({ amount: "6750-9000", currency: "USD" }).ok).toBe(false);
    expect(readPayCeiling({ amount: 0, currency: "USD" }).ok).toBe(false);
    expect(readPayCeiling({ amount: "9000", currency: "usd", per: "month" })).toEqual({ ok: true, value: { amount: 9000, currency: "USD", per: "month" } });
    expect(readPayCeiling(null)).toEqual({ ok: true, value: null });
  });

  it("reads the village's split setting, and a setting that does not read cleanly as none", () => {
    expect(readVillagePayShape("Cash 40, Equity 55; Credits 5%")).toEqual([
      { label: "Cash", pct: 40 },
      { label: "Equity", pct: 55 },
      { label: "Credits", pct: 5 },
    ]);
    expect(readVillagePayShape("Cash forty")).toEqual([]);
    expect(readVillagePayShape("Cash 80, Equity 55")).toEqual([]);
  });
});

describe("the rewards heading (the lead's wording, batch 158)", () => {
  it("reads \"How compensation works\" on the card, the rail and the editor, and its problem names it the same way", () => {
    expect(SECTION_WORDS.payShape).toBe("How compensation works");
    const bad = readPayShape("not a list" as unknown);
    expect(JSON.stringify(bad)).toMatch(/How compensation works/);
  });
});
