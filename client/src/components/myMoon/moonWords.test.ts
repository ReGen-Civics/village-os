import { describe, it } from "vitest";
import { expectMirrorMatches } from "@/i18n/wordTableTesting";
import { MOON_RECAP_MIRROR, MOON_RECAP_WORDS } from "./moonWords";

describe("the moon recap's words in the reader's language (lane ES-A)", () => {
  it("draws exactly the shared English, and every entry goes through the catalog", () => {
    expectMirrorMatches(MOON_RECAP_WORDS, MOON_RECAP_MIRROR, {
      "myMoon.moonLoadOf": [[0], [1], [3]],
      "myMoon.gathered": [[0], [1], [5]],
      "myMoon.seraAdded": [[1], [4]],
      "myMoon.imported": [
        [1, 0, 0],
        [3, 2, 1],
      ],
      "myMoon.skippedItem": [[0], [4]],
      "myMoon.carriedTimes": [[1], [3]],
      "admin.saved": [[0], [1], [4]],
      "admin.settings.seraInboxPending": [["moon@village.example"]],
      "queue.outside": [[1], [3]],
      "queue.result": [
        [1, 0, 0],
        [2, 1, 3],
      ],
      "queue.approvers": [[[]], [["Ana"]], [["Ana", "Rick"]]],
      "splitPay.basis": [
        [40, 50],
        [100, 50],
      ],
      "splitPay.weighted": [[1], [2]],
      "splitPay.periodLine": [
        ["3 Nov", 12, null],
        ["3 Nov", 12, 40],
      ],
      "thanks.notice": [["Ana"]],
      "pack.added": [[1], [3]],
      "pack.merged": [[1], [3]],
      "pack.skipped": [[1], [3]],
    });
  });
});
