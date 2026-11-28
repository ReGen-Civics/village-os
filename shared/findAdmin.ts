/**
 * FIND ANYTHING FOR AN ADMIN: people and codes (the wiring between Find anything and the Admin Garden's registry).
 *
 * The registry of acts (shared/adminActs.ts) reaches the dialog through the index the server builds. These two do
 * not, on purpose:
 *
 *   people   the dialog reads the Players page's own route, so an admin searching people sees what that page already
 *            shows them, its own door answers, and nobody else is handed a name. Names and addresses stay in the
 *            admin's browser: nothing here is sent anywhere, and the guide is never given a person.
 *   codes    a review code (B-71, B-71.2) opens the Review page's own lookup, which answers only for what the
 *            reader may see. A code that does not exist and one they may not see answer the same there.
 *
 * Pure: no I/O, no clock. The dialog imports this file, so it carries no table and nothing of the registry.
 */
import type { FindEntry } from "./findAnything";

/** The Players page's own read. Only an admin's dialog asks it, and its own door answers. */
export const FIND_ROSTER_URL = "/api/admin/players";

/** The Review page with one code looked up (client/src/pages/AdminReview.tsx reads `find`). */
export const findCodePath = (code: string): string => `/admin/review?find=${encodeURIComponent(code)}`;

/**
 * The review code typed words read as, in its shown form, or null: "b27", "B 27", "b-27.2" and "B-27.2" are codes.
 * The same rule as `normalizeCode` (shared/proposedChanges.ts), written again here so the dialog's chunk does not
 * carry that file; a test holds the two equal.
 */
export function findCode(raw: string): string | null {
  const m = /^b[\s-]*(\d{1,6})(?:\s*\.\s*(\d{1,4}))?$/i.exec(String(raw ?? "").trim());
  if (!m) return null;
  return m[2] ? `B-${Number(m[1])}.${Number(m[2])}` : `B-${Number(m[1])}`;
}

/** One row of the Players page's read, as far as search uses it. */
export interface RosterPerson {
  id: string;
  name: string;
  email?: string | null;
  handle?: string | null;
}

/**
 * The roster as people an admin can find: by name, by handle and by email address. Somebody the index already
 * holds (an admitted member, by handle) keeps their profile's address and gains the words; everybody else lands
 * on the Players page. The addresses stay in the admin's own browser: nothing here is sent anywhere.
 */
export function withRoster(entries: readonly FindEntry[], roster: readonly RosterPerson[], playersPath: string, playersLine: string): FindEntry[] {
  const byHandle = new Map<string, RosterPerson>();
  for (const p of roster) if (p.handle) byHandle.set(`person:${p.handle}`, p);
  const known = new Set<string>();
  const out = entries.map((e) => {
    const p = e.kind === "person" ? byHandle.get(e.id) : undefined;
    if (!p) return e;
    known.add(String(p.id));
    return { ...e, synonyms: [...(e.synonyms ?? []), ...(p.email ? [p.email] : []), ...(p.handle ? [p.handle] : [])] };
  });
  for (const p of roster) {
    const name = String(p.name ?? "").trim();
    if (!name || known.has(String(p.id))) continue;
    out.push({ id: `person:player:${p.id}`, kind: "person", title: name.slice(0, 120), help: playersLine, path: playersPath, synonyms: [...(p.email ? [p.email] : []), ...(p.handle ? [p.handle] : [])] });
  }
  return out;
}
