import { describe, expect, it } from "vitest";
import { bookingLinksText, memberBookingUrl, parseMemberBookingInput, stepBookingLinks } from "./interviewBooking";
import { GUT_CRITERION, gutOfRow, parseCriteria, parseGutInput } from "./applicationReview";

const ANA = "https://calendar.example.test/ana";
const BEN = "https://calendar.example.test/ben";
const ROLE = "https://calendar.example.test/role";

describe("which booking link a conversation offers", () => {
  it("the person holding the role first, then the role's link, then nothing", () => {
    expect(stepBookingLinks([{ firstName: "Ana", bookingUrl: ANA }], ROLE)).toEqual([{ who: null, url: ANA }]);
    expect(stepBookingLinks([{ firstName: "Ana", bookingUrl: null }], ROLE)).toEqual([{ who: null, url: ROLE }]);
    expect(stepBookingLinks([], ROLE)).toEqual([{ who: null, url: ROLE }]);
    expect(stepBookingLinks([{ firstName: "Ana", bookingUrl: null }], null)).toEqual([]);
  });

  it("lists several holders by first name, in a steady order, and the same link once", () => {
    expect(stepBookingLinks([{ firstName: "Ben", bookingUrl: BEN }, { firstName: "Ana", bookingUrl: ANA }, { firstName: "Cy", bookingUrl: null }], ROLE)).toEqual([
      { who: "Ana", url: ANA },
      { who: "Ben", url: BEN },
    ]);
    // Two people sharing one page read as one link.
    expect(stepBookingLinks([{ firstName: "Ana", bookingUrl: ANA }, { firstName: "Ben", bookingUrl: ANA }], ROLE)).toEqual([{ who: null, url: ANA }]);
  });

  it("never offers a link that is not https, from a person or a role", () => {
    for (const bad of ["http://calendar.example.test/x", "javascript:alert(1)", "data:text/html,hi", "https://u:p@calendar.example.test/x", 7, {}]) {
      expect(stepBookingLinks([{ firstName: "Ana", bookingUrl: bad }], bad), String(bad)).toEqual([]);
    }
    // CONTROL: a bad personal link falls through to a good role link.
    expect(stepBookingLinks([{ firstName: "Ana", bookingUrl: "http://calendar.example.test/x" }], ROLE)).toEqual([{ who: null, url: ROLE }]);
  });

  it("writes the links into a letter: the link itself, or one line per person", () => {
    expect(bookingLinksText([])).toBeNull();
    expect(bookingLinksText([{ who: null, url: ANA }])).toBe(ANA);
    expect(bookingLinksText([{ who: "Ana", url: ANA }, { who: "Ben", url: BEN }])).toBe(`\nAna: ${ANA}\nBen: ${BEN}`);
  });
});

describe("a member's own booking link", () => {
  it("accepts https, trims it, and clears on empty or null", () => {
    expect(parseMemberBookingInput(`  ${ANA} `)).toEqual({ ok: true, value: ANA });
    expect(parseMemberBookingInput("")).toEqual({ ok: true, value: null });
    expect(parseMemberBookingInput(null)).toEqual({ ok: true, value: null });
  });

  it("refuses anything else in a sentence", () => {
    for (const bad of ["http://calendar.example.test/x", "javascript:alert(1)", "calendar.example.test/x", `https://calendar.example.test/${"a".repeat(300)}`, 42, ["x"]]) {
      const r = parseMemberBookingInput(bad);
      expect(r.ok, String(bad)).toBe(false);
      if (!r.ok) expect(r.problem).toMatch(/\.$/);
    }
  });

  it("reads back from prefs only through the same rule", () => {
    expect(memberBookingUrl({ bookingUrl: ANA })).toBe(ANA);
    expect(memberBookingUrl({ bookingUrl: "javascript:alert(1)" })).toBeNull();
    expect(memberBookingUrl(null)).toBeNull();
    expect(memberBookingUrl("x")).toBeNull();
  });
});

describe("the gut check", () => {
  it("is optional, and takes yes, no or not sure with one line", () => {
    expect(parseGutInput({})).toEqual({ ok: true, gut: null });
    expect(parseGutInput({ gut: null })).toEqual({ ok: true, gut: null });
    expect(parseGutInput({ gut: { answer: "", note: "" } })).toEqual({ ok: true, gut: null });
    expect(parseGutInput({ gut: { answer: "yes", note: "  Felt right.  " } })).toEqual({ ok: true, gut: { answer: "yes", note: "Felt right." } });
    expect(parseGutInput({ gut: { answer: "unsure" } })).toEqual({ ok: true, gut: { answer: "unsure", note: "" } });
  });

  it("refuses an unknown answer, a line with no answer, and a long line", () => {
    expect(parseGutInput({ gut: { answer: "maybe" } }).ok).toBe(false);
    expect(parseGutInput({ gut: { note: "No answer given." } }).ok).toBe(false);
    expect(parseGutInput({ gut: "yes" }).ok).toBe(false);
    expect(parseGutInput({ gut: { answer: "no", note: "x".repeat(201) } }).ok).toBe(false);
  });

  it("reads back only its own row, and a role's criteria can never take its id", () => {
    expect(gutOfRow({ criterionId: GUT_CRITERION, level: "no", evidence: "" })).toEqual({ answer: "no", note: "" });
    expect(gutOfRow({ criterionId: GUT_CRITERION, level: "strong", evidence: "" })).toBeNull();
    expect(gutOfRow({ criterionId: "c1", level: "yes", evidence: "" })).toBeNull();
    expect(parseCriteria([{ id: GUT_CRITERION, text: "Sneaky" }, { id: "~other", text: "Also" }]).map((c) => c.id)).toEqual(["c1", "c2"]);
    // CONTROL: an ordinary id is kept.
    expect(parseCriteria([{ id: "pace", text: "Keeps the pace" }]).map((c) => c.id)).toEqual(["pace"]);
  });
});
