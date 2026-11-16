/**
 * The review page's reading of a change (shared/proposalReview.ts). Pinned:
 *   1. each kind reads as the reader's own word; the calendar's route is a calendar event
 *   2. the flags come off the route and the body, and an edit that adds pay raises the money flag
 *   3. only the fields a change touches are read, except for a whole document, where a field left out is taken away
 *   4. a word diff keeps what stays and groups a reworded phrase
 *   5. a list diff shows kept, moved, reworded, added and taken-out rows
 */
import { describe, expect, it } from "vitest";
import { faceOf, fieldChanges, flagsOf, goalLines, listDiff, wordDiff } from "./proposalReview";

describe("what a change is", () => {
  it("names each kind in the reader's terms", () => {
    expect(faceOf("page_content", { method: "PUT", path: "/api/admin/content/page-home" })).toBe("page_words");
    expect(faceOf("variable", { method: "PUT", path: "/api/admin/variables/x" })).toBe("village_setting");
    expect(faceOf("season_goals", { method: "PUT", path: "/api/admin/seasons" })).toBe("season_priorities");
    expect(faceOf("setting", { method: "POST", path: "/api/admin/events" })).toBe("calendar_event");
    expect(faceOf("setting", { method: "PUT", path: "/api/admin/events/ev1" })).toBe("calendar_event");
    expect(faceOf("setting", { method: "POST", path: "/api/admin/events/calendars" })).toBe("admin_setting");
    expect(faceOf("setting", { method: "PUT", path: "/api/admin/investor-summary" })).toBe("admin_setting");
  });
});

describe("flags", () => {
  it("a whole-document PUT on a public setting says both", () => {
    expect(flagsOf("setting", { method: "PUT", path: "/api/admin/investor-summary" }, {}, { headline: "x" })).toEqual(["whole_document", "public_page", "money_words"]);
  });
  it("a gathering created on the calendar says so, and its PUT replaces nothing whole", () => {
    expect(flagsOf("setting", { method: "POST", path: "/api/admin/events" }, {}, { title: "Potluck" })).toEqual(["calendar_event"]);
    expect(flagsOf("setting", { method: "PUT", path: "/api/admin/events/e1" }, {}, { title: "Potluck" })).toEqual([]);
  });
  it("page words are public; pay on a role card is money words; goals change priorities and their links", () => {
    expect(flagsOf("page_content", { method: "PUT", path: "/api/admin/content/page-home" }, {}, { hero: { headline: "x" } })).toEqual(["public_page"]);
    expect(flagsOf("role_card", { method: "POST", path: "/api/org/role-edit/r" }, {}, { words: { aim: "x" } })).toEqual(["public_page"]);
    expect(flagsOf("role_card", { method: "POST", path: "/api/org/role-edit/r" }, {}, { words: { aim: "x" }, sections: { payCeiling: "x" } })).toContain("money_words");
    expect(flagsOf("season_goals", { method: "PUT", path: "/api/admin/seasons" }, {}, { goals: [] })).toEqual(["priorities_links"]);
  });
  it("a variable reads money off its key; a module goes public only when turned public", () => {
    expect(flagsOf("variable", { method: "PUT", path: "/api/admin/variables/k" }, { key: "org.reward_share" }, { value: "3" })).toEqual(["money_words"]);
    expect(flagsOf("variable", { method: "PUT", path: "/api/admin/variables/k" }, { key: "org.applicant_reply_days" }, { value: "3" })).toEqual([]);
    expect(flagsOf("module_lifecycle", { method: "PUT", path: "/api/admin/modules/m/lifecycle" }, { id: "m" }, { lifecycle: "public" })).toEqual(["public_page"]);
    expect(flagsOf("module_lifecycle", { method: "PUT", path: "/api/admin/modules/m/lifecycle" }, { id: "m" }, { lifecycle: "members" })).toEqual([]);
  });
});

describe("fields", () => {
  it("reads only the fields a change sends, and marks which changed", () => {
    const out = fieldChanges({ hero: { headline: "Welcome", badge: "Open" } }, { hero: { headline: "A home", badge: "Open" } });
    expect(out).toEqual([
      { path: "hero.headline", before: "Welcome", after: "A home", changed: true },
      { path: "hero.badge", before: "Open", after: "Open", changed: false },
    ]);
  });
  it("a whole document shows a field it leaves out as taken away", () => {
    const out = fieldChanges({ headline: "Old", footnote: "Kept?" }, { headline: "New" }, true);
    expect(out.find((f) => f.path === "footnote")).toEqual({ path: "footnote", before: "Kept?", after: null, changed: true });
  });
  it("a list of words is one field", () => {
    expect(fieldChanges({ words: { lines: ["a", "b"] } }, { words: { lines: ["a", "c"] } })).toEqual([{ path: "words.lines", before: ["a", "b"], after: ["a", "c"], changed: true }]);
  });
});

describe("word diff", () => {
  it("keeps the words that stay and groups the phrase that changed", () => {
    expect(wordDiff("Keep the books each moon.", "Hold the money each moon.")).toEqual([
      { op: "del", text: "Keep the books" },
      { op: "add", text: "Hold the money" },
      { op: "same", text: " each moon." },
    ]);
  });
  it("an added word is only an addition", () => {
    expect(wordDiff("A home", "A warm home")).toEqual([
      { op: "same", text: "A " },
      { op: "add", text: "warm " },
      { op: "same", text: "home" },
    ]);
  });
  it("the same text is one kept run", () => {
    expect(wordDiff("Same", "Same")).toEqual([{ op: "same", text: "Same" }]);
  });
});

describe("list diff", () => {
  it("shows a reorder, a rewording, an addition and a row taken out", () => {
    const before = ["Water for every home", "Open the land school", "Plant the food forest", "Hire a cook"];
    const after = ["Plant the food forest", "Water for every home", "Open the village land school", "Build the bridge"];
    const rows = listDiff(before, after);
    expect(rows.map((r) => r.op)).toEqual(["moved", "same", "reworded", "added", "removed"]);
    expect(rows[0]).toMatchObject({ text: "Plant the food forest", from: 3, to: 1 });
    expect(rows[2]).toMatchObject({ before: "Open the land school", text: "Open the village land school" });
    expect(rows[4]).toMatchObject({ op: "removed", text: "Hire a cook" });
  });
  it("reads goals from a body", () => {
    expect(goalLines({ goals: [{ text: "A", done: true }, { text: "B" }] })).toEqual([{ text: "A", done: true }, { text: "B", done: false }]);
  });
});
