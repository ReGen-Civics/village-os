import { describe, expect, it } from "vitest";
import { guideItems, GUIDE_LIMITS, mayUseGuide, readGuideNote } from "./conversationGuide";

const criteria = [
  { id: "c1", text: "Keeps the village's pace" },
  { id: "c2", text: "Works well with children" },
];

describe("the conversation guide's lines", () => {
  it("lists every criterion, then the qualities that are not already a criterion", () => {
    const items = guideItems(criteria, ["Listens before answering", " keeps the village's pace ", "", "Listens before answering"]);
    expect(items).toEqual([
      { key: "c:c1", kind: "criterion", text: "Keeps the village's pace" },
      { key: "c:c2", kind: "criterion", text: "Works well with children" },
      { key: "q:1", kind: "quality", text: "Listens before answering" },
    ]);
  });
  it("caps the qualities so the guide stays a conversation", () => {
    const many = Array.from({ length: 20 }, (_, i) => `Quality ${i}`);
    expect(guideItems([], many)).toHaveLength(GUIDE_LIMITS.qualities);
  });
  it("carries words only: no field of a line could hold a score", () => {
    expect(Object.keys(guideItems(criteria, ["x"])[0]).sort()).toEqual(["key", "kind", "text"]);
  });
});

describe("who may use the guide", () => {
  const base = { isApplicant: false, recused: false, isReviewer: false, isFinalCall: false };
  it("is the reviewers and the final-call role, never the applicant or a recused reviewer", () => {
    expect(mayUseGuide({ ...base, isReviewer: true })).toBe(true);
    expect(mayUseGuide({ ...base, isFinalCall: true })).toBe(true);
    expect(mayUseGuide(base)).toBe(false);
    expect(mayUseGuide({ ...base, isReviewer: true, recused: true })).toBe(false);
    expect(mayUseGuide({ ...base, isReviewer: true, isApplicant: true })).toBe(false);
  });
});

describe("reading a note", () => {
  const items = guideItems(criteria, []);
  it("reads a note for a line on the guide, and an empty one clears the line", () => {
    expect(readGuideNote({ key: "c:c1", note: " Good example\r\n" }, items)).toEqual({ ok: true, key: "c:c1", note: "Good example" });
    expect(readGuideNote({ key: "c:c1", note: "" }, items)).toEqual({ ok: true, key: "c:c1", note: "" });
  });
  it("refuses a line that is not there and a note that is too long", () => {
    expect(readGuideNote({ key: "c:zz", note: "x" }, items).ok).toBe(false);
    expect(readGuideNote({ key: "c:c1", note: "x".repeat(GUIDE_LIMITS.note + 1) }, items).ok).toBe(false);
    expect(readGuideNote(null, items).ok).toBe(false);
  });
});
