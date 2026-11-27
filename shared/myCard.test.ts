/**
 * Today's card, the pure part (shared/myCard.ts): the draw is the same for a member and a date, leans toward
 * the spheres today's sky touches, and reads only what it is handed. Invented birth, real arithmetic.
 */
import { describe, expect, it } from "vitest";
import { chartAt, skyAt, zonedToUtc } from "./geneKeysSky";
import { SPHERES, sphereOf } from "./geneKeys";
import { drawCard, parseCardDate, parseTodayFacts, plainCardReading, seedOf, skyFitsDate, timeLine, todayLine, NO_FACTS } from "./myCard";

const WREN = chartAt(zonedToUtc(1990, 6, 15, 14, 30, "America/New_York"));
const SKY = skyAt(new Date("2024-08-05T12:00:00Z"));

describe("the draw", () => {
  it("draws the same card for the same member and date, every time", () => {
    const a = drawCard(WREN, SKY, seedOf("7", "2024-08-05"));
    for (let i = 0; i < 5; i++) expect(drawCard(WREN, SKY, seedOf("7", "2024-08-05"))).toEqual(a);
    expect(SPHERES).toContain(a.sphere);
    expect(a.gate).toBe(sphereOf(WREN, a.sphere).gate);
    expect(a.line).toBe(sphereOf(WREN, a.sphere).line);
  });

  it("seeds a different draw for another day or another member", () => {
    const seeds = new Set(["2024-08-05", "2024-08-06", "2024-08-07"].flatMap((d) => ["7", "8"].map((u) => seedOf(u, d))));
    expect(seeds.size).toBe(6);
    const sphereSeen = new Set(Array.from({ length: 60 }, (_, i) => drawCard(WREN, SKY, seedOf("7", `2024-09-${String((i % 28) + 1).padStart(2, "0")}`) + i).sphere));
    expect(sphereSeen.size).toBeGreaterThan(3);
  });

  it("leans toward a sphere today's Sun stands in, and names how the sky touches it", () => {
    // A sky with the Sun standing in this member's Radiance gate.
    const radiance = sphereOf(WREN, "radiance").gate;
    const sky = { ...SKY, gates: { ...SKY.gates, Sun: { gate: radiance, line: 1 } } };
    let hits = 0;
    for (let s = 0; s < 400; s++) {
      const c = drawCard(WREN, sky, s * 2654435761);
      if (c.gate === radiance) {
        hits++;
        expect(c.touch).toBe("sun");
      }
    }
    // Weight 6 among the eleven: well over the 1 in 11 an untouched sphere gets.
    expect(hits / 400).toBeGreaterThan(0.2);
  });
});

describe("the date and the sky", () => {
  const NOW = Date.parse("2024-08-05T17:00:00Z");
  it("takes the member's own date within a day and a half, and nothing else", () => {
    expect(parseCardDate("2024-08-05", NOW)).toBe("2024-08-05");
    expect(parseCardDate("2024-08-06", NOW)).toBe("2024-08-06");
    expect(parseCardDate("2024-08-08", NOW)).toBeNull();
    expect(parseCardDate("2024-02-31", NOW)).toBeNull();
    expect(parseCardDate("tomorrow", NOW)).toBeNull();
  });
  it("weighs the card against the sky at noon of its date", () => {
    expect(skyFitsDate(SKY, "2024-08-05")).toBe(true);
    expect(skyFitsDate(SKY, "2024-08-07")).toBe(false);
  });
});

describe("what is going on today", () => {
  it("keeps counts and the moon and season, clamped, and drops anything else", () => {
    const f = parseTodayFacts({ quests: 2, tasks: -1, decisions: 1.5, asks: "3", sessions: 500, gatherings: 1, moon: { n: 4, day: 12, of: 29 }, season: { name: "  The   Dry ", day: 40, of: 120 }, titles: ["secret"] });
    expect(f).toEqual({ quests: 2, tasks: 0, decisions: 0, asks: 0, sessions: 99, gatherings: 1, moon: { n: 4, day: 12, of: 29 }, season: { name: "The Dry", day: 40, of: 120 } });
    expect(parseTodayFacts(null)).toEqual(NO_FACTS);
    expect(timeLine(f)).toBe("Moon 4, day 12 of 29. The Dry, day 40 of 120.");
  });

  it("reads a waiting decision by the member's authority, and an empty day by their strategy", () => {
    expect(todayLine({ ...NO_FACTS, decisions: 1, quests: 2 }, "Projector", "Emotional")).toBe(
      "A decision waits on you and two quests in hand. For the decision, your authority: sleep on it. Clarity comes with time.",
    );
    expect(todayLine(NO_FACTS, "Generator", "Sacral")).toMatch(/^Nothing waits on you in the village today\. As a Generator: let life bring you things/);
  });

  it("builds the plain reading from the card, the chart's line and the day", () => {
    const card = drawCard(WREN, SKY, seedOf("7", "2024-08-05"));
    const r = plainCardReading(card, SKY, "Your chart line.", { ...NO_FACTS, tasks: 1 }, "Projector", "Splenic");
    expect(r.source).toBe("plain");
    expect(r.focus.charAt(0)).toBe(r.focus.charAt(0).toUpperCase());
    expect(r.paragraphs).toHaveLength(3);
    expect(r.paragraphs[0]).toContain(`gate ${card.gate}, your ${card.name}`);
    expect(r.paragraphs[2]).toMatch(/^One task from your sessions\./);
  });
});
