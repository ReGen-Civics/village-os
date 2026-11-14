import { describe, expect, it } from "vitest";
import { splitDomain, splitLine } from "./rolePieces";

describe("splitLine", () => {
  it("turns a short lead and a colon into a titled tile", () => {
    expect(splitLine("Our story: the village's voice across every channel")).toEqual({ title: "Our story", body: "the village's voice across every channel" });
  });
  it("gives a rhythm line its cadence as the title", () => {
    expect(splitLine("Each month: the webinar, and a report to the circle")).toEqual({ title: "Each month", body: "the webinar, and a report to the circle" });
  });
  it("keeps a line with no lead whole", () => {
    expect(splitLine("Approve routine payments that match a budget line")).toEqual({ title: null, body: "Approve routine payments that match a budget line" });
  });
  it("keeps a line whole when the text before the colon is a sentence or too long", () => {
    const long = "Bring the numbers to the circle each month and say plainly what they mean: reach";
    expect(splitLine(long)).toEqual({ title: null, body: long });
    expect(splitLine("It works. Then: more")).toEqual({ title: null, body: "It works. Then: more" });
  });
  it("never drops a word", () => {
    for (const l of ["Our story: a", "a: b: c", "plain"]) {
      const s = splitLine(l);
      expect(`${s.title ? `${s.title}: ` : ""}${s.body}`).toBe(l);
    }
  });
});

describe("splitDomain", () => {
  it("splits a domain written as a list at the writer's semicolons", () => {
    const d = splitDomain("How the story is told: storytelling and brand; social media; and the webinar.");
    expect(d).toEqual({ lead: "How the story is told", parts: ["Storytelling and brand", "Social media", "The webinar"] });
  });
  it("leaves prose whole (control: no semicolons, no split)", () => {
    const text = "Everything that becomes physical on the land, from permits to homes.";
    expect(splitDomain(text)).toEqual({ lead: text, parts: [] });
  });
});
