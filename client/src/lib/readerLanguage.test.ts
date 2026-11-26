import { describe, expect, it } from "vitest";
import { readerLanguage } from "./readerLanguage";

describe("a read names the reader's language only when it is not English", () => {
  it("sends the header for Spanish and nothing for English", () => {
    expect(readerLanguage("es")).toEqual({ headers: { "X-Village-Locale": "es" } });
    expect(readerLanguage("en")).toEqual({});
    expect(readerLanguage("en-GB")).toEqual({});
    expect(readerLanguage("")).toEqual({});
  });
});
