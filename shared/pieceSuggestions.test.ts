import { describe, expect, it } from "vitest";
import { parsePieceSuggestions, pieceSuggestionsOf, SUGGESTION_LIMITS, SUGGESTION_WORDS } from "./pieceSuggestions";
import { openBodyOf } from "./openProposals";

const picked = new Set(["finance"]);

describe("parsePieceSuggestions", () => {
  it("keeps the applicant's words for the roles they pick, trimmed", () => {
    const r = parsePieceSuggestions([{ roleId: "finance", piece: "rewards", kind: "change", text: "  A monthly cash view.  " }], picked);
    expect(r).toEqual({ ok: true, value: [{ roleId: "finance", piece: "rewards", kind: "change", text: "A monthly cash view." }] });
  });
  it("drops what the applicant cannot fix: another role, an unknown piece or kind, an empty line", () => {
    const r = parsePieceSuggestions(
      [
        { roleId: "land", piece: "rewards", kind: "change", text: "x" },
        { roleId: "finance", piece: "salary", kind: "change", text: "x" },
        { roleId: "finance", piece: "rewards", kind: "rating", text: "x" },
        { roleId: "finance", piece: "rewards", kind: "missing", text: "   " },
      ],
      picked,
    );
    expect(r).toEqual({ ok: true, value: [] });
  });
  it("refuses one too long, and too many, with the words", () => {
    expect(parsePieceSuggestions([{ roleId: "finance", piece: "purpose", kind: "deliver", text: "a".repeat(SUGGESTION_LIMITS.text + 1) }], picked)).toEqual({ ok: false, error: SUGGESTION_WORDS.tooLong });
    const many = Array.from({ length: SUGGESTION_LIMITS.total + 1 }, (_, i) => ({ roleId: "finance", piece: "purpose", kind: "deliver", text: `idea ${i}` }));
    expect(parsePieceSuggestions(many, picked)).toEqual({ ok: false, error: SUGGESTION_WORDS.tooMany });
  });
  it("reads no field as no suggestions (an older form)", () => {
    expect(parsePieceSuggestions(undefined, picked)).toEqual({ ok: true, value: [] });
  });
});

describe("a stored body", () => {
  it("reads its suggestions back, and an older body without them reads as none", () => {
    const s = [{ roleId: "finance", piece: "who", kind: "missing", text: "Spanish for the CCSS calls." }];
    expect(openBodyOf({ roles: [{ roleId: "finance", note: "" }], why: "w", aim: "a", pieceSuggestions: s }).pieceSuggestions).toEqual(s);
    expect(openBodyOf({ roles: [{ roleId: "finance", note: "" }], why: "w", aim: "a" }).pieceSuggestions).toBeUndefined();
  });
  it("never throws on a damaged field", () => {
    expect(pieceSuggestionsOf("nonsense")).toEqual([]);
    expect(pieceSuggestionsOf([null, 3, { roleId: "finance", piece: "who", kind: "missing", text: "ok" }])).toHaveLength(1);
  });
});
