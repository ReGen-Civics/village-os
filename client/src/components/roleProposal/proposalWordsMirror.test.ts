import { describe, it } from "vitest";
import { expectMirrorMatches } from "@/i18n/wordTableTesting";
import { RP_WORDS } from "./proposalWords";
import { RP_MIRROR } from "./proposalWordsMirror";

describe("the role proposal's words in the reader's language (lane ES-A)", () => {
  it("draws exactly RP_WORDS's English, and every entry goes through the catalog", () => {
    expectMirrorMatches(RP_WORDS, RP_MIRROR, {
      forSeason: [
        ["Rains", "1 Dec"],
        ["Rains", null],
        [null, "1 Dec"],
        ["  ", ""],
      ],
      stepOf: [[2, 5]],
      goToStep: [[2, "Your words"]],
      guideHere: [["Ana"]],
      opsFillsOpen: [["the Operations Steward"]],
      notSureLine: [["the Operations Steward"]],
      picked: [[1, 3]],
      atMost: [[3]],
      circleLine: [
        ["Land", "Tend the soil"],
        ["Land", ""],
      ],
      heldBy: [[1], [3]],
      places: [
        [1, 3],
        [2, 3],
        [0, 2],
      ],
      applying: [[1], [2]],
      removeNewRole: [["Seed keeper"]],
      sendToOps: [["the Operations Steward"]],
      sendOpsLine: [["the Operations Steward"]],
      sentToOps: [["the Operations Steward"]],
      fromWho: [["Ana", "3 Nov"]],
      submittedOn: [["3 Nov"]],
      proposalFor: [["Rains"], ["  "]],
    });
  });
});
