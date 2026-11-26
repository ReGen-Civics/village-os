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
import { cardWordsWith, fixedCardWords, sayCardIn, type PlayerCardWords } from "../../shared/playerCardSpeak";
import { CARD_MESSAGES, type CardMessageKey } from "../../shared/playerCardMessages";
import type { PlayerCardPayload } from "../../shared/playerCardPayload";
import { HEALTH_MESSAGES, healthWordsWith, type HealthMessageKey } from "../../shared/playerCardHealthMessages";
import { PROPOSAL_MESSAGES, fixedProposalWords, proposalWordsWith, type ProposalMessageKey } from "../../shared/playerCardProposalMessages";
import { sayerFor, speakerFor } from "./catalogSpeech";
import { noSharedCache, readerLocale } from "./contentTranslationRead";

// The catalog reader lives in server/lib/catalogSpeech.ts, which imports no model; these were first written here.
export { forgetSpeakers, messageId, noticeSayFor, sayerFor } from "./catalogSpeech";

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
  const i18n = speakerFor(locale, dirs);
  const health = i18n ? healthWordsWith(sayerFor<HealthMessageKey>(i18n, HEALTH_MESSAGES)) : undefined;
  const proposalSay = i18n ? sayerFor<ProposalMessageKey>(i18n, PROPOSAL_MESSAGES) : undefined;
  const extras = { ...health, ...(proposalSay ? { proposal: proposalWordsWith(proposalSay) } : {}) };
  return {
    ...payload,
    card: {
      ...sayCardIn(payload.card, words, locale, extras),
      words: fixedCardWords(words),
      ...(proposalSay ? { proposalWords: fixedProposalWords(proposalSay) } : {}),
    },
  };
}
