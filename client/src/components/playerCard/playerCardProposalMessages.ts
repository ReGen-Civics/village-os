/**
 * A ROLE'S OPEN PROPOSALS ON THE PLAYER CARD, as the extractor reads them (the coordinator, 26 Nov 2026: the player
 * card follow-ups). The server says these lines from the plain copy in shared/playerCardProposalMessages.ts, because
 * its build runs no macro; this file is the same messages as `msg()` calls, so `lingui extract` puts them in the
 * catalogs and their Spanish lives in client/src/locales/es.d/esb-card-proposals.po. No page imports it: it costs the
 * bundle nothing. playerCardProposalMessages.test.ts holds the two copies to the same ids.
 */
import type { MessageDescriptor } from "@lingui/core";
import { msg } from "@lingui/core/macro";

export const CARD_PROPOSAL_MESSAGES = {
  heading: msg({ message: "Proposed, waiting for consent", context: "player card role proposal, heading" }),
  proposedOn: msg({ message: "Proposed on {day}", context: "player card role proposal, proposed on" }),
  clears: msg({ message: "Clears what is written now", context: "player card role proposal, clears the words" }),
  adopt: msg({ message: "Adopt these words", context: "player card role proposal, adopt" }),
  adoptConfirm: msg({ message: "Adopt now? The role's words change for everyone.", context: "player card role proposal, adopt confirm" }),
  adoptYes: msg({ message: "Yes, adopt them", context: "player card role proposal, adopt yes" }),
  putToVillage: msg({ message: "Put it to the village", context: "player card role proposal, put to the village" }),
  putConfirm: msg({ message: "Open a village vote on these words?", context: "player card role proposal, put confirm" }),
  putYes: msg({ message: "Yes, open the vote", context: "player card role proposal, put yes" }),
  voting: msg({ message: "The village is voting on this until {day}.", context: "player card role proposal, voting until" }),
  waitingHolder: msg({ message: "The role that holds the power to change the structure decides this.", context: "player card role proposal, waiting on the holder" }),
  waitingVillage: msg({ message: "The village decides this by vote.", context: "player card role proposal, waiting on the village" }),
  blocked: msg({ message: "This cannot be adopted as it stands:", context: "player card role proposal, blocked" }),
  adopted: msg({ message: "Adopted. The role now has the new words.", context: "player card role proposal, adopted" }),
  putDone: msg({ message: "Put to the village. Members are asked to vote.", context: "player card role proposal, put done" }),
  cancel: msg({ message: "Cancel", context: "player card role proposal, cancel" }),
  failed: msg({ message: "That did not go through. Try again.", context: "player card role proposal, failed" }),
} satisfies Record<string, MessageDescriptor>;
