/**
 * The covenant's parts draw one paragraph per blank-line block (gap G15); a
 * part with no blank line is one paragraph, exactly as before.
 */
import { describe, expect, it } from "vitest";
import { paragraphsOf } from "./LoveLetter";

describe("the covenant's paragraphs", () => {
  it("splits on blank lines and keeps single line breaks inside a paragraph", () => {
    expect(paragraphsOf("Article 1.\n\nArticle 2.\n  \nArticle 3.")).toEqual(["Article 1.", "Article 2.", "Article 3."]);
    expect(paragraphsOf("One part\nstill one paragraph")).toEqual(["One part\nstill one paragraph"]);
    expect(paragraphsOf("A\r\n\r\nB")).toEqual(["A", "B"]);
  });

  it("draws a text with no blank lines as the one paragraph it always was", () => {
    expect(paragraphsOf("We hold the land in common.")).toEqual(["We hold the land in common."]);
    expect(paragraphsOf("")).toEqual([""]);
  });
});
