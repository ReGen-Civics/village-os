/**
 * Laying a translation over the English a reader would see (Rye, 15 Nov 2026).
 * The server sends only fresh translations (server/lib/contentTranslationRead.ts);
 * these functions only place them, field by field, and leave every other word
 * in English.
 */
import type { ResolvedItem, ResolvedPage, ResolvedSection } from "./pageContent/types";
import type { RoleCardSections } from "./roleCardSections";

/** What the server sends for one role card (`translation` on GET /api/org/role-card/:id). */
export interface RoleCardTranslationWire {
  seat: Record<string, string | string[]>;
  sections: Partial<RoleCardSections>;
  machine: string[];
  locale: string;
}

/** What the server sends for one page (GET /api/content/:section/translation). */
export interface PageTranslationWire {
  fields: Record<string, string>;
  machine: string[];
  locale: string;
}

const isStrings = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === "string");

/** Read a role card's translation off the wire; null when it is absent or malformed. */
export function readRoleCardTranslation(v: unknown): RoleCardTranslationWire | null {
  if (!v || typeof v !== "object") return null;
  const t = v as Record<string, unknown>;
  if (typeof t.locale !== "string" || !t.seat || typeof t.seat !== "object" || !t.sections || typeof t.sections !== "object") return null;
  const seat: Record<string, string | string[]> = {};
  for (const [k, x] of Object.entries(t.seat as Record<string, unknown>)) if (typeof x === "string" || isStrings(x)) seat[k] = x;
  return { seat, sections: t.sections as Partial<RoleCardSections>, machine: isStrings(t.machine) ? t.machine : [], locale: t.locale };
}

/** Read a page's translation off the wire; null when it is absent or malformed. */
export function readPageTranslation(v: unknown): PageTranslationWire | null {
  if (!v || typeof v !== "object") return null;
  const t = v as Record<string, unknown>;
  if (typeof t.locale !== "string" || !t.fields || typeof t.fields !== "object") return null;
  const fields: Record<string, string> = {};
  for (const [k, x] of Object.entries(t.fields as Record<string, unknown>)) if (typeof x === "string") fields[k] = x;
  return { fields, machine: isStrings(t.machine) ? t.machine : [], locale: t.locale };
}

/** The role as the card draws it, in the reader's language where it is translated. */
export function overlaySeat<T extends Record<string, unknown>>(seat: T, t: RoleCardTranslationWire | null): T {
  return t && Object.keys(t.seat).length ? { ...seat, ...t.seat } : seat;
}

/** The founding sections as the card draws them, in the reader's language where translated. */
export function overlaySections(sections: RoleCardSections | null, t: RoleCardTranslationWire | null): RoleCardSections | null {
  if (!sections || !t) return sections;
  return { ...sections, ...t.sections };
}

/** A page's words before `{words}` are filled, with its translated fields laid over them. */
export function overlayPageRaw(raw: ResolvedPage, fields: Readonly<Record<string, string>>): ResolvedPage {
  const entries = Object.entries(fields);
  if (!entries.length) return raw;
  const out: Record<string, ResolvedSection> = { ...raw };
  for (const [address, words] of entries) {
    const parts = address.split(".");
    const section = out[parts[0]];
    if (!section) continue;
    if (parts.length === 2) {
      if (!(parts[1] in section.fields)) continue;
      out[parts[0]] = { ...section, fields: { ...section.fields, [parts[1]]: words } };
    } else if (parts.length === 4) {
      const rows = section.lists[parts[1]];
      if (!rows) continue;
      const i = /^\d+$/.test(parts[2]) ? Number(parts[2]) : rows.findIndex((r) => r.id === parts[2]);
      if (i < 0 || i >= rows.length || !(parts[3] in rows[i])) continue;
      const next = rows.map((r, j) => (j === i ? ({ ...r, [parts[3]]: words } as ResolvedItem) : r));
      out[parts[0]] = { ...section, lists: { ...section.lists, [parts[1]]: next } };
    }
  }
  return out;
}
