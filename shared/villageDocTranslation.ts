/**
 * THE VILLAGE'S WORDS THAT LIVE OUTSIDE ITS PAGES, TRANSLATED (the lead, 24 Nov 2026: "ALL surfaces need to
 * have spanish translation").
 *
 * Most of a village's words are page sections (`page_section`), but a few that every visitor reads live in
 * their own documents: the homepage headline, sentence and footer line in the brand document (Admin, Make this
 * site yours, Identity), and the visit page's words in the visit-config document (Admin, Visit). This file names
 * which of their fields take a translation, how long one may be, and reads a field's English from the document,
 * so the same table, the same proposal path and the same review page serve them as serve a page.
 *
 *   village_doc   ref_key = "brand"         field = "project.heroHeadline" | "project.heroBody" | "project.footerBlurb" | "project.tagline"
 *                 ref_key = "visit-config"  field = "hero_subtitle" | "logistics.<key>" | "visit_types.<id>.<field>"
 *                 ref_key = "paths"         field = "<pathId>.label" | "<pathId>.role" | "<pathId>.description"
 *
 * "paths" is the village's names for its four ways in (Admin, Paths & Stages: a name, a second line and a
 * sentence each), served as the server reads them (server/lib/villagePaths.ts villagePaths()), as
 * `{ paths: ServedPath[] }`. The menu, the footer, the bottom bar and the path pages draw them.
 *
 * Links, ids, ordering and prices that are amounts never take one: only the words a reader reads.
 */

export const VILLAGE_DOC_REFS = ["brand", "visit-config", "paths"] as const;
export type VillageDocRef = (typeof VILLAGE_DOC_REFS)[number];

export const isVillageDocRef = (v: unknown): v is VillageDocRef => (VILLAGE_DOC_REFS as readonly string[]).includes(String(v));

const BRAND_FIELDS = ["heroHeadline", "heroBody", "footerBlurb", "tagline"] as const;
const VISIT_LOGISTICS = ["contact_note", "accommodation", "getting_there", "what_to_bring"] as const;
const VISIT_TYPE_FIELDS = ["title", "format", "duration", "cost", "cta_label", "description"] as const;
const PATH_FIELDS = ["label", "role", "description"] as const;

/** The longest translation a field takes: generous, since these are free text the village writes. */
export const VILLAGE_DOC_FIELD_CHARS = 2000;

const ID = /^[a-z0-9][a-z0-9_-]{0,63}$/i;
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const words = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);

/** Whether `field` of `ref` takes a translation. */
export function villageDocFieldOk(ref: string, field: string): boolean {
  const parts = field.split(".");
  if (ref === "brand") return parts.length === 2 && parts[0] === "project" && (BRAND_FIELDS as readonly string[]).includes(parts[1]);
  if (ref === "paths") return parts.length === 2 && ID.test(parts[0]) && (PATH_FIELDS as readonly string[]).includes(parts[1]);
  if (ref === "visit-config") {
    if (field === "hero_subtitle") return true;
    if (parts.length === 2 && parts[0] === "logistics") return (VISIT_LOGISTICS as readonly string[]).includes(parts[1]);
    if (parts.length === 3 && parts[0] === "visit_types") return ID.test(parts[1]) && (VISIT_TYPE_FIELDS as readonly string[]).includes(parts[2]);
  }
  return false;
}

/** The English a reader sees at `field` of the stored document, or null when there is none. */
export function villageDocEnglishAt(ref: string, doc: unknown, field: string): string | null {
  if (!villageDocFieldOk(ref, field)) return null;
  const d = obj(doc);
  const parts = field.split(".");
  if (ref === "brand") return words(obj(d.project)[parts[1]]);
  if (ref === "paths") return words((Array.isArray(d.paths) ? d.paths : []).map(obj).find((p) => p.id === parts[0])?.[parts[1]]);
  if (field === "hero_subtitle") return words(d.hero_subtitle);
  if (parts[0] === "logistics") return words(obj(d.logistics)[parts[1]]);
  const types = Array.isArray(d.visit_types) ? d.visit_types : [];
  const row = types.map(obj).find((t) => t.id === parts[1]);
  return row ? words(row[parts[2]]) : null;
}

/** Every field of the document that has English now, with that English. */
export function villageDocFields(ref: string, doc: unknown): Array<{ field: string; english: string }> {
  const candidates: string[] = [];
  if (ref === "brand") for (const f of BRAND_FIELDS) candidates.push(`project.${f}`);
  if (ref === "paths") for (const p of (Array.isArray(obj(doc).paths) ? (obj(doc).paths as unknown[]) : []).map(obj)) if (typeof p.id === "string" && ID.test(p.id)) for (const f of PATH_FIELDS) candidates.push(`${p.id}.${f}`);
  if (ref === "visit-config") {
    candidates.push("hero_subtitle");
    for (const k of VISIT_LOGISTICS) candidates.push(`logistics.${k}`);
    const types = Array.isArray(obj(doc).visit_types) ? (obj(doc).visit_types as unknown[]) : [];
    for (const t of types.map(obj)) if (typeof t.id === "string" && ID.test(t.id)) for (const f of VISIT_TYPE_FIELDS) candidates.push(`visit_types.${t.id}.${f}`);
  }
  const out: Array<{ field: string; english: string }> = [];
  for (const field of candidates) {
    const english = villageDocEnglishAt(ref, doc, field);
    if (english) out.push({ field, english });
  }
  return out;
}

/** A document's words with the reader's translated fields laid over them; every other word stays English. */
export function overlayVillageDoc<T>(ref: string, doc: T, fields: Readonly<Record<string, string>>): T {
  const entries = Object.entries(fields).filter(([f]) => villageDocFieldOk(ref, f));
  if (!entries.length || !doc || typeof doc !== "object") return doc;
  const out = JSON.parse(JSON.stringify(doc)) as Record<string, unknown>;
  for (const [field, text] of entries) {
    const parts = field.split(".");
    if (ref === "brand") (out.project = { ...obj(out.project), [parts[1]]: text });
    else if (ref === "paths") { if (Array.isArray(out.paths)) out.paths = out.paths.map((p) => (obj(p).id === parts[0] ? { ...obj(p), [parts[1]]: text } : p)); }
    else if (field === "hero_subtitle") out.hero_subtitle = text;
    else if (parts[0] === "logistics") out.logistics = { ...obj(out.logistics), [parts[1]]: text };
    else if (Array.isArray(out.visit_types)) out.visit_types = out.visit_types.map((t) => (obj(t).id === parts[1] ? { ...obj(t), [parts[2]]: text } : t));
  }
  return out as T;
}
