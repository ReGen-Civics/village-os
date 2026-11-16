/**
 * WORDS AROUND THE APP (gap G7): every box blank by default, blank keeps the
 * platform's translated words, a village's own line fills its words in.
 */
import { describe, expect, it } from "vitest";
import { APP_WORDS_PAGE, appWordOf } from "./appWords";
import { pageDocumentProblems } from "./resolve";

describe("words around the app", () => {
  it("starts blank everywhere, so a village that writes nothing reads today's words", () => {
    for (const section of APP_WORDS_PAGE.sections) for (const f of section.fields) {
      expect(f.default, `${section.id}.${f.key}`).toBe("");
      expect(f.optional, `${section.id}.${f.key}`).toBe(true);
      expect(f.help ?? "", `${section.id}.${f.key}`).toMatch(/^Blank keeps the platform's words/);
    }
    expect(appWordOf(null, "empty", "questsTitle", {})).toBeNull();
    expect(appWordOf({ empty: { questsTitle: "   " } }, "empty", "questsTitle", {})).toBeNull();
  });

  it("reads a village's own line, with its words filled", () => {
    const doc = { empty: { questsTitle: "Calm seas" }, joining: { heading: "Come aboard {village}" }, letter: { heading: "Swear to the {title}" } };
    expect(appWordOf(doc, "empty", "questsTitle", {})).toBe("Calm seas");
    expect(appWordOf(doc, "joining", "heading", { village: "Harbour" })).toBe("Come aboard Harbour");
    expect(appWordOf(doc, "letter", "heading", { title: "Ship's Articles" })).toBe("Swear to the Ship's Articles");
    expect(appWordOf(doc, "launch", "name", {})).toBeNull();
  });

  it("is a document the save route accepts, and refuses a line over its limit", () => {
    expect(pageDocumentProblems(APP_WORDS_PAGE, { launch: { name: "Raise the Flag" } })).toEqual([]);
    expect(pageDocumentProblems(APP_WORDS_PAGE, { launch: { name: "x".repeat(80) } }).length).toBeGreaterThan(0);
  });

  it("never says what a token does in its treasury boxes' own help", () => {
    const treasury = APP_WORDS_PAGE.sections.find((s) => s.id === "treasury")!;
    expect(treasury.shows).toMatch(/never say what a token does/);
  });
});
