/**
 * THE DOOR'S WORDS IN THE READER'S LANGUAGE: the mirror of `DECIDE_WORDS` (shared/openProposalDecide.ts), the
 * fixed words /proposals/open/:id draws when a role holder adopts, declines or reviews an application.
 *
 * The shared table stays English: the server also answers with some of these lines. The page draws them from
 * here, through `useDecideWords()`. Typed off the shared table, so a key added there and not here fails the
 * compiler; decideWords.test.ts holds the English equal and every entry to the catalog.
 */
// A value import of the runtime: precompileEnglish compiles the messages of a file that imports it and skips one
// that only uses `msg` (client/src/components/roleCard/payBandWords.ts says the same).
import { i18n as appI18n, type I18n, type MessageDescriptor } from "@lingui/core";
import { msg } from "@lingui/core/macro";
import { DOOR, type DECIDE_WORDS, type FullSeatWords, type NotSentWhy } from "@shared/openProposalDecide";
import { drawWords, useWords, type Drawn, type WordMirror } from "@/i18n/wordTable";

export type DecideWords = Drawn<typeof DECIDE_WORDS>;

const NOT_SENT: Record<NotSentWhy, MessageDescriptor> = {
  not_set_up: msg({ message: "Email is not set up yet, so nothing went out.", context: "open proposal decide: not sent" }),
  bad_address: msg({ message: "Their address does not look like an email address, so nothing went out.", context: "open proposal decide: not sent" }),
  no_address: msg({ message: "Their address was taken off, so nothing went out.", context: "open proposal decide: not sent" }),
  failed: msg({ message: "The email did not go through.", context: "open proposal decide: not sent" }),
};

/** The roles, as one name or as all but the last and the last, for a sentence that joins them in its own words. */
function rolesIn(roles: readonly string[]): { kind: "none" } | { kind: "one"; role: string } | { kind: "many"; head: string; last: string } {
  const clean = roles.map((s) => s.trim()).filter(Boolean);
  if (clean.length === 0) return { kind: "none" };
  if (clean.length === 1) return { kind: "one", role: clean[0] };
  return { kind: "many", head: clean.slice(0, -1).join(", "), last: clean[clean.length - 1] };
}

/** "Lead Financial Steward has room for 1 person, and that place is filled" (seatCountLine). */
function seatCount(s: FullSeatWords): MessageDescriptor {
  const name = s.name;
  const seats = s.seats;
  if (seats <= 0) return msg({ message: `${name} has no places`, context: "open proposal decide: a full role" });
  if (seats === 1) return msg({ message: `${name} has room for 1 person, and that place is filled`, context: "open proposal decide: a full role" });
  if (seats === 2) return msg({ message: `${name} has room for 2 people, and both places are filled`, context: "open proposal decide: a full role" });
  return msg({ message: `${name} has room for ${seats} people, and all ${seats} places are filled`, context: "open proposal decide: a full role" });
}

export const DECIDE_MIRROR: WordMirror<typeof DECIDE_WORDS> = {
  moonEnded: msg({ message: "The moon this was proposed for has ended. You can adopt it for the moon running now; the letter will say so.", context: "open proposal decide: moonEnded" }),
  heading: (proposer, roles, moon) => {
    const who = proposer || null;
    const r = rolesIn(roles);
    if (moon) {
      if (r.kind === "none") return who ? msg({ message: `${who} proposes to hold a role this moon`, context: "open proposal decide: heading" }) : msg({ message: "Somebody proposes to hold a role this moon", context: "open proposal decide: heading" });
      if (r.kind === "one") {
        const role = r.role;
        return who ? msg({ message: `${who} proposes to hold ${role} this moon`, context: "open proposal decide: heading" }) : msg({ message: `Somebody proposes to hold ${role} this moon`, context: "open proposal decide: heading" });
      }
      const { head, last } = r;
      return who ? msg({ message: `${who} proposes to hold ${head} and ${last} this moon`, context: "open proposal decide: heading" }) : msg({ message: `Somebody proposes to hold ${head} and ${last} this moon`, context: "open proposal decide: heading" });
    }
    if (r.kind === "none") return who ? msg({ message: `${who} proposes to hold a role next season`, context: "open proposal decide: heading" }) : msg({ message: "Somebody proposes to hold a role next season", context: "open proposal decide: heading" });
    if (r.kind === "one") {
      const role = r.role;
      return who ? msg({ message: `${who} proposes to hold ${role} next season`, context: "open proposal decide: heading" }) : msg({ message: `Somebody proposes to hold ${role} next season`, context: "open proposal decide: heading" });
    }
    const { head, last } = r;
    return who ? msg({ message: `${who} proposes to hold ${head} and ${last} next season`, context: "open proposal decide: heading" }) : msg({ message: `Somebody proposes to hold ${head} and ${last} next season`, context: "open proposal decide: heading" });
  },
  applies: (proposer, roles) => {
    const who = proposer || null;
    const r = rolesIn(roles);
    if (r.kind === "none") return who ? msg({ message: `${who} applies for a role`, context: "open proposal decide: applies" }) : msg({ message: "Somebody applies for a role", context: "open proposal decide: applies" });
    if (r.kind === "one") {
      const role = r.role;
      return who ? msg({ message: `${who} applies for ${role}`, context: "open proposal decide: applies" }) : msg({ message: `Somebody applies for ${role}`, context: "open proposal decide: applies" });
    }
    const { head, last } = r;
    return who ? msg({ message: `${who} applies for ${head} and ${last}`, context: "open proposal decide: applies" }) : msg({ message: `Somebody applies for ${head} and ${last}`, context: "open proposal decide: applies" });
  },
  appliedFromOutside: msg({ message: "Applied through the village's public page. Adopted, they begin with a first cycle together.", context: "open proposal decide: appliedFromOutside" }),
  fromOutside: msg({ message: "Proposed through the village's public page. Adopted, they hold these roles from the season's first day.", context: "open proposal decide: fromOutside" }),
  fromOutsideMoon: (from, to) => msg({ message: `Proposed through the village's public page, for this moon. Adopted, they hold these roles from adoption (never before ${from}) to the next new moon, ${to}.`, context: "open proposal decide: fromOutsideMoon" }),
  rolesHeading: msg({ message: "The roles", context: "open proposal decide: rolesHeading" }),
  wordsHeading: msg({ message: "In their words", context: "open proposal decide: wordsHeading" }),
  why: msg({ message: "Why them, and why now", context: "open proposal decide: why" }),
  aim: msg({ message: "Their aim for the season", context: "open proposal decide: aim" }),
  roleGone: msg({ message: "A role no longer offered", context: "open proposal decide: roleGone" }),
  membersOnly: msg({ message: "Members read role proposals.", context: "open proposal decide: membersOnly" }),
  membersOnlyLine: msg({ message: "A proposal carries what somebody wrote to the village, so it opens at the member rung.", context: "open proposal decide: membersOnlyLine" }),
  missing: msg({ message: "There is no proposal at this address.", context: "open proposal decide: missing" }),
  loadFailed: msg({ message: "The proposal did not load. Try again.", context: "open proposal decide: loadFailed" }),
  loading: msg({ message: "Reading the proposal", context: "open proposal decide: loading" }),
  status: {
    confirmed: msg({ message: "Waiting for the village", context: "open proposal decide: status.confirmed" }),
    adopted: msg({ message: "Adopted", context: "open proposal decide: status.adopted" }),
    declined: msg({ message: "Declined", context: "open proposal decide: status.declined" }),
    withdrawn: msg({ message: "Withdrawn", context: "open proposal decide: status.withdrawn" }),
  },
  deciderHeading: msg({ message: "For the village", context: "open proposal decide: deciderHeading" }),
  deciderLine: msg({ message: "You hold the power to place people in roles. Adopt it for the village, or decline it.", context: "open proposal decide: deciderLine" }),
  adopt: msg({ message: "Adopt for the village", context: "open proposal decide: adopt" }),
  decline: msg({ message: "Decline", context: "open proposal decide: decline" }),
  declineAsk: msg({ message: "Decline it? They get a short, kind email saying no.", context: "open proposal decide: declineAsk" }),
  declineYes: msg({ message: "Yes, decline it", context: "open proposal decide: declineYes" }),
  declineNo: msg({ message: "Keep it", context: "open proposal decide: declineNo" }),
  ownProposal: msg({ message: "This proposal came from your own address, so it is decided by another holder of the power to place people in roles.", context: "open proposal decide: ownProposal" }),
  formerMember: msg({ message: "This address belongs to somebody who left the village. Welcoming a former member back is its own act, so this proposal is not adopted here. You can still decline it.", context: "open proposal decide: formerMember" }),
  door: {
    [DOOR.villageHolds]: msg({ message: "The village holds the power to place people in roles now, so nobody adopts this proposal on their own. It waits here until the village settles how it adopts one from outside.", context: "open proposal decide: door" }),
    [DOOR.nobodyHolds]: msg({ message: "Right now nobody holds the power to place people in roles, so this proposal waits here until somebody does.", context: "open proposal decide: door" }),
    [DOOR.aRoleHolds]: msg({ message: "It is adopted or declined by a holder of the power to place people in roles.", context: "open proposal decide: door" }),
    [DOOR.scaffoldingHolds]: msg({ message: "Until the village holds the power to place people in roles, the founders and stewards adopt or decline it.", context: "open proposal decide: door" }),
  },
  adoptedEmailed: (days) => msg({ message: `Adopted. Their invitation went to them by email. It works once and lasts ${days} days. If it does not reach them, make a new one from this page.`, context: "open proposal decide: adoptedEmailed" }),
  adoptedNotEmailed: (why) => [msg({ message: "Adopted.", context: "open proposal decide: adoptedNotEmailed" }), " ", NOT_SENT[why], " ", msg({ message: "Copy their invitation below and send it to them yourself.", context: "open proposal decide: adoptedNotEmailed" })],
  adoptedAccount: msg({ message: "Adopted. That address already has an account here, so no invitation was needed: their roles start on the season's first day.", context: "open proposal decide: adoptedAccount" }),
  adoptedAccountMoon: msg({ message: "Adopted. That address already has an account here, so no invitation was needed: their roles start today, for this moon.", context: "open proposal decide: adoptedAccountMoon" }),
  accountTold: msg({ message: "They were told by email as well.", context: "open proposal decide: accountTold" }),
  accountNotTold: (why) => [NOT_SENT[why], " ", msg({ message: "They see it in their notifications when they sign in.", context: "open proposal decide: accountNotTold" })],
  declinedEmailed: msg({ message: "Declined. A kind no went to them by email.", context: "open proposal decide: declinedEmailed" }),
  declinedNotEmailed: (why) => [msg({ message: "Declined.", context: "open proposal decide: declinedNotEmailed" }), " ", NOT_SENT[why]],
  reissued: (days) => msg({ message: `A new invitation is ready, and the old one no longer works. It works once and lasts ${days} days.`, context: "open proposal decide: reissued" }),
  reissuedEmailed: msg({ message: "It went to them by email.", context: "open proposal decide: reissuedEmailed" }),
  reissuedNotEmailed: (why) => [NOT_SENT[why], " ", msg({ message: "Copy it below and send it to them yourself.", context: "open proposal decide: reissuedNotEmailed" })],
  reissue: msg({ message: "Make a new invitation", context: "open proposal decide: reissue" }),
  reissueLine: msg({ message: "They have not used their invitation yet. A new one replaces it, and goes to them by email.", context: "open proposal decide: reissueLine" }),
  invitationUsed: msg({ message: "They made their account with their invitation.", context: "open proposal decide: invitationUsed" }),
  newInvitationAsked: msg({ message: "Their invitation expired, and they asked for a new one.", context: "open proposal decide: newInvitationAsked" }),
  newInvitationAskedNotice: (roles) => msg({ message: `An applicant for ${roles} asked for a new invitation. Their first one expired.`, context: "open proposal decide: newInvitationAskedNotice" }),
  invitationSent: (when, emailed) =>
    emailed
      ? msg({ message: `The invitation went to them by email on ${when}.`, context: "open proposal decide: invitationSent" })
      : msg({ message: `The invitation was made on ${when}, and the email did not go. Send it again, or hand them the link.`, context: "open proposal decide: invitationSent" }),
  copy: msg({ message: "Copy invitation", context: "open proposal decide: copy" }),
  copied: msg({ message: "Copied", context: "open proposal decide: copied" }),
  notAHolder: msg({ message: "Adopting or declining a proposal is for a live holder of the power to place people in roles.", context: "open proposal decide: notAHolder" }),
  pending: msg({ message: "That address already has an application waiting for one of these roles. Decide that one on its page first.", context: "open proposal decide: pending" }),
  decided: msg({ message: "This proposal has been decided, so there is nothing left to decide.", context: "open proposal decide: decided" }),
  raced: msg({ message: "Somebody else decided this proposal a moment ago. Read it again.", context: "open proposal decide: raced" }),
  noTermsForAnAgent: msg({ message: "An agent holds a role with no pay, allowance or commitment, so there are no terms to change.", context: "open proposal decide: noTermsForAnAgent" }),
  noInvitation: msg({ message: "There is no invitation to replace: they already made their account, or this proposal was not adopted.", context: "open proposal decide: noInvitation" }),
  notAPlace: msg({ message: "This proposal was adopted, and its roles could not be set up. Nothing was changed. Read the roles on the chart, then try again.", context: "open proposal decide: notAPlace" }),
  failed: msg({ message: "That did not reach the server. Try again.", context: "open proposal decide: failed" }),
  tooMany: msg({ message: "That is a lot of decisions in a few minutes. Wait a little and try again.", context: "open proposal decide: tooMany" }),
  seatsFull: (full) => [
    ...full.flatMap((s, i) => [i > 0 ? ". " : "", seatCount(s)]),
    ". ",
    msg({ message: "Adopting now would promise a role nobody can start. You can adopt them for when a place opens: we tell them their role starts then, never sooner.", context: "open proposal decide: seatsFull" }),
  ],
  adoptWhenASeatOpens: msg({ message: "Adopt for when a place opens", context: "open proposal decide: adoptWhenASeatOpens" }),
  forWhenASeatOpens: msg({ message: "for when a place opens", context: "open proposal decide: forWhenASeatOpens" }),
  adoptedAccountWaits: msg({ message: "Adopted for when a place opens. That address already has an account here, so no invitation was needed: their role starts once a place is free.", context: "open proposal decide: adoptedAccountWaits" }),
  leftHeading: msg({ message: "Before you can adopt", context: "open proposal decide: leftHeading" }),
  conversationMissing: (role) => msg({ message: `The conversation with ${role} is not written up yet.`, context: "open proposal decide: conversationMissing" }),
  conversationUnheld: (role) => msg({ message: `Nobody holds ${role} right now, so nobody can hold that conversation. Seat somebody in ${role} on the chart, and they can hold it.`, context: "open proposal decide: conversationUnheld" }),
  chartLink: msg({ message: "Open the chart", context: "open proposal decide: chartLink" }),
  review: {
    heading: msg({ message: "Our review", context: "open proposal decide: review.heading" }),
    line: msg({ message: "Read it through, then answer.", context: "open proposal decide: review.line" }),
    conversations: msg({ message: "The conversations, in order", context: "open proposal decide: review.conversations" }),
    noConversations: msg({ message: "This role names no conversations, so an invitation takes the application straight to the circle's decision.", context: "open proposal decide: review.noConversations" }),
    invite: msg({ message: "Invite to the conversations", context: "open proposal decide: review.invite" }),
    notInvite: msg({ message: "Send the not-invited letter", context: "open proposal decide: review.notInvite" }),
    notInviteAsk: msg({ message: "Send the not-invited letter? It thanks them, says we found someone more closely matched to this role, and points to open ways to stay close. It names no reason of its own, and your note rides with it only if you write one.", context: "open proposal decide: review.notInviteAsk" }),
    notInviteYes: msg({ message: "Yes, send the letter", context: "open proposal decide: review.notInviteYes" }),
    notInviteNo: msg({ message: "Keep reading", context: "open proposal decide: review.notInviteNo" }),
    invitedEmailed: msg({ message: "Invited. The invitation went by email, and the first conversation is open.", context: "open proposal decide: review.invitedEmailed" }),
    invitedNotEmailed: (why) => [msg({ message: "Invited.", context: "open proposal decide: review.invitedNotEmailed" }), " ", NOT_SENT[why], " ", msg({ message: "The first conversation is open, so tell them yourself.", context: "open proposal decide: review.invitedNotEmailed" })],
    notInvitedEmailed: msg({ message: "The not-invited letter went by email.", context: "open proposal decide: review.notInvitedEmailed" }),
    notInvitedNotEmailed: (why) => [msg({ message: "Recorded as not invited.", context: "open proposal decide: review.notInvitedNotEmailed" }), " ", NOT_SENT[why]],
    first: msg({ message: "Our review comes first: invite them to the conversations, or send the not-invited letter.", context: "open proposal decide: review.first" }),
    done: msg({ message: "Our review of this application is already answered.", context: "open proposal decide: review.done" }),
    none: msg({ message: "This application has no review step, so there is nothing to invite to.", context: "open proposal decide: review.none" }),
    invited: msg({ message: "Invited to the conversations", context: "open proposal decide: review.invited" }),
    inReview: msg({ message: "Waiting for our review", context: "open proposal decide: review.inReview" }),
  },
};

/** The door's words in `i18n`'s language, for code outside a component. */
export function decideWords(i18n: I18n = appI18n): DecideWords {
  return drawWords(DECIDE_MIRROR, i18n);
}

/** The door's words in the reader's language. */
export function useDecideWords(): DecideWords {
  return useWords(DECIDE_MIRROR);
}
