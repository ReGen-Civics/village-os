import { describe, expect, it } from "vitest";
import { finalFreezes, mayRefine, PROPOSAL_VERSIONS_MAX, readRefined, readVersions } from "./proposalRefine";
import { OPEN_AIM_MAX } from "./openProposals";

describe("when the applicant may refine their proposal", () => {
  it("only at References and proposal, undecided, before the final conversation opens", () => {
    expect(mayRefine({ stage: "references", decided: false, finalFrozen: false })).toBe(true);
    // CONTROLS: every other stage, a decision, or a final conversation that opened closes it.
    for (const stage of ["received", "review", "final_interview", "agreement", "start"] as const) expect(mayRefine({ stage, decided: false, finalFrozen: false })).toBe(false);
    expect(mayRefine({ stage: "references", decided: true, finalFrozen: false })).toBe(false);
    expect(mayRefine({ stage: "references", decided: false, finalFrozen: true })).toBe(false);
  });

  it("a final conversation freezes it once it opens, is booked, held or skipped; one still waiting does not", () => {
    expect(finalFreezes([])).toBe(false);
    expect(finalFreezes([{ state: "waiting", booked: false }])).toBe(false);
    expect(finalFreezes([{ state: "waiting", booked: true }])).toBe(true);
    for (const state of ["open", "scored", "skipped"]) expect(finalFreezes([{ state, booked: false }])).toBe(true);
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
