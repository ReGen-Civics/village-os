/**
 * What may be translated, and what a translation must look like
 * (shared/contentTranslation.ts).
 */
import { describe, expect, it } from "vitest";
import { contentTranslationProblem, PROTECTED_PAGES, translatableLocales, translationTarget, type TranslationInput } from "./contentTranslation";
import { pageSpecForSection } from "./pageContent";

const ok = (over: Partial<TranslationInput> = {}): TranslationInput => ({
  kind: "role_card",
  refKey: "legal-steward",
  field: "aim",
  locale: "es",
  text: "Sostener lo legal de {village}.",
  status: "approved",
  source: "Hold the legal side of {village}.",
  ...over,
});

/** The first text field and the first link field of a page, read from its spec so the test follows the spec. */
function fieldsOf(section: string) {
  const spec = pageSpecForSection(section)!;
  let text: string | null = null;
  let link: string | null = null;
  for (const s of spec.sections) {
    for (const f of s.fields) {
      if (!text && f.kind !== "link") text = `${s.id}.${f.key}`;
      if (!link && f.kind === "link") link = `${s.id}.${f.key}`;
    }
  }
  return { text, link };
}

describe("translationTarget", () => {
  it("takes a role card's text columns and its accountabilities by index", () => {
    expect(translationTarget("role_card", "r1", "aim")).toMatchObject({ ok: true, protection: "open" });
    expect(translationTarget("role_card", "r1", "accountabilities.3")).toMatchObject({ ok: true });
    expect(translationTarget("role_card", "r1", "accountabilities.x")).toMatchObject({ ok: false });
    expect(translationTarget("role_card", "r1", "holder_id")).toMatchObject({ ok: false });
  });

  it("keeps pay words for a person to translate", () => {
    expect(translationTarget("role_card", "r1", "compensation_reality")).toMatchObject({ ok: true, protection: "human_only" });
    expect(translationTarget("role_card_sections", "r1", "payNote")).toMatchObject({ ok: true, protection: "human_only" });
    expect(translationTarget("role_card_sections", "r1", "payShape.0.label")).toMatchObject({ ok: true, protection: "human_only" });
    expect(translationTarget("role_card_sections", "r1", "qualities.2")).toMatchObject({ ok: true, protection: "open" });
    expect(translationTarget("role_card_sections", "r1", "qualities.99")).toMatchObject({ ok: false });
  });

  it("takes a journey page's words, but never a link", () => {
    const { text, link } = fieldsOf("page-journey-steward");
    expect(text).toBeTruthy();
    expect(translationTarget("page_section", "page-journey-steward", text!)).toMatchObject({ ok: true, protection: "open" });
    if (link) expect(translationTarget("page_section", "page-journey-steward", link)).toMatchObject({ ok: false });
  });

  it("refuses every binding page, whatever field is asked for", () => {
    for (const id of PROTECTED_PAGES) {
      expect(pageSpecForSection(`page-${id}`), `page-${id} exists`).toBeTruthy();
      const { text } = fieldsOf(`page-${id}`);
      const t = translationTarget("page_section", `page-${id}`, text ?? "x.y");
      expect(t.ok).toBe(false);
      if (!t.ok) expect(t.reason).toMatch(/binding/);
    }
  });

  it("refuses content that is not one of the three kinds (agreements, the legal section, documents)", () => {
    for (const kind of ["agreement", "legal", "covenant", "village_document", "constitution"]) {
      expect(translationTarget(kind, "x", "y").ok).toBe(false);
    }
    expect(translationTarget("page_section", "legal", "a.b").ok).toBe(false);
  });
});

describe("contentTranslationProblem", () => {
  it("passes a faithful translation", () => {
    expect(contentTranslationProblem(ok())).toBeNull();
  });

  it("never stores a translation into the source language or one the village does not offer", () => {
    expect(translatableLocales()).not.toContain("en");
    expect(contentTranslationProblem(ok({ locale: "en" }))).toMatch(/not a language/);
    expect(contentTranslationProblem(ok({ locale: "xx" }))).toMatch(/not a language/);
  });

  it("refuses a machine draft of pay words, and lets a person write them", () => {
    const pay = { field: "compensation_reality", source: "Paid monthly.", text: "Se paga cada mes." };
    expect(contentTranslationProblem(ok({ ...pay, status: "ai_draft" }))).toMatch(/person/);
    expect(contentTranslationProblem(ok({ ...pay, status: "approved" }))).toBeNull();
  });

  it("keeps the words in braces and the bold words of the English", () => {
    expect(contentTranslationProblem(ok({ text: "Sostener lo legal de la aldea." }))).toMatch(/\{village\}/);
    expect(contentTranslationProblem(ok({ text: "Sostener {pueblo}." }))).toMatch(/braces/);
    expect(contentTranslationProblem(ok({ source: "Hold **all** of it.", text: "Sostenerlo todo." }))).toMatch(/bold/);
  });

  it("refuses markup, blank text, and text longer than the field holds", () => {
    expect(contentTranslationProblem(ok({ text: "<b>Hola</b> {village}" }))).toMatch(/markup/);
    expect(contentTranslationProblem(ok({ text: "   " }))).toMatch(/Write/);
    expect(contentTranslationProblem(ok({ field: "qualities.0", kind: "role_card_sections", source: "Calm", text: "x".repeat(400) }))).toMatch(/holds/);
  });

  it("refuses a status it does not know", () => {
    expect(contentTranslationProblem(ok({ status: "machine" }))).toMatch(/status/);
  });
});
