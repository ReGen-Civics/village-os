import { describe, it } from "vitest";
import { ONBOARDING_WORDS } from "@shared/applicantOnboarding";
import { expectMirrorMatches } from "@/i18n/wordTableTesting";
import { ONBOARDING_MIRROR } from "./onboardingWords";

describe("the applicant's walk in the reader's language (lane ES-A)", () => {
  it("draws exactly the shared English, and every entry goes through the catalog", () => {
    expectMirrorMatches(ONBOARDING_WORDS, ONBOARDING_MIRROR, {
      ownerDefault: [["Treasurer"]],
      gatheredIntro: [["Treasurer"]],
      gatheredShort: [["Treasurer"]],
      arrivedOn: [["2026-11-03"]],
    });
  });
});
