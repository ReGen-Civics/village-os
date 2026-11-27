/**
 * THE APPLICANT'S WALK, IN THE READER'S LANGUAGE: the mirror of `ONBOARDING_WORDS` (shared/applicantOnboarding.ts),
 * the fixed words of an application's walkthrough on /proposals/open/:id and the stage list in Admin.
 *
 * The shared table stays English for the server. The pages draw this mirror through `useOnboardingWords()`.
 * Typed off the shared table, so a key added there and not here fails the compiler; onboardingWords.test.ts
 * holds the English equal and every entry to the catalog.
 */
// A value import of the runtime: precompileEnglish compiles the messages of a file that imports it and skips one
// that only uses `msg` (client/src/components/roleCard/payBandWords.ts says the same).
import { i18n as appI18n, type I18n } from "@lingui/core";
import { msg } from "@lingui/core/macro";
import type { ONBOARDING_WORDS } from "@shared/applicantOnboarding";
import { drawWords, useWords, type Drawn, type WordMirror } from "@/i18n/wordTable";

export type OnboardingWords = Drawn<typeof ONBOARDING_WORDS>;

export const ONBOARDING_MIRROR: WordMirror<typeof ONBOARDING_WORDS> = {
  heading: msg({ message: "Where this application stands", context: "applicant onboarding: heading" }),
  intro: msg({ message: "One stage at a time. People decide every step: nothing here ranks, scores or judges the applicant.", context: "applicant onboarding: intro" }),
  whoActs: msg({ message: "Who acts next", context: "applicant onboarding: whoActs" }),
  whatNext: msg({ message: "What happens next", context: "applicant onboarding: whatNext" }),
  stateWords: {
    done: msg({ message: "Done", context: "applicant onboarding: stateWords.done" }),
    now: msg({ message: "Now", context: "applicant onboarding: stateWords.now" }),
    later: msg({ message: "Later", context: "applicant onboarding: stateWords.later" }),
    skipped: msg({ message: "Skipped", context: "applicant onboarding: stateWords.skipped" }),
  },
  primary: {
    review: msg({ message: "Go to our review", context: "applicant onboarding: primary.review" }),
    shortlist: msg({ message: "Shortlist", context: "applicant onboarding: primary.shortlist" }),
    conversation: msg({ message: "Go to the conversation", context: "applicant onboarding: primary.conversation" }),
    ask_references: msg({ message: "Ask for references", context: "applicant onboarding: primary.ask_references" }),
    wait_applicant: msg({ message: "Waiting on the applicant", context: "applicant onboarding: primary.wait_applicant" }),
    follow_up: msg({ message: "Go to the follow-ups", context: "applicant onboarding: primary.follow_up" }),
    add_final: msg({ message: "Move to the final conversation", context: "applicant onboarding: primary.add_final" }),
    final_conversation: msg({ message: "Go to the final conversation", context: "applicant onboarding: primary.final_conversation" }),
    decide: msg({ message: "Go to the decision", context: "applicant onboarding: primary.decide" }),
    none: msg({ message: "Nothing to do", context: "applicant onboarding: primary.none" }),
  },
  notShortlist: msg({ message: "Not shortlisted", context: "applicant onboarding: notShortlist" }),
  shortlisted: msg({ message: "Shortlisted.", context: "applicant onboarding: shortlisted" }),
  notShortlisted: msg({ message: "Not shortlisted. The decision stays with the people who decide: decline with its letter when you are ready.", context: "applicant onboarding: notShortlisted" }),
  shortlistDone: msg({ message: "This application already has a shortlist answer.", context: "applicant onboarding: shortlistDone" }),
  shortlistWaitsReview: msg({ message: "Our review comes first: invite the applicant to the conversations before the shortlist.", context: "applicant onboarding: shortlistWaitsReview" }),
  referencesHeading: msg({ message: "References and follow-ups", context: "applicant onboarding: referencesHeading" }),
  referencesPrivate: msg({ message: "Personal details of people who never signed up. Only the people who review this application, the role that makes the final call and each reference's owner read them. No AI reads them. They are deleted with the application.", context: "applicant onboarding: referencesPrivate" }),
  referencesAsked: msg({ message: "References were asked for. The applicant adds them from their status page.", context: "applicant onboarding: referencesAsked" }),
  referencesAskedNow: msg({ message: "Asked. The letter went to the applicant in their language.", context: "applicant onboarding: referencesAskedNow" }),
  referencesAskedAlready: msg({ message: "References were already asked for.", context: "applicant onboarding: referencesAskedAlready" }),
  referencesNeedShortlist: msg({ message: "Shortlist the application before asking for references.", context: "applicant onboarding: referencesNeedShortlist" }),
  referencesFirstRoleOnly: msg({ message: "References are asked of a member only for their first long-term role, and this member already holds a role.", context: "applicant onboarding: referencesFirstRoleOnly" }),
  referencesNone: msg({ message: "No references yet.", context: "applicant onboarding: referencesNone" }),
  owner: msg({ message: "Follows up", context: "applicant onboarding: owner" }),
  ownerDefault: (role) => msg({ message: `${role} (the default)`, context: "applicant onboarding: ownerDefault" }),
  ownerNobody: msg({ message: "Nobody yet", context: "applicant onboarding: ownerNobody" }),
  ownerPick: msg({ message: "Pick who follows up", context: "applicant onboarding: ownerPick" }),
  ownerRole: msg({ message: "A role", context: "applicant onboarding: ownerRole" }),
  ownerMember: msg({ message: "A member", context: "applicant onboarding: ownerMember" }),
  ownerSaved: msg({ message: "Saved. They have been told.", context: "applicant onboarding: ownerSaved" }),
  ownerGive: msg({ message: "Give it to them", context: "applicant onboarding: ownerGive" }),
  notes: msg({ message: "Follow-up notes", context: "applicant onboarding: notes" }),
  notesSave: msg({ message: "Save my notes", context: "applicant onboarding: notesSave" }),
  notesSaved: msg({ message: "Saved.", context: "applicant onboarding: notesSaved" }),
  followedUp: msg({ message: "Followed up", context: "applicant onboarding: followedUp" }),
  notFollowedUp: msg({ message: "Not followed up yet", context: "applicant onboarding: notFollowedUp" }),
  notYours: msg({ message: "Only this reference's follow-up owner writes its notes.", context: "applicant onboarding: notYours" }),
  howKnown: msg({ message: "How they know the applicant", context: "applicant onboarding: howKnown" }),
  ally: msg({ message: "Why they might be an ally or partner", context: "applicant onboarding: ally" }),
  contact: msg({ message: "How to reach them", context: "applicant onboarding: contact" }),
  gatheredHeading: msg({ message: "Gathered for the final call", context: "applicant onboarding: gatheredHeading" }),
  gatheredIntro: (role) => msg({ message: `Everything ${role} reads before the final conversation and the decision: each reference's follow-up notes and each conversation's scorecard. Nothing is totalled or ranked.`, context: "applicant onboarding: gatheredIntro" }),
  gatheredHidden: msg({ message: "This view is for the role that makes the final call and the people who decide.", context: "applicant onboarding: gatheredHidden" }),
  scorecardsHidden: msg({ message: "Scorecards open to you once you have added your own.", context: "applicant onboarding: scorecardsHidden" }),
  finalAdded: msg({ message: "The final conversation is open. The applicant books it now, and their proposal is fixed.", context: "applicant onboarding: finalAdded" }),
  finalExists: msg({ message: "The final conversation is already open.", context: "applicant onboarding: finalExists" }),
  finalTalksFirst: msg({ message: "Write up the conversations before it first. Then move the application to the final conversation.", context: "applicant onboarding: finalTalksFirst" }),
  finalNoRole: msg({ message: "No role is named for the final call. A founder names it in the village's settings.", context: "applicant onboarding: finalNoRole" }),
  notAllowed: msg({ message: "This is for the people who review this application.", context: "applicant onboarding: notAllowed" }),
  notFound: msg({ message: "That application is not here.", context: "applicant onboarding: notFound" }),
  decided: msg({ message: "This application has been decided.", context: "applicant onboarding: decided" }),
  listHeading: msg({ message: "Applications by stage", context: "applicant onboarding: listHeading" }),
  listIntro: msg({ message: "Every open application, by stage and then by the day it arrived. Nothing here is ranked.", context: "applicant onboarding: listIntro" }),
  listEmpty: msg({ message: "No application is waiting.", context: "applicant onboarding: listEmpty" }),
  arrivedOn: (day) => msg({ message: `Arrived ${day}`, context: "applicant onboarding: arrivedOn" }),
}
;

/** The walk's words in `i18n`'s language, for code outside a component. */
export function onboardingWords(i18n: I18n = appI18n): OnboardingWords {
  return drawWords(ONBOARDING_MIRROR, i18n);
}

/** The walk's words in the reader's language. */
export function useOnboardingWords(): OnboardingWords {
  return useWords(ONBOARDING_MIRROR);
}
