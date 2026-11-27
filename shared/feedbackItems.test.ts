/**
 * The guide's title suggestion and the three kinds (the fold of /feedback into the guide's panel).
 * The suggestion is the member's own first line, cut at a word: never a summary and never a verdict.
 */
import { describe, expect, it } from "vitest";
import { FEEDBACK_KINDS, SUGGESTED_TITLE_MAX, isFeedbackKind, pageForHeard, suggestTitle } from "./feedbackItems";

describe("suggestTitle", () => {
  it("takes the first sentence, without its full stop", () => {
    expect(suggestTitle("The map is blank. I tapped a circle and waited.")).toBe("The map is blank");
  });

  it("takes the first line when the member wrote in lines", () => {
    expect(suggestTitle("quests page\nit shows nothing after I sign in")).toBe("Quests page");
  });

  it("cuts a long line at a word, and says it was cut", () => {
    const long = "When I open the calendar on my phone the days run off the right edge and I cannot reach the last two of them at all";
    const title = suggestTitle(long);
    expect(title.length).toBeLessThanOrEqual(SUGGESTED_TITLE_MAX + 1);
    expect(title.endsWith("…")).toBe(true);
    expect(long.startsWith(title.slice(0, -1))).toBe(true);
  });

  it("is empty for nothing", () => {
    expect(suggestTitle("")).toBe("");
    expect(suggestTitle("   \n ")).toBe("");
  });

  it("keeps a question as the member asked it", () => {
    expect(suggestTitle("Could the gratitude wall show older notes? It stops at a week.")).toBe("Could the gratitude wall show older notes");
  });
});

describe("the kinds", () => {
  it("are a bug, an idea and feedback, and nothing else", () => {
    expect(FEEDBACK_KINDS).toEqual(["bug", "idea", "feedback"]);
    expect(isFeedbackKind("feedback")).toBe(true);
    expect(isFeedbackKind("praise")).toBe(false);
    expect(isFeedbackKind(undefined)).toBe(false);
  });
});

describe("pageForHeard", () => {
  it("says the path back, and never the query or the hash", () => {
    expect(pageForHeard("https://village.example/quests?token=abc#x")).toBe("/quests");
    expect(pageForHeard("https://village.example/")).toBe("/");
  });
});
