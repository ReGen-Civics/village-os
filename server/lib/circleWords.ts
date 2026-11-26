/**
 * A VIEWER'S CIRCLES IN THEIR LANGUAGE (the lead's Spanish audit, 26 Nov 2026; the coordinator's ruling (A)).
 *
 * Circle names and purposes take a translation (shared/villageDocTranslation.ts, ref "circles"), but the set of
 * circles is not public: /api/org and /api/circles each choose which circles a viewer may see. So the translation
 * is never served on its own. Those two routes hand this the circles they ALREADY chose, and it lays over them:
 *
 *   - only translations a person accepted (status "approved"); a machine draft never reaches a reader here;
 *   - only where the English it was written against is still the English (a renamed circle reads its new
 *     English until somebody translates the new name);
 *   - only onto circles in the list it was given, so it can never add one, or a word for one, the viewer could
 *     not see. Everything else stays as the village wrote it.
 *
 * A reader asks by sending X-Village-Locale; a read without it (every admin editor) is English, so an editor
 * can never save a translation back over the village's own words.
 */
import type { Pool } from "mysql2/promise";
import { translationTarget } from "../../shared/contentTranslation";
import { overlayVillageDoc, villageDocEnglishAt } from "../../shared/villageDocTranslation";
import { sourceHash, translationsFor } from "../repos/contentTranslations";
import { noSharedCache, readerLocale } from "./contentTranslationRead";

type Reader = Parameters<typeof readerLocale>[0];

/** `circles` with each accepted, current translation laid over it for `locale`. Pure apart from the read. */
export async function circlesInLanguage<C extends { id: string }>(pool: Pool, circles: C[], locale: string | null): Promise<C[]> {
  if (!locale || !circles.length) return circles;
  const rows = await translationsFor(pool, "village_doc", ["circles"], locale).catch(() => []);
  const shown = new Set(circles.map((c) => c.id));
  const doc = { circles };
  const fields: Record<string, string> = {};
  for (const row of rows) {
    if (row.status !== "approved") continue;
    if (!translationTarget(row.kind, row.refKey, row.field).ok) continue;
    if (!shown.has(row.field.split(".")[0])) continue;
    const english = villageDocEnglishAt("circles", doc, row.field);
    if (english === null || sourceHash(english) !== row.sourceHash) continue;
    fields[row.field] = row.text;
  }
  return Object.keys(fields).length ? (overlayVillageDoc("circles", doc, fields) as { circles: C[] }).circles : circles;
}

/** For a route: the reader's language from the request, and a response no shared cache keeps across languages. */
export async function circlesForReader<C extends { id: string }>(
  pool: Pool,
  req: Reader,
  res: { set: (k: string, v: string) => unknown },
  circles: C[],
): Promise<C[]> {
  const locale = readerLocale(req);
  if (!locale) return circles;
  noSharedCache(res);
  return circlesInLanguage(pool, circles, locale);
}
