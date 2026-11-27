/**
 * WHAT A READER IN ANOTHER LANGUAGE SEES of a village's own words
 * (Rye, 15 Nov 2026). The rows are in `content_translations`
 * (server/repos/contentTranslations.ts); the rules in shared/contentTranslation.ts.
 *
 * A translation is shown only while it is a translation of the English the
 * reader would otherwise see: its `source_hash` must match the hash of that
 * English, worked out here from the live row. A card edited since its
 * translation falls back to the English, field by field, until somebody
 * translates the new words.
 *
 * A machine draft is shown, and named in `machine`, so the page can mark it
 * (Rye, 15 Nov). The test is "not approved", never "is ai_draft": a row whose
 * status is anything but a person's approval is read as a machine's and
 * marked, so an unknown or mistyped status can never reach a reader
 * unmarked, and approved words never carry the mark.
 *
 * THE READER ASKS. The client sends `X-Village-Locale` only on the reads a
 * visitor sees (the role card, a page's words). An editor's read never sends
 * it, so the English an editor loads, and saves back, is always the English.
 */
import { villageDocEnglishAt } from "../../shared/villageDocTranslation";
import type { Pool } from "mysql2/promise";
import { PROTECTED_PAGES, ROLE_CARD_LIST_FIELDS, translatableLocales, translationTarget } from "../../shared/contentTranslation";
import { PAGE_SECTION_PREFIX, pageSpecForSection } from "../../shared/pageContent";
import { resolvePageRaw } from "../../shared/pageContent/resolve";
import type { RoleCardSections } from "../../shared/roleCardSections";
import { sourceHash, translationsFor, type ContentTranslationRow } from "../repos/contentTranslations";

export const LOCALE_HEADER = "x-village-locale";

/**
 * A swapped answer differs by the reader's language, so no cache may hand one
 * reader's language to another: never stored (`no-store`), and keyed on the
 * header for any cache that keys at all (`Vary`). Docs/PROVISIONING.md §9b's
 * Cloudflare rule caches only `/api/i18n/catalog/.../part/` and passes the
 * rest of `/api/` through, so it never sees these.
 */
export function noSharedCache(res: { set: (k: string, v: string) => unknown }): void {
  res.set("Cache-Control", "no-store");
  res.set("Vary", "X-Village-Locale");
}

/** The locale a reader asked for, when it is one this village translates into. Null reads the English. */
export function readerLocale(req: { get?: (h: string) => string | undefined; headers?: Record<string, unknown> }): string | null {
  const raw = req.get ? req.get(LOCALE_HEADER) : (req.headers?.[LOCALE_HEADER] as string | undefined);
  if (typeof raw !== "string") return null;
  const tag = raw.trim();
  return translatableLocales().includes(tag) ? tag : null;
}

/** The org_roles column a field address names, as the role reads it in the API. */
const ROLE_FIELD: Readonly<Record<string, string>> = {
  name: "name",
  aim: "aim",
  domain: "domain",
  why_it_matters: "whyItMatters",
  authority: "authority",
  first_year_outcomes: "firstYearOutcomes",
  first_90_day_outcomes: "first90DayOutcomes",
  location_expectations: "locationExpectations",
  compensation_reality: "compensationReality",
  evidence_required: "evidenceRequired",
  exists_while: "existsWhile",
  signs_stretched: "signsStretched",
  flows_back: "flowsBack",
  step_back: "stepBack",
  time_commitment: "timeCommitment",
  accountabilities: "accountabilities",
  authorities: "authorities",
  responsibilities: "responsibilities",
  bring_me: "bringMe",
  not_mine: "notMine",
};

const LISTS: ReadonlySet<string> = new Set(ROLE_CARD_LIST_FIELDS);

const text = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v : null);

/** Marked as a machine translation unless a person approved it: fails toward the mark. */
export const machineWritten = (row: Pick<ContentTranslationRow, "status">): boolean => row.status !== "approved";

/** Is this row a translation of exactly this English? */
const fresh = (row: ContentTranslationRow, english: string | null) => english !== null && sourceHash(english) === row.sourceHash;

export interface RoleCardTranslation {
  /** The role's fields in the reader's language, keyed as the API names them. Lists are whole, English where a line has none. */
  seat: Record<string, string | string[]>;
  /** The founding sections' words in the reader's language. */
  sections: Partial<Pick<RoleCardSections, "aiSupport" | "payNote" | "paySplitNote" | "idealBackground" | "qualities" | "payShape">>;
  /** The addresses shown from a machine draft ("role_card:aim"), for the page to mark. */
  machine: string[];
  locale: string;
  /** Set on a binding page: these words are its reading copy, and the English stays the binding text. */
  readingCopy?: true;
}

/**
 * One role card in the reader's language: only the fields that have a fresh
 * translation. Null when nothing on the card is translated.
 */
export async function roleCardTranslation(
  pool: Pool,
  role: Record<string, unknown> & { id: string },
  sections: RoleCardSections | null,
  locale: string,
): Promise<RoleCardTranslation | null> {
  const [cardRows, sectionRows] = await Promise.all([
    translationsFor(pool, "role_card", [role.id], locale),
    sections ? translationsFor(pool, "role_card_sections", [role.id], locale) : Promise.resolve([]),
  ]);
  const out: RoleCardTranslation = { seat: {}, sections: {}, machine: [], locale };
  const take = (row: ContentTranslationRow) => {
    if (machineWritten(row)) out.machine.push(`${row.kind}:${row.field}`);
  };

  for (const row of cardRows) {
    if (!translationTarget(row.kind, row.refKey, row.field).ok) continue;
    const [col, n] = row.field.split(".");
    const key = ROLE_FIELD[col];
    if (!key) continue;
    if (LISTS.has(col)) {
      const english = Array.isArray(role[key]) ? (role[key] as unknown[]).map(String) : [];
      const i = Number(n);
      if (!fresh(row, text(english[i]))) continue;
      const lines = (out.seat[key] as string[] | undefined) ?? [...english];
      lines[i] = row.text;
      out.seat[key] = lines;
    } else {
      if (n !== undefined || !fresh(row, text(role[key]))) continue;
      out.seat[key] = row.text;
    }
    take(row);
  }

  if (sections) {
    for (const row of sectionRows) {
      if (!translationTarget(row.kind, row.refKey, row.field).ok) continue;
      const [key, n, sub] = row.field.split(".");
      if (key === "aiSupport" || key === "payNote" || key === "paySplitNote") {
        if (!fresh(row, text(sections[key]))) continue;
        out.sections[key] = row.text;
      } else if (key === "idealBackground" || key === "qualities") {
        const english = sections[key] ?? [];
        if (!fresh(row, text(english[Number(n)]))) continue;
        const lines = out.sections[key] ?? [...english];
        lines[Number(n)] = row.text;
        out.sections[key] = lines;
      } else if (key === "payShape" && sub === "label") {
        const english = sections.payShape ?? [];
        const share = english[Number(n)];
        if (!share || !fresh(row, text(share.label))) continue;
        const shares = out.sections.payShape ?? english.map((s) => ({ ...s }));
        shares[Number(n)] = { ...shares[Number(n)], label: row.text };
        out.sections.payShape = shares;
      } else continue;
      take(row);
    }
  }

  return Object.keys(out.seat).length || Object.keys(out.sections).length ? out : null;
}

export interface PageTranslation {
  /** Field address ("intro.title", "steps.items.apply.body") to its words in the reader's language, before `{words}` are filled. */
  fields: Record<string, string>;
  /** The addresses shown from a machine draft. */
  machine: string[];
  locale: string;
}

/** The English a page shows at a field address, before `{words}` are filled; null when there is none. */
export function pageEnglishAt(section: string, stored: unknown, address: string): string | null {
  const spec = pageSpecForSection(section);
  if (!spec) return null;
  const raw = resolvePageRaw(spec, stored);
  const parts = address.split(".");
  const s = raw[parts[0]];
  if (!s) return null;
  if (parts.length === 2) return text(s.fields[parts[1]]);
  if (parts.length === 4) {
    const rows = s.lists[parts[1]] ?? [];
    const row = /^\d+$/.test(parts[2]) ? rows[Number(parts[2])] : rows.find((r) => r.id === parts[2]);
    return row ? text(row[parts[3]]) : null;
  }
  return null;
}

/** A page's words in the reader's language, or a binding page's reading copy (marked). Null when there are none. */
export async function pageTranslation(pool: Pool, section: string, stored: unknown, locale: string): Promise<PageTranslation | null> {
  if (!section.startsWith(PAGE_SECTION_PREFIX)) return null;
  if (!pageSpecForSection(section)) return null;
  // A binding page has no translation, only its reading copy, and only the lines a person accepted.
  const binding = PROTECTED_PAGES.includes(section.slice(PAGE_SECTION_PREFIX.length));
  const rows = await translationsFor(pool, binding ? "reading_copy" : "page_section", [section], locale);
  const out: PageTranslation = { fields: {}, machine: [], locale, ...(binding ? { readingCopy: true as const } : {}) };
  for (const row of rows) {
    if (binding && row.status !== "approved") continue;
    if (!translationTarget(row.kind, row.refKey, row.field).ok) continue;
    if (!fresh(row, pageEnglishAt(section, stored, row.field))) continue;
    out.fields[row.field] = row.text;
    if (machineWritten(row)) out.machine.push(row.field);
  }
  return Object.keys(out.fields).length ? out : null;
}

/** The village's words outside its pages in the reader's language (shared/villageDocTranslation.ts). Null when there are none. */
export async function villageDocTranslation(pool: Pool, ref: string, doc: unknown, locale: string): Promise<PageTranslation | null> {
  const rows = await translationsFor(pool, "village_doc", [ref], locale);
  const out: PageTranslation = { fields: {}, machine: [], locale };
  for (const row of rows) {
    if (!translationTarget(row.kind, row.refKey, row.field).ok) continue;
    if (!fresh(row, villageDocEnglishAt(ref, doc, row.field))) continue;
    out.fields[row.field] = row.text;
    if (machineWritten(row)) out.machine.push(row.field);
  }
  return Object.keys(out.fields).length ? out : null;
}
