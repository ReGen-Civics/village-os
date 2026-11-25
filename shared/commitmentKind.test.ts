import { describe, expect, it } from "vitest";
import { commitmentKind, timeFromWords } from "./commitmentKind";

describe("commitmentKind: the role's own data, never invented", () => {
  it("a whole share of 100 is full time, less is part time", () => {
    expect(commitmentKind({ card: { commitmentPct: 100 } })).toEqual({ time: "full", contract: false });
    expect(commitmentKind({ card: { commitmentPct: 40 } })).toEqual({ time: "part", contract: false });
  });

  it("a role that can be shared from below 100 is full or part time, and a contractor track says contract", () => {
    // The shape of the open founding roles on the first village (from 30%, contractor).
    expect(commitmentKind({ card: { commitmentMin: 30, track: "contractor" } })).toEqual({ time: "either", contract: true });
    expect(commitmentKind({ card: { commitmentMin: 100 } })).toEqual({ time: "full", contract: false });
  });

  it("the share wins over the words the role was written with", () => {
    expect(commitmentKind({ timeCommitment: "Part time", card: { commitmentPct: 100 } })?.time).toBe("full");
  });

  it("falls back to the role's own words, and an older track word still reads as a contract", () => {
    expect(commitmentKind({ timeCommitment: "Part time, agreed with the Anchor Circle", card: { track: "paid" } })).toEqual({ time: "part", contract: true });
    expect(commitmentKind({ timeCommitment: "Part or full commitment, agreed with the steward" })?.time).toBe("either");
    expect(commitmentKind({ timeCommitment: "Likely part-time" })?.time).toBe("part");
  });

  it("says nothing when the data says nothing: no hours, no pay, no guess", () => {
    expect(commitmentKind({ timeCommitment: "Commission-based, at the commitment you choose" })).toBeNull();
    expect(commitmentKind({ timeCommitment: "A few hours a week" })).toBeNull();
    expect(commitmentKind({})).toBeNull();
    expect(commitmentKind(null)).toBeNull();
    expect(commitmentKind({ card: { commitmentPct: 0 } })).toBeNull();
    expect(commitmentKind({ card: { commitmentPct: 150 } })).toBeNull();
  });

  it("a contract with no time said is a contract alone", () => {
    expect(commitmentKind({ card: { track: "contractor" } })).toEqual({ time: null, contract: true });
    expect(commitmentKind({ card: { track: "volunteer" }, timeCommitment: "Full time" })).toEqual({ time: "full", contract: false });
  });

  it("reads full, part and both from words, case-insensitively", () => {
    expect(timeFromWords("FULL TIME")).toBe("full");
    expect(timeFromWords("fractional")).toBe("part");
    expect(timeFromWords("Full or part commitment (from 30% this season)")).toBe("either");
    expect(timeFromWords("partner work")).toBeNull();
    expect(timeFromWords(42)).toBeNull();
  });
});
