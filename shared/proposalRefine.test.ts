import { describe, expect, it } from "vitest";
import { finalFreezes, mayRefine, PROPOSAL_VERSIONS_MAX, readRefined, readVersions } from "./proposalRefine";
import { OPEN_AIM_MAX } from "./openProposals";

describe("when the applicant may refine their proposal", () => {
  it("at References and proposal and at the Final conversation, undecided, until it goes to the anchor circle", () => {
    // The lead, 27 Nov 2026: "one more opportunity to refine their proposal before it's up for anchor circle review".
    expect(mayRefine({ stage: "references", decided: false, finalFrozen: false })).toBe(true);
    expect(mayRefine({ stage: "final_interview", decided: false, finalFrozen: false })).toBe(true);
    // "they can refine proposal in each stage" (the lead, 27 Nov 2026): Received and Our review too.
    expect(mayRefine({ stage: "received", decided: false, finalFrozen: false })).toBe(true);
    expect(mayRefine({ stage: "review", decided: false, finalFrozen: false })).toBe(true);
    // CONTROLS: Agreement and Start, a decision, or the proposal sent to the circle closes it.
    for (const stage of ["agreement", "start"] as const) expect(mayRefine({ stage, decided: false, finalFrozen: false })).toBe(false);
    expect(mayRefine({ stage: "references", decided: true, finalFrozen: false })).toBe(false);
    expect(mayRefine({ stage: "final_interview", decided: false, finalFrozen: true })).toBe(false);
  });

  it("the proposal is fixed once it is SENT to the anchor circle (ruling 7), never at the final conversation's write-up", () => {
    expect(finalFreezes({ sentToCircle: false })).toBe(false);
    expect(finalFreezes({ sentToCircle: true })).toBe(true);
  });
});

describe("the refined words", () => {
  it("needs both, trimmed, within the form's limits", () => {
    expect(readRefined({ why: "  Because.\r\nNow. ", aim: " Clear books. " })).toEqual({ ok: true, why: "Because.\nNow.", aim: "Clear books." });
    expect(readRefined({ why: "x" })).toEqual({ ok: false, error: "empty" });
    expect(readRefined(null)).toEqual({ ok: false, error: "empty" });
    expect(readRefined({ why: "x", aim: "y".repeat(OPEN_AIM_MAX + 1) })).toEqual({ ok: false, error: "too_long" });
  });

  it("reads the kept versions, oldest first, dropping what it cannot read, and keeps at most the cap", () => {
    expect(readVersions("nope")).toEqual([]);
    expect(readVersions([{ at: "2026-11-27T00:00:00Z", why: "a", aim: "b" }, null, { why: "no date" }])).toEqual([{ at: "2026-11-27T00:00:00Z", why: "a", aim: "b" }]);
    const many = Array.from({ length: PROPOSAL_VERSIONS_MAX + 5 }, (_, i) => ({ at: `2026-11-${String(i + 1).padStart(2, "0")}`, why: `w${i}`, aim: "a" }));
    const kept = readVersions(many);
    expect(kept).toHaveLength(PROPOSAL_VERSIONS_MAX);
    expect(kept[0].why).toBe("w5");
  });
});
