/**
 * WHAT EACH ROW IS, AND WHAT DECIDING IT DOES (docs/REVIEW_INBOX_PLAN.md, lane 4c; the lead, 25 Nov 2026: "too hard to
 * see with just 'open'").
 *
 * One entry per source, keyed by the source union, so a queue added to `INBOX_SOURCES` without its words fails the
 * compiler: a row is never a bare title and a bare door again. `what` names the kind of thing, `does` says in one
 * sentence what deciding it changes, and `door` is the verb on the button that opens the page it is decided on, used
 * only where the row cannot decide it itself.
 */
// A value import of the runtime, as client/src/components/roleCard/rewardWords.ts has: the build compiles the messages
// of a file that imports it and skips a file that only uses `msg`, which would ship its English uncompiled.
import { i18n as appI18n, type I18n, type MessageDescriptor } from "@lingui/core";
import { msg } from "@lingui/core/macro";
import type { InboxSource } from "@shared/reviewInboxSources";

export interface SourceWords {
  /** The group's heading on the list, and its label wherever its count is shown. */
  title: MessageDescriptor;
  what: MessageDescriptor;
  does: MessageDescriptor;
  door: MessageDescriptor;
}

/* Each entry names its words literally, so the catalog extracts them. */
export const SOURCE_WORDS: Record<InboxSource, SourceWords> = {
  connector: {
    title: msg({ context: "review inbox: section", message: "Proposed changes" }),
    what: msg({ context: "review inbox: a row, what it is", message: "A proposed change" }),
    does: msg({ context: "review inbox: a row, what deciding it does", message: "Accepting it puts it live on its page." }),
    door: msg({ context: "review inbox: a row, the door", message: "Decide it" }),
  },
  intake: {
    title: msg({ context: "review inbox: section", message: "From Sera and outside services" }),
    what: msg({ context: "review inbox: a row, what it is", message: "A suggestion from Sera or an outside service" }),
    does: msg({ context: "review inbox: a row, what deciding it does", message: "Accepting it adds it to the village." }),
    door: msg({ context: "review inbox: a row, the door", message: "Read and decide" }),
  },
  sera: {
    title: msg({ context: "review inbox: section", message: "Where Sera's memory differs" }),
    what: msg({ context: "review inbox: a row, what it is", message: "A place where Sera's memory differs from the village" }),
    does: msg({ context: "review inbox: a row, what deciding it does", message: "Deciding says which one is right." }),
    door: msg({ context: "review inbox: a row, the door", message: "Compare them" }),
  },
  quest: {
    title: msg({ context: "review inbox: section", message: "Quest ideas" }),
    what: msg({ context: "review inbox: a row, what it is", message: "A quest idea" }),
    does: msg({ context: "review inbox: a row, what deciding it does", message: "Approving it puts it on the quest board." }),
    door: msg({ context: "review inbox: a row, the door", message: "Read the idea" }),
  },
  claim: {
    title: msg({ context: "review inbox: section", message: "Finished work to witness" }),
    what: msg({ context: "review inbox: a row, what it is", message: "Finished work" }),
    does: msg({ context: "review inbox: a row, what deciding it does", message: "Witnessing it records the work as done." }),
    door: msg({ context: "review inbox: a row, the door", message: "Witness it" }),
  },
  approval: {
    title: msg({ context: "review inbox: section", message: "Approvals" }),
    what: msg({ context: "review inbox: a row, what it is", message: "A change waiting on your approval" }),
    does: msg({ context: "review inbox: a row, what deciding it does", message: "Approving it lets it go live." }),
    door: msg({ context: "review inbox: a row, the door", message: "Read and approve" }),
  },
  agent: {
    title: msg({ context: "review inbox: section", message: "From agents" }),
    what: msg({ context: "review inbox: a row, what it is", message: "Something an agent filed" }),
    does: msg({ context: "review inbox: a row, what deciding it does", message: "Approving it lets it go live. Seatings are listed in the order they arrived." }),
    door: msg({ context: "review inbox: a row, the door", message: "Read and approve" }),
  },
  vote: {
    title: msg({ context: "review inbox: section", message: "Votes waiting on you" }),
    what: msg({ context: "review inbox: a row, what it is", message: "A vote" }),
    does: msg({ context: "review inbox: a row, what deciding it does", message: "Your vote counts toward the village's decision." }),
    door: msg({ context: "review inbox: a row, the door", message: "Vote" }),
  },
  consent: {
    title: msg({ context: "review inbox: section", message: "Asked to consent" }),
    what: msg({ context: "review inbox: a row, what it is", message: "A consent round" }),
    does: msg({ context: "review inbox: a row, what deciding it does", message: "Your consent, or your objection, decides whether it goes ahead." }),
    door: msg({ context: "review inbox: a row, the door", message: "Give your answer" }),
  },
  application: {
    title: msg({ context: "review inbox: section", message: "Applications for a role" }),
    what: msg({ context: "review inbox: a row, what it is", message: "An application for a role" }),
    does: msg({ context: "review inbox: a row, what deciding it does", message: "Deciding answers the applicant." }),
    door: msg({ context: "review inbox: a row, the door", message: "Read the application" }),
  },
  open: {
    title: msg({ context: "review inbox: section", message: "Proposals from outside the village" }),
    what: msg({ context: "review inbox: a row, what it is", message: "A proposal from outside the village" }),
    does: msg({ context: "review inbox: a row, what deciding it does", message: "Deciding answers the person who sent it." }),
    door: msg({ context: "review inbox: a row, the door", message: "Read the proposal" }),
  },
  form: {
    title: msg({ context: "review inbox: section", message: "Forms to answer" }),
    what: msg({ context: "review inbox: a row, what it is", message: "A form somebody sent" }),
    does: msg({ context: "review inbox: a row, what deciding it does", message: "Answering it accepts or declines what they asked." }),
    door: msg({ context: "review inbox: a row, the door", message: "Open the form" }),
  },
  structure: {
    title: msg({ context: "review inbox: section", message: "Org chart drafts" }),
    what: msg({ context: "review inbox: a row, what it is", message: "An org chart draft" }),
    does: msg({ context: "review inbox: a row, what deciding it does", message: "Publishing it changes the org chart now." }),
    door: msg({ context: "review inbox: a row, the door", message: "Read the draft" }),
  },
  change: {
    title: msg({ context: "review inbox: section", message: "Change requests in review" }),
    what: msg({ context: "review inbox: a row, what it is", message: "A change request" }),
    does: msg({ context: "review inbox: a row, what deciding it does", message: "Your review moves it toward a vote." }),
    door: msg({ context: "review inbox: a row, the door", message: "Review it" }),
  },
  suggestion: {
    title: msg({ context: "review inbox: section", message: "Suggested edits to what you hold" }),
    what: msg({ context: "review inbox: a row, what it is", message: "A suggested edit to something you hold" }),
    does: msg({ context: "review inbox: a row, what deciding it does", message: "Accepting it makes the edit." }),
    door: msg({ context: "review inbox: a row, the door", message: "Read the edit" }),
  },
  hand: {
    title: msg({ context: "review inbox: section", message: "Members asking to hold a power" }),
    what: msg({ context: "review inbox: a row, what it is", message: "A member asking to hold a power" }),
    does: msg({ context: "review inbox: a row, what deciding it does", message: "Deciding gives them the power, or does not." }),
    door: msg({ context: "review inbox: a row, the door", message: "Answer" }),
  },
  tension: {
    title: msg({ context: "review inbox: section", message: "Tensions raised with your role" }),
    what: msg({ context: "review inbox: a row, what it is", message: "A tension raised with your role" }),
    does: msg({ context: "review inbox: a row, what deciding it does", message: "Answering it closes it or turns it into work." }),
    door: msg({ context: "review inbox: a row, the door", message: "Answer it" }),
  },
  task: {
    title: msg({ context: "review inbox: section", message: "Done work to accept" }),
    what: msg({ context: "review inbox: a row, what it is", message: "Done work to accept" }),
    does: msg({ context: "review inbox: a row, what deciding it does", message: "Accepting it closes the task." }),
    door: msg({ context: "review inbox: a row, the door", message: "Accept it" }),
  },
  handoff: {
    title: msg({ context: "review inbox: section", message: "Tasks handed to you" }),
    what: msg({ context: "review inbox: a row, what it is", message: "A task handed to you" }),
    does: msg({ context: "review inbox: a row, what deciding it does", message: "Taking it makes it yours." }),
    door: msg({ context: "review inbox: a row, the door", message: "Answer" }),
  },
  recap: {
    title: msg({ context: "review inbox: section", message: "Moon recaps to review" }),
    what: msg({ context: "review inbox: a row, what it is", message: "A moon recap" }),
    does: msg({ context: "review inbox: a row, what deciding it does", message: "Approving it moves it to its next stage." }),
    door: msg({ context: "review inbox: a row, the door", message: "Review the recap" }),
  },
  cash: {
    title: msg({ context: "review inbox: section", message: "Cash owed" }),
    what: msg({ context: "review inbox: a row, what it is", message: "Cash owed for work" }),
    does: msg({ context: "review inbox: a row, what deciding it does", message: "Paying it records the payment." }),
    door: msg({ context: "review inbox: a row, the door", message: "Open the payouts" }),
  },
  owed: {
    title: msg({ context: "review inbox: section", message: "Postings owed" }),
    what: msg({ context: "review inbox: a row, what it is", message: "A posting owed for finished work" }),
    does: msg({ context: "review inbox: a row, what deciding it does", message: "Posting it gives the recognition." }),
    door: msg({ context: "review inbox: a row, the door", message: "Open the postings" }),
  },
  mint: {
    title: msg({ context: "review inbox: section", message: "Mint requests" }),
    what: msg({ context: "review inbox: a row, what it is", message: "A request to issue recognition" }),
    does: msg({ context: "review inbox: a row, what deciding it does", message: "Approving it issues it." }),
    door: msg({ context: "review inbox: a row, the door", message: "Review the request" }),
  },
  cycle: {
    title: msg({ context: "review inbox: section", message: "Cycles to settle" }),
    what: msg({ context: "review inbox: a row, what it is", message: "A cycle to settle" }),
    does: msg({ context: "review inbox: a row, what deciding it does", message: "Settling it releases what the cycle holds." }),
    door: msg({ context: "review inbox: a row, the door", message: "Open the cycle" }),
  },
  cosign: {
    title: msg({ context: "review inbox: section", message: "Keys waiting for a co-sign" }),
    what: msg({ context: "review inbox: a row, what it is", message: "A key waiting for a second signature" }),
    does: msg({ context: "review inbox: a row, what deciding it does", message: "Co-signing it lets the key be planted." }),
    door: msg({ context: "review inbox: a row, the door", message: "Co-sign" }),
  },
  letter: {
    title: msg({ context: "review inbox: section", message: "Letters waiting to be read" }),
    what: msg({ context: "review inbox: a row, what it is", message: "A letter waiting to be read" }),
    does: msg({ context: "review inbox: a row, what deciding it does", message: "Sending it is a person's act, on its own page." }),
    door: msg({ context: "review inbox: a row, the door", message: "Read the letter" }),
  },
  assistant: {
    title: msg({ context: "review inbox: section", message: "Drafts from the assistant" }),
    what: msg({ context: "review inbox: a row, what it is", message: "A draft from the assistant" }),
    does: msg({ context: "review inbox: a row, what deciding it does", message: "Accepting it turns it into a real change." }),
    door: msg({ context: "review inbox: a row, the door", message: "Read the draft" }),
  },
  feedback: {
    title: msg({ context: "review inbox: section", message: "Feedback to read" }),
    what: msg({ context: "review inbox: a row, what it is", message: "Feedback" }),
    does: msg({ context: "review inbox: a row, what deciding it does", message: "Reading it marks it seen." }),
    door: msg({ context: "review inbox: a row, the door", message: "Read it" }),
  },
  vouch: {
    title: msg({ context: "review inbox: section", message: "Places waiting for your vouch" }),
    what: msg({ context: "review inbox: a row, what it is", message: "A place waiting for your vouch" }),
    does: msg({ context: "review inbox: a row, what deciding it does", message: "Vouching for it puts it on the map." }),
    door: msg({ context: "review inbox: a row, the door", message: "Vouch" }),
  },
  erasure: {
    title: msg({ context: "review inbox: section", message: "Erasures to retry" }),
    what: msg({ context: "review inbox: a row, what it is", message: "Erasures to retry" }),
    does: msg({ context: "review inbox: a row, what deciding it does", message: "Retrying finishes removing a member's data." }),
    door: msg({ context: "review inbox: a row, the door", message: "Retry" }),
  },
};

/** A row's three sentences in the reader's language. */
export function sourceText(source: InboxSource, i18n: I18n = appI18n): { title: string; what: string; does: string; door: string } {
  const w = SOURCE_WORDS[source];
  return { title: i18n._(w.title), what: i18n._(w.what), does: i18n._(w.does), door: i18n._(w.door) };
}
