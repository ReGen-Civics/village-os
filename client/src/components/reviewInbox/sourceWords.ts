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
  what: MessageDescriptor;
  does: MessageDescriptor;
  door: MessageDescriptor;
}

/* Each entry names its words literally, so the catalog extracts them. */
export const SOURCE_WORDS: Record<InboxSource, SourceWords> = {
  connector: {
    what: msg({ context: "review inbox: a row, what it is", message: "A proposed change" }),
    does: msg({ context: "review inbox: a row, what deciding it does", message: "Accepting it puts it live on its page." }),
    door: msg({ context: "review inbox: a row, the door", message: "Decide it" }),
  },
  intake: {
    what: msg({ context: "review inbox: a row, what it is", message: "A suggestion from Sera or an outside service" }),
    does: msg({ context: "review inbox: a row, what deciding it does", message: "Accepting it adds it to the village." }),
    door: msg({ context: "review inbox: a row, the door", message: "Read and decide" }),
  },
  sera: {
    what: msg({ context: "review inbox: a row, what it is", message: "A place where Sera's memory differs from the village" }),
    does: msg({ context: "review inbox: a row, what deciding it does", message: "Deciding says which one is right." }),
    door: msg({ context: "review inbox: a row, the door", message: "Compare them" }),
  },
  quest: {
    what: msg({ context: "review inbox: a row, what it is", message: "A quest idea" }),
    does: msg({ context: "review inbox: a row, what deciding it does", message: "Approving it puts it on the quest board." }),
    door: msg({ context: "review inbox: a row, the door", message: "Read the idea" }),
  },
  claim: {
    what: msg({ context: "review inbox: a row, what it is", message: "Finished work" }),
    does: msg({ context: "review inbox: a row, what deciding it does", message: "Witnessing it records the work as done." }),
    door: msg({ context: "review inbox: a row, the door", message: "Witness it" }),
  },
  approval: {
    what: msg({ context: "review inbox: a row, what it is", message: "A change waiting on your approval" }),
    does: msg({ context: "review inbox: a row, what deciding it does", message: "Approving it lets it go live." }),
    door: msg({ context: "review inbox: a row, the door", message: "Read and approve" }),
  },
  agent: {
    what: msg({ context: "review inbox: a row, what it is", message: "Something an agent filed" }),
    does: msg({ context: "review inbox: a row, what deciding it does", message: "Approving it lets it go live. Seatings are listed in the order they arrived." }),
    door: msg({ context: "review inbox: a row, the door", message: "Read and approve" }),
  },
  vote: {
    what: msg({ context: "review inbox: a row, what it is", message: "A vote" }),
    does: msg({ context: "review inbox: a row, what deciding it does", message: "Your vote counts toward the village's decision." }),
    door: msg({ context: "review inbox: a row, the door", message: "Vote" }),
  },
  consent: {
    what: msg({ context: "review inbox: a row, what it is", message: "A consent round" }),
    does: msg({ context: "review inbox: a row, what deciding it does", message: "Your consent, or your objection, decides whether it goes ahead." }),
    door: msg({ context: "review inbox: a row, the door", message: "Give your answer" }),
  },
  application: {
    what: msg({ context: "review inbox: a row, what it is", message: "An application for a role" }),
    does: msg({ context: "review inbox: a row, what deciding it does", message: "Deciding answers the applicant." }),
    door: msg({ context: "review inbox: a row, the door", message: "Read the application" }),
  },
  open: {
    what: msg({ context: "review inbox: a row, what it is", message: "A proposal from outside the village" }),
    does: msg({ context: "review inbox: a row, what deciding it does", message: "Deciding answers the person who sent it." }),
    door: msg({ context: "review inbox: a row, the door", message: "Read the proposal" }),
  },
  structure: {
    what: msg({ context: "review inbox: a row, what it is", message: "An org chart draft" }),
    does: msg({ context: "review inbox: a row, what deciding it does", message: "Publishing it changes the org chart now." }),
    door: msg({ context: "review inbox: a row, the door", message: "Read the draft" }),
  },
  change: {
    what: msg({ context: "review inbox: a row, what it is", message: "A change request" }),
    does: msg({ context: "review inbox: a row, what deciding it does", message: "Your review moves it toward a vote." }),
    door: msg({ context: "review inbox: a row, the door", message: "Review it" }),
  },
  suggestion: {
    what: msg({ context: "review inbox: a row, what it is", message: "A suggested edit to something you hold" }),
    does: msg({ context: "review inbox: a row, what deciding it does", message: "Accepting it makes the edit." }),
    door: msg({ context: "review inbox: a row, the door", message: "Read the edit" }),
  },
  hand: {
    what: msg({ context: "review inbox: a row, what it is", message: "A member asking to hold a power" }),
    does: msg({ context: "review inbox: a row, what deciding it does", message: "Deciding gives them the power, or does not." }),
    door: msg({ context: "review inbox: a row, the door", message: "Answer" }),
  },
  tension: {
    what: msg({ context: "review inbox: a row, what it is", message: "A tension raised with your role" }),
    does: msg({ context: "review inbox: a row, what deciding it does", message: "Answering it closes it or turns it into work." }),
    door: msg({ context: "review inbox: a row, the door", message: "Answer it" }),
  },
  task: {
    what: msg({ context: "review inbox: a row, what it is", message: "Done work to accept" }),
    does: msg({ context: "review inbox: a row, what deciding it does", message: "Accepting it closes the task." }),
    door: msg({ context: "review inbox: a row, the door", message: "Accept it" }),
  },
  handoff: {
    what: msg({ context: "review inbox: a row, what it is", message: "A task handed to you" }),
    does: msg({ context: "review inbox: a row, what deciding it does", message: "Taking it makes it yours." }),
    door: msg({ context: "review inbox: a row, the door", message: "Answer" }),
  },
  recap: {
    what: msg({ context: "review inbox: a row, what it is", message: "A moon recap" }),
    does: msg({ context: "review inbox: a row, what deciding it does", message: "Approving it moves it to its next stage." }),
    door: msg({ context: "review inbox: a row, the door", message: "Review the recap" }),
  },
  cash: {
    what: msg({ context: "review inbox: a row, what it is", message: "Cash owed for work" }),
    does: msg({ context: "review inbox: a row, what deciding it does", message: "Paying it records the payment." }),
    door: msg({ context: "review inbox: a row, the door", message: "Open the payouts" }),
  },
  owed: {
    what: msg({ context: "review inbox: a row, what it is", message: "A posting owed for finished work" }),
    does: msg({ context: "review inbox: a row, what deciding it does", message: "Posting it gives the recognition." }),
    door: msg({ context: "review inbox: a row, the door", message: "Open the postings" }),
  },
  mint: {
    what: msg({ context: "review inbox: a row, what it is", message: "A request to issue recognition" }),
    does: msg({ context: "review inbox: a row, what deciding it does", message: "Approving it issues it." }),
    door: msg({ context: "review inbox: a row, the door", message: "Review the request" }),
  },
  cycle: {
    what: msg({ context: "review inbox: a row, what it is", message: "A cycle to settle" }),
    does: msg({ context: "review inbox: a row, what deciding it does", message: "Settling it releases what the cycle holds." }),
    door: msg({ context: "review inbox: a row, the door", message: "Open the cycle" }),
  },
  cosign: {
    what: msg({ context: "review inbox: a row, what it is", message: "A key waiting for a second signature" }),
    does: msg({ context: "review inbox: a row, what deciding it does", message: "Co-signing it lets the key be planted." }),
    door: msg({ context: "review inbox: a row, the door", message: "Co-sign" }),
  },
  letter: {
    what: msg({ context: "review inbox: a row, what it is", message: "A letter waiting to be read" }),
    does: msg({ context: "review inbox: a row, what deciding it does", message: "Sending it is a person's act, on its own page." }),
    door: msg({ context: "review inbox: a row, the door", message: "Read the letter" }),
  },
  assistant: {
    what: msg({ context: "review inbox: a row, what it is", message: "A draft from the assistant" }),
    does: msg({ context: "review inbox: a row, what deciding it does", message: "Accepting it turns it into a real change." }),
    door: msg({ context: "review inbox: a row, the door", message: "Read the draft" }),
  },
  feedback: {
    what: msg({ context: "review inbox: a row, what it is", message: "Feedback" }),
    does: msg({ context: "review inbox: a row, what deciding it does", message: "Reading it marks it seen." }),
    door: msg({ context: "review inbox: a row, the door", message: "Read it" }),
  },
  vouch: {
    what: msg({ context: "review inbox: a row, what it is", message: "A place waiting for your vouch" }),
    does: msg({ context: "review inbox: a row, what deciding it does", message: "Vouching for it puts it on the map." }),
    door: msg({ context: "review inbox: a row, the door", message: "Vouch" }),
  },
  erasure: {
    what: msg({ context: "review inbox: a row, what it is", message: "Erasures to retry" }),
    does: msg({ context: "review inbox: a row, what deciding it does", message: "Retrying finishes removing a member's data." }),
    door: msg({ context: "review inbox: a row, the door", message: "Retry" }),
  },
};

/** A row's three sentences in the reader's language. */
export function sourceText(source: InboxSource, i18n: I18n = appI18n): { what: string; does: string; door: string } {
  const w = SOURCE_WORDS[source];
  return { what: i18n._(w.what), does: i18n._(w.does), door: i18n._(w.door) };
}
