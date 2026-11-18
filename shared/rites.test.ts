import { describe, expect, it } from "vitest";

import {
  CEREMONY_REFUSALS,
  DEFAULT_CONFIG,
  DOOR_CODE,
  MARK_PATH_SHAPE,
  WITNESS_REFUSALS,
  ceremonyStep,
  fill,
  isPlainRite,
  lookStyle,
  makeDoorCode,
  markPath,
  parseRitesConfig,
  refuseConfirm,
  refuseSpoken,
  refuseWitness,
  ringOrder,
  ritesConfigProblem,
  stampedTogether,
  stampsFor,
  type CeremonyFacts,
} from "./rites";

const oath = { id: "oath", todo: "Take the vow", done: "Took the vow", lines: ["One.", "Two."], mark: true, admits: true, together: ["signed"], witnesses: 1 };
const signed = { id: "signed", todo: "Sign", done: "Signed", ink: "alt" };
const met = { id: "met", todo: "Meet your buddy", done: "Met my buddy" };

describe("the rites document", () => {
  it("reads nothing as the neutral defaults", () => {
    const { config, problems } = parseRitesConfig(undefined);
    expect(problems).toEqual([]);
    expect(config).toEqual(DEFAULT_CONFIG);
    expect(config.rites).toEqual([]);
  });

  it("reads a village's rites in its order with defaults filled", () => {
    const { config, problems } = parseRitesConfig({ format: "village-rites/1", rites: [oath, signed, met] });
    expect(problems).toEqual([]);
    expect(config.rites.map((r) => r.id)).toEqual(["oath", "signed", "met"]);
    expect(config.rites[2]).toMatchObject({ witnesses: 1, lines: [], mark: false, admits: false, callCounts: true, ink: "seal", place: null });
    expect(config.rites[1].ink).toBe("alt");
  });

  it("names every problem and keeps the platform's words where a village wrote none", () => {
    const { problems, config } = parseRitesConfig({
      rites: [{ ...oath }, { ...met, admits: true }, { id: "Bad Id", todo: "", done: "x" }, { ...signed, together: ["ghost"] }],
      words: { buddy: "x".repeat(25), spoken: "Said" },
      look: { primary: "gold", seal: "#8a3b20", sparkle: "#fff" },
      welcome: { doors: [{ id: "rent", title: "Rent", href: "javascript:alert(1)" }] },
    });
    expect(problems).toEqual(
      expect.arrayContaining([
        "Only one rite may admit a member.",
        expect.stringContaining('rites[3].id "Bad Id"'),
        "rites[3].todo (the rite as a task) is empty.",
        'The rite "signed" stamps "ghost" together with it, and there is no rite with that id.',
        "words.buddy is 25 characters. Keep it to 24.",
        "look.primary must be a colour like #0b1a1e.",
        "look.sparkle is not a look this module reads.",
        "welcome.doors[1].href must be a page here (starting with /) or an https address.",
      ]),
    );
    expect(config.words.spoken).toBe("Said");
    expect(config.words.buddy).toBe("Buddy");
    expect(config.look).toEqual({ seal: "#8a3b20" });
    expect(ritesConfigProblem({ rites: "no" })).toBe("rites must be a list.");
    expect(ritesConfigProblem({ rites: [oath, signed] })).toBeNull();
  });

  it("caps every list", () => {
    const many = Array.from({ length: 13 }, (_, i) => ({ id: `r${i}`, todo: "a", done: "b" }));
    expect(parseRitesConfig({ rites: many }).problems).toContain("There are 13 rites. Keep it to 12.");
    expect(parseRitesConfig({ rites: [{ ...met, lines: Array(13).fill("l") }] }).problems).toContain("rites[1].lines has 13 lines. Keep it to 12.");
  });

  it("sets the look on the scope as custom properties, fonts with a fallback", () => {
    expect(lookStyle({ paper: "#f4ead4", fontDisplay: "IM Fell English" })).toEqual({ "--paper": "#f4ead4", "--font-display": '"IM Fell English", Georgia, serif' });
  });
});

describe("words with blanks", () => {
  it("fills what it knows and drops what it does not", () => {
    expect(fill("You're aboard, {name}!", { name: "Sol" })).toBe("You're aboard, Sol!");
    expect(fill("{inviter} has saved you a place.", {})).toBe("has saved you a place.");
  });
});

describe("stamps on a card", () => {
  const { config } = parseRitesConfig({ rites: [oath, signed, met] });
  it("inks what is held, marks the first unheld one next", () => {
    expect(stampsFor(config.rites, new Set(["signed"]))).toEqual([
      { id: "oath", label: "Take the vow", state: "next", ink: "seal" },
      { id: "signed", label: "Signed", state: "on", ink: "alt" },
      { id: "met", label: "Meet your buddy", state: "todo", ink: "seal" },
    ]);
  });
  it("marks next by the village's walk order when it gives one", () => {
    expect(stampsFor(config.rites, new Set(), ["met", "vow"]).map((s) => s.state)).toEqual(["todo", "todo", "next"]);
    expect(stampsFor(config.rites, new Set(["met"]), ["met", "vow"]).map((s) => s.state)).toEqual(["next", "todo", "on"]);
    expect(parseRitesConfig({ rites: [oath, signed, met], walk: ["ghost"] }).problems).toContain('walk names "ghost", and there is no rite with that id.');
    expect(parseRitesConfig({ articles: { linkFor: "members" } }).config.articles.linkFor).toBe("members");
    expect(parseRitesConfig({ articles: { linkFor: "nobody" } }).problems).toContain('articles.linkFor must be "everyone" or "members".');
  });
  it("stamps a rite with its together rites once each", () => {
    expect(stampedTogether(config.rites[0], config.rites)).toEqual(["oath", "signed"]);
  });
  it("knows a plain rite from a ceremony", () => {
    expect(isPlainRite(config.rites[2])).toBe(true);
    expect(isPlainRite(config.rites[0])).toBe(false);
  });
});

describe("who may witness", () => {
  const base = { candidateId: "a", witnessId: "b", via: "present" as const, callCounts: true, witnessSworn: true, anyoneSworn: true, witnessAdmitted: true };
  it("refuses the candidate", () => expect(refuseWitness({ ...base, witnessId: "a" })).toBe(WITNESS_REFUSALS.self));
  it("asks for a sworn witness once anybody is sworn", () => expect(refuseWitness({ ...base, witnessSworn: false })).toBe(WITNESS_REFUSALS.notSworn));
  it("lets an admitted member witness while nobody is sworn", () => {
    expect(refuseWitness({ ...base, witnessSworn: false, anyoneSworn: false })).toBeNull();
    expect(refuseWitness({ ...base, witnessSworn: false, anyoneSworn: false, witnessAdmitted: false })).toBe(WITNESS_REFUSALS.notAdmitted);
  });
  it("refuses a call when the rite is in person only", () => expect(refuseWitness({ ...base, via: "call", callCounts: false })).toBe(WITNESS_REFUSALS.call));
});

describe("the ceremony", () => {
  const c: CeremonyFacts = { status: "open", lineCount: 2, spoken: 0, markNeeded: true, markMade: false, needed: 2, confirmed: 0 };
  it("walks speaking, marking, witnessing, sworn", () => {
    expect(ceremonyStep(c)).toBe("speaking");
    expect(ceremonyStep({ ...c, spoken: 2 })).toBe("marking");
    expect(ceremonyStep({ ...c, spoken: 2, markMade: true, confirmed: 1 })).toBe("witnessing");
    expect(ceremonyStep({ ...c, spoken: 2, markMade: true, confirmed: 2 })).toBe("sworn");
    expect(ceremonyStep({ ...c, status: "set-aside" })).toBe("set-aside");
  });
  it("takes lines in order from the candidate only, and a repeat of the last is a no-op", () => {
    expect(refuseSpoken(c, true, 0)).toBeNull();
    expect(refuseSpoken(c, true, 1)).toBe(CEREMONY_REFUSALS.outOfOrder);
    expect(refuseSpoken({ ...c, spoken: 1 }, true, 0)).toBeNull();
    expect(refuseSpoken(c, false, 0)).toBe(CEREMONY_REFUSALS.notCandidate);
    expect(refuseSpoken({ ...c, status: "sworn" }, true, 0)).toBe(CEREMONY_REFUSALS.closed);
  });
  it("lets a witness confirm only after the lines and the mark", () => {
    expect(refuseConfirm(c, true)).toBe(CEREMONY_REFUSALS.tooEarly);
    expect(refuseConfirm({ ...c, spoken: 2 }, true)).toBe(CEREMONY_REFUSALS.tooEarly);
    expect(refuseConfirm({ ...c, spoken: 2, markMade: true }, true)).toBeNull();
    expect(refuseConfirm({ ...c, spoken: 2, markMade: true }, false)).toBe(CEREMONY_REFUSALS.notWitness);
  });
});

describe("the mark", () => {
  it("writes one path of whole numbers inside the square", () => {
    const got = markPath([[[1.4, 2.6], [70, -3]], [[30, 30]]]);
    expect(got).toEqual({ ok: true, path: "M1 3L60 0M30 30L30 30" });
    if (got.ok) expect(MARK_PATH_SHAPE.test(got.path)).toBe(true);
  });
  it("refuses anything that is not strokes of number pairs", () => {
    expect(markPath([])).toMatchObject({ ok: false });
    expect(markPath([[["<script>", 1]]])).toMatchObject({ ok: false });
    expect(markPath(Array(13).fill([[1, 1]]))).toMatchObject({ ok: false });
    expect(markPath([Array(401).fill([1, 1])])).toMatchObject({ ok: false });
  });
});

describe("the ring", () => {
  it("orders the same way every time, by nothing a person did", () => {
    const marks = ["u-1", "u-2", "u-3", "u-4", "u-5"].map((userId) => ({ userId }));
    const once = ringOrder(marks, "village");
    expect(ringOrder([...marks].reverse(), "village")).toEqual(once);
    expect(once.map((m) => m.userId)).not.toEqual(marks.map((m) => m.userId).sort());
  });
});

describe("the door code", () => {
  it("is ten characters from the look-alike-free set", () => {
    const code = makeDoorCode((n) => Uint8Array.from({ length: n }, (_, i) => i * 37));
    expect(DOOR_CODE.test(code)).toBe(true);
  });
});
