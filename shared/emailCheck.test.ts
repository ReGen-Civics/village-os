import { describe, expect, it } from "vitest";
import { domainOf, isDisposable, suggestEmail } from "./emailCheck";

describe("the entrance's instant email checks", () => {
  it("suggests the common domain a person probably meant", () => {
    expect(suggestEmail("ana@gmial.com")).toBe("ana@gmail.com");
    expect(suggestEmail("ana@hotmail.co")).toBe("ana@hotmail.com");
    expect(suggestEmail("ana@yaho.com")).toBe("ana@yahoo.com");
  });

  it("never second-guesses a real domain or another country's ending", () => {
    expect(suggestEmail("ana@gmail.com")).toBeNull();
    expect(suggestEmail("ana@yahoo.fr")).toBeNull();
    expect(suggestEmail("ana@village.example")).toBeNull();
    expect(suggestEmail("no-at-sign")).toBeNull();
  });

  it("knows a throwaway inbox, its subdomains too, and nothing else", () => {
    expect(isDisposable("x@mailinator.com")).toBe(true);
    expect(isDisposable("x@inbox.mailinator.com")).toBe(true);
    expect(isDisposable("x@YopMail.com")).toBe(true);
    expect(isDisposable("x@gmail.com")).toBe(false);
    expect(domainOf("A@B.Example")).toBe("b.example");
  });
});
