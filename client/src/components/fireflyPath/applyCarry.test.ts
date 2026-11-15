/**
 * What a second application carries over from the first (applyCarry.ts): the applicant's
 * own words about themselves, never one role's answers, the price ask, references, consent
 * or a recording, and nothing older than a draft is kept.
 */
import { describe, expect, it } from "vitest";
import { DRAFT_DAYS } from "./applyDraft";
import { carriesAnything, carryAsDraft, carryKey, toCarry, type CarryFields } from "./applyCarry";

const NOW = new Date("2026-11-15T12:00:00Z");
const FIELDS: CarryFields = {
  name: " Rowan ",
  email: "rowan@example.test",
  about: { based: "San José", languages: "Español, English", story: "I keep gardens." },
  selfKnowledge: "Generator 2/4",
  links: [{ label: "My work", url: "https://example.test/rowan" }, { label: "", url: "  " }],
  knowUs: ["a friend"],
  items: [
    { title: "Open the gate each dawn", doneWhen: "open by sunrise", moves: "", serves: "g-team", date: "", roleId: "r-gate" },
    { title: "", doneWhen: "", moves: "", serves: "", date: "", roleId: "r-gate" },
    { title: "Sera's idea", doneWhen: "", moves: "", serves: "", date: "", roleId: "r-gate", seraDraft: true },
  ],
  marks: { story: "I keep gardens.", aim: "an aim Sera drafted" },
  transcript: "  Hola, soy Rowan.  ",
};

describe("what is kept when an application is sent", () => {
  it("keeps their own words, drops blank rows and the role each item was for, and has no place for the role's answers", () => {
    const c = toCarry(FIELDS, NOW);
    expect(c.name).toBe("Rowan");
    expect(c.links).toEqual([{ label: "My work", url: "https://example.test/rowan" }]);
    expect(c.items).toEqual([
      { title: "Open the gate each dawn", doneWhen: "open by sunrise", serves: "g-team" },
      { title: "Sera's idea", doneWhen: "", serves: "", seraDraft: true },
    ]);
    expect(c.storyMark).toBe("I keep gardens.");
    expect(c.transcript).toBe("Hola, soy Rowan.");
    const json = JSON.stringify(c);
    for (const never of ["roleId", "aim", "why", "terms", "payAsk", "commitment", "references", "consent", "practical", "pieceSuggestions"]) expect(json).not.toContain(never);
  });

  it("an application with none of their words leaves nothing to carry", () => {
    const empty: CarryFields = { name: "", email: "", about: { based: "", languages: "", story: "" }, selfKnowledge: "", links: [], knowUs: ["a friend"], items: [], marks: {}, transcript: " " };
    expect(carriesAnything(toCarry(empty, NOW))).toBe(false);
  });
});

describe("the next role's starting draft", () => {
  const stored = () => JSON.parse(JSON.stringify(toCarry(FIELDS, NOW)));

  it("is the carried words with this role's own answers blank, on the first step, each item now this role's", () => {
    const got = carryAsDraft(stored(), "r-host", NOW, 5);
    expect(got?.transcript).toBe("Hola, soy Rowan.");
    const d = got!.draft;
    expect(d.step).toBe(0);
    expect(d.name).toBe("Rowan");
    expect(d.about).toEqual({ based: "San José", languages: "Español, English", story: "I keep gardens." });
    expect(d.items.map((g) => g.roleId)).toEqual(["r-host", "r-host"]);
    expect(d.items[1]).toMatchObject({ seraDraft: true });
    expect(d.marks).toEqual({ story: "I keep gardens." });
    expect(d.why).toBe("");
    expect(d.aim).toBe("");
    expect(d.terms).toEqual({ answers: {}, commitmentPct: null, payAsk: null });
    expect(d.pieceSuggestions).toEqual([]);
  });

  it("ignores words older than a draft may be, and anything unreadable", () => {
    const old = new Date(NOW.getTime() + (DRAFT_DAYS + 1) * 24 * 60 * 60_000);
    expect(carryAsDraft(stored(), "r-host", old, 5)).toBeNull();
    for (const junk of [null, "x", [], { savedAt: "not a date", name: "Rowan" }]) expect(carryAsDraft(junk, "r-host", NOW, 5)).toBeNull();
  });

  it("drops a story mark once the story was edited, so an edited story is theirs", () => {
    const raw = { ...stored(), about: { ...stored().about, story: "I keep gardens, and bees." } };
    expect(carryAsDraft(raw, "r-host", NOW, 5)!.draft.marks).toEqual({});
  });

  it("is kept per link, apart from the public form's, under a name /reset keeps", () => {
    expect(carryKey("")).not.toBe(carryKey("abc"));
    expect(carryKey("abc")).toMatch(/draft/);
  });
});
