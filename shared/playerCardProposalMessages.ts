/**
 * A ROLE'S OPEN PROPOSALS ON THE PLAYER CARD, AS MESSAGES (the coordinator, 26 Nov 2026: the player card follow-ups,
 * server-side): "Proposed, waiting for consent", "Proposed on ...", "Clears what is written now", and the words on
 * the doors that adopt a proposal (ROLE_PROPOSAL_WORDS, shared/playerCardProposals.ts).
 *
 * The server says them by the same hashed id the client macro gives each message, from the one catalog every page
 * reads (client/src/locales/es.d/esb-card-proposals.po). "Proposed on ..." is said again inside the card; the rest
 * the card's components draw themselves, so the server sends them beside the card in the reader's language
 * (`fixedProposalWords`), with the voting line as a template the doors fill with their own day. Plain objects,
 * because the server build runs no macro; the extraction source is
 * client/src/components/playerCard/playerCardProposalMessages.ts, and its test holds the two copies to one id each.
 */
import type { ROLE_PROPOSAL_WORDS } from "./playerCardProposals";

export interface ProposalMessage {
  message: string;
  context: string;
}

const m = (message: string, context: string): ProposalMessage => ({ message, context: `player card role proposal, ${context}` });

export const PROPOSAL_MESSAGES = {
  heading: m("Proposed, waiting for consent", "heading"),
  proposedOn: m("Proposed on {day}", "proposed on"),
  clears: m("Clears what is written now", "clears the words"),
  adopt: m("Adopt these words", "adopt"),
  adoptConfirm: m("Adopt now? The role's words change for everyone.", "adopt confirm"),
  adoptYes: m("Yes, adopt them", "adopt yes"),
  putToVillage: m("Put it to the village", "put to the village"),
  putConfirm: m("Open a village vote on these words?", "put confirm"),
  putYes: m("Yes, open the vote", "put yes"),
  voting: m("The village is voting on this until {day}.", "voting until"),
  waitingHolder: m("The role that holds the power to change the structure decides this.", "waiting on the holder"),
  waitingVillage: m("The village decides this by vote.", "waiting on the village"),
  blocked: m("This cannot be adopted as it stands:", "blocked"),
  adopted: m("Adopted. The role now has the new words.", "adopted"),
  putDone: m("Put to the village. Members are asked to vote.", "put done"),
  cancel: m("Cancel", "cancel"),
  failed: m("That did not go through. Try again.", "failed"),
} as const satisfies Record<string, ProposalMessage>;

export type ProposalMessageKey = keyof typeof PROPOSAL_MESSAGES;

/** One message in the reader's language. Throws when the language has none. */
export type ProposalSay = (key: ProposalMessageKey, values?: Record<string, unknown>) => string;

/** The fixed lines of ROLE_PROPOSAL_WORDS: every entry that is one line. */
export type FixedProposalKey = { [K in keyof typeof ROLE_PROPOSAL_WORDS]: (typeof ROLE_PROPOSAL_WORDS)[K] extends string ? K : never }[keyof typeof ROLE_PROPOSAL_WORDS];

/** What the card's components are sent: the fixed lines, and the voting line with `{day}` left for the doors to fill. */
export type ProposalWordsOut = Partial<Record<FixedProposalKey, string>> & { votingTemplate?: string };

/** ROLE_PROPOSAL_WORDS in the reader's language, shaped as the English. Each entry is read only when used. */
export function proposalWordsWith(s: ProposalSay): { [K in keyof typeof ROLE_PROPOSAL_WORDS]: (typeof ROLE_PROPOSAL_WORDS)[K] extends string ? string : (day: string) => string } {
  const fixed = (k: FixedProposalKey) => ({
    get() {
      return s(k);
    },
    enumerable: true,
  });
  const out = {
    proposedOn: (day: string) => s("proposedOn", { day }),
    voting: (day: string) => s("voting", { day }),
  } as ReturnType<typeof proposalWordsWith>;
  for (const k of Object.keys(PROPOSAL_MESSAGES) as ProposalMessageKey[]) {
    if (k !== "proposedOn" && k !== "voting") Object.defineProperty(out, k, fixed(k as FixedProposalKey));
  }
  return out;
}

/** The lines the card's components draw, in the reader's language. A line the language lacks is left out. */
export function fixedProposalWords(s: ProposalSay): ProposalWordsOut {
  const out: Record<string, string> = {};
  for (const k of Object.keys(PROPOSAL_MESSAGES) as ProposalMessageKey[]) {
    if (k === "proposedOn") continue;
    try {
      if (k === "voting") out.votingTemplate = s("voting", { day: "{day}" });
      else out[k] = s(k);
    } catch {
      // No words for this line: the component draws its English.
    }
  }
  return out as ProposalWordsOut;
}
