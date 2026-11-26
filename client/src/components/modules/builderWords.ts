/**
 * THE MODULE BUILDER'S STEPS IN THE READER'S LANGUAGE (lane ES-A, 26 Nov 2026). `BUILDER_STEPS` and
 * `BUILDER_EXAMPLES` (shared/builderJourney.ts) are arrays of plain English the client draws on /modules, so, as
 * the menu does (#1714), their words are translated here keyed by their English, at the moment they are drawn.
 * builderWords.test.ts fails on a step or example word with no entry.
 *
 * The text a builder copies into their agent (`agentHandoffText`) stays English on purpose: it points an AI at
 * the English guide and contract and is pasted into a tool, never read on the page as copy.
 */
// A value import of the runtime: precompileEnglish compiles the messages of a file that imports it and skips one
// that only uses `msg` (client/src/components/roleCard/payBandWords.ts says the same).
import { i18n as appI18n, type I18n, type MessageDescriptor } from "@lingui/core";
import { msg } from "@lingui/core/macro";

export const BUILDER_WORDS: Readonly<Record<string, MessageDescriptor>> = {
  "Read the contract": msg({ message: "Read the contract", context: "module builder journey" }),
  "Paste the guide into your agent": msg({ message: "Paste the guide into your agent", context: "module builder journey" }),
  "Run the module facts": msg({ message: "Run the module facts", context: "module builder journey" }),
  "Open the pull request": msg({ message: "Open the pull request", context: "module builder journey" }),
  "Get listed": msg({ message: "Get listed", context: "module builder journey" }),
  "A connected tool: organisational memory": msg({ message: "A connected tool: organisational memory", context: "module builder journey" }),
  "A personal practice: Gene Keys": msg({ message: "A personal practice: Gene Keys", context: "module builder journey" }),
  "A shared ritual: live sessions": msg({ message: "A shared ritual: live sessions", context: "module builder journey" }),
  "It says what a module may do, what it must never touch, and how a village switches it on and off.": msg({ message: "It says what a module may do, what it must never touch, and how a village switches it on and off.", context: "module builder journey" }),
  "Give START_HERE to the AI you build with. It walks you both through the repository and the first files to write.": msg({ message: "Give START_HERE to the AI you build with. It walks you both through the repository and the first files to write.", context: "module builder journey" }),
  "One command prints every check the pull request will face, read from the workflows themselves.": msg({ message: "One command prints every check the pull request will face, read from the workflows themselves.", context: "module builder journey" }),
  "Send it to the upstream repository. A person reads every module before it ships.": msg({ message: "Send it to the upstream repository. A person reads every module before it ships.", context: "module builder journey" }),
  "Once it lands, your module appears on this page in every village, off until a village chooses it.": msg({ message: "Once it lands, your module appears on this page in every village, off until a village chooses it.", context: "module builder journey" }),
  "An outside service keeps what an organisation knows, and the module syncs it in with a review step for people.": msg({ message: "An outside service keeps what an organisation knows, and the module syncs it in with a review step for people.", context: "module builder journey" }),
  "Opt-in personal profiles, shown in context only, with every line the member's own to share or hide.": msg({ message: "Opt-in personal profiles, shown in context only, with every line the member's own to share or hide.", context: "module builder journey" }),
  "Templates for gatherings, with drop-ins like a shared breath or a bell, run together in real time.": msg({ message: "Templates for gatherings, with drop-ins like a shared breath or a bell, run together in real time.", context: "module builder journey" }),
  "The Module Library contract": msg({ message: "The Module Library contract", context: "module builder journey" }),
  "START_HERE": msg({ message: "START_HERE", context: "module builder journey" }),
  "The repository": msg({ message: "The repository", context: "module builder journey" }),
};

/** A builder-journey word in `i18n`'s language; a word this file does not know is drawn as written. */
export function builderWord(english: string, i18n: I18n = appI18n): string {
  const d = Object.prototype.hasOwnProperty.call(BUILDER_WORDS, english) ? BUILDER_WORDS[english] : undefined;
  return d ? i18n._(d) : english;
}
