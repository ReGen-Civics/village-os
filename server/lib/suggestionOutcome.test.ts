/**
 * The outcome a decided proposed change leaves: its id is fixed by the change (so a second write is a
 * no-op), it carries what was PROPOSED (so the discard window compares what a stream sends again), and it
 * names a person's filing as a member's, never by who they are. No database.
 */
import { describe, expect, it } from "vitest";
import { valueDigestOf } from "../../shared/suggestionPipeline/engine";
import { outcomeOfChange } from "./suggestionOutcome";

const change = {
  id: "pc_abc",
  kind: "page_content" as const,
  target: { section: "page-home" },
  body: { hero: { headline: "A home on the land" } },
  proposedByKind: "person" as const,
  createdAt: "2026-11-20T10:00:00.000Z",
};

describe("outcomeOfChange", () => {
  it("fixes its id by the change, digests the proposed value, and names the filer only as a member", () => {
    const o = outcomeOfChange(change, "edited", 1, "story.tell", "2026-11-21T10:00:00.000Z");
    expect(o.id).toBe("pcd_pc_abc");
    expect(o.stream).toBe("connector");
    expect(o.valueDigest).toBe(valueDigestOf(change));
    expect(o.keys.length).toBeGreaterThan(0);
    expect(o.proposerKind).toBe("member");
    expect([o.outcome, o.fieldsEdited, o.decidedByCapability]).toEqual(["edited", 1, "story.tell"]);
  });

  it("gives the same id for the same change whatever the outcome, so one change records one decision", () => {
    expect(outcomeOfChange(change, "accepted", 0, "admin", new Date()).id).toBe(outcomeOfChange(change, "discarded", 0, "admin", new Date()).id);
  });
});
