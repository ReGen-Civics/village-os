import { describe, it } from "vitest";
import { DECIDE_WORDS } from "@shared/openProposalDecide";
import { expectMirrorMatches } from "@/i18n/wordTableTesting";
import { DECIDE_MIRROR } from "./decideWords";

const WHY = [["not_set_up"], ["bad_address"], ["no_address"], ["failed"]] as const;

describe("the door's words in the reader's language (lane ES-A)", () => {
  it("draws exactly the shared English, and every entry goes through the catalog", () => {
    expectMirrorMatches(DECIDE_WORDS, DECIDE_MIRROR, {
      heading: [
        ["Ana", ["Treasurer"], true],
        ["", ["Treasurer", " Cook ", "Gardener"], false],
        ["Ana", [], false],
        ["", [], true],
        ["Ana", ["Treasurer", "Cook"], true],
        ["", ["Treasurer"], false],
      ],
      applies: [
        ["Ana", ["Treasurer"]],
        ["", ["Treasurer", "Cook"]],
        ["Ana", []],
        ["", []],
      ],
      fromOutsideMoon: [["3 Nov", "1 Dec"]],
      adoptedEmailed: [[14]],
      adoptedNotEmailed: WHY,
      accountNotTold: WHY,
      declinedNotEmailed: WHY,
      reissued: [[14]],
      reissuedNotEmailed: WHY,
      newInvitationAskedNotice: [["Treasurer"]],
      invitationSent: [
        ["3 Nov", true],
        ["3 Nov", false],
      ],
      seatsFull: [
        [[{ name: "Treasurer", seats: 1, taken: 1 }]],
        [
          [
            { name: "Cook", seats: 0, taken: 0 },
            { name: "Gardener", seats: 2, taken: 2 },
            { name: "Guide", seats: 4, taken: 4 },
          ],
        ],
      ],
      conversationMissing: [["Treasurer"]],
      conversationUnheld: [["Treasurer"]],
      "review.invitedNotEmailed": WHY,
      "review.notInvitedNotEmailed": WHY,
    });
  });
});
