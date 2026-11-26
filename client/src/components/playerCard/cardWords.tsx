/**
 * THE PLAYER CARD'S WORDS FOR THE COMPONENTS, in the reader's language (the lead, 26 Nov 2026: the whole site in
 * Spanish).
 *
 * The server says the card itself in the reader's language (server/lib/platformSpeech.ts) and sends the table's
 * fixed lines beside it as `card.words`; PlayerRoleCardView puts them in `CardWordsContext`. `useCardWords()` is
 * the table a component draws from: the English (CARD_WORDS) with those lines laid over it, and the few sentences a
 * component builds itself from what it holds (a count, a name) said here. An English reader, an older server and a
 * component drawn outside a card all read the English as it always was.
 *
 * The messages below are the server's own (shared/playerCardMessages.ts), word for word and context for context, so
 * they share its Spanish; cardWords.test.tsx holds them to it.
 */
import { createContext, useContext, useMemo } from "react";
import { i18n as appI18n, type I18n } from "@lingui/core";
import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react/macro";
import { CARD_WORDS } from "@shared/playerCard";
import { countWord } from "@shared/playerCardHero";
import type { PlayerCardWords } from "@shared/playerCardSpeak";

/** The fixed lines the server sent, for a reader in another language. Undefined draws the English. */
export const CardWordsContext = createContext<Partial<PlayerCardWords> | undefined>(undefined);

/** The sentences a component builds itself, as the server's messages. */
export const CLIENT_CARD_MESSAGES = {
  myNRoles: msg({ message: "{n, plural, one {My role} other {My # roles}}", context: "player card, my n roles" }),
  eachInFull: msg({ message: "{n, plural, one {My role in full} other {Each role in full}}", context: "player card, each in full" }),
  portraitAlt: msg({ message: "{name}'s character portrait", context: "player card, portrait alt" }),
  termsOnce: msg({ message: "Terms for all {count} roles, recorded once", context: "player card, terms once" }),
  openSheet: msg({ message: "See what makes up: {sign}", context: "player card, open sheet" }),
  ofTarget: msg({ message: "target {n}", context: "player card, of target" }),
  countWord: msg({
    message: "{n, plural, =0 {No} =1 {One} =2 {Two} =3 {Three} =4 {Four} =5 {Five} =6 {Six} =7 {Seven} =8 {Eight} =9 {Nine} =10 {Ten} =11 {Eleven} =12 {Twelve} other {#}}",
    context: "player card, tagline count of roles",
  }),
};

/** The table a component draws from, with `count` for the number words ("Two"). */
export type CardWordsForComponents = PlayerCardWords & { count: (n: number) => string };

/** The table for a reader: English, or the server's lines and these sentences in their language. */
export function cardWordsFor(fixed: Partial<PlayerCardWords> | undefined, i18n: I18n = appI18n): CardWordsForComponents {
  if (!fixed) return { ...CARD_WORDS, count: countWord };
  const M = CLIENT_CARD_MESSAGES;
  return {
    ...CARD_WORDS,
    ...fixed,
    myNRoles: (n: number) => i18n._({ ...M.myNRoles, values: { n } }),
    eachInFull: (n: number) => i18n._({ ...M.eachInFull, values: { n } }),
    portraitAlt: (name: string) => i18n._({ ...M.portraitAlt, values: { name } }),
    termsOnce: (count: string) => i18n._({ ...M.termsOnce, values: { count } }),
    openSheet: (sign: string) => i18n._({ ...M.openSheet, values: { sign } }),
    ofTarget: (n: number) => i18n._({ ...M.ofTarget, values: { n } }),
    count: (n: number) => i18n._({ ...M.countWord, values: { n } }),
  };
}

/** The card's words for a component, redrawn when the reader changes language. */
export function useCardWords(): CardWordsForComponents {
  const fixed = useContext(CardWordsContext);
  const { i18n } = useLingui();
  return useMemo(() => cardWordsFor(fixed, i18n), [fixed, i18n, i18n.locale]);
}
