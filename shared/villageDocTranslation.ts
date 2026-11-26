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
 *                 ref_key = "season"        field = "<seasonId>.name" | ".theme" | ".focus" | "<seasonId>.goals.<n>"
 *                 ref_key = "archetypes"    field = "<key>.name" | ".subtitle" | ".blurb" | "<key>.examples.<n>"
 *
 * "season" is the season calendar (Admin, Season) as `{ seasons: SeasonEntry[] }`; a goal is addressed by its
 * place in the season's list. The overlay also reaches `current` and `upcoming`, the shape /api/season serves.
 * "archetypes" is the village's five classes as /api/archetypes serves them, `{ archetypes: Archetype[] }`. Both
 * are public already, which is why their words can be served to any reader.
 *
 *                 ref_key = "circles"       field = "<circleId>.name" | "<circleId>.purpose"
 *
 * "circles" IS NOT PUBLIC AS A SET. Which circles a reader may see depends on who they are (circlesToShow,
 * shared/roleListing.ts), so its translation is never served on its own (PRIVATE_VILLAGE_DOCS): the routes that
 * already filter circles by viewer lay the accepted translation over what they serve (server/lib/circleWords.ts).
 *
 * Links, ids, ordering and prices that are amounts never take one: only the words a reader reads.
 */

export const VILLAGE_DOC_REFS = ["brand", "visit-config", "paths", "season", "archetypes", "circles"] as const;

/** Documents whose translation is laid only by the routes that already decide who may read them, never served whole. */
export const PRIVATE_VILLAGE_DOCS: readonly VillageDocRef[] = ["circles"];
export type VillageDocRef = (typeof VILLAGE_DOC_REFS)[number];

export const isVillageDocRef = (v: unknown): v is VillageDocRef => (VILLAGE_DOC_REFS as readonly string[]).includes(String(v));

const BRAND_FIELDS = ["heroHeadline", "heroBody", "footerBlurb", "tagline"] as const;
const VISIT_LOGISTICS = ["contact_note", "accommodation", "getting_there", "what_to_bring"] as const;
const VISIT_TYPE_FIELDS = ["title", "format", "duration", "cost", "cta_label", "description"] as const;

/**
 * A document that is a list of rows, each row addressed by its own id: its fields, and its lists of lines (a
 * season's goals, a class's examples), each line addressed by its place. `also` names single rows the served
 * shape carries beside the list (the current season), which take the same translation.
 */
interface RowList {
  list: string;
  id: string;
  fields: readonly string[];
  lines: Readonly<Record<string, ((line: unknown) => unknown) | null>>;
  also?: readonly string[];
}
const ROW_LISTS: Readonly<Record<string, RowList>> = {
  paths: { list: "paths", id: "id", fields: ["label", "role", "description"], lines: {} },
  season: { list: "seasons", id: "id", fields: ["name", "theme", "focus"], lines: { goals: (g) => obj(g).text }, also: ["current", "upcoming"] },
  archetypes: { list: "archetypes", id: "key", fields: ["name", "subtitle", "blurb"], lines: { examples: null } },
  circles: { list: "circles", id: "id", fields: ["name", "purpose"], lines: {} },
};
const PLACE = /^(0|[1-9][0-9]{0,2})$/;
const rowsOf = (d: Record<string, unknown>, spec: RowList): Record<string, unknown>[] => (Array.isArray(d[spec.list]) ? (d[spec.list] as unknown[]) : []).map(obj);

function rowFieldOk(spec: RowList, parts: string[]): boolean {
  if (!ID.test(parts[0] ?? "")) return false;
  if (parts.length === 2) return spec.fields.includes(parts[1]);
  return parts.length === 3 && parts[1] in spec.lines && PLACE.test(parts[2]);
}

function rowEnglish(spec: RowList, d: Record<string, unknown>, parts: string[]): string | null {
  const row = rowsOf(d, spec).find((r) => r[spec.id] === parts[0]);
  if (!row) return null;
  if (parts.length === 2) return words(row[parts[1]]);
  const line = (Array.isArray(row[parts[1]]) ? (row[parts[1]] as unknown[]) : [])[Number(parts[2])];
  const read = spec.lines[parts[1]];
  return words(read ? read(line) : line);
}

function rowWithWords(spec: RowList, row: unknown, parts: string[], text: string): unknown {
  const r = obj(row);
  if (r[spec.id] !== parts[0]) return row;
  if (parts.length === 2) return { ...r, [parts[1]]: text };
  const lines = Array.isArray(r[parts[1]]) ? [...(r[parts[1]] as unknown[])] : [];
  const at = Number(parts[2]);
  if (at >= lines.length) return row;
  lines[at] = spec.lines[parts[1]] ? { ...obj(lines[at]), text } : text;
  return { ...r, [parts[1]]: lines };
}

/** The longest translation a field takes: generous, since these are free text the village writes. */
export const VILLAGE_DOC_FIELD_CHARS = 2000;

const ID = /^[a-z0-9][a-z0-9_-]{0,63}$/i;
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const words = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);

/** Whether `field` of `ref` takes a translation. */
export function villageDocFieldOk(ref: string, field: string): boolean {
  const parts = field.split(".");
  if (ref === "brand") return parts.length === 2 && parts[0] === "project" && (BRAND_FIELDS as readonly string[]).includes(parts[1]);
  if (ROW_LISTS[ref]) return rowFieldOk(ROW_LISTS[ref], parts);
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
  if (ROW_LISTS[ref]) return rowEnglish(ROW_LISTS[ref], d, parts);
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
  const spec = ROW_LISTS[ref];
  if (spec) {
    for (const row of rowsOf(obj(doc), spec)) {
      const id = row[spec.id];
      if (typeof id !== "string" || !ID.test(id)) continue;
      for (const f of spec.fields) candidates.push(`${id}.${f}`);
      for (const l of Object.keys(spec.lines)) (Array.isArray(row[l]) ? (row[l] as unknown[]) : []).slice(0, 1000).forEach((_, i) => candidates.push(`${id}.${l}.${i}`));
    }
  }
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
    else if (ROW_LISTS[ref]) {
      const spec = ROW_LISTS[ref];
      if (Array.isArray(out[spec.list])) out[spec.list] = (out[spec.list] as unknown[]).map((r) => rowWithWords(spec, r, parts, text));
      for (const key of spec.also ?? []) if (out[key] && typeof out[key] === "object") out[key] = rowWithWords(spec, out[key], parts, text);
    }
    else if (field === "hero_subtitle") out.hero_subtitle = text;
    else if (parts[0] === "logistics") out.logistics = { ...obj(out.logistics), [parts[1]]: text };
    else if (Array.isArray(out.visit_types)) out.visit_types = out.visit_types.map((t) => (obj(t).id === parts[1] ? { ...obj(t), [parts[2]]: text } : t));
  }
  return out as T;
}
