import { describe, it } from "vitest";
import { ROOM_COPY } from "@shared/sessions";
import { expectMirrorMatches } from "@/i18n/wordTableTesting";
import { ROOM_MIRROR } from "./roomWords";

describe("the live session room's words in the reader's language (lane ES-A)", () => {
  it("draws exactly the shared English, and every entry goes through the catalog", () => {
    expectMirrorMatches(ROOM_COPY, ROOM_MIRROR, {
      moonOrdinal: [[3]],
      facilitatedBy: [["Ana"]],
      clockLine: [[12, 60]],
      browsing: [["the agenda", "the check-in"]],
      breathRound: [[2, 3]],
      breathStepLine: [
        [1, 1, 3],
        [4, 2, 3],
      ],
      breathCounts: [[[4, 7, 8]], [[4]]],
      breathStartedSay: [[3]],
      sitMinutesWord: [[1], [5]],
      sitLeft: [[0], [65], [600]],
      sitStartedSay: [[1], [10]],
      roomMovedTo: [["The garden"]],
      agendaFitLine: [[40, 20]],
      tallyLine: [
        [{ consent: 3, concern: 1, object: 0, waiting: 2 }],
        [{ consent: 3, concern: 1, object: 1, sleeping: 1, byDefault: 2, waiting: 0 }],
      ],
      talliedLine: [[{ consent: 3, concern: 0, object: 0 }], [{ consent: 3, concern: 1, object: 1, sleeping: 2, byDefault: 1 }]],
      nightOpen: [["Ana", "Friday 9am"]],
      nightOver: [["Ana", "Friday 9am"]],
      recordNightYours: [["Friday 9am"]],
      waitingFor: [[["Ana"]], [["Ana", "Rick"]]],
      upNext: [["The garden"]],
      nowOn: [["The garden"]],
      timeUpFor: [["The garden"]],
      timeLeft: [[65], [0]],
      timeOver: [[125]],
      thank: [["Ana"]],
      thankSent: [["Ana"]],
      closedOn: [["3 Nov"]],
      arrivalNumbers: [[{ count: 5, median: 7, low: 3, high: 10 }]],
      usedOf: [[10, 60]],
      editThis: [["the agenda"]],
      countOf: [[2, 5]],
    });
  });
});
