/**
 * THE CIRCLE'S CONSENT ON A ROLE PROPOSAL, IN THE READER'S LANGUAGE (lane ES-A, 26 Nov 2026).
 *
 * The mirror of `CONSENT_WORDS` and `TALLY_WORDS` (shared/roleProposalConsent.ts), drawn through the catalog at the
 * moment they are drawn (client/src/i18n/wordTable.ts). The shared tables stay English for the server, which sends
 * the circle's ask as a notification and an email.
 *
 * A date inside a sentence is drawn in the reader's locale (`civilDayWords(day, locale)`), and a list of roles is
 * joined by the sentence itself ("A, B and C" / "A, B y C"), never by an English `seatList`.
 */
// A value import of the runtime: precompileEnglish compiles the messages of a file that imports it and skips one
// that only uses `msg` (client/src/components/roleCard/payBandWords.ts says the same).
import { i18n as appI18n, type I18n } from "@lingui/core";
import { msg } from "@lingui/core/macro";
import { civilDayWords } from "@shared/civilDay";
import { OBJECTION_MAX, type CONSENT_WORDS, type ConsentState, type TALLY_WORDS } from "@shared/roleProposalConsent";
import type { ADOPTED_HEADING, STATE_HEADINGS } from "./proposalWords";
import { drawWords, useWords, type Drawn, type MirrorLine, type WordMirror } from "@/i18n/wordTable";
import { useLingui } from "@/i18n/runtime";

export type ConsentWords = Drawn<typeof CONSENT_WORDS>;
export type TallyWords = Drawn<typeof TALLY_WORDS>;

/** The day the circle's window closes, in the active locale ("9 de noviembre de 2026"). */
const day = (closesOnDay: string) => civilDayWords(closesOnDay, appI18n.locale);

/** The roles as one sentence's list: one name, or all but the last and the last. */
function rolesLine(roles: readonly string[]): MirrorLine {
  const clean = roles.map((s) => s.trim()).filter(Boolean);
  if (clean.length === 0) return msg({ message: "Your circle is asked about a role proposal: a role", context: "circle consent: askTitle" });
  if (clean.length === 1) {
    const role = clean[0];
    return msg({ message: `Your circle is asked about a role proposal: ${role}`, context: "circle consent: askTitle" });
  }
  const head = clean.slice(0, -1).join(", ");
  const last = clean[clean.length - 1];
  return msg({ message: `Your circle is asked about a role proposal: ${head} and ${last}`, context: "circle consent: askTitle" });
}

export const CONSENT_MIRROR: WordMirror<typeof CONSENT_WORDS> = {
  open: (closesOnDay) => {
    const by = day(closesOnDay);
    return msg({ message: `The circle is asked to consent or object by ${by}.`, context: "circle consent: open" });
  },
  objected: msg({ message: "A member of the circle objected, so the proposal goes to the circle's next meeting. It can still be adopted by a holder of the power to place people in roles.", context: "circle consent: objected" }),
  consented: msg({ message: "Consented by the circle", context: "circle consent: consented" }),
  lapsed: msg({ message: "The circle's 2 business days passed with no consent. It can still be adopted by a holder of the power to place people in roles.", context: "circle consent: lapsed" }),
  noOtherHolders: msg({ message: "Nobody else holds a role in this circle, so the circle cannot consent. It is adopted by a holder of the power to place people in roles.", context: "circle consent: noOtherHolders" }),
  record: msg({ message: "Record the adoption", context: "circle consent: record" }),
  reasonNeeded: msg({ message: "Say why you object, so the circle can talk it through.", context: "circle consent: reasonNeeded" }),
  notAsked: msg({ message: "This proposal did not ask you. The circle's holders answer it.", context: "circle consent: notAsked" }),
  answered: msg({ message: "You have answered this already.", context: "circle consent: answered" }),
  windowClosed: msg({ message: "The circle's 2 business days have passed, so answers are closed.", context: "circle consent: windowClosed" }),
  withdrawn: msg({ message: "This proposal was withdrawn, so answers are closed.", context: "circle consent: withdrawn" }),
  decided: msg({ message: "This proposal has been decided, so answers are closed.", context: "circle consent: decided" }),
  notCarried: msg({ message: "The circle has not met yet, so the objection waits on the application page.", context: "circle consent: notCarried" }),
  sessionsOff: msg({ message: "Live Sessions is off, so the objection waits on the application page.", context: "circle consent: sessionsOff" }),
  askTitle: (roles) => rolesLine(roles),
  askBody: (closesOnDay) => {
    const by = day(closesOnDay);
    return msg({ message: `Consent or object by ${by}. It waits under Tasks on your profile too.`, context: "circle consent: askBody" });
  },
  noVote: msg({ message: "A proposal that changes roles is adopted by its circle's consent or by a holder of the power to place people in roles. It does not go to a village vote.", context: "circle consent: noVote" }),
  candidateOpens: msg({ message: "The member who proposed it opens this vote.", context: "circle consent: candidateOpens" }),
  heading: msg({ message: "The circle's answer", context: "circle consent: heading" }),
  askedYou: (closesOnDay) => {
    const by = day(closesOnDay);
    return msg({ message: `Your circle asks you to consent or object by ${by}.`, context: "circle consent: askedYou" });
  },
  consentButton: msg({ message: "Consent", context: "circle consent: consentButton" }),
  objectButton: msg({ message: "Object", context: "circle consent: objectButton" }),
  objectionGoes: msg({ message: "Your objection goes to the circle's next meeting.", context: "circle consent: objectionGoes" }),
  reasonLabel: msg({ message: "Why you object", context: "circle consent: reasonLabel" }),
  reasonHelp: msg({ message: `Up to ${OBJECTION_MAX} characters.`, context: "circle consent: reasonHelp" }),
  sendObjection: msg({ message: "Send my objection", context: "circle consent: sendObjection" }),
  notNow: msg({ message: "Not now", context: "circle consent: notNow" }),
  youConsented: msg({ message: "You consented.", context: "circle consent: youConsented" }),
  youObjected: msg({ message: "You objected.", context: "circle consent: youObjected" }),
  answerStands: msg({ message: "Each holder answers once, so your answer stands.", context: "circle consent: answerStands" }),
  recordLine: msg({ message: "The circle consented. Record the adoption for the village.", context: "circle consent: recordLine" }),
  failed: msg({ message: "That did not reach the server. Try again.", context: "circle consent: failed" }),
};

export const TALLY_MIRROR: WordMirror<typeof TALLY_WORDS> = {
  asked: msg({ message: "Asked", context: "circle consent: tally" }),
  consented: msg({ message: "Consented", context: "circle consent: tally" }),
  objected: msg({ message: "Objected", context: "circle consent: tally" }),
  none: msg({ message: "None", context: "circle consent: tally" }),
};

/** The headings for where a proposal stands (proposalWords.ts `STATE_HEADINGS` and `ADOPTED_HEADING`), as one table. */
export interface ConsentHeadingsEnglish {
  states: typeof STATE_HEADINGS;
  adopted: typeof ADOPTED_HEADING;
}
export type ConsentHeadings = Drawn<ConsentHeadingsEnglish>;

export const HEADINGS_MIRROR: WordMirror<ConsentHeadingsEnglish> = {
  states: {
    open: msg({ message: "Waiting on the circle", context: "circle consent: state heading" }),
    objected: msg({ message: "An objection goes to the circle's next meeting", context: "circle consent: state heading" }),
    consented: msg({ message: "Consented by the circle, waiting for a holder of the power to record it", context: "circle consent: state heading" }),
    lapsed: msg({ message: "Waiting for a holder of the power", context: "circle consent: state heading" }),
    "no-other-holders": msg({ message: "Waiting for a holder of the power", context: "circle consent: state heading" }),
  },
  adopted: msg({ message: "Adopted", context: "circle consent: adopted heading" }),
};

/** The headings in `i18n`'s language, for code outside a component. */
export function consentHeadings(i18n: I18n = appI18n): ConsentHeadings {
  return drawWords(HEADINGS_MIRROR, i18n);
}

/** The headings in the reader's language. */
export function useConsentHeadings(): ConsentHeadings {
  return useWords(HEADINGS_MIRROR);
}

/**
 * The sentence for where the circle's answer stands, drawn here from the state and the window's last day (the
 * shared `consentStateWords`, which the server sends as `consent.words` in English).
 */
export function stateLine(state: ConsentState, closesOnDay: string | null, words: ConsentWords): string {
  switch (state) {
    case "open":
      return words.open(closesOnDay ?? "");
    case "objected":
      return words.objected;
    case "consented":
      return words.consented;
    case "lapsed":
      return words.lapsed;
    case "no-other-holders":
      return words.noOtherHolders;
  }
}

/** The seal on a consented proposal (CircleConsent's `CONSENT_SEAL`). */
const SEAL = msg({ message: "The circle consented", context: "circle consent: seal" });

/** The consent words in `i18n`'s language, for code outside a component. */
export function consentWords(i18n: I18n = appI18n): ConsentWords {
  return drawWords(CONSENT_MIRROR, i18n);
}

/** The consent words, the tally's words and the seal in the reader's language. */
export function useConsentWords(): { words: ConsentWords; tally: TallyWords; seal: string } {
  const words = useWords(CONSENT_MIRROR);
  const tally = useWords(TALLY_MIRROR);
  const { i18n } = useLingui();
  return { words, tally, seal: i18n._(SEAL) };
}

/** "2 (Gate keeper, Orchard keeper)", "1", or the tally's "None" (shared `tallyWords`, with the drawn "None"). */
export function tallyLine(count: number, roles: readonly string[], tally: TallyWords): string {
  if (!Number.isFinite(count) || count <= 0) return tally.none;
  const titles = roles.map((r) => String(r).trim()).filter(Boolean);
  return titles.length ? `${count} (${titles.join(", ")})` : String(count);
}
