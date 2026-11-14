/**
 * THE FOUNDING SECTIONS' STORE (phase A, lane A3): one `app_config` document,
 * `role-card-sections`, holding each role's sections (shared/roleCardSections.ts)
 * and who last saved them. No migration: the document is the village's data,
 * written only by the role editor's save, through the editor's own gate
 * (server/routes/roleEdit.ts).
 *
 * "Last edited by" is the newest of three things: the newest published edit to
 * the role's words or details (its draft history), the newest save of these
 * sections, and the newest write to the card's words outside the editor (an
 * admin's or an agent's, `stampCardEdit`, kept in the same document). The person is named by first name, and only to a reader the
 * village lets read names (`peopleShown`); everyone else reads the day alone.
 */
import type { Pool } from "mysql2/promise";
import { dbDocument } from "../repos/store-db";
import { firstNames, roleDraftRows } from "../repos/roleEditHistory";
import {
  cardEditOf,
  newerEdit,
  sameSections,
  sectionsFromDoc,
  SECTIONS_DOC_KEY,
  type RoleCardSections,
  type SectionsDoc,
  type SectionsEdit,
} from "../../shared/roleCardSections";

/** The document as stored, every key kept. */
async function loadRaw(pool: Pool): Promise<Record<string, unknown>> {
  const doc = dbDocument<SectionsDoc & Record<string, unknown>>(pool, SECTIONS_DOC_KEY, { roles: {} });
  await doc.load();
  const v = doc.get();
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

/**
 * Record that a role card's words or details were written outside the role
 * editor (PUT /api/admin/org/roles/:id: an admin, or an agent acting as one),
 * so "Last edited" moves with it. Keeps every other key of the document.
 */
export async function stampCardEdit(pool: Pool, roleId: string, userId: string | null, now = new Date()): Promise<void> {
  const doc = dbDocument<SectionsDoc & Record<string, unknown>>(pool, SECTIONS_DOC_KEY, { roles: {} });
  await doc.load();
  const held = (doc.get() ?? { roles: {} }) as SectionsDoc & Record<string, unknown>;
  const edits = held.cardEdits && typeof held.cardEdits === "object" && !Array.isArray(held.cardEdits) ? { ...held.cardEdits } : {};
  edits[roleId] = { by: userId, at: now.toISOString() };
  await doc.put({ ...held, roles: held.roles ?? {}, cardEdits: edits });
}

async function loadDoc(pool: Pool): Promise<SectionsDoc> {
  const doc = dbDocument<SectionsDoc & Record<string, unknown>>(pool, SECTIONS_DOC_KEY, { roles: {} });
  await doc.load();
  const v = doc.get();
  return v && typeof v.roles === "object" && v.roles && !Array.isArray(v.roles) ? { roles: v.roles } : { roles: {} };
}

/** One role's sections and their last save. Empty sections for a role with none. */
export async function sectionsFor(pool: Pool, roleId: string): Promise<{ sections: RoleCardSections; edited: SectionsEdit | null }> {
  return sectionsFromDoc(await loadDoc(pool), roleId);
}

/** Many roles' sections in one read, by id. */
export async function sectionsForMany(pool: Pool, roleIds: readonly string[]): Promise<Map<string, RoleCardSections>> {
  const doc = await loadDoc(pool);
  const out = new Map<string, RoleCardSections>();
  for (const id of roleIds) out.set(id, sectionsFromDoc(doc, id).sections);
  return out;
}

/**
 * Save one role's sections, already read by `readSections`. A save that
 * changes nothing writes nothing and answers false.
 */
export async function saveSections(pool: Pool, roleId: string, next: RoleCardSections, userId: string, now = new Date()): Promise<boolean> {
  const doc = dbDocument<SectionsDoc & Record<string, unknown>>(pool, SECTIONS_DOC_KEY, { roles: {} });
  await doc.load();
  const held = doc.get();
  const roles = held && typeof held.roles === "object" && held.roles && !Array.isArray(held.roles) ? { ...held.roles } : {};
  const before = sectionsFromDoc({ roles }, roleId).sections;
  if (sameSections(before, next)) return false;
  roles[roleId] = { sections: next, edited: { by: userId, at: now.toISOString() } };
  await doc.put({ ...held, roles });
  return true;
}

export interface LastEdited {
  /** First name, or null when this reader does not read names or nobody is on record. */
  by: string | null;
  /** The civil day, year-month-day. */
  on: string;
}

/** Who last changed this role's card, and when: its newest live edit or its newest sections save. */
export async function lastEditedOf(pool: Pool, roleId: string, opts: { peopleShown: boolean }): Promise<LastEdited | null> {
  const [rows, raw] = await Promise.all([roleDraftRows(pool, roleId, 1), loadRaw(pool)]);
  const top = rows.find((r) => r.status === "published" && r.publishedAt);
  const fromDraft: SectionsEdit | null = top && top.publishedAt ? { by: top.publishedBy, at: new Date(top.publishedAt).toISOString() } : null;
  const mine = sectionsFromDoc(raw, roleId);
  const newest = newerEdit(newerEdit(fromDraft, mine.edited), cardEditOf(raw, roleId));
  if (!newest) return null;
  let by: string | null = null;
  if (opts.peopleShown && newest.by) by = (await firstNames(pool, [newest.by])).get(newest.by) || null;
  return { by, on: newest.at.slice(0, 10) };
}
