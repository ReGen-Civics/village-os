import { describe, expect, it } from "vitest";
import { batchCodeOf, changeCodeOf, matchesFind, normalizeCode } from "./proposedChanges";
import { queueItemOf } from "./proposalQueue";

describe("proposal short codes", () => {
  it("builds a batch code and a change code from its place", () => {
    expect(batchCodeOf(27)).toBe("B-27");
    expect(changeCodeOf("B-27", 0)).toBe("B-27.1");
    expect(changeCodeOf("B-27", 1)).toBe("B-27.2");
  });

  it("reads a typed code in any spacing or case", () => {
    expect(normalizeCode("b27")).toBe("B-27");
    expect(normalizeCode(" B 27 ")).toBe("B-27");
    expect(normalizeCode("b-27.2")).toBe("B-27.2");
    expect(normalizeCode("B-027.02")).toBe("B-27.2");
    expect(normalizeCode("pc_90175c42bc84937192")).toBeNull();
    expect(normalizeCode("B-")).toBeNull();
  });

  const item = { id: "pc_90175c42bc84937192", code: "B-27.2", batchId: "pcb_9f4e302d36470e1903", batchCode: "B-27" };
  it("finds a change by its code, its batch code, or either long id", () => {
    expect(matchesFind("", item)).toBe(true);
    expect(matchesFind("B-27.2", item)).toBe(true);
    expect(matchesFind("b-27", item)).toBe(true);
    expect(matchesFind("B-27.1", item)).toBe(false);
    expect(matchesFind("B-2", item)).toBe(false);
    expect(matchesFind("pc_90175c42bc84937192", item)).toBe(true);
    expect(matchesFind("PCB_9F4E302D36470E1903", item)).toBe(true);
    expect(matchesFind("pc_90175c", item)).toBe(true);
    expect(matchesFind("pc_9", item)).toBe(false);
  });

  it("carries the code in what an agent reads", () => {
    const q = queueItemOf({ id: "pc_a", code: "B-3.1", batchId: "pcb_a", kind: "setting", summary: "x", status: "proposed", proposedBy: "u", proposedByKind: "agent" }, "u");
    expect(q.code).toBe("B-3.1");
    expect(queueItemOf({ id: "pc_a", batchId: "pcb_a", kind: "setting", summary: "x", status: "proposed", proposedBy: "u", proposedByKind: "agent" }, "u").code).toBeNull();
  });
});
