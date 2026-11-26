import { describe, it } from "vitest";
import { expectMirrorMatches } from "@/i18n/wordTableTesting";
import { ONBOARDING_WORDS } from "./OnboardingPath";
import { ONBOARDING_PATH_MIRROR } from "./onboardingPathWords";

describe("a new holder's first days in the reader's language (lane ES-A)", () => {
  it("draws exactly the English, and every entry goes through the catalog", () => {
    expectMirrorMatches(ONBOARDING_WORDS, ONBOARDING_PATH_MIRROR, {
      heading: [["Treasurer"]],
      line: [[3, "20 November"]],
      days: [
        [1, 1],
        [2, 7],
      ],
      holderOf: [["Treasurer"]],
      buddy: [["Ana"]],
      open: [[1], [4]],
      due: [[7]],
      withOwner: [["Ana"]],
      checkinOpen: [[7]],
      filed: [[7]],
    });
  });
});
