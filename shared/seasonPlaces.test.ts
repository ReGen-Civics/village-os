/**
 * Season places, the pure rules: seasons served, the road, the cap and the
 * words. Every circle and season here is invented.
 */
import { describe, expect, it } from "vitest";
import {
  freePlaces,
  overCap,
  parseWords,
  placeAdoptionPath,
  placeBallotDoc,
  placeBallotTitle,
  placeOrQueue,
  PLACE_NOTICES,
  roadFor,
  seasonsServed,
  subjectKindOf,
  targetSeasonOf,
  type PlaceSeason,
} from "./seasonPlaces";

const S1: PlaceSeason = { id: "s1", name: "First", startsOn: "2026-01-01", endsOn: "2026-03-31" };
const S2: PlaceSeason = { id: "s2", name: "Second", startsOn: "2026-04-01", endsOn: "2026-06-30" };
const S3: PlaceSeason = { id: "s3", name: "Third", startsOn: "2026-07-01", endsOn: "2026-09-30" };
const S4: PlaceSeason = { id: "s4", name: "Fourth", startsOn: "2026-10-01", endsOn: null };
const ALL = [S1, S2, S3, S4];

describe("seasons served", () => {
  it("counts each earlier season the subject held a place in, once", () => {
    const rows = [
      { seasonId: "s1", status: "taking_part" as const },
      { seasonId: "s2", status: "taking_part" as const },
      { seasonId: "s3", status: "taking_part" as const },
    ];
    expect(seasonsServed(rows, ALL, S4)).toBe(3);
  });

  it("counts the season running now toward the next one (spec C2)", () => {
    expect(seasonsServed([{ seasonId: "s3", status: "taking_part" }], ALL, S4)).toBe(1);
  });

  it("never counts the target, a later season, or a place not held", () => {
    const rows = [
      { seasonId: "s4", status: "taking_part" as const },
      { seasonId: "s2", status: "waitlisted" as const },
      { seasonId: "s1", status: "declined" as const },
      { seasonId: "s1", status: "withdrawn" as const },
    ];
    expect(seasonsServed(rows, ALL, S3)).toBe(0);
  });

  it("still counts a place held in a season the calendar no longer lists", () => {
    expect(seasonsServed([{ seasonId: "gone", status: "taking_part" }], ALL, S2)).toBe(1);
  });
});

describe("the road", () => {
  it("blank means every season needs a proposal", () => {
    expect(roadFor(40, null)).toBe("proposal");
  });
  it("takes part without a proposal once served reaches the dial", () => {
    expect(roadFor(2, 3)).toBe("proposal");
    expect(roadFor(3, 3)).toBe("served");
    expect(roadFor(0, 0)).toBe("served");
  });
});

describe("the cap", () => {
  it("blank is no cap, and 0 is no places (caps fail closed)", () => {
    expect(placeOrQueue(10_000, null)).toBe("taking_part");
    expect(placeOrQueue(0, 0)).toBe("waitlisted");
  });
  it("the forty-fourth takes the last place and the forty-fifth waits", () => {
    expect(placeOrQueue(43, 44)).toBe("taking_part");
    expect(placeOrQueue(44, 44)).toBe("waitlisted");
  });
  it("fills only the free places, and a lowered cap removes nobody", () => {
    expect(freePlaces(42, 44, 5)).toBe(2);
    expect(freePlaces(50, 44, 5)).toBe(0);
    expect(freePlaces(0, null, 5)).toBe(5);
    expect(overCap(50, 44)).toBe(6);
    expect(overCap(50, null)).toBe(0);
  });
});

describe("who decides", () => {
  it("a holder outside the circle decides; the crew never decides its own", () => {
    expect(placeAdoptionPath({ who: "live-holders", holders: ["a", "x"] }, ["a", "b"])).toBe("holder");
    expect(placeAdoptionPath({ who: "live-holders", holders: ["a", "b"] }, ["a", "b"])).toBe("ballot");
    expect(placeAdoptionPath({ who: "any-member", holders: [] }, ["a"])).toBe("ballot");
  });
});

describe("the season a request means", () => {
  const state = { current: S3, upcoming: S4 };
  it("defaults to the next season, else the one running", () => {
    expect(targetSeasonOf(state, undefined)?.id).toBe("s4");
    expect(targetSeasonOf({ current: S3, upcoming: null }, "")?.id).toBe("s3");
  });
  it("refuses a season that is over or not open", () => {
    expect(targetSeasonOf(state, "s1")).toBeNull();
    expect(targetSeasonOf(state, "s3")?.id).toBe("s3");
  });
});

describe("words", () => {
  it("keeps the crew's words to 600 characters", () => {
    expect(parseWords("x".repeat(601)).ok).toBe(false);
    expect(parseWords("  a\u0007 b  ")).toEqual({ ok: true, words: "a b" });
    expect(parseWords("")).toEqual({ ok: true, words: null });
    expect(parseWords(5).ok).toBe(false);
  });
  it("names the circle and never a person, and a member subject is 'you' to themselves", () => {
    const circle = { kind: "circle" as const, name: "North Crew" };
    const member = { kind: "member" as const, name: "" };
    expect(PLACE_NOTICES.opened(circle, "Fourth")).toBe("A place opened. North Crew takes part in Fourth.");
    expect(PLACE_NOTICES.placed(member, "Fourth")).toBe("You take part in Fourth.");
    expect(PLACE_NOTICES.waitlisted(circle, "Fourth", 2)).toContain("number 2 on the waitlist");
    expect(placeBallotTitle(member, "Fourth")).toBe("A member takes part in Fourth");
    expect(placeBallotDoc(circle, "Fourth", 1)).toContain("North Crew takes part in Fourth. It has held a place in 1 earlier season.");
  });
  it("reads an unknown subject dial as circles", () => {
    expect(subjectKindOf("member")).toBe("member");
    expect(subjectKindOf("ships")).toBe("circle");
  });
});
