/**
 * THE REGISTRY OF ACTS IN THE READER'S LANGUAGE (shared/adminActs.ts holds the registry, in English).
 *
 * Admin search and Find anything match what a person types against an entry's title, help and synonyms. Those were
 * English only, so a founder who reads the app in Spanish typed Spanish and found nothing. The words tables under
 * shared/adminActs/<language>/ give every entry that is not a dial its title, its line and the words a reader of
 * that language would type. `localizeEntry` lays one over an entry the moment a search route serves it.
 *
 *   the title and the line   the reader's language
 *   the synonyms             the reader's language first, then the English title, then the English synonyms, so the
 *                            English words still find it
 *
 * A language with no table, or an id the table does not hold, gets the entry back unchanged: the same object.
 *
 * DIALS ARE NOT HERE. A dial's words in another language are the Game Mechanics page's own
 * (client/src/pages/gameMechanicsDialWords.ts), and the browser lays them over the dial entries it is served
 * (client/src/components/search/dialSearchWords.ts), so each dial is translated once.
 *
 * Only the server reads this file: the tables are server data, and the browser is handed its own list already in
 * its language by GET /api/admin/search-index and GET /api/search/index.
 *
 * Pure: no I/O, no clock.
 */
import type { AdminSearchEntry } from "./adminSearch";
import type { ActWords } from "./adminActs/types";
import { ADMIN_ACT_WORDS_ES } from "./adminActs/es";

export type { ActWords };

/** The words tables, by language. A language joins by adding its folder under shared/adminActs/ and a row here. */
export const ADMIN_ACT_WORDS: Readonly<Record<string, Readonly<Record<string, ActWords>>>> = {
  es: ADMIN_ACT_WORDS_ES,
};

const own = <T,>(table: Readonly<Record<string, T>>, key: string): T | undefined =>
  Object.prototype.hasOwnProperty.call(table, key) ? table[key] : undefined;

/** The table a locale reads: its own, or its language's ("es-CR" reads "es"). Undefined: the English as it stands. */
function tableFor(locale: string | null | undefined): Readonly<Record<string, ActWords>> | undefined {
  if (!locale) return undefined;
  return own(ADMIN_ACT_WORDS, locale) ?? own(ADMIN_ACT_WORDS, locale.split("-")[0].toLowerCase());
}

/** The languages the registry has words in, beside English. */
export const ACT_WORD_LOCALES: readonly string[] = Object.keys(ADMIN_ACT_WORDS);

/** True when the registry has words in this reader's language, so a route knows its answer differs by language. */
export function hasActWords(locale: string | null | undefined): boolean {
  return !!tableFor(locale);
}

/**
 * One entry in the reader's language. Its title and its line are the table's; its synonyms are the table's, then
 * the English title, then the English synonyms. Anything else about the entry (its id, its address, the key and the
 * module it names) is untouched. Another language, or an id the table does not hold: the same object, unchanged.
 */
export function localizeEntry<E extends Pick<AdminSearchEntry, "id" | "title" | "help" | "synonyms">>(entry: E, locale: string | null | undefined): E {
  const table = tableFor(locale);
  const w = table ? own(table, entry.id) : undefined;
  if (!w) return entry;
  const seen = new Set<string>();
  const synonyms: string[] = [];
  for (const s of [...w.synonyms, entry.title, ...entry.synonyms]) {
    const key = s.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    synonyms.push(s);
  }
  return { ...entry, title: w.title, help: w.help, synonyms };
}
