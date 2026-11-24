/**
 * NOTHING OVER ITS LIMIT GOES, AND NOTHING IS CUT (the ops request of 19 Nov 2026). The application keeps every
 * answer whole in its box; at Continue and at Send this names each box that runs past its limit, with how many
 * characters to trim, and anything attached that one post cannot carry. ProposeARole.tsx `findProblems` places
 * each on its own field, and the server refuses the same things again with a field error.
 *
 * The words are messages, so every shipped language reads them; the trim line is the same message the box's own
 * signs show (components/form/LimitSigns.tsx `useTrimWords`).
 */
// A value import of the runtime, as applyWordsT.ts has: precompileEnglish compiles the messages of a file that
// imports it and skips one that only uses `msg` (client/src/i18n/precompileEnglish.ts).
import { i18n as appI18n, type I18n } from "@lingui/core";
import { msg } from "@lingui/core/macro";
import { OPEN_AIM_MAX, OPEN_WHY_MAX, SELF_KNOWLEDGE_MAX } from "@shared/openProposals";
import { ABOUT_BASED_MAX, ABOUT_LANGUAGES_MAX, ABOUT_STORY_MAX, REFERENCE_CONTACT_MAX, REFERENCE_HOW_MAX, REFERENCE_NAME_MAX, type ProposalReference } from "@shared/proposalAbout";
import { PROPOSAL_FILES_MAX, PROPOSAL_LINK_LABEL_MAX, PROPOSAL_LINK_URL_MAX, fileSizeWords, type ProposalLink } from "@shared/proposalAttachments";
import { GOAL_LIMITS } from "@shared/proposalGoals";
import { TERM_NOTE_MAX, type TermAnswers } from "@shared/termsWords";
import { PRICE_WHY_MAX } from "@shared/commitmentRange";
import { SUGGESTION_LIMITS } from "@shared/pieceSuggestions";
import { VOICE_CLIP_WORDS_MAX, VOICE_TRANSCRIPT_MAX } from "@shared/voiceNotes";
import { uploadProblem, type VoiceParts } from "@/components/openProposal/uploadSize";
import { trimWords } from "@/components/form/trimWords";
export { trimWords };

export interface LimitInput {
  why: string;
  about: { based: string; languages: string; story: string; references: ProposalReference[] };
  selfKnowledge: string;
  links: ProposalLink[];
  aim: string;
  items: ReadonlyArray<{ title: string; doneWhen: string }>;
  /** The value items' id prefix on the page ("#value-<role>"), for the cursor. */
  valuePrefix: string;
  pieceSuggestions: ReadonlyArray<{ text: string }>;
  /** Every role's terms: the notes and the price's why. */
  terms: ReadonlyArray<{ answers: TermAnswers; payAsk?: { why?: string } | null }>;
  voice: VoiceParts & { transcript: string; clips: Readonly<Record<string, { blob: { size: number }; words: string }>> };
  files: ReadonlyArray<{ name: string; size: number }>;
  clipsMax: number;
}

/** One problem: its field, its words, and where the cursor goes (undefined: the field's own place; null: the list). */
export interface LimitProblem {
  field: string;
  message: string;
  target?: string | null;
}

export function limitProblems(f: LimitInput, i18n: I18n = appI18n): LimitProblem[] {
  const found: LimitProblem[] = [];
  const over = (field: string, label: string, text: string, max: number, target?: string | null) => {
    if (text.length > max) found.push({ field, message: `${label}: ${trimWords(text.length - max, i18n)}`, target });
  };
  over("why", i18n._(msg`Why you, and why now`), f.why, OPEN_WHY_MAX, "#propose-why");
  over("about", i18n._(msg({ message: "Where you are based", context: "founding application check, a box over its limit" })), f.about.based, ABOUT_BASED_MAX, "#propose-about-based");
  over("about", i18n._(msg({ message: "Languages you work in", context: "founding application check, a box over its limit" })), f.about.languages, ABOUT_LANGUAGES_MAX, "#propose-about-languages");
  over("about", i18n._(msg({ message: "Your story with us", context: "founding application check, a box over its limit" })), f.about.story, ABOUT_STORY_MAX, "#propose-about-story");
  over("selfKnowledge", i18n._(msg({ message: "Your Human Design, Gene Keys, or ways of working", context: "founding application check, a box over its limit" })), f.selfKnowledge, SELF_KNOWLEDGE_MAX, "#propose-self");
  f.about.references.forEach((r, i) => {
    const n = i + 1;
    over("references", i18n._(msg({ message: `Reference ${n}: name`, context: "founding application check, a box over its limit" })), r.name, REFERENCE_NAME_MAX);
    over("references", i18n._(msg({ message: `Reference ${n}: how you know them`, context: "founding application check, a box over its limit" })), r.how, REFERENCE_HOW_MAX, `#propose-about-ref-${i}-how`);
    over("references", i18n._(msg({ message: `Reference ${n}: email or phone`, context: "founding application check, a box over its limit" })), r.contact, REFERENCE_CONTACT_MAX);
  });
  f.links.forEach((l, i) => {
    const n = i + 1;
    over("links", i18n._(msg({ message: `Link ${n}: what it is`, context: "founding application check, a box over its limit" })), l.label, PROPOSAL_LINK_LABEL_MAX);
    over("links", i18n._(msg({ message: `Link ${n}: web address`, context: "founding application check, a box over its limit" })), l.url, PROPOSAL_LINK_URL_MAX);
  });
  over("aim", i18n._(msg({ message: "Your aim in this role", context: "founding application check, a box over its limit" })), f.aim, OPEN_AIM_MAX, "#propose-aim");
  f.items.forEach((g, i) => {
    const n = i + 1;
    over("card", i18n._(msg({ message: `Value ${n}: what it brings`, context: "founding application check, a box over its limit" })), g.title, GOAL_LIMITS.title, `${f.valuePrefix}-${i}-title`);
    over("card", i18n._(msg({ message: `Value ${n}: how we'll know it is done`, context: "founding application check, a box over its limit" })), g.doneWhen, GOAL_LIMITS.doneWhen, `${f.valuePrefix}-${i}-done`);
  });
  f.pieceSuggestions.forEach((x, i) => {
    const n = i + 1;
    over("card", i18n._(msg({ message: `Suggestion ${n} for the role card`, context: "founding application check, a box over its limit" })), x.text, SUGGESTION_LIMITS.text, null);
  });
  for (const step of f.terms) {
    for (const a of Object.values(step.answers)) if (a) over("terms", i18n._(msg({ message: "A note on the terms", context: "founding application check, a box over its limit" })), a.note, TERM_NOTE_MAX);
    over("terms", i18n._(msg({ message: "Why this compensation", context: "founding application check, a box over its limit" })), step.payAsk?.why ?? "", PRICE_WHY_MAX);
  }
  if (f.voice.consent) {
    over("voice", i18n._(msg({ message: "What we heard, in your words", context: "founding application check, a box over its limit" })), f.voice.transcript.trim(), VOICE_TRANSCRIPT_MAX, null);
    for (const c of Object.values(f.voice.clips)) over("voice", i18n._(msg({ message: "The words with a recording beside an answer", context: "founding application check, a box over its limit" })), c.words.trim(), VOICE_CLIP_WORDS_MAX, null);
  }
  // The files and recordings, added up as the server will add them (components/openProposal/uploadSize.ts).
  const up = uploadProblem(f.files, f.voice, f.clipsMax);
  if (up?.kind === "tooManyFiles") {
    const extra = up.extra;
    found.push({ field: "files", message: i18n._(msg({ message: `Up to ${PROPOSAL_FILES_MAX} files can be sent. Remove ${extra} to send.`, context: "founding application check, uploads" })) });
  } else if (up?.kind === "fileTooBig") {
    const name = up.name;
    found.push({ field: "files", message: i18n._(msg({ message: `${name} is larger than one file can be. Remove it, or attach a smaller copy.`, context: "founding application check, uploads" })) });
  } else if (up?.kind === "takeTooBig" || up?.kind === "clipTooBig") {
    found.push({ field: "voice", message: i18n._(msg({ message: "One recording is larger than we can take. Remove it and record that part again in a shorter take.", context: "founding application check, uploads" })), target: null });
  } else if (up?.kind === "tooBigTogether") {
    const size = fileSizeWords(up.over);
    found.push({ field: "files", message: i18n._(msg({ message: `Your files and recordings are ${size} more than one application can carry. Remove a file or a recording to send.`, context: "founding application check, uploads" })) });
  }
  return found;
}
