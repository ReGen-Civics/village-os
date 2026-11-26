/**
 * THE PLATFORM'S OWN WORDS IN THE READER'S LANGUAGE, said on the server (the lead, 26 Nov 2026: the whole site in
 * Spanish; the coordinator the same day: server-side copy, because the client bundle is at its ceiling).
 *
 * The Spanish lives where every page's Spanish lives: the PO fragments under client/src/locales, compiled by
 * scripts/build-i18n-catalogs.mjs to dist/i18n/<locale>.json, outside dist/public. The server already serves those
 * files to the client (server/routes/i18n.ts). Here it reads them itself, by the same hashed id the client macro
 * gives a message, so a sentence said on the server and the same sentence said in a page are one translation.
 *
 * A message the catalog lacks throws, and the caller keeps that one sentence in English. A language with no catalog
 * (a build without one, a test with no dist) has no speaker at all, and everything stays English.
 */
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { setupI18n, type I18n } from "@lingui/core";
import { cardWordsWith, fixedCardWords, sayCardIn, type PlayerCardWords } from "../../shared/playerCardSpeak";
import { CARD_MESSAGES, type CardMessageKey } from "../../shared/playerCardMessages";
import type { PlayerCardPayload } from "../../shared/playerCardPayload";
import { noSharedCache, readerLocale } from "./contentTranslationRead";

/**
 * The id Lingui gives a message: the first six characters of the base64url SHA-256 of the message, a unit
 * separator and the context (@lingui/message-utils generateMessageId, a dev dependency, so the production image
 * does not carry it). server/platformSpeech.test.ts holds this to the library's answer.
 */
export function messageId(message: string, context = ""): string {
  return createHash("sha256").update(`${message}\u001F${context}`).digest("base64url").slice(0, 6);
}

/** Where the compiled catalogs are: beside the bundle in production, under dist/ from the source tree. */
function catalogDirs(): string[] {
  return [path.join(__dirname, "i18n"), path.resolve(__dirname, "..", "..", "dist", "i18n"), path.resolve(process.cwd(), "dist", "i18n")];
}

const speakers = new Map<string, I18n | null>();

/** The catalog's speaker for a language, read once. Null when there is no catalog. */
function speakerFor(locale: string, dirs: string[] = catalogDirs()): I18n | null {
  if (speakers.has(locale)) return speakers.get(locale) ?? null;
  let i18n: I18n | null = null;
  for (const dir of dirs) {
    try {
      const catalog = JSON.parse(fs.readFileSync(path.join(dir, `${locale}.json`), "utf8")) as { messages?: Record<string, unknown> };
      if (catalog && catalog.messages && typeof catalog.messages === "object") {
        i18n = setupI18n({ locale, messages: { [locale]: catalog.messages as never } });
        break;
      }
    } catch {
      // Not here; the next place, or no speaker.
    }
  }
  speakers.set(locale, i18n);
  return i18n;
}

/** Forget what was read, for a test that writes its own catalog. */
export function forgetSpeakers(): void {
  speakers.clear();
}

/** One of the given messages in a language, by its id. Throws when the catalog lacks it. */
export function sayerFor<K extends string>(i18n: I18n, table: Readonly<Record<K, { message: string; context: string }>>) {
  const ids = new Map<K, string>();
  return (key: K, values?: Record<string, unknown>): string => {
    let id = ids.get(key);
    if (!id) {
      const d = table[key];
      id = messageId(d.message, d.context);
      ids.set(key, id);
    }
    if (!(id in i18n.messages)) throw new Error(`no words for ${key}`);
    return i18n._(id, values);
  };
}

/** The player card's table in a language, or null when the language has no catalog. */
export function playerCardWordsFor(locale: string, dirs?: string[]): PlayerCardWords | null {
  const i18n = speakerFor(locale, dirs);
  return i18n ? cardWordsWith(sayerFor<CardMessageKey>(i18n, CARD_MESSAGES), locale) : null;
}

/**
 * A card payload for the reader who asked (X-Village-Locale): the card said in their language, with the fixed
 * lines the components draw beside it. An English reader, or a language with no catalog, gets the payload as built,
 * minus the record of what it was made from, which only this step reads.
 */
export function cardForReader(req: Parameters<typeof readerLocale>[0], res: Parameters<typeof noSharedCache>[0], payload: PlayerCardPayload, dirs?: string[]): PlayerCardPayload {
  const { said: _said, ...plain } = payload.card;
  const locale = readerLocale(req);
  if (!locale) return { ...payload, card: plain };
  noSharedCache(res);
  const words = playerCardWordsFor(locale, dirs);
  if (!words) return { ...payload, card: plain };
  return { ...payload, card: { ...sayCardIn(payload.card, words, locale), words: fixedCardWords(words) } };
}
