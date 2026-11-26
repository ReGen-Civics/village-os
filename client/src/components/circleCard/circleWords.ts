/**
 * THE CIRCLE CARD'S WORDS, in the reader's language (the lead, 26 Nov 2026: the whole site in Spanish).
 *
 * shared/circleCardWords.ts holds the card's English: the headings, the fixed lines, and the sentences built from
 * a count, a name or a day. The server builds the card from them (shared/circleCard.ts) and the components draw
 * the rest. This file holds the same table in the reader's language, entry for entry:
 *
 *  - `circleWordsIn(i18n)` / `useCircleWords()`: the table, for a component that draws its own words.
 *  - `localizeCircleCard(card, i18n)`: the card the server built, with every sentence it baked said again from the
 *    same key and arguments (`card.said`, shared/saidWords.ts), each day in the reader's language, and each
 *    heading by its section key. A circle's own words, an older server's card and an English reader's card are
 *    drawn as sent.
 *
 * circleWords.test.ts holds every entry to the English table (each sentence with sample arguments), so a word
 * added there fails here until it is here, and holds every entry to having Spanish.
 */
// A value import of the runtime: precompileEnglish compiles the messages of a file that imports it and skips one
// that only uses `msg` (client/src/components/roleCard/payBandWords.ts says the same).
import { i18n as appI18n, type I18n, type MessageDescriptor } from "@lingui/core";
import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react/macro";
import { useMemo } from "react";
import { CIRCLE_CARD_WORDS, CIRCLE_SECTION_KEYS, type CircleSectionKey } from "@shared/circleCardWords";
import type { CircleCard } from "@shared/circleCard";
import type { CircleWordKey } from "@shared/circleCharterParse";
import type { SaidArg, SaidDay } from "@shared/saidWords";

type English = typeof CIRCLE_CARD_WORDS;
/** The table's shape with every fixed line as a plain string, so a translation fits where the English did. */
export type CircleWords = {
  [K in keyof English]: English[K] extends string ? string : English[K];
};

const M = {
  eyebrow: msg({ message: "Circle", context: "circle card, eyebrow" }),
  partOf: msg({ message: "Part of", context: "circle card, part of" }),
  existsWhile: msg({ message: "This circle exists while", context: "circle card, exists while" }),
  existsWhileEmpty: msg({ message: "not written yet", context: "circle card, exists while, empty" }),
  statusForming: msg({ message: "Forming", context: "circle card, status forming" }),
  statusDormant: msg({ message: "Resting", context: "circle card, status dormant" }),
  termsKey: msg({ message: "Underlined headings show the matching CCOS term when you hover or tap them.", context: "circle card, terms key" }),
  backToCircles: msg({ message: "All circles", context: "circle card, back to circles" }),
  notWritten: msg({ message: "Not written yet", context: "circle card, not written" }),
  noPurpose: msg({ message: "No purpose written yet", context: "circle card, no purpose" }),
  accountabilitiesShort: msg({
    message: "{n, plural, one {# line} other {# lines}} written. A circle answers for 3 to 6 things.",
    context: "circle card, accountabilities short",
  }),
  noRoles: msg({ message: "No roles in this circle yet", context: "circle card, no roles" }),
  roleFilled: msg({ message: "Filled", context: "circle card, role filled" }),
  roleOpen: msg({ message: "Open", context: "circle card, role open" }),
  rolePartly: msg({ message: "{n} of {of} filled", context: "circle card, role partly filled" }),
  roleForming: msg({ message: "Forming", context: "circle card, role forming" }),
  roleExpired: msg({ message: "Term ended", context: "circle card, role term ended" }),
  seeCard: msg({ message: "See their card", context: "circle card, see card" }),
  seeCardOfMany: msg({ message: "See the card of holder {i} of {role}", context: "circle card, see card of one of several holders" }),
  seeCardOfOne: msg({ message: "See the card of the holder of {role}", context: "circle card, see card of the one holder" }),
  roleDetails: msg({ message: "About this role", context: "circle card, role details" }),
  apply: msg({ message: "Apply for this role", context: "circle card, apply" }),
  heldBy: msg({ message: "Held by {names}", context: "circle card, held by" }),
  holdersPrivate: msg({ message: "Sign in to open the holders' cards.", context: "circle card, holders private" }),
  valueLine: msg({ message: "{value}: {practice}", context: "circle card, value line" }),
  noAdoption: msg({ message: "No words for this circle have been adopted by consent yet.", context: "circle card, no adoption" }),
  adoptedByVote: msg({ message: "Adopted by a village vote on {day}", context: "circle card, adopted by vote" }),
  adoptedDirectly: msg({ message: "Adopted by a direct decision on {day}", context: "circle card, adopted directly" }),
  adoptionCount: msg({ message: "{n, plural, one {# change} other {# changes}} adopted since {first}", context: "circle card, adoption count" }),
  createdLine: msg({ message: "The circle was created", context: "circle card, created line" }),
  wordsLine: msg({ message: "New words for the circle", context: "circle card, words line" }),
  proposeWords: msg({ message: "Propose new words", context: "circle card, propose words" }),
  doneProposing: msg({ message: "Done", context: "circle card, done proposing" }),
  proposeNote: msg({
    message: "A circle's words change by consent. Your words go to the village as a proposed change, and the card shows them once it is adopted.",
    context: "circle card, propose note",
  }),
  oneLine: msg({ message: "One line each.", context: "circle card, one line" }),
  valuesHint: msg({ message: "Up to two, one per line, each as the value, a colon, then one practice that shows it.", context: "circle card, values hint" }),
  proposeSend: msg({ message: "Propose this change", context: "circle card, propose send" }),
  cancel: msg({ message: "Cancel", context: "circle card, cancel" }),
  proposed: msg({ message: "Proposed, waiting for consent", context: "circle card, proposed" }),
  proposalSent: msg({ message: "Sent as a proposal for consent.", context: "circle card, proposal sent" }),
  pending: msg({ message: "Proposed, waiting for consent", context: "circle card, pending" }),
  proposeFailed: msg({ message: "That did not go through. Try again.", context: "circle card, propose failed" }),
  proposedOn: msg({ message: "Proposed on {day}", context: "circle card, proposed on" }),
  clears: msg({ message: "Clears what is written now", context: "circle card, clears" }),
  adopt: msg({ message: "Adopt these words", context: "circle card, adopt" }),
  adoptConfirm: msg({ message: "Adopt now? The circle's card changes for everyone.", context: "circle card, adopt confirm" }),
  adoptYes: msg({ message: "Yes, adopt them", context: "circle card, adopt yes" }),
  putToVillage: msg({ message: "Put it to the village", context: "circle card, put to village" }),
  putConfirm: msg({ message: "Open a village vote on these words?", context: "circle card, put confirm" }),
  putYes: msg({ message: "Yes, open the vote", context: "circle card, put yes" }),
  voting: msg({ message: "The village is voting on this until {day}.", context: "circle card, voting" }),
  waitingHolder: msg({ message: "The role that holds the power to change the structure decides this.", context: "circle card, waiting holder" }),
  waitingVillage: msg({ message: "The village decides this by vote.", context: "circle card, waiting village" }),
  blocked: msg({ message: "This cannot be adopted as it stands:", context: "circle card, blocked" }),
  adopted: msg({ message: "Adopted. The card now shows the new words.", context: "circle card, adopted" }),
  putDone: msg({ message: "Put to the village. Members are asked to vote.", context: "circle card, put done" }),
  notCountedYet: msg({ message: "Not counted yet", context: "circle card, not counted yet" }),
  nOf: msg({ message: "{n} of {of}", context: "circle card, n of" }),
  trendUp: msg({ message: "Up on last moon", context: "circle card, trend up" }),
  trendDown: msg({ message: "Down on last moon", context: "circle card, trend down" }),
  trendSame: msg({ message: "Same as last moon", context: "circle card, trend same" }),
  trendLater: msg({ message: "Trend from next moon", context: "circle card, trend later" }),
  lastMet: msg({ message: "Last met on {day}", context: "circle card, last met" }),
  notMetYet: msg({ message: "Has not met yet", context: "circle card, not met yet" }),
  rhythmNotSet: msg({ message: "Meeting rhythm: not set yet", context: "circle card, rhythm not set" }),
  rhythm: msg({ message: "Meeting rhythm: {words}", context: "circle card, rhythm" }),
  nextMeeting: msg({ message: "Next meeting: {words}", context: "circle card, next meeting" }),
  waiting: msg({
    message: "{n, plural, =0 {Nothing waiting for the next meeting} one {# item waiting for the next meeting} other {# items waiting for the next meeting}}",
    context: "circle card, waiting",
  }),
  openSessions: msg({ message: "Open Live Sessions", context: "circle card, open sessions" }),
  arrivalRound: msg({
    message: "Each meeting in Live Sessions opens by asking how everyone is arriving, with a number from 1 to 11.",
    context: "circle card, arrival round",
  }),
  sharedBreath: msg({ message: "Whoever facilitates can start a shared breath for everyone in the room.", context: "circle card, shared breath" }),
  gratitudeRound: msg({ message: "A meeting can close with a round of thanks to each person in it.", context: "circle card, round of thanks" }),
  bringSomething: msg({ message: "Bring something to the next meeting", context: "circle card, bring something" }),
  openTensions: msg({
    message: "{n, plural, =0 {No open tensions on this circle's roles} one {# open tension on this circle's roles} other {# open tensions on this circle's roles}}",
    context: "circle card, open tensions",
  }),
  tensionFlow: msg({
    message: "A tension goes to the role it is about. The role's holders answer it, or bring it to the circle's next meeting.",
    context: "circle card, tension flow",
  }),
  tensionWhere: msg({ message: "Raise one from the card of a holder of the role it is about.", context: "circle card, tension where" }),
  reviewDue: msg({ message: "Due for review on {day}, the last day of this season.", context: "circle card, review due" }),
  noReviewDate: msg({ message: "No season is set, so there is no review date yet.", context: "circle card, no review date" }),
  lastChanged: msg({ message: "Last changed by consent on {day}.", context: "circle card, last changed" }),
  decisionsLede: msg({
    message: "What this circle decided by consent, newest first. Give one a review date, and it comes back as an agenda item when the time comes.",
    context: "circle card, decisions lede",
  }),
  pulseLede: msg({
    message: "How this circle has been doing this season, from what its sessions already wrote down. Counts only, never a name.",
    context: "circle card, pulse lede",
  }),
  failed: msg({ message: "This circle card did not load.", context: "circle card, failed" }),
  retry: msg({ message: "Retry", context: "circle card, retry" }),
  notFound: msg({ message: "There is no circle here.", context: "circle card, not found" }),
} satisfies Record<string, MessageDescriptor>;

/** Every heading, by section key. */
export const CIRCLE_HEADING_WORDS: Readonly<Record<CircleSectionKey, MessageDescriptor>> = {
  purpose: msg({ message: "Why this circle exists", context: "circle card heading, purpose" }),
  accountabilities: msg({ message: "What you can count on us for", context: "circle card heading, accountabilities" }),
  domains: msg({ message: "What we look after", context: "circle card heading, domains" }),
  authorities: msg({ message: "What we can decide on our own", context: "circle card heading, authorities" }),
  responsibilities: msg({ message: "What we do regularly", context: "circle card heading, responsibilities" }),
  roles: msg({ message: "Roles in this circle", context: "circle card heading, roles" }),
  signs: msg({ message: "How we'll know it's working", context: "circle card heading, signs" }),
  meet: msg({ message: "How we meet", context: "circle card heading, meet" }),
  wholeness: msg({ message: "How we look after ourselves", context: "circle card heading, wholeness" }),
  tensions: msg({ message: "How tensions flow", context: "circle card heading, tensions" }),
  stewardship: msg({ message: "How we give back more than we take", context: "circle card heading, stewardship" }),
  checks: msg({ message: "How we keep power in balance", context: "circle card heading, checks" }),
  succession: msg({ message: "When a role changes hands", context: "circle card heading, succession" }),
  values: msg({ message: "What we value", context: "circle card heading, values" }),
  livingAgreement: msg({ message: "How we agree to be together", context: "circle card heading, living agreement" }),
  tools: msg({ message: "Tools we rely on", context: "circle card heading, tools" }),
  review: msg({ message: "When we look at this again", context: "circle card heading, review" }),
  adoption: msg({ message: "Who agreed to this, and when", context: "circle card heading, adoption" }),
};

/** The descriptors, for the test: every one needs Spanish. */
export const CIRCLE_WORD_DESCRIPTORS: readonly MessageDescriptor[] = [...Object.values(M), ...CIRCLE_SECTION_KEYS.map((k) => CIRCLE_HEADING_WORDS[k])];

/** "a", "a and b", "a, b and c" in the reader's language. */
function listIn(items: readonly string[], locale: string): string {
  try {
    return new Intl.ListFormat(locale === "en" ? "en-GB" : locale, { type: "conjunction" }).format(items);
  } catch {
    return items.join(", ");
  }
}

/** The card's table in the reader's language. */
export function circleWordsIn(i18n: I18n = appI18n): CircleWords {
  const s = (d: MessageDescriptor, values?: Record<string, unknown>) => i18n._(values ? { ...d, values } : d);
  return {
    eyebrow: s(M.eyebrow),
    partOf: s(M.partOf),
    existsWhile: s(M.existsWhile),
    existsWhileEmpty: s(M.existsWhileEmpty),
    status: { forming: s(M.statusForming), dormant: s(M.statusDormant) },
    termsKey: s(M.termsKey),
    backToCircles: s(M.backToCircles),
    notWritten: s(M.notWritten),
    noPurpose: s(M.noPurpose),
    accountabilitiesShort: (n: number) => s(M.accountabilitiesShort, { n }),
    noRoles: s(M.noRoles),
    roleFilled: s(M.roleFilled),
    roleOpen: s(M.roleOpen),
    rolePartly: (n: number, of: number) => s(M.rolePartly, { n, of }),
    roleForming: s(M.roleForming),
    roleExpired: s(M.roleExpired),
    seeCard: s(M.seeCard),
    seeCardOf: (role: string, i: number, of: number) => (of > 1 ? s(M.seeCardOfMany, { role, i }) : s(M.seeCardOfOne, { role })),
    roleDetails: s(M.roleDetails),
    apply: s(M.apply),
    heldByNames: (names: readonly string[]): string | null => (names.length === 0 ? null : s(M.heldBy, { names: listIn(names, i18n.locale) })),
    holdersPrivate: s(M.holdersPrivate),
    valueLine: (value: string, practice: string) => s(M.valueLine, { value, practice }),
    noAdoption: s(M.noAdoption),
    adoptedByVote: (day: string) => s(M.adoptedByVote, { day }),
    adoptedDirectly: (day: string) => s(M.adoptedDirectly, { day }),
    adoptionCount: (n: number, first: string) => s(M.adoptionCount, { n, first }),
    createdLine: s(M.createdLine),
    wordsLine: s(M.wordsLine),
    proposeWords: s(M.proposeWords),
    doneProposing: s(M.doneProposing),
    proposeNote: s(M.proposeNote),
    oneLine: s(M.oneLine),
    valuesHint: s(M.valuesHint),
    proposeSend: s(M.proposeSend),
    cancel: s(M.cancel),
    proposed: s(M.proposed),
    proposalSent: s(M.proposalSent),
    pending: s(M.pending),
    proposeFailed: s(M.proposeFailed),
    proposedOn: (day: string) => s(M.proposedOn, { day }),
    clears: s(M.clears),
    adopt: s(M.adopt),
    adoptConfirm: s(M.adoptConfirm),
    adoptYes: s(M.adoptYes),
    putToVillage: s(M.putToVillage),
    putConfirm: s(M.putConfirm),
    putYes: s(M.putYes),
    voting: (day: string) => s(M.voting, { day }),
    waitingHolder: s(M.waitingHolder),
    waitingVillage: s(M.waitingVillage),
    blocked: s(M.blocked),
    adopted: s(M.adopted),
    putDone: s(M.putDone),
    notCountedYet: s(M.notCountedYet),
    nOf: (n: number, of: number) => s(M.nOf, { n, of }),
    trend: { up: s(M.trendUp), down: s(M.trendDown), same: s(M.trendSame) },
    trendLater: s(M.trendLater),
    lastMet: (day: string) => s(M.lastMet, { day }),
    notMetYet: s(M.notMetYet),
    rhythmNotSet: s(M.rhythmNotSet),
    rhythm: (words: string) => s(M.rhythm, { words }),
    nextMeeting: (words: string) => s(M.nextMeeting, { words }),
    waiting: (n: number) => s(M.waiting, { n }),
    openSessions: s(M.openSessions),
    arrivalRound: s(M.arrivalRound),
    sharedBreath: s(M.sharedBreath),
    gratitudeRound: s(M.gratitudeRound),
    bringSomething: s(M.bringSomething),
    openTensions: (n: number) => s(M.openTensions, { n }),
    tensionFlow: s(M.tensionFlow),
    tensionWhere: s(M.tensionWhere),
    reviewDue: (day: string) => s(M.reviewDue, { day }),
    noReviewDate: s(M.noReviewDate),
    lastChanged: (day: string) => s(M.lastChanged, { day }),
    decisionsLede: s(M.decisionsLede),
    pulseLede: s(M.pulseLede),
    failed: s(M.failed),
    retry: s(M.retry),
    notFound: s(M.notFound),
  };
}

/** The table for a component, redrawn when the reader changes language. */
export function useCircleWords(): CircleWords {
  const { i18n } = useLingui();
  return useMemo(() => circleWordsIn(i18n), [i18n, i18n.locale]);
}

/** A day the server formatted, in the reader's language. */
function dayIn(d: SaidDay, locale: string): string | null {
  const civil = /^\d{4}-\d{2}-\d{2}$/.test(d.iso);
  const t = civil ? new Date(`${d.iso}T00:00:00Z`) : new Date(d.iso);
  if (Number.isNaN(t.getTime())) return null;
  try {
    return t.toLocaleDateString(locale, { day: "numeric", month: "long", ...(d.year ? { year: "numeric" } : {}), timeZone: civil ? "UTC" : (d.tz ?? undefined) });
  } catch {
    return null;
  }
}

/** Every string in a value, at any depth, passed through `say`; anything else as it is. */
function mapStrings<T>(v: T, say: (s: string) => string): T {
  if (typeof v === "string") return say(v) as T;
  if (Array.isArray(v)) return v.map((x) => mapStrings(x, say)) as T;
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, k === "said" ? x : mapStrings(x, say)])) as T;
  return v;
}

/** A word's label in the proposal form and a proposal's fields: its heading, or "This circle exists while". */
export function circleWordLabelIn(key: CircleWordKey, i18n: I18n = appI18n): string {
  if (key === "existsWhile") return i18n._(M.existsWhile);
  const d = CIRCLE_HEADING_WORDS[key as CircleSectionKey];
  return d ? i18n._(d) : key;
}

/** The card the server built, in the reader's language. */
export function localizeCircleCard(card: CircleCard, i18n: I18n = appI18n): CircleCard {
  if (!i18n.locale || i18n.locale === "en") return card;
  const words = circleWordsIn(i18n);
  const said = card.said;
  const arg = (a: SaidArg): SaidArg => (typeof a === "string" && said?.days[a] ? (dayIn(said.days[a], i18n.locale) ?? a) : a);
  const say = (english: string): string => {
    const w = said?.words[english];
    if (!w) return english;
    let entry: unknown = words;
    for (const part of w.k.split(".")) entry = entry && typeof entry === "object" && Object.prototype.hasOwnProperty.call(entry, part) ? (entry as Record<string, unknown>)[part] : undefined;
    if (typeof entry === "string") return entry;
    if (typeof entry === "function") {
      const out = (entry as (...a: SaidArg[]) => unknown)(...(w.a ?? []).map(arg));
      return typeof out === "string" ? out : english;
    }
    return english;
  };
  const out = mapStrings({ ...card, said: undefined }, say);
  return {
    ...out,
    said,
    sections: out.sections.map((sec) => ({ ...sec, heading: CIRCLE_HEADING_WORDS[sec.key] ? i18n._(CIRCLE_HEADING_WORDS[sec.key]) : sec.heading })),
    proposals: out.proposals.map((p) => ({ ...p, fields: p.fields.map((f) => ({ ...f, label: circleWordLabelIn(f.key, i18n) })) })),
  } as CircleCard;
}
