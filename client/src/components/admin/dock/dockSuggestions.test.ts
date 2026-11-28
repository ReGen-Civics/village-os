/**
 * SUGGESTED NEXT STEPS (./dockSuggestions.ts): never more than four, in plain
 * words, and never one that names money, pay, a vote or a person, or invites
 * ranking, comparing or judging anybody.
 */
import { setupI18n } from "@lingui/core";
import { describe, expect, it } from "vitest";
import { navGroups } from "../adminNavGroups";
import { everySuggestion, MAX_SUGGESTIONS, SUGGESTED_TABS, suggestionsFor } from "./dockSuggestions";

const EN = setupI18n({ locale: "en", messages: { en: {} } });
const words = (list: ReturnType<typeof suggestionsFor>) => list.map((d) => EN._(d));
const all = () => words(everySuggestion());

/** Money, pay and votes stay a person's own; nothing here may invite judging a person either. */
const FORBIDDEN =
  /\b(money|pay|pays|paid|payment|payout|wage|wages|salary|salaries|price|prices|cash|budget|budgets|token|tokens|credit|credits|fund|funds|dues|fee|fees|invoice|ledger|treasury|mint|reward|rewards|vote|votes|voting|ballot|ballots|elect|election|objection|veto|rank|ranks|ranking|compare|comparing|score|scores|judge|judging|shortlist|candidate|candidates|applicant|applicants|application|applications|interview|interviews|hire|fire|who should)\b/i;

describe("the suggestions above the talk box", () => {
  it("are never more than four for any place, started or not", () => {
    expect(MAX_SUGGESTIONS).toBe(4);
    const places = [
      ...SUGGESTED_TABS.map((tab) => ({ mode: "helper" as const, tab })),
      { mode: "helper" as const, tab: "a-tab-with-none" },
      { mode: "launch" as const },
      { mode: "organize" as const },
    ];
    for (const place of places) {
      for (const empty of [true, false]) {
        const list = suggestionsFor(place, empty);
        expect(list.length, JSON.stringify(place)).toBeGreaterThan(0);
        expect(list.length, JSON.stringify(place)).toBeLessThanOrEqual(MAX_SUGGESTIONS);
        expect(new Set(words(list)).size, "no line twice in one place").toBe(list.length);
      }
    }
  });

  it("never name money, pay, a vote or a person, and never invite ranking or judging anybody", () => {
    for (const line of all()) {
      expect(line, line).not.toMatch(FORBIDDEN);
      // No person is named: a capital only opens the line, or is "I" or one of the platform's own nouns.
      const inner = line.slice(1).replace(/\b(FAQ|Library|Admin|I)\b/g, "");
      expect(inner, `"${line}" names something with a capital`).not.toMatch(/[A-Z]/);
    }
  });

  it("are short, plain, and written to be said", () => {
    for (const line of all()) {
      expect(line.length, line).toBeLessThanOrEqual(44);
      expect(line, line).toMatch(/[.?]$/);
      expect(line, line).not.toMatch(/[–—]/);
    }
  });

  it("are keyed by Admin tabs that exist, so a renamed tab cannot leave a dead row", () => {
    const real = new Set([...navGroups(true), ...navGroups(false)].flatMap((g) => g.items.map((i) => i.key)));
    for (const tab of SUGGESTED_TABS) expect(real.has(tab), tab).toBe(true);
  });

  it("depend on where the person is, and on whether the conversation has started", () => {
    expect(words(suggestionsFor({ mode: "helper", tab: "home" }, true))).toContain("What needs me today?");
    expect(words(suggestionsFor({ mode: "helper", tab: "modules" }, true))).toContain("What can this village run?");
    // A tab with no row of its own reads the general four.
    expect(words(suggestionsFor({ mode: "helper", tab: "ledger" }, true))).toEqual(words(suggestionsFor({ mode: "helper", tab: "nowhere" }, true)));
    expect(words(suggestionsFor({ mode: "helper", tab: "home" }, false))).toContain("Tell me more.");
    expect(words(suggestionsFor({ mode: "launch" }, true))).toContain("What is blocking the launch?");
    expect(words(suggestionsFor({ mode: "launch" }, false))).toContain("What comes next?");
    expect(words(suggestionsFor({ mode: "organize" }, true))).toContain("How do we handle a disagreement?");
  });
});
