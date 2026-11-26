/**
 * WHAT A DECISION IS CALLED, IN THE READER'S LANGUAGE: `SUBJECT_NOUN` in ./wizardConfig.ts ("Rule change", "Who
 * sits in a role"), keyed by its English as ./wizardWords.ts keys the wizard's words. Kept apart from those so
 * the Decision page, the decision cards and the live band carry these few nouns and not the whole wizard.
 * decisionNounWords.test.ts fails on a noun with no entry.
 */
// A value import of the runtime: precompileEnglish compiles the messages of a file that imports it and skips one
// that only uses `msg` (client/src/components/roleCard/payBandWords.ts says the same).
import { i18n as appI18n, type I18n, type MessageDescriptor } from "@lingui/core";
import { msg } from "@lingui/core/macro";
import { useLingui } from "@/i18n/runtime";
import { subjectNoun } from "./wizardConfig";

export const DECISION_NOUN_WORDS: Readonly<Record<string, MessageDescriptor>> = {
  "Rule change": msg({ message: "Rule change", context: "proposal wizard" }),
  "Who holds a role, and on what terms": msg({ message: "Who holds a role, and on what terms", context: "proposal wizard" }),
  "Agreement": msg({ message: "Agreement", context: "proposal wizard" }),
  "Badge grant": msg({ message: "Badge grant", context: "proposal wizard" }),
  "Quest payout": msg({ message: "Quest payout", context: "proposal wizard" }),
  "Power handover": msg({ message: "Power handover", context: "proposal wizard" }),
  "Power given to a role": msg({ message: "Power given to a role", context: "proposal wizard" }),
  "Power handed back": msg({ message: "Power handed back", context: "proposal wizard" }),
  "Change of purpose": msg({ message: "Change of purpose", context: "proposal wizard" }),
  "Change to the conflict agreement": msg({ message: "Change to the conflict agreement", context: "proposal wizard" }),
  "Change to what closing means": msg({ message: "Change to what closing means", context: "proposal wizard" }),
  "Advisory vote": msg({ message: "Advisory vote", context: "proposal wizard" }),
  "The end of a moon": msg({ message: "The end of a moon", context: "proposal wizard" }),
  "Starting the Game": msg({ message: "Starting the Game", context: "proposal wizard" }),
  "Minting rule change": msg({ message: "Minting rule change", context: "proposal wizard" }),
  "A new role": msg({ message: "A new role", context: "proposal wizard" }),
  "Who sits in a role": msg({ message: "Who sits in a role", context: "proposal wizard" }),
  "A role handed back": msg({ message: "A role handed back", context: "proposal wizard" }),
  "A change to the structure": msg({ message: "A change to the structure", context: "proposal wizard" }),
  "A grant of new tokens": msg({ message: "A grant of new tokens", context: "proposal wizard" }),
  "A suggested change to an admin control": msg({ message: "A suggested change to an admin control", context: "proposal wizard" }),
  "One copy of the village's database": msg({ message: "One copy of the village's database", context: "proposal wizard" }),
  "The quests a funding round's two counts disagree on": msg({ message: "The quests a funding round's two counts disagree on", context: "proposal wizard" }),
  "How votes are counted": msg({ message: "How votes are counted", context: "proposal wizard" }),
  "Decision": msg({ message: "Decision", context: "proposal wizard" }),
};

/** A decision's noun for its subject type, in `i18n`'s language; a noun this file does not know is drawn as written. */
export function decisionNoun(subjectType: string, i18n: I18n = appI18n): string {
  const english = subjectNoun(subjectType);
  const d = Object.prototype.hasOwnProperty.call(DECISION_NOUN_WORDS, english) ? DECISION_NOUN_WORDS[english] : undefined;
  return d ? i18n._(d) : english;
}

/** `noun(subjectType)`: a decision's noun in the reader's language. */
export function useDecisionNoun(): (subjectType: string) => string {
  const { i18n } = useLingui();
  return (subjectType) => decisionNoun(subjectType, i18n);
}
