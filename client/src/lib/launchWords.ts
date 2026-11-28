/**
 * The six plain names for where a village stands, in words.
 *
 * The names themselves are `LAUNCH_LABELS` in `shared/launchFacts.ts`, and the
 * server sends one with the launch facts. They are for a status line and for
 * nothing else: a control never decides what to offer by the name, it reads
 * the fact its own server door reads (`launchDoors` beside the labels).
 *
 * Keyed by the union, so a seventh name cannot ship without its words.
 *
 * Read them through `useLaunchLabelWords`. The hook is also what makes the
 * build compile these messages: a module that only declares messages and never
 * touches the runtime is skipped by the English precompile step
 * (client/src/i18n/precompileEnglish.ts), and the build then refuses it.
 */
import type { MessageDescriptor } from "@lingui/core";
import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react/macro";
import type { LaunchLabel } from "@shared/launchFacts";

export const LAUNCH_LABEL_WORDS: Record<LaunchLabel, MessageDescriptor> = {
  unclaimed: msg({ message: "Unclaimed", context: "where the village stands: nobody holds it yet" }),
  setup: msg({ message: "Setup", context: "where the village stands: still being built" }),
  "vote-open": msg({ message: "Vote open", context: "where the village stands: its launch vote is open" }),
  "vote-did-not-carry": msg({ message: "Vote did not carry", context: "where the village stands: its last launch vote closed without carrying" }),
  "issuing-vote-not-held": msg({ message: "Issuing and vote not held", context: "where the village stands: tokens are issued and no launch vote was held" }),
  running: msg({ message: "Running", context: "where the village stands: its launch vote carried" }),
};

/** The label's words in the reader's language: `words("vote-open")`. */
export function useLaunchLabelWords(): (label: LaunchLabel) => string {
  const { i18n } = useLingui();
  return (label) => i18n._(LAUNCH_LABEL_WORDS[label]);
}
