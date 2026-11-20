import { describe, expect, it } from "vitest";
import { NO_SHARED, onboardingFor, readRoleCardShared, roleCardSharedFrom } from "./roleCardShared";

describe("the words every card shares", () => {
  it("reads each setting as lines, dropping bullets and blanks", () => {
    const vars: Record<string, string> = { "org.role_card_shared": "- Where: on the land\n\nAnswers to: the circle", "org.role_card_rhythm": "Weekly: Monday team meeting\nEach moon: recap", "org.role_card_onboarding": "" };
    expect(roleCardSharedFrom((k) => vars[k] ?? "")).toEqual({ lines: ["Where: on the land", "Answers to: the circle"], rhythm: ["Weekly: Monday team meeting", "Each moon: recap"], onboarding: [] });
  });

  it("a card's own onboarding wins, the village's stands in", () => {
    const shared = { ...NO_SHARED, onboarding: ["Village step"] };
    expect(onboardingFor(["Own step"], shared)).toEqual(["Own step"]);
    expect(onboardingFor([], shared)).toEqual(["Village step"]);
    expect(onboardingFor(undefined, NO_SHARED)).toEqual([]);
  });

  it("a bad answer draws nothing", () => {
    expect(readRoleCardShared(null)).toEqual(NO_SHARED);
    expect(readRoleCardShared({ lines: ["a", 3, " "], rhythm: "x" })).toEqual({ lines: ["a"], rhythm: [], onboarding: [] });
  });
});
