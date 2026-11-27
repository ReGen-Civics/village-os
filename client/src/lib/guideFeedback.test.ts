/**
 * Where /feedback sends a member now the form lives in the guide's panel: back to the page they
 * were on, with #feedback so the panel opens there.
 */
import { describe, expect, it } from "vitest";
import { feedbackReturnPath } from "./guideFeedback";

const origin = "https://village.example";

describe("feedbackReturnPath", () => {
  it("goes back to the page the member was on in this tab", () => {
    expect(feedbackReturnPath({ last: "/quests", referrer: "", origin })).toBe("/quests");
  });

  it("falls back to the page on this site that linked here", () => {
    expect(feedbackReturnPath({ last: null, referrer: `${origin}/gratitude?x=1`, origin })).toBe("/gratitude");
  });

  it("never follows a link from another site, and goes home", () => {
    expect(feedbackReturnPath({ last: null, referrer: "https://elsewhere.example/page", origin })).toBe("/");
    expect(feedbackReturnPath({ last: null, referrer: "", origin })).toBe("/");
  });

  it("never sends a member to Admin, which draws no corner, or round to /feedback again", () => {
    expect(feedbackReturnPath({ last: "/admin/settings", referrer: "", origin })).toBe("/");
    expect(feedbackReturnPath({ last: "/feedback", referrer: `${origin}/feedback`, origin })).toBe("/");
    expect(feedbackReturnPath({ last: "//evil.example", referrer: "", origin })).toBe("/");
  });
});
