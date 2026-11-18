/**
 * A village's own nouns (gap G4) and its own notice words (gap G6).
 */
import { describe, expect, it } from "vitest";
import { NOUN_SLOTS, NOUN_SLOT_IDS, nounVars, vocabularyIsDefault, vocabularyOf, vocabularyProblem } from "./vocabulary";
import { pageVarsFrom } from "./pageContent/vars";
import { fillVars } from "./pageContent/resolve";
import { noticeBlurb, noticeBlurbsFor, noticeTitle, noticeWordsOf, noticeWordsProblem } from "./noticeWords";
import { NOTIFICATION_KIND_WORDS } from "./notificationKindWords";

describe("the village's nouns (G4)", () => {
  it("are the platform's words for a village that set none", () => {
    const v = vocabularyOf(null);
    expect(vocabularyIsDefault(v)).toBe(true);
    for (const s of NOUN_SLOT_IDS) expect(v[s].one).toBe(NOUN_SLOTS[s].one);
  });

  it("take the village's words, work out a blank plural and the article", () => {
    const v = vocabularyOf({ circle: { one: "Ship" }, gathering: { one: "Muster", many: "Musters" }, badge: { one: "  " } });
    expect(v.circle).toEqual({ one: "Ship", many: "Ships", a: "a" });
    expect(v.gathering.many).toBe("Musters");
    expect(v.badge.one).toBe("badge");
    expect(vocabularyOf({ ballot: { one: "Ordinance" } }).ballot.a).toBe("an");
  });

  it("reach every editable page field, and never take {village} (the name)", () => {
    // The config serves the vocabulary resolved, and so does the server.
    const vars = pageVarsFrom({ project: { name: "Harbour" }, vocabulary: vocabularyOf({ circle: { one: "Ship" }, village: { one: "fleet" } }) });
    expect(vars.village).toBe("Harbour");
    expect(vars["village-noun"]).toBe("fleet");
    expect(fillVars("Every {circle} in {village} has its crew. {a-circle}, two {circles}.", vars)).toBe("Every Ship in Harbour has its crew. a Ship, two Ships.");
    // A page that names no noun reads as before.
    expect(fillVars("Welcome to {village}", pageVarsFrom({ project: { name: "Harbour" } }))).toBe("Welcome to Harbour");
    expect(Object.keys(nounVars(vocabularyOf(null)))).toContain("crews");
  });

  it("refuse an unknown slot and an overlong word", () => {
    expect(vocabularyProblem({ circle: { one: "Ship" } })).toBeNull();
    expect(vocabularyProblem({ parrot: { one: "x" } })).toMatch(/not one of the words/);
    expect(vocabularyProblem({ circle: { one: "x".repeat(40) } })).toMatch(/32 characters/);
  });
});

describe("the village's notice words (G6)", () => {
  const vars = { village: "Harbour", ballot: "ordinance" };

  it("keep the producer's title where the village set none", () => {
    expect(noticeTitle({}, "ballot_opened", "A vote opened: the roof", vars)).toBe("A vote opened: the roof");
  });

  it("put the village's words around the platform's title, with its nouns", () => {
    const words = noticeWordsOf({ ballot_opened: { title: "Council called ({ballot}): {default}", blurb: "{village} asks your voice." } });
    expect(noticeTitle(words, "ballot_opened", "A vote opened: the roof", vars)).toBe("Council called (ordinance): A vote opened: the roof");
    expect(noticeBlurb(words, "ballot_opened", NOTIFICATION_KIND_WORDS.ballot_opened.blurb, vars)).toBe("Harbour asks your voice.");
    expect(noticeBlurb(words, "gratitude_received", "platform", vars)).toBe("platform");
    // What the config serves the bell: only kinds with a description, already filled.
    expect(noticeBlurbsFor(words, vars)).toEqual({ ballot_opened: "Harbour asks your voice." });
  });

  it("clean and cap what is stored, and refuse what the route must not keep", () => {
    expect(noticeWordsOf({ "Bad Kind!": { title: "x" }, ok: { title: " a\\n b " }, empty: { title: "" } })).toEqual({ ok: { title: "a\\n b" } });
    expect(noticeWordsProblem({ ok: { title: "x".repeat(200) } })).toMatch(/120 characters/);
    expect(noticeWordsProblem({ ok: { title: "Fine" } })).toBeNull();
    expect(noticeTitle(noticeWordsOf({ k: { title: "{default}{default}" } }), "k", "y".repeat(200), {}).length).toBe(255);
  });
});
