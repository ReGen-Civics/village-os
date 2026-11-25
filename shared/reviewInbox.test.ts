import { describe, expect, it } from "vitest";
import { findInInbox, fromAgentWaiting, fromApprovals, fromClaims, fromConnector, fromReviewQueue, fromSeraDifferences, mergeSections, searchedCode, stateOfStatus } from "./reviewInbox";

const connector = {
  timezone: "UTC",
  batches: [{ id: "pcb_1", code: "B-71", title: "Phase A words", by: "Helper", byKind: "agent", at: "2026-11-20T10:00:00.000Z" }],
  changes: [
    { id: "pc_1", code: "B-71.1", batchId: "pcb_1", batchCode: "B-71", kind: "page_content", summary: "Reword the home headline.", body: { secret: "x" }, live: { y: 1 }, at: "2026-11-20T10:00:00.000Z" },
    { id: "pc_2", code: "B-71.2", batchId: "pcb_1", batchCode: "B-71", kind: "faq_add", summary: "Add an FAQ.", at: "2026-11-20T10:00:01.000Z" },
  ],
  decided: [],
};

describe("reading each queue's answer", () => {
  it("keeps a connector change's code, its batch's code and title, and never its body or live value", () => {
    const items = fromConnector(connector);
    expect(items.map((i) => [i.key, i.code, i.batch?.code, i.batch?.title])).toEqual([
      ["connector:pc_1", "B-71.1", "B-71", "Phase A words"],
      ["connector:pc_2", "B-71.2", "B-71", "Phase A words"],
    ]);
    expect(JSON.stringify(items)).not.toContain("secret");
  });

  it("reads intake cards by their payload's title, and quest ideas by their prose title", () => {
    const { intake, quest } = fromReviewQueue({
      batches: [{ batchId: "eb_1", items: [{ id: "ep_1", kind: "role.proposed", payload: { name: "Water Steward" }, receivedAt: "2026-11-19T00:00:00.000Z" }, { id: "ep_2", kind: "risk.observed", payload: {}, receivedAt: "2026-11-19T00:00:01.000Z" }] }],
      quests: [{ id: "qp_1", prose: { title: "Seed library" }, receivedAt: "2026-11-18T00:00:00.000Z" }],
    });
    expect(intake.map((i) => i.summary)).toEqual(["Water Steward", "risk observed"]);
    expect(intake[0].batch?.key).toBe("intake:eb_1");
    expect(quest.map((i) => [i.key, i.summary])).toEqual([["quest:qp_1", "Seed library"]]);
  });

  it("keeps only the finished work that waits for a witness", () => {
    const items = fromClaims([
      { id: "c1", status: "submitted", questTitle: "Mend the fence", submittedAt: "2026-11-21T00:00:00.000Z" },
      { id: "c2", status: "claimed", questTitle: "Not yet done" },
      { id: "c3", status: "consented", questTitle: "Already witnessed" },
    ]);
    expect(items.map((i) => i.key)).toEqual(["claim:c1"]);
  });

  it("files the approvals read's seatings and role-change drafts under the agent, as the agent read names them", () => {
    const fromApproval = fromApprovals({ waiting: [{ id: "ap_1", kind: "setting", title: "Turn a dial", at: "2026-11-20T00:00:00.000Z" }, { id: "ap_2", kind: "seating", title: "Seat someone", at: "2026-11-20T00:00:01.000Z" }, { id: "draft:d1", kind: "role_change", title: "Move a role", at: null }] });
    const fromAgent = fromAgentWaiting({ roleChanges: [{ draftId: "d1", title: "Move a role" }], seatings: [{ id: "ap_2", title: "Seat someone", createdAt: "2026-11-20T00:00:01.000Z" }] });
    expect(fromApproval.map((i) => i.key)).toEqual(["approval:ap_1", "agent:seating:ap_2", "agent:draft:d1"]);
    expect(fromAgent.map((i) => i.key).sort()).toEqual(["agent:draft:d1", "agent:seating:ap_2"]);
    expect(fromApproval.find((i) => i.kind === "seating")?.touchesPerson).toBe(true);
  });

  it("reads Sera's differences by their sentence", () => {
    const items = fromSeraDifferences({ differences: [{ key: "page1:name", kind: "rename", words: { sentence: "Sera calls this circle Garden." }, source: { editedAt: "2026-11-17T00:00:00.000Z" }, batchId: "eb_1" }] });
    expect(items.map((i) => [i.key, i.summary, i.batch?.key])).toEqual([["sera:page1:name", "Sera calls this circle Garden.", "intake:eb_1"]]);
  });

  it("tolerates an answer of the wrong shape as an empty one, never as a crash", () => {
    for (const bad of [null, 5, "x", [], { changes: "no" }]) {
      expect(fromConnector(bad)).toEqual([]);
      expect(fromClaims(bad)).toEqual([]);
      expect(fromReviewQueue(bad)).toEqual({ intake: [], quest: [] });
    }
  });
});

describe("one list", () => {
  it("reads 401 and 403 as refused, 404 as a module that is off, and anything else unhappy as failed", () => {
    expect([200, 401, 403, 404, 429, 500, 504].map(stateOfStatus)).toEqual(["ok", "refused", "refused", "off", "failed", "failed", "failed"]);
  });

  it("lists an item two queues share once, oldest first, untimed last, and nothing from a section that is not ok", () => {
    const seat = { key: "agent:seating:s1", source: "agent" as const, kind: "seating", code: null, summary: "Seat", filedAt: "2026-11-20T00:00:00.000Z", batch: null, decideAt: "/review", touchesPerson: true };
    const draft = { ...seat, key: "agent:draft:d1", kind: "role_change", filedAt: null, touchesPerson: false };
    const old = { ...seat, key: "connector:pc_0", source: "connector" as const, filedAt: "2026-11-01T00:00:00.000Z", touchesPerson: false };
    const merged = mergeSections([
      { source: "approval", state: "ok", items: [seat] },
      { source: "agent", state: "ok", items: [draft, seat] },
      { source: "connector", state: "ok", items: [old] },
      { source: "claim", state: "failed", items: [{ ...seat, key: "claim:x" }] },
    ]);
    expect(merged.map((i) => i.key)).toEqual(["connector:pc_0", "agent:seating:s1", "agent:draft:d1"]);
  });

  it("finds a batch by its code, one change by its code, and nothing for a code it does not hold", () => {
    const items = fromConnector(connector);
    expect(findInInbox(items, "B-71").map((i) => i.code)).toEqual(["B-71.1", "B-71.2"]);
    expect(findInInbox(items, "b71.2").map((i) => i.code)).toEqual(["B-71.2"]);
    expect(findInInbox(items, "B-99")).toEqual([]);
    expect(findInInbox(items, "")).toEqual([]);
    expect(searchedCode("b 71")).toBe("B-71");
    expect(searchedCode("water")).toBeNull();
  });
});
