/**
 * THE ROLE WORDS' HEADINGS, in the reader's language, for the pages that print a role's words outside the player
 * card (the coordinator, 26 Nov 2026: the player card follow-ups): the role card (FullRoleCard, FoundingRoleCard) and
 * the role proposal editor (StepWords, roleWords.ts).
 *
 * The same message and context as the player card's own headings (playerCardMessages.ts), so these read the Spanish
 * the catalog already holds and need none of their own. cardHeadings.test.ts holds each one to the English in
 * CARD_WORDS and to the player card's id.
 */
// A value import of the runtime: precompileEnglish compiles the messages of a file that imports it.
import { i18n as appI18n, type I18n } from "@lingui/core";
import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react/macro";
import { useMemo } from "react";

export const CARD_HEADING_MESSAGES = {
  purpose: msg({ message: "Purpose", context: "player card, purpose" }),
  decide: msg({ message: "What I look after", context: "player card, decide" }),
  countOnMe: msg({ message: "What you can count on me for", context: "player card, count on me" }),
  bringMe: msg({ message: "Bring me", context: "player card, bring me" }),
  notMine: msg({ message: "Not mine to hold", context: "player card, not mine" }),
  runbook: msg({ message: "Runbook", context: "player card, runbook" }),
  existsWhile: msg({ message: "This role exists while", context: "player card, exists while" }),
  authorities: msg({ message: "What I can decide on my own", context: "player card, authorities" }),
  responsibilities: msg({ message: "What I do regularly", context: "player card, responsibilities" }),
  holdingWell: msg({ message: "Holding this role well", context: "player card, holding well" }),
  signsStretched: msg({ message: "Signs I'm stretched", context: "player card, signs stretched" }),
  flowsBack: msg({ message: "What flows back", context: "player card, flows back" }),
  stepBack: msg({ message: "How I can step back", context: "player card, step back" }),
  timeCommitment: msg({ message: "Commitment", context: "player card, time commitment" }),
};

export type CardHeadingKey = keyof typeof CARD_HEADING_MESSAGES;
export type CardHeadings = Record<CardHeadingKey, string>;

/** Every heading in a language. */
export function cardHeadingsIn(i18n: I18n = appI18n): CardHeadings {
  return Object.fromEntries(Object.entries(CARD_HEADING_MESSAGES).map(([k, d]) => [k, i18n._(d)])) as CardHeadings;
}

/** The headings for a component, redrawn when the reader changes language. */
export function useCardHeadings(): CardHeadings {
  const { i18n } = useLingui();
  return useMemo(() => cardHeadingsIn(i18n), [i18n, i18n.locale]);
}

/** One heading in the language active now, for a list built once at load: read it at render. */
export function cardHeadingNow(key: CardHeadingKey): string {
  return appI18n._(CARD_HEADING_MESSAGES[key]);
}
