import { describe, it } from "vitest";
import { TASK_COPY } from "@shared/sessionTasks";
import { expectMirrorMatches } from "@/i18n/wordTableTesting";
import { TASK_MIRROR } from "./taskWords";

const NO_SKIPS = { setup: 0, members: 0, other: 0 };

describe("the task board's words in the reader's language (lane ES-A)", () => {
  it("draws exactly the shared English, and every entry goes through the catalog", () => {
    expectMirrorMatches(TASK_COPY, TASK_MIRROR, {
      from: [
        ["Garden", "3 Nov"],
        ["Land circle", "3 Nov"],
        [" Water Circle ", "3 Nov"],
      ],
      fromNoCircle: [["Weekly planning", "3 Nov"]],
      heldPerson: [["Ana"]],
      heldSeat: [
        ["Treasurer", ["Rick"]],
        ["Treasurer", ["Rick", "Ana"]],
      ],
      heldSeatVacant: [["Treasurer"]],
      due: [["Friday"]],
      duePassed: [["3 Nov"]],
      duePast: [["3 Nov"]],
      latest: [["Ordered the pipes"]],
      latestByFacilitator: [["Ordered the pipes"]],
      acceptedOn: [["3 Nov"]],
      newDate: [["Friday"]],
      doneSince: [[0], [1], [4]],
      "mail.result": [
        [3, 3, NO_SKIPS],
        [1, 4, { setup: 1, members: 1, other: 1 }],
        [0, 2, { setup: 2, members: 0, other: 0 }],
      ],
      "mail.lastSent": [["yesterday", "Ana"]],
      "mail.lastTried": [["yesterday", "Ana"]],
      "menu.waiting": [[1], [3]],
      "waitingCard.count": [[1], [2]],
      "waitingCard.nextDue": [["Friday"]],
      "waitingCard.nextDuePassed": [["3 Nov"]],
      "bell.doneLabel": [["Order the pipes"]],
      "bell.openLabel": [["Order the pipes"]],
      "bell.undoLabel": [["Order the pipes"]],
    });
  });
});
