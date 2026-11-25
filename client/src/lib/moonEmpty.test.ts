import { describe, expect, it } from "vitest";
import { moonIsEmpty } from "./moonEmpty";

const days = ["2026-11-20", "2026-11-21", "2026-11-22"];
const map = (entries: Record<string, Array<{ kind: any; isExample?: boolean }>>) => new Map(Object.entries(entries)) as any;

describe("moonIsEmpty", () => {
  it("a moon with only the season, the sky, its own turnings and examples is empty", () => {
    expect(moonIsEmpty(days, map({}))).toBe(true);
    expect(moonIsEmpty(days, map({ "2026-11-20": [{ kind: "season" }, { kind: "sky" }], "2026-11-21": [{ kind: "cycle-mark" }, { kind: "gathering", isExample: true }] }))).toBe(true);
  });

  it("one real thing on any day of the moon is enough to show the moon", () => {
    expect(moonIsEmpty(days, map({ "2026-11-22": [{ kind: "gathering" }] }))).toBe(false);
    expect(moonIsEmpty(days, map({ "2026-11-21": [{ kind: "quest-window" }] }))).toBe(false);
  });

  it("CONTROL: a gathering outside the moon's days does not count", () => {
    expect(moonIsEmpty(days, map({ "2026-12-01": [{ kind: "gathering" }] }))).toBe(true);
  });
});
