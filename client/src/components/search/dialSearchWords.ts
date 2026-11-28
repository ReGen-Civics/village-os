/**
 * A DIAL IN SEARCH, IN THE READER'S LANGUAGE.
 *
 * Admin search and Find anything are handed every dial as a search entry by the server, in English: its label, its
 * description, its key and its category (`dialEntry`, shared/adminSearch.ts). The rest of the registry arrives
 * already in the reader's language (shared/adminActsWords.ts). A dial's words in another language are the Game
 * Mechanics page's (client/src/pages/gameMechanicsDialWords.ts, Lingui messages by dial key), so they are translated
 * once, there, and laid over the served entries here:
 *
 *   the title      the page's label for that dial
 *   the line       the page's description, clipped as the server clips the English
 *   the synonyms   the category in the reader's language, then the English label, then what the server sent
 *                  (the key and the English category), so the English words still find it
 *
 * THE WORDS LOAD LAZILY, and only for a reader whose language is not English: a dynamic import of the page's own
 * words module, the first time a search opens. A reader of English never fetches it and gets the served list back
 * as it is, so no first page's scripts grow. A dial the page has no words for stays as the server sent it.
 */
import type { I18n, MessageDescriptor } from "@lingui/core";
import { useEffect, useState } from "react";

/** One dial's words in the reader's language. */
export interface DialSearchWords {
  label: string;
  description: string;
}

/** Reads the Game Mechanics page's words in the active language. */
export interface DialWordsReader {
  /** A dial's label and description by its key, or null when the page has no words for it. */
  dial(key: string): DialSearchWords | null;
  /** A category's name by its English name, or null when the page has none. */
  category(english: string): string | null;
}

/** The part of the page's words module this reads (client/src/pages/gameMechanicsDialWords.ts). */
export interface DialWordsModule {
  DIAL_WORDS: Readonly<Record<string, { label: MessageDescriptor; description: MessageDescriptor }>>;
  DIAL_CATEGORY_WORDS: Readonly<Record<string, MessageDescriptor>>;
}

/** The clip `dialEntry` gives a dial's English description (shared/adminSearch.ts). */
export const DIAL_HELP_MAX = 240;

export const readsEnglish = (locale: string | null | undefined): boolean => !locale || locale === "en" || locale.startsWith("en-");

const own = <T,>(table: Readonly<Record<string, T>>, key: string): T | undefined =>
  Object.prototype.hasOwnProperty.call(table, key) ? table[key] : undefined;

/** A reader over the page's words, drawing each through the catalog at the moment it is asked. */
export function dialWordsReader(words: DialWordsModule, i18n: I18n): DialWordsReader {
  return {
    dial(key) {
      const w = own(words.DIAL_WORDS, key);
      return w ? { label: i18n._(w.label), description: i18n._(w.description) } : null;
    },
    category(english) {
      const c = own(words.DIAL_CATEGORY_WORDS, english);
      return c ? i18n._(c) : null;
    },
  };
}

/** The dial an entry names: admin search's `dial.<key>` or Find anything's `setting:dial.<key>`. Null: not a dial. */
export function dialKeyOf(id: string): string | null {
  const m = /^(?:setting:)?dial\.(.+)$/.exec(id);
  return m ? m[1] : null;
}

interface Found {
  id: string;
  title: string;
  help: string;
  synonyms?: readonly string[];
}

/**
 * The served entries with each dial in the reader's language. With no reader (English, or the words not loaded
 * yet) the same list comes back. An entry that is not a dial, or a dial the page has no words for, is untouched.
 */
export function localizeDialEntries<E extends Found>(entries: readonly E[], read: DialWordsReader | null): readonly E[] {
  if (!read) return entries;
  return entries.map((e) => {
    const key = dialKeyOf(e.id);
    const w = key ? read.dial(key) : null;
    if (!w) return e;
    const english = e.synonyms ?? [];
    const seen = new Set<string>([w.label.trim().toLowerCase()]);
    const synonyms: string[] = [];
    // The category in the reader's language first, then the English label, then the key and the English category.
    for (const s of [...english.map((x) => read.category(x) ?? ""), e.title, ...english]) {
      const k = s.trim().toLowerCase();
      if (!k || seen.has(k)) continue;
      seen.add(k);
      synonyms.push(s);
    }
    // The English label always stays findable, even where the language keeps the same word.
    if (!synonyms.includes(e.title)) synonyms.push(e.title);
    return { ...e, title: w.label, help: w.description.slice(0, DIAL_HELP_MAX), synonyms };
  });
}

type Loader = () => Promise<DialWordsModule>;

/** The page's own words module, fetched on demand. One chunk, shared with the Game Mechanics page. */
const loadWordsModule: Loader = () => import("@/pages/gameMechanicsDialWords");

let pending: Promise<DialWordsModule> | null = null;

/**
 * The dials' words for this reader, or null for a reader of English, who is never sent them. A load that fails
 * resolves null and may be tried again: search keeps working on the English it was served.
 */
export function loadDialWords(locale: string, i18n: I18n, loader: Loader = loadWordsModule): Promise<DialWordsReader | null> {
  if (readsEnglish(locale)) return Promise.resolve(null);
  const loading = loader === loadWordsModule ? (pending ??= loader()) : loader();
  return loading.then(
    (m) => dialWordsReader(m, i18n),
    () => {
      if (loader === loadWordsModule) pending = null;
      return null;
    },
  );
}

/**
 * The dials' words once they are wanted (the search is open and has dials to show) and the reader's language is not
 * English. Null until they arrive, and always null in English.
 */
export function useDialSearchWords(locale: string, i18n: I18n, wanted: boolean, loader?: Loader): DialWordsReader | null {
  const [got, setGot] = useState<{ locale: string; read: DialWordsReader } | null>(null);
  useEffect(() => {
    if (!wanted || readsEnglish(locale)) return;
    let live = true;
    void loadDialWords(locale, i18n, loader).then((read) => {
      if (live && read) setGot({ locale, read });
    });
    return () => {
      live = false;
    };
  }, [wanted, locale, i18n, loader]);
  return wanted && got && got.locale === locale && !readsEnglish(locale) ? got.read : null;
}
