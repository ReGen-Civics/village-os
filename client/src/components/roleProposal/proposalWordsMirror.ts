/**
 * THE ROLE PROPOSAL'S WORDS IN THE READER'S LANGUAGE: the mirror of `RP_WORDS` (./proposalWords.ts), every
 * fixed word /propose-a-role and the shared proposal draw.
 *
 * `RP_WORDS` stays the English source; the components draw this mirror through `useProposalWords()` (or
 * `proposalWords()` outside a component). Typed off `RP_WORDS`, so a key added there and not here fails the
 * compiler; proposalWordsMirror.test.ts holds the English equal and every entry to the catalog.
 */
// A value import of the runtime: precompileEnglish compiles the messages of a file that imports it and skips one
// that only uses `msg` (client/src/components/roleCard/payBandWords.ts says the same).
import { i18n as appI18n, type I18n } from "@lingui/core";
import { msg, plural } from "@lingui/core/macro";
import { drawWords, useWords, type Drawn, type WordMirror } from "@/i18n/wordTable";
import type { RP_WORDS } from "./proposalWords";

export type ProposalWords = Drawn<typeof RP_WORDS>;

export const RP_MIRROR: WordMirror<typeof RP_WORDS> = {
  propose: msg({ message: "Propose my roles for next season", context: "role proposal: propose" }),
  continue: msg({ message: "Continue my proposal for next season", context: "role proposal: continue" }),
  profileKicker: msg({ message: "Next season", context: "role proposal: profileKicker" }),
  profilePropose: msg({ message: "Propose your role", context: "role proposal: profilePropose" }),
  profileProposeLine: msg({ message: "Say the roles you will hold next season.", context: "role proposal: profileProposeLine" }),
  profileContinue: msg({ message: "Continue your role proposal", context: "role proposal: profileContinue" }),
  profileSubmitted: msg({ message: "Your role proposal", context: "role proposal: profileSubmitted" }),
  profileSee: msg({ message: "See where it stands", context: "role proposal: profileSee" }),
  profileFailed: msg({ message: "Your role proposal did not load.", context: "role proposal: profileFailed" }),
  title: msg({ message: "Propose my roles for next season", context: "role proposal: title" }),
  forSeason: (name, starts) => {
    const title = String(name ?? "").trim();
    const day = String(starts ?? "").trim();
    if (!title) return day ? msg({ message: `For next season, starting ${day}.`, context: "role proposal: forSeason, no season named" }) : msg({ message: "For next season.", context: "role proposal: forSeason, no season named" });
    return day ? msg({ message: `For ${title}, starting ${day}.`, context: "role proposal: forSeason" }) : msg({ message: `For ${title}.`, context: "role proposal: forSeason" });
  },
  signIn: msg({ message: "Sign in to propose your roles.", context: "role proposal: signIn" }),
  signInLine: msg({ message: "Propose the roles you will hold next season, and share the draft for feedback before you submit it.", context: "role proposal: signInLine" }),
  membersOnly: msg({ message: "Proposing roles opens at the member rung.", context: "role proposal: membersOnly" }),
  starting: msg({ message: "Starting from your current card", context: "role proposal: starting" }),
  reading: msg({ message: "Reading your proposal", context: "role proposal: reading" }),
  missing: msg({ message: "There is no proposal by that id.", context: "role proposal: missing" }),
  stepOf: (n, of) => msg({ message: `Step ${n} of ${of}`, context: "role proposal: stepOf" }),
  goToStep: (n, title) => msg({ message: `Step ${n}: ${title}`, context: "role proposal: goToStep" }),
  back: msg({ message: "Back", context: "role proposal: back" }),
  next: msg({ message: "Next", context: "role proposal: next" }),
  saving: msg({ message: "Saving", context: "role proposal: saving" }),
  saved: msg({ message: "Saved", context: "role proposal: saved" }),
  savedReturn: msg({ message: "Saved. Come back from your profile.", context: "role proposal: savedReturn" }),
  welcomeTitle: msg({ message: "Let's draft your roles", context: "role proposal: welcomeTitle" }),
  welcomeLede: msg({ message: "Three short questions, then we draft it with you. Save and come back any time.", context: "role proposal: welcomeLede" }),
  guideHere: (who) => msg({ message: `Your guide here is ${who}.`, context: "role proposal: guideHere" }),
  termsLoading: msg({ message: "Loading your terms…", context: "role proposal: termsLoading" }),
  opsFillsOpen: (ops) => msg({ message: `Anything left open, you fill in together with ${ops}.`, context: "role proposal: opsFillsOpen" }),
  quickPath: msg({ message: "Quick path", context: "role proposal: quickPath" }),
  fullControl: msg({ message: "All the steps", context: "role proposal: fullControl" }),
  yourWordsTitle: msg({ message: "In your words", context: "role proposal: yourWordsTitle" }),
  yourWordsLede: msg({ message: "Write the way you talk. These stay exactly as you wrote them.", context: "role proposal: yourWordsLede" }),
  yourWordsKept: msg({ message: "Your words, kept as you wrote them", context: "role proposal: yourWordsKept" }),
  anyLanguage: msg({ message: "Any language is welcome. Write in the language you think in.", context: "role proposal: anyLanguage" }),
  love: msg({ message: "What do you love doing?", context: "role proposal: love" }),
  offer: msg({ message: "What would you offer the village?", context: "role proposal: offer" }),
  whyHere: msg({ message: "Why here, why now?", context: "role proposal: whyHere" }),
  loveHint: msg({ message: "A ramble is welcome. Speak it if that is easier.", context: "role proposal: loveHint" }),
  startQuestions: msg({ message: "Start the three questions", context: "role proposal: startQuestions" }),
  goFailed: msg({ message: "That did not save, so you are still on this step. Your words are kept on this page. Check your connection, then try again.", context: "role proposal: goFailed" }),
  stayHere: msg({ message: "Stay here", context: "role proposal: stayHere" }),
  editYourWords: msg({ message: "Edit your words", context: "role proposal: editYourWords" }),
  onToRoles: msg({ message: "Pick the roles", context: "role proposal: onToRoles" }),
  proposeThisRole: msg({ message: "Propose this role for next season", context: "role proposal: proposeThisRole" }),
  commitmentQuestion: msg({ message: "How much energy and attention does each role get?", context: "role proposal: commitmentQuestion" }),
  commitmentChoose: msg({ message: "Choose a commitment", context: "role proposal: commitmentChoose" }),
  notSureYet: msg({ message: "Not sure yet", context: "role proposal: notSureYet" }),
  notSureLine: (partner) => msg({ message: `Leave these open. We'll fill them together with ${partner}.`, context: "role proposal: notSureLine" }),
  notSaved: msg({ message: "Not saved, try again", context: "role proposal: notSaved" }),
  tryAgain: msg({ message: "Try again", context: "role proposal: tryAgain" }),
  rolesLede: msg({ message: "Pick the roles you will hold next season: ones you hold now, open roles, or roles someone else holds now. Or propose a new role.", context: "role proposal: rolesLede" }),
  picked: (n, max) => msg({ message: `${n} of at most ${max} picked.`, context: "role proposal: picked" }),
  atMost: (max) => msg({ message: `One proposal holds at most ${max} roles. Take one off to add another.`, context: "role proposal: atMost" }),
  youHold: msg({ message: "Roles you hold", context: "role proposal: youHold" }),
  open: msg({ message: "Open roles", context: "role proposal: open" }),
  othersHold: msg({ message: "Roles someone else holds now", context: "role proposal: othersHold" }),
  noRolesYet: msg({ message: "This village has no roles on its chart yet. Propose a new one below.", context: "role proposal: noRolesYet" }),
  loadingRoles: msg({ message: "Reading the roles", context: "role proposal: loadingRoles" }),
  rolesFailed: msg({ message: "The roles did not load. Try again in a moment.", context: "role proposal: rolesFailed" }),
  roleNotOnChart: msg({ message: "That role is not on the chart, so it was left off this proposal.", context: "role proposal: roleNotOnChart" }),
  circleLine: (circle, purpose) => (purpose ? msg({ message: `${circle}: ${purpose}`, context: "role proposal: circleLine, a circle and its purpose" }) : [circle]),
  noCircle: msg({ message: "Not in a circle yet", context: "role proposal: noCircle" }),
  youHoldThis: msg({ message: "You hold this role now", context: "role proposal: youHoldThis" }),
  heldBy: (n) => msg({ message: plural(n, { one: "Held by # other member now", other: "Held by # other members now" }), context: "role proposal: heldBy" }),
  places: (free, of) => msg({ message: plural(free, { one: `# of ${of} places open`, other: `# of ${of} places open` }), context: "role proposal: places" }),
  everyPlaceHeld: msg({ message: "Every place is held now", context: "role proposal: everyPlaceHeld" }),
  applying: (n) => msg({ message: plural(n, { one: "# other member is applying", other: "# other members are applying" }), context: "role proposal: applying" }),
  newRoleHeading: msg({ message: "Propose a new role", context: "role proposal: newRoleHeading" }),
  newRoleLede: msg({ message: "A new role sits in a circle, and that circle consents to it with the rest of your proposal.", context: "role proposal: newRoleLede" }),
  newRoleName: msg({ message: "The new role's name", context: "role proposal: newRoleName" }),
  newRoleCircle: msg({ message: "The circle it sits in", context: "role proposal: newRoleCircle" }),
  pickCircle: msg({ message: "Pick a circle", context: "role proposal: pickCircle" }),
  addNewRole: msg({ message: "Add this new role", context: "role proposal: addNewRole" }),
  addAnotherRole: msg({ message: "Add another role", context: "role proposal: addAnotherRole" }),
  suggestionsHeading: msg({ message: "Roles that fit your words", context: "role proposal: suggestionsHeading" }),
  suggested: msg({ message: "Suggested", context: "role proposal: suggested" }),
  noSuggestions: msg({ message: "No role suggestions from your words yet; pick below, or propose a new one.", context: "role proposal: noSuggestions" }),
  fromYourWords: msg({ message: "From your words:", context: "role proposal: fromYourWords" }),
  removeNewRole: (name) => msg({ message: `Take ${name} off this proposal`, context: "role proposal: removeNewRole" }),
  newRoleTag: msg({ message: "New role", context: "role proposal: newRoleTag" }),
  noCircles: msg({ message: "This village has no circles yet, so a new role has nowhere to sit.", context: "role proposal: noCircles" }),
  wordsLede: msg({ message: "These are the words on each role's card. Change any of them for next season. A change shows in gold.", context: "role proposal: wordsLede" }),
  pickRoleFirst: msg({ message: "Pick at least one role first, on the step before this one.", context: "role proposal: pickRoleFirst" }),
  whichRole: msg({ message: "Which role", context: "role proposal: whichRole" }),
  changed: msg({ message: "Changed from the posted role", context: "role proposal: changed" }),
  isNew: msg({ message: "New", context: "role proposal: isNew" }),
  seePosted: msg({ message: "See the posted words", context: "role proposal: seePosted" }),
  posted: msg({ message: "The posted words", context: "role proposal: posted" }),
  nothingPosted: msg({ message: "Nothing is written on the posted role.", context: "role proposal: nothingPosted" }),
  onePerLine: msg({ message: "One per line.", context: "role proposal: onePerLine" }),
  countOnMeHint: msg({ message: "3 to 6 things, one per line.", context: "role proposal: countOnMeHint" }),
  reviewOn: msg({ message: "Review date", context: "role proposal: reviewOn" }),
  reviewHint: msg({ message: "The day this role is reviewed. Leave it empty if there is none yet.", context: "role proposal: reviewHint" }),
  roleName: msg({ message: "Role name", context: "role proposal: roleName" }),
  fromHolder: msg({ message: "From whoever holds it now", context: "role proposal: fromHolder" }),
  fromHolderLede: msg({ message: "The runbook and how ready the role is to hand over, as they stand on the posted role.", context: "role proposal: fromHolderLede" }),
  noRunbook: msg({ message: "No runbook written yet", context: "role proposal: noRunbook" }),
  seasonLede: msg({ message: "Your own aim and goals for next season, and how they serve the village's goals for that season.", context: "role proposal: seasonLede" }),
  aim: msg({ message: "Your aim for the season", context: "role proposal: aim" }),
  aimHelp: msg({ message: "What will be true at the end of next season because of you.", context: "role proposal: aimHelp" }),
  orgGoalsHeading: msg({ message: "The village's goals for next season", context: "role proposal: orgGoalsHeading" }),
  noOrgGoals: msg({ message: "The village hasn't set next season's goals yet.", context: "role proposal: noOrgGoals" }),
  noOrgGoalsLine: msg({ message: "You can save your season anyway, and come back to these once they are set.", context: "role proposal: noOrgGoalsLine" }),
  termsLede: msg({ message: "One set of terms covers every role in this proposal. Each role keeps its own review date.", context: "role proposal: termsLede" }),
  reviewDates: msg({ message: "Review dates", context: "role proposal: reviewDates" }),
  termsHeading: msg({ message: "Your terms", context: "role proposal: termsHeading" }),
  termsNotSaved: msg({ message: "These terms are not saved until the lines in red are fixed.", context: "role proposal: termsNotSaved" }),
  previewLede: msg({ message: "Your card as the circle will read it. Words you changed show in gold.", context: "role proposal: previewLede" }),
  previewFailed: msg({ message: "The preview did not load.", context: "role proposal: previewFailed" }),
  loadingPreview: msg({ message: "Drawing your card", context: "role proposal: loadingPreview" }),
  shareHeading: msg({ message: "Share it for feedback", context: "role proposal: shareHeading" }),
  shareLede: msg({ message: "Share a link to this draft before you submit it, and read the feedback here.", context: "role proposal: shareLede" }),
  shareOff: msg({ message: "The link is off. Nobody else can read this draft.", context: "role proposal: shareOff" }),
  makeLink: msg({ message: "Make a share link", context: "role proposal: makeLink" }),
  sendToOps: (who) => msg({ message: `Send to ${who} to finish the terms together`, context: "role proposal: sendToOps" }),
  sendOpsLine: (who) => {
    const role = `${who.charAt(0).toUpperCase()}${who.slice(1)}`;
    return msg({ message: `The terms are still open. ${role} can read this draft and fill them with you.`, context: "role proposal: sendOpsLine, the operations role" });
  },
  sentToOps: (who) => msg({ message: `Sent. ${who} can open the link.`, context: "role proposal: sentToOps" }),
  whoReads: msg({ message: "Who can read it", context: "role proposal: whoReads" }),
  membersOnlyTier: msg({ message: "Members of the village", context: "role proposal: membersOnlyTier" }),
  membersOnlyLine: msg({ message: "Members with the link read it, terms included, and can leave feedback.", context: "role proposal: membersOnlyLine" }),
  anyoneTier: msg({ message: "Anyone with the link", context: "role proposal: anyoneTier" }),
  anyoneLine: msg({ message: "Anyone with the link reads the roles and their words. Terms, your season and feedback stay with members.", context: "role proposal: anyoneLine" }),
  copyLink: msg({ message: "Copy the link", context: "role proposal: copyLink" }),
  copied: msg({ message: "Copied", context: "role proposal: copied" }),
  copyFailed: msg({ message: "Copy did not work. Select the link and copy it.", context: "role proposal: copyFailed" }),
  regenerate: msg({ message: "Make a new link", context: "role proposal: regenerate" }),
  regenerated: msg({ message: "A new link is made. The old one no longer opens anything.", context: "role proposal: regenerated" }),
  turnOff: msg({ message: "Turn the link off", context: "role proposal: turnOff" }),
  openShared: msg({ message: "Open the shared view", context: "role proposal: openShared" }),
  theLink: msg({ message: "The share link", context: "role proposal: theLink" }),
  feedbackHeading: msg({ message: "Feedback", context: "role proposal: feedbackHeading" }),
  noFeedback: msg({ message: "No feedback yet.", context: "role proposal: noFeedback" }),
  fromWho: (from, on) => msg({ message: `${from}, ${on}`, context: "role proposal: fromWho" }),
  submitHeading: msg({ message: "Submit for next season", context: "role proposal: submitHeading" }),
  submit: msg({ message: "Submit for next season", context: "role proposal: submit" }),
  whoApproves: msg({ message: "The circle consents within 2 business days, or a founder or steward role adopts it.", context: "role proposal: whoApproves" }),
  youAlign: msg({ message: "You align with these words when you submit:", context: "role proposal: youAlign" }),
  confirm: msg({ message: "Yes, submit it", context: "role proposal: confirm" }),
  notYet: msg({ message: "Not yet", context: "role proposal: notYet" }),
  submitted: msg({ message: "Submitted. Your circle is asked now.", context: "role proposal: submitted" }),
  stateHeading: msg({ message: "Where it stands", context: "role proposal: stateHeading" }),
  seeApplication: msg({ message: "See the proposal", context: "role proposal: seeApplication" }),
  submittedOn: (day) => msg({ message: `Submitted on ${day}.`, context: "role proposal: submittedOn" }),
  myProposals: msg({ message: "My role proposals", context: "role proposal: myProposals" }),
  proposalFor: (season) => {
    const name = season.trim();
    return name ? msg({ message: `Role proposal for ${name}`, context: "role proposal: proposalFor" }) : msg({ message: "Role proposal for next season", context: "role proposal: proposalFor" });
  },
  proposalNoSeason: msg({ message: "Role proposal for next season", context: "role proposal: proposalNoSeason" }),
  draftWords: msg({ message: "Draft, not submitted yet", context: "role proposal: draftWords" }),
  sharedTitle: msg({ message: "A role proposal for next season", context: "role proposal: sharedTitle" }),
  yourOwn: msg({ message: "This is your own proposal.", context: "role proposal: yourOwn" }),
  editYourOwn: msg({ message: "Open it to edit", context: "role proposal: editYourOwn" }),
  linkOff: msg({ message: "This link is no longer shared.", context: "role proposal: linkOff" }),
  sharedSignIn: msg({ message: "Sign in as a member of the village to read this proposal.", context: "role proposal: sharedSignIn" }),
  readOnly: msg({ message: "You are reading this proposal. Feedback is for members of the village.", context: "role proposal: readOnly" }),
  feedbackLabel: msg({ message: "Your feedback", context: "role proposal: feedbackLabel" }),
  feedbackHelp: msg({ message: "Up to 1000 characters. The member who wrote this proposal reads it.", context: "role proposal: feedbackHelp" }),
  sendFeedback: msg({ message: "Send feedback", context: "role proposal: sendFeedback" }),
  yourFeedback: msg({ message: "Your feedback so far", context: "role proposal: yourFeedback" }),
  feedbackSent: msg({ message: "Sent.", context: "role proposal: feedbackSent" }),
  submittedNoFeedback: msg({ message: "This proposal is submitted, so feedback is closed.", context: "role proposal: submittedNoFeedback" }),
  aiHelp: msg({ message: "Let AI help me with this", context: "role proposal: aiHelp" }),
  useSuggestion: msg({ message: "Use this", context: "role proposal: useSuggestion" }),
};

let last: { i18n: I18n; locale: string; messages: unknown; words: ProposalWords } | null = null;

/** The proposal words in `i18n`'s language, for a helper outside a component. Drawn once per language. */
export function proposalWords(i18n: I18n = appI18n): ProposalWords {
  if (last && last.i18n === i18n && last.locale === i18n.locale && last.messages === i18n.messages) return last.words;
  const words = drawWords(RP_MIRROR, i18n);
  last = { i18n, locale: i18n.locale, messages: i18n.messages, words };
  return words;
}

/** The proposal words in the reader's language. */
export function useProposalWords(): ProposalWords {
  return useWords(RP_MIRROR);
}
