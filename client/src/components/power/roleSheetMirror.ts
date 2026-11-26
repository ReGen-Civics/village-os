/**
 * THE ROLE CARD'S WORDS IN THE READER'S LANGUAGE: the mirror of shared/roleSheetWords.ts (`ROLE_SHEET_WORDS`).
 *
 * The shared table stays English, for anything that builds a card without a reader (tests, the server). The
 * card's components draw this mirror through `useRoleSheetWords()` and hand it to the view model as
 * `SheetContext.words`, so every line the model builds is in the reader's language too. Typed off the shared
 * table, so a key added there and not here fails the compiler; roleSheetMirror.test.ts holds the English equal.
 */
// A value import of the runtime: precompileEnglish compiles the messages of a file that imports it and skips one
// that only uses `msg` (client/src/components/roleCard/payBandWords.ts says the same).
import { i18n as appI18n, type I18n } from "@lingui/core";
import { msg, plural } from "@lingui/core/macro";
import type { ROLE_SHEET_WORDS, RoleSheetWords } from "@shared/roleSheetWords";
import { drawWords, useWords, type WordMirror } from "@/i18n/wordTable";

export const ROLE_SHEET_MIRROR: WordMirror<typeof ROLE_SHEET_WORDS> = {
  words: {
    figuresName: msg({ message: "Right now", context: "role card" }),
    aimLabel: msg({ message: "Aim", context: "role card" }),
    aimMissing: msg({ message: "The aim is still to be written down.", context: "role card" }),
    rosterHeading: msg({ message: "Holding it now", context: "role card" }),
    commitmentsHeading: msg({ message: "Its commitments", context: "role card" }),
    flipTitle: msg({ message: "What it does", context: "role card" }),
    backButton: msg({ message: "Back to the card", context: "role card" }),
    showingBack: msg({ message: "Showing what it does.", context: "role card" }),
    showingFront: msg({ message: "Showing the card.", context: "role card" }),
    proposed: msg({ message: "Proposed", context: "role card" }),
    keySeat: msg({ message: "Key role", context: "role card" }),
    keySeatGloss: msg({ message: "The village marked this role as key.", context: "role card" }),
    recruiting: msg({ message: "Recruiting", context: "role card" }),
    recruitingGloss: msg({ message: "The village is looking for someone to hold this role.", context: "role card" }),
    suggestedTag: msg({ message: "Suggested", context: "role card" }),
    suitsGloss: msg({ message: "Guessed from the role's own words. Nobody has confirmed it yet. The picture is stock art for this class.", context: "role card" }),
    readyToBeRechosen: msg({ message: "ready to be re-chosen", context: "role card" }),
    agent: msg({ message: "An agent", context: "role card" }),
    seated: msg({ message: "Team member", context: "role card" }),
    openPlace: msg({ message: "Open place", context: "role card" }),
    nobodyHoldsThis: msg({ message: "Nobody holds this yet", context: "role card" }),
    waitingForAHand: msg({ message: "Waiting for a hand", context: "role card" }),
    formingPlace: msg({ message: "A place still forming", context: "role card" }),
    aVoteFillsThis: msg({ message: "A vote fills this place", context: "role card" }),
    signInToSeeNames: msg({ message: "Sign in to see who holds it.", context: "role card" }),
    namesNotShared: msg({ message: "Names are not shared on this page.", context: "role card" }),
    unreachable: msg({ message: "Held, and not reachable through the map yet.", context: "role card" }),
    raise: msg({ message: "Apply for this role", context: "role card" }),
    raiseConsequence: msg({ message: "Your application reaches the founding team, who will be in touch.", context: "role card" }),
    applyConsequence: msg({ message: "Opens your proposal for this role and its terms. A role holder or the village decides.", context: "role card" }),
    raisePlaceholder: msg({ message: "Why this role calls to you (optional)", context: "role card" }),
    raiseTermLabel: msg({ message: "End date for your role (optional)", context: "role card" }),
    raiseSubmit: msg({ message: "Send my application", context: "role card" }),
    cancel: msg({ message: "Cancel", context: "role card" }),
    raised: msg({ message: "Application sent. The founding team will be in touch.", context: "role card" }),
    signInToRaise: msg({ message: "Sign in to apply for this role", context: "role card" }),
    nobodyWroteThisSeat: msg({ message: "Nobody has written down what this role is for yet.", context: "role card" }),
    foundingTeamWrites: msg({ message: "The founding team writes these down.", context: "role card" }),
    setByHand: msg({ message: "This state was set by hand.", context: "role card" }),
    everyoneReady: msg({ message: "Everyone in this role is ready to be re-chosen.", context: "role card" }),
    atLeastOneReady: msg({ message: "At least one place is ready to be re-chosen.", context: "role card" }),
    termSub: msg({ message: "The earliest term among its holders.", context: "role card" }),
    termAtSeating: msg({ message: "Set when someone takes the role", context: "role card" }),
    termAtSeatingSub: msg({ message: "With no date asked, it ends with the season.", context: "role card" }),
    villagesWay: msg({ message: "The village's way.", context: "role card" }),
    proposalLead: msg({ message: "A preview of the text below, read the way accepting reads it.", context: "role card" }),
    proposalInvalid: msg({ message: "The text below is not valid JSON yet, so there is nothing to preview.", context: "role card" }),
    seatNeedsAName: msg({ message: "A role needs a name", context: "role card" }),
    whatItDoes: msg({ message: "What it does", context: "role card" }),
    roleUnwritten: msg({ message: "Nobody has written down what this role does yet.", context: "role card" }),
    powersHeading: msg({ message: "Powers it carries", context: "role card" }),
    rungHeading: msg({ message: "Rung it asks for", context: "role card" }),
    unknownPower: msg({ message: "A power this page cannot name yet", context: "role card" }),
    noRung: msg({ message: "This role asks for no rung.", context: "role card" }),
    unknownRung: msg({ message: "Asks for a rung this village no longer names.", context: "role card" }),
    livePreview: msg({ message: "Live preview", context: "role card" }),
    livePreviewSub: msg({ message: "Shows the role you picked.", context: "role card" }),
  },
  lines: {
    listOf: (head, last) => msg({ message: `${head} and ${last}`, context: "role card: the last two items of a list" }),
    stillToWrite: (phrases) => msg({ message: `Still to be written down: ${phrases}.`, context: "role card" }),
    alsoStillToWrite: (phrases) => msg({ message: `Also still to be written down: ${phrases}.`, context: "role card" }),
    notCarried: (phrases) => msg({ message: `This page does not carry ${phrases}.`, context: "role card" }),
    readyCount: (n, of) =>
      msg({ message: plural(n, { one: `# of ${of} team members is ready to be re-chosen.`, other: `# of ${of} team members are ready to be re-chosen.` }), context: "role card" }),
    personTermEnds: (day) => msg({ message: `term ends ${day}`, context: "role card: under a holder's name" }),
    applyAria: (role) => msg({ message: `Apply for this role: ${role}`, context: "role card" }),
    contact: (name) => msg({ message: `Contact ${name}`, context: "role card" }),
    stockArtFor: (className) => msg({ message: `Stock art for ${className}, a class suggested for this role`, context: "role card" }),
    stockArt: msg({ message: "Stock art for a class suggested for this role", context: "role card" }),
    chipAtStart: msg({ message: "set at the start", context: "role card: a commitment chip's suffix" }),
    chipVillages: msg({ message: "the village's", context: "role card: a commitment chip's suffix" }),
    srWritten: msg({ message: ", written down", context: "role card: screen reader, after a commitment" }),
    srVillages: msg({ message: ", the village's way", context: "role card: screen reader, after a commitment" }),
    srAtSeating: msg({ message: ", set when someone takes the role", context: "role card: screen reader, after a commitment" }),
    srUnwritten: msg({ message: ", still to be written down", context: "role card: screen reader, after a commitment" }),
    daysLeftInTerm: (n) => msg({ message: plural(n, { one: "Day left in term", other: "Days left in term" }), context: "role card: under the countdown" }),
    daysLeftInSeason: (n) =>
      msg({ message: plural(n, { one: "Day left in the season", other: "Days left in the season" }), context: "role card: under the countdown" }),
    termEnds: (day) => msg({ message: `Term ends ${day}`, context: "role card" }),
    namedSeasonEnds: (season, day) => msg({ message: `${season} ends ${day}`, context: "role card: a named season's last day" }),
    seasonEnds: (day) => msg({ message: `The season ends ${day}`, context: "role card" }),
    places: (n) => msg({ message: plural(n, { one: "Place", other: "Places" }), context: "role card: a figure's label" }),
    heldNow: msg({ message: "Held now", context: "role card: a figure's label" }),
    taken: msg({ message: "Taken", context: "role card: a figure's label" }),
    openPlaces: (n) => msg({ message: plural(n, { one: "Open place", other: "Open places" }), context: "role card: a figure's label" }),
    answersFor: msg({ message: "Answers for", context: "role card: a figure's label" }),
    term: msg({ message: "Term", context: "role card: a fact's label" }),
    endsOn: (day) => msg({ message: `Ends ${day}`, context: "role card: the term fact" }),
    reachedOn: (day) => msg({ message: `Reached its date on ${day}`, context: "role card: the term fact" }),
    nextHolder: msg({ message: "Next holder", context: "role card: a fact's label" }),
    wayOfDeciding: msg({ message: "Way of deciding", context: "role card: a fact's label" }),
    circlesOwnWay: (circle) => msg({ message: `${circle}'s own way.`, context: "role card: the way of deciding is the circle's" }),
    villagesWayNotCircles: (circle) => msg({ message: `The village's way. ${circle} has not set one of its own.`, context: "role card" }),
    flipSubWork: (written, of) => msg({ message: `What it decides on and answers for. ${written} of ${of} written down.`, context: "role card" }),
    flipSub: (written, of) => msg({ message: `Its commitments. ${written} of ${of} written down.`, context: "role card" }),
    powers: (n) => msg({ message: plural(n, { one: "Power", other: "Powers" }), context: "role card: a figure's label" }),
    withPowers: (roleWord) => msg({ message: `A ${roleWord} with powers`, context: "role card: eyebrow, the village's word for a role" }),
    srBelowRung: msg({ message: ", below the rung it asks for", context: "role card: screen reader, after a rung" }),
    srAtRung: msg({ message: ", the rung it asks for", context: "role card: screen reader, after a rung" }),
    srAlsoQualifies: msg({ message: ", also qualifies", context: "role card: screen reader, after a rung" }),
    state: {
      open: msg({ message: "Open", context: "role card: a role's state" }),
      partial: msg({ message: "Partly held", context: "role card: a role's state" }),
      filled: msg({ message: "Held", context: "role card: a role's state" }),
      forming: msg({ message: "Forming", context: "role card: a role's state" }),
      expired: msg({ message: "Ready to be re-chosen", context: "role card: a role's state" }),
    },
  },
  labels: {
    aim: msg({ message: "Aim", context: "role card: a commitment" }),
    domain: msg({ message: "Decides on", context: "role card: a commitment" }),
    accountabilities: msg({ message: "Answers for", context: "role card: a commitment" }),
    why: msg({ message: "Why it matters", context: "role card: a commitment" }),
    term: msg({ message: "Term", context: "role card: a commitment" }),
    nextHolder: msg({ message: "Next holder", context: "role card: a commitment" }),
    decides: msg({ message: "Way of deciding", context: "role card: a commitment" }),
  },
  phrases: {
    aim: msg({ message: "what it works toward", context: "role card: a commitment inside a sentence" }),
    domain: msg({ message: "what it decides on", context: "role card: a commitment inside a sentence" }),
    accountabilities: msg({ message: "what it answers for", context: "role card: a commitment inside a sentence" }),
    why: msg({ message: "why it matters", context: "role card: a commitment inside a sentence" }),
    term: msg({ message: "when the term ends", context: "role card: a commitment inside a sentence" }),
    nextHolder: msg({ message: "how the next holder is chosen", context: "role card: a commitment inside a sentence" }),
    decides: msg({ message: "how its decisions pass", context: "role card: a commitment inside a sentence" }),
  },
  seatPreviewSub: (picked) =>
    picked > 1
      ? msg({ message: "Shows the first role you picked. Your terms cover every role you picked.", context: "role card" })
      : msg({ message: "Shows the role you picked.", context: "role card" }),
  suitsLabel: (className) => msg({ message: `Suits ${className}`, context: "role card: a chip, the class this role suits" }),
  speaksForLabel: (circle) => msg({ message: `Speaks for ${circle}`, context: "role card: a chip" }),
  speaksForGloss: (circle) => msg({ message: `This role speaks for ${circle} on how it decides.`, context: "role card" }),
  moreOpenLine: (n) => msg({ message: plural(n, { one: "+# more open place", other: "+# more open places" }), context: "role card" }),
  notReadLine: (keys) => (keys.length ? msg({ message: `Not read: ${keys.join(", ")}.`, context: "role card: the proposal preview" }) : null),
  rungLine: (stageName) => msg({ message: `Asks for ${stageName} or above. The vote turns away anyone on a lower rung.`, context: "role card" }),
  keptByLine: (keeper) => msg({ message: `Kept by ${keeper}`, context: "role card: under an agent, the member who keeps it" }),
};

/** The role card's words in `i18n`'s language, for code outside a component. */
export function roleSheetWords(i18n: I18n = appI18n): RoleSheetWords {
  return drawWords(ROLE_SHEET_MIRROR, i18n);
}

/** The role card's words in the reader's language. */
export function useRoleSheetWords(): RoleSheetWords {
  return useWords(ROLE_SHEET_MIRROR);
}
