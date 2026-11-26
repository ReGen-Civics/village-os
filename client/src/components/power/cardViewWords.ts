/**
 * A ROLE CARD'S PARAMETER ROWS IN THE READER'S LANGUAGE: the mirror of `CARD_VIEW_WORDS` (shared/roleCardView.ts),
 * the labels and fixed lines of a card's rows (who can hold it, commitment, track, where, review, how it is
 * filled). Handed to `roleCardView(seat, locale, words)` by the components that draw the card, so the rows the
 * view model builds are in the reader's language. Typed off the shared table, so a key added there and not here
 * fails the compiler; cardViewWords.test.ts holds the English equal and every entry to the catalog.
 */
// A value import of the runtime: precompileEnglish compiles the messages of a file that imports it and skips one
// that only uses `msg` (client/src/components/roleCard/payBandWords.ts says the same).
import { i18n as appI18n, type I18n } from "@lingui/core";
import { msg, plural } from "@lingui/core/macro";
import type { CARD_VIEW_WORDS, CardViewWords } from "@shared/roleCardView";
import { drawWords, useWords, type WordMirror } from "@/i18n/wordTable";

export const CARD_VIEW_MIRROR: WordMirror<typeof CARD_VIEW_WORDS> = {
  labels: {
    heldBy: msg({ message: "Who can hold it", context: "role card rows: a label" }),
    commitment: msg({ message: "Commitment", context: "role card rows: a label" }),
    track: msg({ message: "Track", context: "role card rows: a label" }),
    goals: msg({ message: "Village goals it serves", context: "role card rows: a label" }),
    where: msg({ message: "Where", context: "role card rows: a label" }),
    nationality: msg({ message: "Nationality", context: "role card rows: a label" }),
    languages: msg({ message: "Languages", context: "role card rows: a label" }),
    review: msg({ message: "Review", context: "role card rows: a label" }),
    interviews: msg({ message: "How it is filled", context: "role card rows: a label" }),
    criteria: msg({ message: "Selection criteria", context: "role card rows: a label" }),
    budget: msg({ message: "Budget line", context: "role card rows: a label" }),
  },
  heldBy: {
    person: msg({ message: "A person", context: "role card rows: who can hold it" }),
    agent: msg({ message: "An agent", context: "role card rows: who can hold it" }),
    either: msg({ message: "A person or an agent", context: "role card rows: who can hold it" }),
  },
  track: {
    contractor: msg({ message: "Paid contractor", context: "role card rows: track" }),
    volunteer: msg({ message: "Volunteer", context: "role card rows: track" }),
    employee: msg({ message: "Local employee", context: "role card rows: track" }),
    ai: msg({ message: "AI", context: "role card rows: track" }),
  },
  where: {
    land: msg({ message: "On the land", context: "role card rows: where" }),
    remote: msg({ message: "Remote", context: "role card rows: where" }),
    both: msg({ message: "On the land or remote", context: "role card rows: where" }),
  },
  commitmentPct: (pct) => msg({ message: `${pct}%`, context: "role card rows: commitment, a percent" }),
  firstReviewOn: (words) => msg({ message: `First review ${words}`, context: "role card rows: review, the village's own words" }),
  firstReviewAfter: (days) => msg({ message: plural(days, { one: "First review after # day", other: "First review after # days" }), context: "role card rows: review" }),
  firstConversation: (words) => msg({ message: `First conversation: ${words}`, context: "role card rows: how it is filled" }),
  consentedBy: (circle) => msg({ message: `Paid roles are consented by ${circle}`, context: "role card rows: how it is filled" }),
  conversationsInAll: (total) => msg({ message: `${total} of conversations in all`, context: "role card rows: how it is filled, the total time" }),
};

/** The rows' words in `i18n`'s language, for code outside a component. */
export function cardViewWords(i18n: I18n = appI18n): CardViewWords {
  return drawWords(CARD_VIEW_MIRROR, i18n);
}

/** The rows' words in the reader's language. */
export function useCardViewWords(): CardViewWords {
  return useWords(CARD_VIEW_MIRROR);
}
