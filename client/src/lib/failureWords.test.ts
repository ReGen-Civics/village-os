/**
 * The sentence a failed request shows (surface audit, 19 Nov 2026): the browser's own words for "no signal" never
 * reach a person, and a sentence the village wrote comes through as written.
 */
import { describe, expect, it } from "vitest";
import { i18n } from "@lingui/core";
import { failureWords } from "./failureWords";

i18n.load("en", {});
i18n.activate("en");

describe("failureWords", () => {
  it("says to check the connection for each browser's no-signal TypeError", () => {
    for (const said of ["Failed to fetch", "Load failed", "NetworkError when attempting to fetch resource."]) {
      expect(failureWords(new TypeError(said), "fallback")).toBe("Nothing answered. Check your connection and try again.");
    }
  });

  it("does not show a parser's message when a proxy answers with an HTML page", () => {
    expect(failureWords(new SyntaxError("Unexpected token '<', \"<!DOCTYPE \"... is not valid JSON"))).toBe(
      "The village did not answer properly. Try again in a moment.",
    );
  });

  it("names a timeout as one", () => {
    expect(failureWords(new DOMException("The operation was aborted.", "AbortError"))).toBe("That took too long. Check your connection and try again.");
    expect(failureWords(new DOMException("signal timed out", "TimeoutError"))).toBe("That took too long. Check your connection and try again.");
  });

  it("passes the village's own sentence through, and falls back when there is none", () => {
    expect(failureWords(new Error("That email is already on the list."), "fallback")).toBe("That email is already on the list.");
    expect(failureWords(new Error("  "), "Sign-in didn't work.")).toBe("Sign-in didn't work.");
    expect(failureWords("not an error")).toBe("That did not go through. Try again.");
    expect(failureWords(null, "fallback")).toBe("fallback");
  });
});
