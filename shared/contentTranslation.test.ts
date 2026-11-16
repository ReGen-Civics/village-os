/**
 * What may be translated, and what a translation must look like
 * (shared/contentTranslation.ts).
 */
import { describe, expect, it } from "vitest";
import { addedUrls, contentTranslationProblem, PROTECTED_PAGES, translatableLocales, translationTarget, type TranslationInput } from "./contentTranslation";
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
    expect(translationTarget("role_card", "r1", "authorities.0")).toMatchObject({ ok: true });
    expect(translationTarget("role_card", "r1", "exists_while")).toMatchObject({ ok: true });
    expect(translationTarget("role_card", "r1", "accountabilities.x")).toMatchObject({ ok: false });
    expect(translationTarget("role_card", "r1", "runbook")).toMatchObject({ ok: false });
    expect(translationTarget("role_card", "r1", "holder_id")).toMatchObject({ ok: false });
  });

  it("keeps pay words for a person to translate", () => {
    expect(translationTarget("role_card", "r1", "compensation_reality")).toMatchObject({ ok: true, protection: "human_only" });
    expect(translationTarget("role_card_sections", "r1", "payNote")).toMatchObject({ ok: true, protection: "human_only" });
    expect(translationTarget("role_card_sections", "r1", "payShape.0.label")).toMatchObject({ ok: true, protection: "human_only" });
    expect(translationTarget("role_card_sections", "r1", "qualities.2")).toMatchObject({ ok: true, protection: "open" });
    expect(translationTarget("role_card_sections", "r1", "qualities.99")).toMatchObject({ ok: false });
    // The companion names the card's animal icon; a translated name would draw no animal.
    expect(translationTarget("role_card_sections", "r1", "aiCompanion")).toMatchObject({ ok: false });
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

  // Security audit, 15 Nov 2026: markup in the English used to switch the markup check off.
  it("holds a translation's tags to exactly the English's, even when the English has markup", () => {
    const source = "Hold the <b>legal</b> side of {village}.";
    expect(contentTranslationProblem(ok({ source, text: "Sostener el lado <b>legal</b> de {village}." }))).toBeNull();
    expect(contentTranslationProblem(ok({ source, text: "Sostener el lado <B >legal</b> de {village}." }))).toBeNull();
    expect(contentTranslationProblem(ok({ source, text: 'Sostener el lado <b>legal</b> de {village}. <a href="https://x.example">aqui</a>' }))).toMatch(/markup/);
    expect(contentTranslationProblem(ok({ source, text: "Sostener el lado <b>legal</b> de {village}.<img src=x onerror=alert(1)>" }))).toMatch(/markup/);
    expect(contentTranslationProblem(ok({ source, text: "Sostener el lado legal de {village}." }))).toMatch(/markup/);
    expect(contentTranslationProblem(ok({ source, text: "Sostener el lado <i>legal</i> de {village}." }))).toMatch(/markup/);
  });

  // Rye, 15 Nov 2026: a machine draft is shown to readers, marked, so it may not add an address.
  it("refuses a machine draft that adds a web address the English does not have", () => {
    const draft = (text: string, source = "Hold the legal side of {village}.") => contentTranslationProblem(ok({ status: "ai_draft", text, source }));
    expect(draft("Sostener lo legal de {village}.")).toBeNull();
    expect(draft("Sostener lo legal de {village}. Mas en https://evil.example/pay")).toMatch(/web address/);
    expect(draft("Sostener lo legal de {village}. Visita www.evil.example")).toMatch(/web address/);
    expect(draft("Sostener lo legal de {village}. Escribe a evil-pay.com")).toMatch(/web address/);
    expect(draft("Sostener lo legal de {village}. evil.example/pagar")).toMatch(/web address/);
    expect(draft("Sostener lo legal de {village}. mailto:x@evil.example")).toMatch(/web address/);
    // The address the English already holds may stay, whatever its case or a full stop after it.
    expect(draft("Lee https://village.example/rules. antes de {village}.", "Read https://village.example/rules before {village}.")).toBeNull();
    expect(draft("Lee HTTPS://Village.example/rules antes de {village}.", "Read https://village.example/rules before {village}.")).toBeNull();
    // A different address in the same place is still added.
    expect(draft("Lee https://vil1age.example/rules antes de {village}.", "Read https://village.example/rules before {village}.")).toMatch(/web address/);
    // A person's translation stands in their name, so this check is the machine's.
    expect(contentTranslationProblem(ok({ status: "approved", text: "Sostener lo legal de {village}. Mas en https://village.example/es" }))).toBeNull();
    expect(addedUrls("Mas en https://a.example y https://b.example", "See https://a.example")).toEqual(["https://b.example"]);
  });
});
