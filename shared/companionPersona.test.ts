import { describe, expect, it } from "vitest";
import {
  CHARACTERS,
  CHARACTER_INFO,
  DEFAULT_PERSONA,
  HELP_INFO,
  LENS_NEVER,
  NAKSHATRA,
  RASHI,
  lensNote,
  parsePersona,
  personaLines,
  readLens,
  readWelcome,
  writeWelcome,
  welcomeMoveRefused,
} from "./companionPersona";
import { lahiriAyanamsa, siderealMoonLon, vedicMoon } from "./geneKeysSky";
import * as Astronomy from "astronomy-engine";

describe("persona", () => {
  it("reads a stored persona, clamps dials and drops unknown help ways", () => {
    const p = parsePersona(JSON.stringify({ character: "poet", dials: { playful: 140, detail: -3, direct: "x" }, help: ["steps", "steps", "fly"], speak: false }));
    expect(p).toEqual({ character: "poet", dials: { playful: 100, detail: 0, direct: 50 }, help: ["steps"], speak: false });
  });

  it("refuses an unknown character and anything that is not an object", () => {
    expect(parsePersona({ character: "wizard" })).toBeNull();
    expect(parsePersona("not json")).toBeNull();
    expect(parsePersona([1])).toBeNull();
  });

  it("speaks aloud unless told not to", () => {
    expect(parsePersona({ character: "plain" })?.speak).toBe(true);
  });

  it("turns a persona into fixed sentences only", () => {
    const lines = personaLines({ character: "coach", dials: { playful: 10, detail: 90, direct: 50 }, help: ["no-nag"], speak: true });
    expect(lines).toEqual([CHARACTER_INFO.coach.prompt, "Keep the tone calm.", "Give a little more detail when it helps.", HELP_INFO["no-nag"].prompt]);
  });

  it("gives every character a label, a sample and a prompt", () => {
    for (const c of CHARACTERS) {
      expect(CHARACTER_INFO[c].label && CHARACTER_INFO[c].sample && CHARACTER_INFO[c].prompt).toBeTruthy();
    }
    expect(parsePersona(DEFAULT_PERSONA)).toEqual(DEFAULT_PERSONA);
  });
});

describe("lenses", () => {
  it("keeps a Vedic lens to two small numbers that agree", () => {
    expect(readLens("vedic", { rashi: 1, nakshatra: 3 })).toEqual({ ok: true, data: { rashi: 1, nakshatra: 3 } });
    expect(readLens("vedic", { rashi: 1, nakshatra: null })).toEqual({ ok: true, data: { rashi: 1, nakshatra: null } });
    // Rohini (3) sits in Vrishabha (1), never in Mesha (0).
    expect(readLens("vedic", { rashi: 0, nakshatra: 3 }).ok).toBe(false);
    expect(readLens("vedic", { rashi: 12 }).ok).toBe(false);
    // Anything else sent along is dropped: a birth date never reaches the row.
    expect(readLens("vedic", { rashi: 1, nakshatra: 3, birth: "1991-04-18" })).toEqual({ ok: true, data: { rashi: 1, nakshatra: 3 } });
  });

  it("every nakshatra falls in the rashi readLens expects", () => {
    for (let nk = 0; nk < 27; nk++) {
      const start = (nk * 360) / 27;
      expect(readLens("vedic", { rashi: Math.floor(start / 30), nakshatra: nk }).ok).toBe(true);
    }
  });

  it("checks a type lens and needs at least one part", () => {
    expect(readLens("type", { enneagram: "9", four: "infp" })).toEqual({ ok: true, data: { enneagram: 9, four: "INFP", bigFive: null } });
    expect(readLens("type", { four: "ABCD" }).ok).toBe(false);
    expect(readLens("type", { enneagram: 10 }).ok).toBe(false);
    expect(readLens("type", {}).ok).toBe(false);
    expect(readLens("type", { bigFive: [1, 2, 3] }).ok).toBe(false);
  });

  it("keeps the member's own words short and tidy", () => {
    expect(readLens("own", { text: "  night owl,\n short messages " })).toEqual({ ok: true, data: { text: "night owl, short messages" } });
    expect(readLens("own", { text: "x".repeat(401) }).ok).toBe(false);
    expect(readLens("own", { text: "" }).ok).toBe(false);
  });

  it("writes notes from fixed words, and the own-words note never carries the text", () => {
    expect(lensNote("vedic", { rashi: 1, nakshatra: 3 })).toBe(`Their Vedic Moon is in ${RASHI[1]}, in ${NAKSHATRA[3]}. Keep your tone steady and practical.`);
    expect(lensNote("type", { enneagram: 9, four: null, bigFive: null })).toContain("Peacemaker");
    expect(lensNote("own", { text: "SECRET WORDS" })).not.toContain("SECRET");
  });

  it("closes with the rule that nobody is judged by a lens", () => {
    expect(LENS_NEVER).toMatch(/Never describe, rank or judge/);
  });
});

describe("welcome state", () => {
  it("reads only a well-formed state", () => {
    expect(readWelcome({ companionWelcome: { beat: 3, status: "skipped", at: "x" } })).toEqual({ beat: 3, status: "skipped", at: "x" });
    expect(readWelcome({ companionWelcome: { beat: 9, status: "open" } })).toBeNull();
    expect(readWelcome({ companionWelcome: { beat: 1, status: "gone" } })).toBeNull();
    expect(readWelcome(null)).toBeNull();
  });

  it("checks a write", () => {
    expect(writeWelcome({ beat: 7, status: "done" }, "t")).toEqual({ ok: true, state: { beat: 7, status: "done", at: "t" } });
    expect(writeWelcome({ beat: -1, status: "done" }, "t").ok).toBe(false);
  });

  it("keeps a finished welcome finished: only another done may follow a done", () => {
    const done = { beat: 7, status: "done" as const, at: "t" };
    expect(welcomeMoveRefused(done, { status: "open" })).toBe(true);
    expect(welcomeMoveRefused(done, { status: "skipped" })).toBe(true);
    expect(welcomeMoveRefused(done, { status: "done" })).toBe(false);
    expect(welcomeMoveRefused({ beat: 3, status: "skipped", at: "t" }, { status: "open" })).toBe(false);
    expect(welcomeMoveRefused(null, { status: "open" })).toBe(false);
  });
});

describe("the Vedic Moon", () => {
  it("sets the sidereal zodiac about 24 degrees behind the tropical one", () => {
    const t = Astronomy.MakeTime(new Date("2000-01-01T12:00:00Z"));
    expect(lahiriAyanamsa(t)).toBeCloseTo(23.853, 2);
    const t2 = Astronomy.MakeTime(new Date("2050-01-01T12:00:00Z"));
    expect(lahiriAyanamsa(t2) - lahiriAyanamsa(t)).toBeCloseTo((50 * 50.29) / 3600, 2);
  });

  it("is the tropical Moon less the ayanamsa", () => {
    const d = new Date("1991-04-18T05:40:00Z");
    const t = Astronomy.MakeTime(d);
    const tropical = Astronomy.EclipticGeoMoon(t).lon;
    const diff = (((tropical - siderealMoonLon(d)) % 360) + 360) % 360;
    expect(diff).toBeCloseTo(lahiriAyanamsa(t), 6);
  });

  it("names both for a known time, and only what holds across an unknown day", () => {
    const exact = vedicMoon([new Date("2000-01-01T12:00:00Z")]);
    expect(exact.rashi).toBe(6); // Tula
    expect(exact.nakshatra).not.toBeNull();
    expect(readLens("vedic", exact).ok).toBe(true);
    // Across a whole day the Moon moves about 13 degrees, a full nakshatra.
    const day = vedicMoon([new Date("2000-01-01T00:00:00Z"), new Date("2000-01-01T23:59:00Z")]);
    expect(day.nakshatra).toBeNull();
  });
});
