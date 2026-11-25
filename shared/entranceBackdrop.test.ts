import { describe, expect, it } from "vitest";
import { backdropOf, safeMediaUrl } from "./entrance";
import { VARIABLES_BY_KEY, validateVariable } from "./gameVariables";

describe("the entrance's background video", () => {
  it("keeps an https address or a file of this site, and nothing else", () => {
    expect(safeMediaUrl("https://village.example/video/hero.mp4?v=2")).toBe("https://village.example/video/hero.mp4?v=2");
    expect(safeMediaUrl("/uploads/gate.mp4")).toBe("/uploads/gate.mp4");
    for (const bad of ["http://village.example/a.mp4", "//evil.example/a.mp4", "/\\evil.example", "javascript:alert(1)", "a b", 7, null]) {
      expect(safeMediaUrl(bad)).toBe("");
    }
  });

  it("is off until the video dial is set, and carries the phone copy and still image", () => {
    expect(backdropOf("", "https://x.example/m.mp4", "https://x.example/p.jpg")).toBeNull();
    expect(backdropOf("https://x.example/v.mp4", "", "nope")).toEqual({ video: "https://x.example/v.mp4", mobile: "", poster: "" });
  });

  it("refuses a value the page would not play, at the door", () => {
    expect(validateVariable(VARIABLES_BY_KEY["entrance.background_video"], "village.example/v.mp4")).toMatch(/https:\/\//);
    expect(validateVariable(VARIABLES_BY_KEY["entrance.background_video"], "https://village.example/v.mp4")).toBeNull();
    expect(validateVariable(VARIABLES_BY_KEY["entrance.background_poster"], "")).toBeNull();
  });
});
