/**
 * THE ENGLISH A TRANSLATION IS OF, read live (Rye, 15 Nov 2026). Every write
 * of a translation, by a person, a machine or an accepted suggestion, takes
 * its English from here, never from the request: the hash a translation keeps
 * is of the words the village says now.
 *
 * `translatableFields` lists every field of one role card or one page that
 * takes a translation and has English to translate, with how it is protected.
 * Binding pages, links and empty fields are not on it.
 */
import { isVillageDocRef, villageDocFields } from "../../shared/villageDocTranslation";
import type { Pool } from "mysql2/promise";
import { PROTECTED_PAGES, ROLE_CARD_LIST_FIELDS, ROLE_CARD_TEXT_FIELDS, translationTarget, type ContentKind, type Protection } from "../../shared/contentTranslation";
import { PAGE_SECTION_PREFIX, pageSpecForSection } from "../../shared/pageContent";
import { resolvePageRaw } from "../../shared/pageContent/resolve";
import { hasSections } from "../../shared/roleCardSections";
import { listOrgRoles } from "./orgChart";
import { sectionsFor } from "./roleCardSections";

export interface SourceField {
  field: string;
  english: string;
  protection: Protection;
}

const text = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v : null);

/** The API's name for each org_roles column a translation names. */
const ROLE_KEY: Readonly<Record<string, string>> = {
  name: "name", aim: "aim", domain: "domain", why_it_matters: "whyItMatters", authority: "authority",
  first_year_outcomes: "firstYearOutcomes", first_90_day_outcomes: "first90DayOutcomes",
  location_expectations: "locationExpectations", compensation_reality: "compensationReality",
  evidence_required: "evidenceRequired", exists_while: "existsWhile", signs_stretched: "signsStretched",
  flows_back: "flowsBack", step_back: "stepBack", time_commitment: "timeCommitment",
  accountabilities: "accountabilities", authorities: "authorities", responsibilities: "responsibilities",
  bring_me: "bringMe", not_mine: "notMine",
};

function keep(out: SourceField[], kind: ContentKind, refKey: string, field: string, english: unknown) {
  const words = text(english);
  if (!words) return;
  const t = translationTarget(kind, refKey, field);
  if (t.ok) out.push({ field, english: words, protection: t.protection });
}

export interface SourceReaders {
  pool: Pool;
  /** The `content` document's section, for a page. */
  contentSection: (section: string) => unknown;
  /** One of the village's own documents outside its pages, by name ("brand", "visit-config"). Absent: none is read. */
  villageDoc?: (ref: string) => unknown;
}

/**
 * Every translatable field of one ref with its English now, or null when the
 * ref is not there (no such role, an example role, no such page, a binding page).
 */
export async function translatableFields(r: SourceReaders, kind: ContentKind, refKey: string): Promise<SourceField[] | null> {
  const out: SourceField[] = [];
  if (kind === "role_card" || kind === "role_card_sections") {
    const role = (await listOrgRoles(r.pool)).find((x) => x.id === refKey);
    if (!role || role.isExample) return null;
    if (kind === "role_card") {
      const row = role as unknown as Record<string, unknown>;
      for (const col of ROLE_CARD_TEXT_FIELDS) keep(out, kind, refKey, col, row[ROLE_KEY[col]]);
      for (const col of ROLE_CARD_LIST_FIELDS) {
        const lines = row[ROLE_KEY[col]];
        if (Array.isArray(lines)) lines.forEach((l, i) => keep(out, kind, refKey, `${col}.${i}`, l));
      }
      return out;
    }
    const { sections } = await sectionsFor(r.pool, refKey);
    if (!hasSections(sections)) return out;
    keep(out, kind, refKey, "aiSupport", sections.aiSupport);
    keep(out, kind, refKey, "payNote", sections.payNote);
    keep(out, kind, refKey, "paySplitNote", sections.paySplitNote);
    sections.idealBackground.forEach((l, i) => keep(out, kind, refKey, `idealBackground.${i}`, l));
    sections.qualities.forEach((l, i) => keep(out, kind, refKey, `qualities.${i}`, l));
    sections.payShape.forEach((s, i) => keep(out, kind, refKey, `payShape.${i}.label`, s.label));
    return out;
  }
  if (kind === "village_doc") {
    if (!isVillageDocRef(refKey) || !r.villageDoc) return null;
    for (const f of villageDocFields(refKey, r.villageDoc(refKey))) keep(out, kind, refKey, f.field, f.english);
    return out;
  }
  // page_section
  if (!refKey.startsWith(PAGE_SECTION_PREFIX) || PROTECTED_PAGES.includes(refKey.slice(PAGE_SECTION_PREFIX.length))) return null;
  const spec = pageSpecForSection(refKey);
  if (!spec) return null;
  const raw = resolvePageRaw(spec, r.contentSection(refKey));
  for (const s of spec.sections) {
    for (const f of s.fields) keep(out, kind, refKey, `${s.id}.${f.key}`, raw[s.id]?.fields[f.key]);
    for (const l of s.lists ?? []) {
      (raw[s.id]?.lists[l.key] ?? []).forEach((row, i) => {
        const at = row.id ?? String(i);
        for (const f of l.fields) keep(out, kind, refKey, `${s.id}.${l.key}.${at}.${f.key}`, row[f.key]);
      });
    }
  }
  return out;
}

/** The English of one field now, or null. */
export async function englishOf(r: SourceReaders, kind: ContentKind, refKey: string, field: string): Promise<SourceField | null> {
  return (await translatableFields(r, kind, refKey))?.find((f) => f.field === field) ?? null;
}
