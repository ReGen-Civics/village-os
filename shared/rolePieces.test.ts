import { describe, expect, it } from "vitest";
import { domainsHeld, splitDomain, splitLine } from "./rolePieces";

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

describe("domainsHeld", () => {
  it("names each part of a listed domain, cut at its first comma outside brackets, and leaves out growing a circle", () => {
    const d = "How the story is told: storytelling, brand and the content calendar; social media; the permitting sequence (including the D1 and water permits), wells and roads; and, as the circle grows, the team that holds each of these.";
    expect(domainsHeld(d)).toEqual(["Storytelling, brand and the content calendar", "Social media", "The permitting sequence (including the D1 and water permits)"]);
  });
  it("draws nothing for a domain written as prose (control: no list, no chips)", () => {
    expect(domainsHeld("Everything that becomes physical on the land.")).toEqual([]);
  });
  it("keeps a short part whole and cuts a long one at its first comma (live test, 14 Nov)", () => {
    const d = "The land: building, renovation and repair; the financial model and its change log, including viability, lot pricing and funding scenarios";
    expect(domainsHeld(d)).toEqual(["Building, renovation and repair", "The financial model and its change log"]);
  });
  it("keeps to the most it is asked for", () => {
    expect(domainsHeld("Money: a; b; c; d; e; f", 4)).toEqual(["A", "B", "C", "D"]);
  });
});
