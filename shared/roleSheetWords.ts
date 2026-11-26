/**
 * THE ROLE CARD'S WORDS: every fixed string a seat card or a permission card
 * prints, in one place, so a component holds no copy of its own and the voice
 * gates read all of it at once.
 *
 * `shared/roleSheet.ts` re-exports everything here, so a host imports the words
 * and the view model from the same module. The two ladders' labels and the
 * phrases that name each commitment inside a sentence are keyed by
 * `CommitmentKey`, so an eighth commitment cannot render an empty chip.
 */

import type { Widened } from "./wordTableTypes";

export type CommitmentKey = "aim" | "domain" | "accountabilities" | "why" | "term" | "nextHolder" | "decides";

/** Every fixed string the card prints, so the component holds no copy of its own. */
export const SHEET_WORDS = {
  figuresName: "Right now",
  aimLabel: "Aim",
  aimMissing: "The aim is still to be written down.",
  rosterHeading: "Holding it now",
  commitmentsHeading: "Its commitments",
  flipTitle: "What it does",
  backButton: "Back to the card",
  showingBack: "Showing what it does.",
  showingFront: "Showing the card.",
  proposed: "Proposed",
  keySeat: "Key role",
  keySeatGloss: "The village marked this role as key.",
  recruiting: "Recruiting",
  recruitingGloss: "The village is looking for someone to hold this role.",
  suggestedTag: "Suggested",
  suitsGloss: "Guessed from the role's own words. Nobody has confirmed it yet. The picture is stock art for this class.",
  readyToBeRechosen: "ready to be re-chosen",
  agent: "An agent",
  seated: "Team member",
  openPlace: "Open place",
  nobodyHoldsThis: "Nobody holds this yet",
  waitingForAHand: "Waiting for a hand",
  formingPlace: "A place still forming",
  aVoteFillsThis: "A vote fills this place",
  signInToSeeNames: "Sign in to see who holds it.",
  namesNotShared: "Names are not shared on this page.",
  unreachable: "Held, and not reachable through the map yet.",
  raise: "Apply for this role",
  raiseConsequence: "Your application reaches the founding team, who will be in touch.",
  applyConsequence: "Opens your proposal for this role and its terms. A role holder or the village decides.",
  raisePlaceholder: "Why this role calls to you (optional)",
  raiseTermLabel: "End date for your role (optional)",
  raiseSubmit: "Send my application",
  cancel: "Cancel",
  raised: "Application sent. The founding team will be in touch.",
  signInToRaise: "Sign in to apply for this role",
  nobodyWroteThisSeat: "Nobody has written down what this role is for yet.",
  foundingTeamWrites: "The founding team writes these down.",
  setByHand: "This state was set by hand.",
  everyoneReady: "Everyone in this role is ready to be re-chosen.",
  atLeastOneReady: "At least one place is ready to be re-chosen.",
  termSub: "The earliest term among its holders.",
  termAtSeating: "Set when someone takes the role",
  termAtSeatingSub: "With no date asked, it ends with the season.",
  villagesWay: "The village's way.",
  proposalLead: "A preview of the text below, read the way accepting reads it.",
  proposalInvalid: "The text below is not valid JSON yet, so there is nothing to preview.",
  seatNeedsAName: "A role needs a name",
  whatItDoes: "What it does",
  roleUnwritten: "Nobody has written down what this role does yet.",
  powersHeading: "Powers it carries",
  rungHeading: "Rung it asks for",
  unknownPower: "A power this page cannot name yet",
  noRung: "This role asks for no rung.",
  unknownRung: "Asks for a rung this village no longer names.",
  livePreview: "Live preview",
  livePreviewSub: "Shows the role you picked.",
} as const;

/**
 * The line under a role application's live preview. "Shows the role you picked."
 * alone is wrong for an application with several roles, because the card shows
 * only the first (red team U11). No count: the line says which.
 */
export const seatPreviewSub = (picked: number): string =>
  picked > 1 ? "Shows the first role you picked. Your terms cover every role you picked." : "Shows the role you picked.";

export const suitsLabel = (className: string): string => `Suits ${className}`;
export const speaksForLabel = (circle: string): string => `Speaks for ${circle}`;
export const speaksForGloss = (circle: string): string => `This role speaks for ${circle} on how it decides.`;
export const moreOpenLine = (n: number): string => `+${n} more open place${n === 1 ? "" : "s"}`;
export const notReadLine = (keys: string[]): string | null => (keys.length ? `Not read: ${keys.join(", ")}.` : null);
export const rungLine = (stageName: string): string =>
  `Asks for ${stageName} or above. The vote turns away anyone on a lower rung.`;

// ── The seven commitments, in a label and inside a sentence ────────────────

export const COMMITMENT_LABELS: Record<CommitmentKey, string> = {
  aim: "Aim",
  domain: "Decides on",
  accountabilities: "Answers for",
  why: "Why it matters",
  term: "Term",
  nextHolder: "Next holder",
  decides: "Way of deciding",
};

/** How each commitment is named inside a sentence. */
export const COMMITMENT_PHRASES: Record<CommitmentKey, string> = {
  aim: "what it works toward",
  domain: "what it decides on",
  accountabilities: "what it answers for",
  why: "why it matters",
  term: "when the term ends",
  nextHolder: "how the next holder is chosen",
  decides: "how its decisions pass",
};

/** Under an agent on the roster: the member who keeps it (0374, shared/agentHolders.ts). */
export const keptByLine = (keeper: string): string => `Kept by ${keeper}`;

// ── The view model's own lines (shared/roleSheet.ts, shared/permissionSheet.ts) ──

/**
 * Every line the role card's view model builds, moved here from inline English so the card can be drawn in
 * the reader's language (lane ES-A, 26 Nov 2026). The client passes its translated copy as
 * `SheetContext.words`; anything that passes none, the server among them, reads this English.
 */
export const SHEET_LINES = {
  listOf: (head: string, last: string): string => `${head} and ${last}`,
  stillToWrite: (phrases: string): string => `Still to be written down: ${phrases}.`,
  alsoStillToWrite: (phrases: string): string => `Also still to be written down: ${phrases}.`,
  notCarried: (phrases: string): string => `This page does not carry ${phrases}.`,
  readyCount: (n: number, of: number): string => `${n} of ${of} team members ${n === 1 ? "is" : "are"} ready to be re-chosen.`,
  personTermEnds: (day: string): string => `term ends ${day}`,
  applyAria: (role: string): string => `Apply for this role: ${role}`,
  contact: (name: string): string => `Contact ${name}`,
  stockArtFor: (className: string): string => `Stock art for ${className}, a class suggested for this role`,
  stockArt: "Stock art for a class suggested for this role",
  chipAtStart: "set at the start",
  chipVillages: "the village's",
  srWritten: ", written down",
  srVillages: ", the village's way",
  srAtSeating: ", set when someone takes the role",
  srUnwritten: ", still to be written down",
  daysLeftInTerm: (n: number): string => (n === 1 ? "Day left in term" : "Days left in term"),
  daysLeftInSeason: (n: number): string => (n === 1 ? "Day left in the season" : "Days left in the season"),
  termEnds: (day: string): string => `Term ends ${day}`,
  namedSeasonEnds: (season: string, day: string): string => `${season} ends ${day}`,
  seasonEnds: (day: string): string => `The season ends ${day}`,
  places: (n: number): string => (n === 1 ? "Place" : "Places"),
  heldNow: "Held now",
  taken: "Taken",
  openPlaces: (n: number): string => (n === 1 ? "Open place" : "Open places"),
  answersFor: "Answers for",
  term: "Term",
  endsOn: (day: string): string => `Ends ${day}`,
  reachedOn: (day: string): string => `Reached its date on ${day}`,
  nextHolder: "Next holder",
  wayOfDeciding: "Way of deciding",
  circlesOwnWay: (circle: string): string => `${circle}'s own way.`,
  villagesWayNotCircles: (circle: string): string => `The village's way. ${circle} has not set one of its own.`,
  flipSubWork: (written: number, of: number): string => `What it decides on and answers for. ${written} of ${of} written down.`,
  flipSub: (written: number, of: number): string => `Its commitments. ${written} of ${of} written down.`,
  powers: (n: number): string => (n === 1 ? "Power" : "Powers"),
  withPowers: (roleWord: string): string => `A ${roleWord} with powers`,
  srBelowRung: ", below the rung it asks for",
  srAtRung: ", the rung it asks for",
  srAlsoQualifies: ", also qualifies",
  state: {
    open: "Open",
    partial: "Partly held",
    filled: "Held",
    forming: "Forming",
    expired: "Ready to be re-chosen",
  },
} as const;

/** All of the role card's words in one object: the shape the client mirrors and passes back as `SheetContext.words`. */
export const ROLE_SHEET_WORDS = {
  words: SHEET_WORDS,
  lines: SHEET_LINES,
  labels: COMMITMENT_LABELS,
  phrases: COMMITMENT_PHRASES,
  seatPreviewSub,
  suitsLabel,
  speaksForLabel,
  speaksForGloss,
  moreOpenLine,
  notReadLine,
  rungLine,
  keptByLine,
};

/** The role card's words with every literal widened, so a translated copy fits the same slot. */
export type RoleSheetWords = Widened<typeof ROLE_SHEET_WORDS>;

