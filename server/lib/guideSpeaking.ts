/**
 * HOW THE GUIDE SPEAKS IN A REPLY SHE WRITES (the founder, 28 Nov 2026: "Go
 * with warm and plain with the brief and quiet toggle").
 *
 * The dock's fixed lines carry both forms in the client. A reply the model
 * writes has no fixed line, so the voice goes into the prompt instead, here,
 * in one place: the voice sheet's seven rules as plain instructions, and for
 * a person whose speaking dial is on `quiet`, the brief form.
 *
 * A prompt asks for these lines with ONE call, and only while the village's
 * dock is on. With the dock off no prompt changes by a byte.
 *
 * The setting arrives from the browser with each ask and is read as a closed
 * value (shared/guideSpeaking.ts): anything unknown is the default.
 */
import { readGuideSpeaking, speaksBriefly, type GuideSpeaking } from "../../shared/guideSpeaking";

export { readGuideSpeaking, type GuideSpeaking };

/** The voice sheet's rules, as instructions. The same for every setting. */
export const VOICE_RULES: readonly string[] = [
  "Say what is true, then what to do, in the words a neighbour would use.",
  "Lead with whatever has a deadline or blocks something.",
  "Money, pay, votes, errors and anything that binds the village are said plainly, with what follows from them. No figure of speech there.",
  "Say what you did, then what you left for the person. Never claim an act a person has to press: you prepare a change, and they save it or accept it.",
  "Ask one question at most, and put it at the end.",
  "Never write an address or a path. Name the page or the control.",
  "Never talk in lanterns, stones or other pictures of the garden. A place's name, such as the Hall or the Fire, is a name and may be used as one.",
  "Write no dash inside a sentence. Use a comma, a full stop or a colon.",
];

/** How long she speaks, by the person's setting. */
export const VOICE_LENGTH = {
  plain: "Speak warm and plain, in one to three sentences.",
  quiet: "This person asked for brief and quiet: use the fewest words that keep every fact. No greeting and no preamble. Money, pay, votes and anything that binds stay exact, with what follows from them.",
} as const;

/**
 * The lines a prompt adds for one person's setting. They come last in the
 * rules and say so, because the prompt above them was written before the
 * voice was ruled and asks for longer replies.
 */
export function speakingPromptLines(setting: GuideSpeaking): string {
  return [
    "- HOW YOU SPEAK. Where a line above differs, these decide:",
    ...VOICE_RULES.map((rule) => `  - ${rule}`),
    `  - ${speaksBriefly(setting) ? VOICE_LENGTH.quiet : VOICE_LENGTH.plain}`,
  ].join("\n");
}
