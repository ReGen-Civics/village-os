/**
 * THE STARTER SETS' WORDS, in the reader's language (the lead, 26 Nov 2026: the whole site in Spanish).
 *
 * Each set's name and line are English in shared/moduleStarterSets.ts, and the library drew them as written. They
 * are translated HERE, keyed by set id; a set this file does not know is drawn as written. The module names inside
 * a set come from the localized catalog (moduleWords.ts).
 *
 * starterSetWords.test.ts derives every set from shared/moduleStarterSets.ts and fails on one this file lacks or
 * has stale, or one with no Spanish.
 */
// A value import of the runtime: precompileEnglish compiles the messages of a file that imports it and skips one
// that only uses `msg` (client/src/components/roleCard/payBandWords.ts says the same).
import { i18n as appI18n, type I18n, type MessageDescriptor } from "@lingui/core";
import { msg } from "@lingui/core/macro";


export const STARTER_SET_WORDS: Readonly<Record<string, { name: MessageDescriptor; gloss: MessageDescriptor }>> = {
  "hosting-guests": {
    name: msg({ message: "Hosting guests", context: "module starter set hosting-guests, name" }),
    gloss: msg({ message: "Rooms people can book, a way to take payment, and a calendar for what is on.", context: "module starter set hosting-guests, gloss" }),
  },
  "village-voice": {
    name: msg({ message: "Village voice", context: "module starter set village-voice, name" }),
    gloss: msg({ message: "Somewhere to talk in the open, write to each other, and keep a shared journal.", context: "module starter set village-voice, gloss" }),
  },
  "sharing-things": {
    name: msg({ message: "Sharing what we own", context: "module starter set sharing-things, name" }),
    gloss: msg({ message: "A tool library and a shared library, so things get used more than once.", context: "module starter set sharing-things, gloss" }),
  },
};

/** A set's name and line in the reader's language; a set this file does not know keeps its words. */
export function starterSetWords(set: { id: string; name: string; gloss: string }, i18n: I18n = appI18n): { name: string; gloss: string } {
  const w = Object.prototype.hasOwnProperty.call(STARTER_SET_WORDS, set.id) ? STARTER_SET_WORDS[set.id] : undefined;
  return w ? { name: i18n._(w.name), gloss: i18n._(w.gloss) } : { name: set.name, gloss: set.gloss };
}
