/**
 * TRANSLATED VILLAGE CONTENT: what may be translated, and what a translation
 * must look like (Rye, 15 Nov 2026).
 *
 * The catalog (client/src/locales/*.po) translates the words the code says.
 * It cannot translate what a village writes at run time: a role card's name and
 * aim, the founding sections of a card, a page's fields. Those are stored in
 * `content_translations` (migration 0387_content_translations.sql), one row per
 * (kind, ref_key, field, locale), and this file is the contract for that table.
 *
 * THE RULINGS IT KEEPS
 *   - Role cards and village content get translated. A machine draft is shown
 *     to readers marked as a machine translation until a person approves it
 *     (15 Nov).
 *   - Translations are crowdsourced: any member improves or flags a string;
 *     whoever holds the power to edit the source approves (6 Nov; act follows
 *     power, propose freely).
 *   - LEGAL AND BINDING TEXT IS PROTECTED. It is never machine-drafted, and the
 *     pages that ARE the binding text (the pledge, the rights pages, the good
 *     neighbor agreement) take no stored translation at all here: a village
 *     adopts a binding translation by its highest vote, which is a separate
 *     path, not this table.
 *
 * FIELD ADDRESSES
 *   role_card            ref_key = org_roles.id
 *                        field   = a text column ("aim") or a list line ("accountabilities.<n>")
 *   role_card_sections   ref_key = org_roles.id
 *                        field   = "aiSupport" | "payNote" | "paySplitNote" (never "aiCompanion": it names the card's animal)
 *                                  | "idealBackground.<n>" | "qualities.<n>" | "payShape.<n>.label"
 *   page_section         ref_key = "page-<id>"
 *                        field   = "<sectionId>.<fieldKey>"
 *                                  | "<sectionId>.<listKey>.<rowId or index>.<fieldKey>"
 *
 * A translation is of the ENGLISH THE READER WOULD OTHERWISE SEE. The server
 * stores the hash of that English beside it; when the English changes the
 * translation is stale and the reader falls back to the English.
 */
import { offeredLocaleTags, tierOf } from "./i18nLocales";
import { GOOD_NEIGHBOR_PAGE_ID } from "./pageContent/goodNeighborName";
import { pageSpecForSection, PAGE_SECTION_PREFIX } from "./pageContent";
import type { FieldSpec } from "./pageContent/types";
import { SECTION_LIMITS } from "./roleCardSections";

export const CONTENT_KINDS = ["role_card", "role_card_sections", "page_section"] as const;
export type ContentKind = (typeof CONTENT_KINDS)[number];

/** ai_draft: a machine wrote it, readers see it marked. approved: a person with the power stands behind it. */
export const TRANSLATION_STATUSES = ["ai_draft", "approved"] as const;
export type TranslationStatus = (typeof TRANSLATION_STATUSES)[number];

/**
 * open: any status. human_only: a person must write it (money and pay terms on a
 * card: a machine's wording of what someone is paid is not one we let stand,
 * even marked).
 */
export type Protection = "open" | "human_only";

/** The org_roles text columns a reader sees on a card. */
export const ROLE_CARD_TEXT_FIELDS = [
  "name",
  "aim",
  "domain",
  "why_it_matters",
  "authority",
  "first_year_outcomes",
  "first_90_day_outcomes",
  "location_expectations",
  "compensation_reality",
  "evidence_required",
  // 0268 and 0274: the handover and CCOS words the full card draws.
  "exists_while",
  "signs_stretched",
  "flows_back",
  "step_back",
  "time_commitment",
] as const;

/** The org_roles list columns, translated line by line ("authorities.2"). */
export const ROLE_CARD_LIST_FIELDS = ["accountabilities", "authorities", "responsibilities", "bring_me", "not_mine"] as const;

/** Pay words. A person writes their translation; a machine never drafts one. */
const HUMAN_ONLY_FIELDS: ReadonlySet<string> = new Set(["compensation_reality", "payNote", "paySplitNote", "payShape.label"]);

/**
 * Pages that are themselves binding text. No stored translation here: a binding
 * translation is adopted by the village's highest vote (6 Nov), elsewhere.
 */
export const PROTECTED_PAGES: readonly string[] = ["love-letter", "rights-resident", "rights-steward", GOOD_NEIGHBOR_PAGE_ID];

/** Role-card text columns have no layout limit of their own; this is the most a translation may hold. */
export const ROLE_CARD_FIELD_CHARS = 4000;

/** Spanish runs about a quarter longer than English; a translation may exceed the source field's limit by that much. */
export const TRANSLATION_SLACK = 1.25;

export const ROLE_ID_MAX = 64;

export type Target = { ok: true; cap: number; protection: Protection } | { ok: false; reason: string };

const INDEX = /^(0|[1-9]\d{0,2})$/;
const ID = /^[a-z0-9][a-z0-9_-]{0,63}$/i;

const slack = (n: number) => Math.ceil(n * TRANSLATION_SLACK);

/** May this field take a translation, and how long may it be? */
export function translationTarget(kind: string, refKey: string, field: string): Target {
  if (!(CONTENT_KINDS as readonly string[]).includes(kind)) return { ok: false, reason: `"${kind}" is not content that takes a translation.` };
  if (typeof refKey !== "string" || !refKey || refKey.length > 80) return { ok: false, reason: "Name what the translation is for." };
  if (typeof field !== "string" || !field || field.length > 120) return { ok: false, reason: "Name the field being translated." };
  const parts = field.split(".");

  if (kind === "role_card") {
    if (refKey.length > ROLE_ID_MAX) return { ok: false, reason: "That is not a role." };
    if (parts.length === 1 && (ROLE_CARD_TEXT_FIELDS as readonly string[]).includes(field)) {
      return { ok: true, cap: ROLE_CARD_FIELD_CHARS, protection: HUMAN_ONLY_FIELDS.has(field) ? "human_only" : "open" };
    }
    if (parts.length === 2 && (ROLE_CARD_LIST_FIELDS as readonly string[]).includes(parts[0]) && INDEX.test(parts[1])) {
      return { ok: true, cap: ROLE_CARD_FIELD_CHARS, protection: "open" };
    }
    return { ok: false, reason: `A role card has no translatable field "${field}".` };
  }

  if (kind === "role_card_sections") {
    if (refKey.length > ROLE_ID_MAX) return { ok: false, reason: "That is not a role." };
    if (parts.length === 1) {
      if (field === "aiSupport") return { ok: true, cap: slack(SECTION_LIMITS.aiSupportChars), protection: "open" };
      if (field === "payNote" || field === "paySplitNote") return { ok: true, cap: slack(SECTION_LIMITS.payNoteChars), protection: "human_only" };
    }
    if (parts.length === 2 && (parts[0] === "idealBackground" || parts[0] === "qualities") && INDEX.test(parts[1]) && Number(parts[1]) < SECTION_LIMITS.lines) {
      return { ok: true, cap: slack(SECTION_LIMITS.lineChars), protection: "open" };
    }
    if (parts.length === 3 && parts[0] === "payShape" && INDEX.test(parts[1]) && Number(parts[1]) < SECTION_LIMITS.shares && parts[2] === "label") {
      return { ok: true, cap: slack(SECTION_LIMITS.shareLabelChars), protection: "human_only" };
    }
    return { ok: false, reason: `A role card's founding sections have no translatable field "${field}".` };
  }

  // page_section
  if (!refKey.startsWith(PAGE_SECTION_PREFIX)) return { ok: false, reason: "Only a page's sections take a translation here." };
  const pageId = refKey.slice(PAGE_SECTION_PREFIX.length);
  if (PROTECTED_PAGES.includes(pageId)) {
    return { ok: false, reason: "This page is binding text. Its translation is adopted by the village's vote, not stored here." };
  }
  const spec = pageSpecForSection(refKey);
  if (!spec) return { ok: false, reason: `There is no page called "${pageId}".` };
  const section = spec.sections.find((s) => s.id === parts[0]);
  if (!section) return { ok: false, reason: `That page has no section "${parts[0]}".` };
  let fieldSpec: FieldSpec | undefined;
  if (parts.length === 2) fieldSpec = section.fields.find((f) => f.key === parts[1]);
  else if (parts.length === 4) {
    const list = section.lists?.find((l) => l.key === parts[1]);
    if (list && (INDEX.test(parts[2]) ? Number(parts[2]) < list.maxItems : ID.test(parts[2]))) fieldSpec = list.fields.find((f) => f.key === parts[3]);
  }
  if (!fieldSpec) return { ok: false, reason: `That page has no translatable field "${field}".` };
  if (fieldSpec.kind === "link") return { ok: false, reason: "A link is not translated." };
  return { ok: true, cap: slack(fieldSpec.max), protection: "open" };
}

/** The locales a translation may be stored for: offered, and not the source. */
export function translatableLocales(): string[] {
  return offeredLocaleTags().filter((t) => tierOf(t) !== "source");
}

const placeholders = (s: string) => (s.match(/\{[a-zA-Z][a-zA-Z0-9_]*\}/g) ?? []).map((m) => m.slice(1, -1)).sort();
const bolds = (s: string) => (s.match(/\*\*/g) ?? []).length;
const MARKUP = /<\s*\/?\s*[a-z!]/i;
// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;

export interface TranslationInput {
  kind: string;
  refKey: string;
  field: string;
  locale: string;
  text: string;
  status: string;
  /** The English the reader would otherwise see. */
  source: string;
}

/** Why this translation may not be stored, or null. The same rules as the source field, plus the source's own words. */
export function contentTranslationProblem(t: TranslationInput): string | null {
  const target = translationTarget(t.kind, t.refKey, t.field);
  if (!target.ok) return target.reason;
  if (!translatableLocales().includes(t.locale)) return `"${t.locale}" is not a language this village offers a translation into.`;
  if (!(TRANSLATION_STATUSES as readonly string[]).includes(t.status)) return `"${t.status}" is not a translation status.`;
  if (t.status === "ai_draft" && target.protection === "human_only") return "Pay words are translated by a person, never drafted by a machine.";
  if (typeof t.source !== "string" || !t.source.trim()) return "There is no English here to translate.";
  if (typeof t.text !== "string") return "Write the translation.";
  const text = t.text.trim();
  if (!text) return "Write the translation, or leave the English.";
  if (text.length > target.cap) return `That is ${text.length} characters; this field holds ${target.cap}.`;
  if (CONTROL.test(text)) return "The translation holds a character that cannot be shown.";
  if (MARKUP.test(text) && !MARKUP.test(t.source)) return "A translation is plain words; it may not add markup.";
  const want = placeholders(t.source);
  const got = placeholders(text);
  if (want.join(",") !== got.join(",")) {
    return want.length ? `Keep the words in braces exactly as they are: ${want.map((w) => `{${w}}`).join(", ")}.` : "The English has no words in braces, so the translation may not add any.";
  }
  if (bolds(text) !== bolds(t.source)) return "Keep the same **bold** words as the English.";
  return null;
}
