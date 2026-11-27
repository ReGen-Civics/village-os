import { describe, expect, it } from "vitest";
import { findInInbox, fromAgentWaiting, fromApprovals, fromClaims, fromConnector, fromOrgDrafts, fromReviewQueue, fromSeraDifferences, mergeSections, searchedCode, stateOfStatus } from "./reviewInbox";
import type { InboxItem } from "./reviewInbox";

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
    expect(fromApproval.map((i) => i.key)).toEqual(["approval:ap_1", "agent:seating:ap_2", "structure:d1"]);
    expect(fromAgent.map((i) => i.key).sort()).toEqual(["agent:seating:ap_2", "structure:d1"]);
    // An agent's role draft is the same draft the org drafts read lists: one key, so it is listed once.
    expect(fromOrgDrafts([{ id: "d1", title: "Add a role", status: "open", changes: [{}] }]).map((i) => i.key)).toEqual(["structure:d1"]);
    expect(fromApproval.find((i) => i.kind === "seating")?.touchesPerson).toBe(true);
    // An approval lapses seven days after it was filed, and says when; a draft waits until it is decided.
    expect(fromApproval.find((i) => i.key === "approval:ap_1")?.lapsesAt).toBe("2026-11-27T00:00:00.000Z");
    expect(fromApproval.find((i) => i.key === "structure:d1")?.lapsesAt).toBeNull();
    expect(fromAgent.find((i) => i.kind === "seating")).toMatchObject({ lapsesAt: "2026-11-27T00:00:01.000Z", decideAt: "/governance/work#approvals" });
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

  it("lists an item two queues share once, oldest first, untimed last, keeps what a half-failed queue did read, and nothing from one that refused or is off", () => {
    const seat = { key: "agent:seating:s1", source: "agent" as const, kind: "seating", code: null, summary: "Seat", filedAt: "2026-11-20T00:00:00.000Z", batch: null, decideAt: "/review", touchesPerson: true };
    const draft = { ...seat, key: "structure:d1", kind: "role_change", filedAt: null, touchesPerson: false };
    const old = { ...seat, key: "connector:pc_0", source: "connector" as const, filedAt: "2026-11-01T00:00:00.000Z", touchesPerson: false };
    const merged = mergeSections([
      { source: "approval", state: "ok", items: [seat] },
      { source: "agent", state: "ok", items: [draft, seat] },
      { source: "connector", state: "ok", items: [old] },
      { source: "claim", state: "failed", items: [{ ...seat, key: "claim:x" }] },
      { source: "quest", state: "refused", items: [{ ...seat, key: "quest:r" }] },
      { source: "sera", state: "off", items: [{ ...seat, key: "sera:o" }] },
    ]);
    expect(merged.map((i) => i.key)).toEqual(["connector:pc_0", "agent:seating:s1", "claim:x", "structure:d1"]);
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

// ── Every queue a person decides from (lane 4a's completeness pass) ─────────

import {
  fromAssistantDrafts,
  fromBallots,
  fromCashOwed,
  fromChangeRequests,
  fromCycles,
  fromErasure,
  fromFeedback,
  fromHandoffs,
  fromHands,
  fromLetters,
  fromMintRequests,
  fromMoonQueue,
  fromOpenProposalDesk,
  fromOwedPostings,
  fromPlanting,
  fromSuggestions,
  fromVouches,
  fromWaitingOnMe,
  INBOX_ORDER,
  INBOX_READS,
  INBOX_SOURCES,
} from "./reviewInbox";

const keys = (items: { key: string }[]) => items.map((i) => i.key);

describe("every queue a person decides from", () => {
  it("reads every source from at least one route, and draws every source in one place on the page", () => {
    const read = new Set(INBOX_READS.flatMap((r) => r.sources));
    expect([...INBOX_SOURCES].filter((s) => !read.has(s))).toEqual([]);
    expect([...INBOX_ORDER].sort()).toEqual([...INBOX_SOURCES].sort());
    expect(new Set(INBOX_ORDER).size).toBe(INBOX_ORDER.length);
    // Each route is read once.
    expect(new Set(INBOX_READS.map((r) => r.path)).size).toBe(INBOX_READS.length);
  });

  it("every reader answers a body of the wrong shape with nothing, never a crash", () => {
    for (const r of INBOX_READS) {
      for (const bad of [null, 0, "x", [], {}, { rows: "no", items: 3 }]) expect(r.read(bad), r.path).toEqual([]);
    }
  });

  it("waiting-on-me: applications, consent rounds, open proposals, drafts, done work and tensions, each with its own door; applicants are never named", () => {
    const items = fromWaitingOnMe({
      applications: [{ id: "ap1", href: "/role-applications/ap1", seats: ["Water Steward"], circles: ["Water"], applicant: "Ana", appliedOn: "2026-11-20" }],
      toConsent: [{ proposalId: "rp1", applicationId: "ap2", href: "/role-applications/ap2", roles: ["Seed Keeper"], circle: "Garden", applicant: "Ben", closesOn: "2026-11-28" }],
      openProposals: [{ id: "op1", href: "/open-proposals/op1", roles: ["Builder"], circles: [], proposer: "Cy", ask: "adopt", closesOn: null, confirmedOn: "2026-11-19" }],
      drafts: [{ id: "d1", title: "A new circle", circles: 1, seats: 2, href: "/review/structure/b1" }],
      toAccept: [{ entryId: 7, text: "Mend the fence", role: "Builder", circle: null, doneOn: "2026-11-21" }],
      raisedWithYou: [{ id: "t1", roleId: "r1", role: "Builder", circle: "Garden", text: "The tools are missing", status: "open", raisedOn: "2026-11-22", overdue: false }],
    });
    expect(items.map((i) => [i.key, i.decideAt])).toEqual([
      ["application:ap1", "/role-applications/ap1"],
      ["consent:rp1", "/role-applications/ap2"],
      ["open:op1", "/open-proposals/op1"],
      ["structure:d1", "/governance/decisions/drafts/d1"],
      ["task:7", "/profile"],
      ["tension:t1", "/profile"],
    ]);
    const words = JSON.stringify(items);
    for (const name of ["Ana", "Ben", "Cy"]) expect(words).not.toContain(name);
    expect(items.filter((i) => i.touchesPerson).map((i) => i.source)).toEqual(["application", "consent", "open"]);
  });

  it("ballots: only a running vote this person may cast and has not", () => {
    const items = fromBallots([
      { id: "b1", subjectType: "power_return", title: "Give back the dial power", status: "running", myWeight: 1, myVote: null, opensAt: "2026-11-20T00:00:00.000Z" },
      { id: "b2", subjectType: "mechanics", title: "Already voted", status: "running", myWeight: 1, myVote: "yes" },
      { id: "b3", subjectType: "mechanics", title: "Not mine to vote", status: "running", myWeight: null, myVote: null },
      { id: "b4", subjectType: "mechanics", title: "Closed", status: "carried", myWeight: 1, myVote: null },
    ]);
    expect(items.map((i) => [i.key, i.kind, i.decideAt])).toEqual([["vote:b1", "power_return", "/decisions/b1"]]);
  });

  it("moon recaps: only those still waiting on a stage, named by role and never by amount", () => {
    const items = fromMoonQueue({ rows: [
      { recapId: "m1", name: "Ana", waitingOn: "work", roles: [{ roleId: "r1", name: "Water Steward", itemCount: 3 }], invoice: { total: 900 } },
      { recapId: "m2", name: "Ben", waitingOn: null, roles: [] },
    ] });
    expect(items.map((i) => [i.key, i.summary])).toEqual([["recap:m1", "A moon recap for Water Steward"]]);
    expect(JSON.stringify(items)).not.toContain("900");
  });

  it("change requests: those open for review or a vote, the reader's own left out", () => {
    expect(keys(fromChangeRequests({ open: [{ id: "c1", title: "Shorter quiet hours", state: "review" }, { id: "c2", title: "Mine", yours: true }] }))).toEqual(["change:c1"]);
  });

  it("suggested edits, raised hands, handoffs: only what is open and this reader's to act on", () => {
    expect(keys(fromSuggestions({ suggestions: [{ id: "s1", controlLabel: "Quiet hours", status: "open" }, { id: "s2", controlLabel: "Done", status: "accepted" }] }))).toEqual(["suggestion:s1"]);
    expect(keys(fromHands({ hands: [{ id: "h1", powerLabel: "Turn the dials", youMayPut: true }, { id: "h2", powerLabel: "Not mine", youMayPut: false }] }))).toEqual(["hand:h1"]);
    expect(keys(fromHandoffs({ waiting: [{ id: "w1", title: "Water the beds", sentOn: "2026-11-23" }] }))).toEqual(["handoff:w1"]);
  });

  it("the money desks: cash owed, postings owed, pending mint requests, cycles to settle, by title and never by amount", () => {
    const items = [
      ...fromCashOwed({ unpaid: [{ id: "co1", workTitle: "Fence repair", amountMinor: 50000, currency: "CRC", owedAt: "2026-11-20" }], paid: [{ id: "co2" }] }),
      ...fromOwedPostings([{ key: "k1", claimId: "c1", questTitle: "Mend the fence", units: 30, createdAt: "2026-11-21" }]),
      ...fromMintRequests({ requests: [{ id: "mr1", reason: "Founders' seed", amount: 1000, status: "pending" }, { id: "mr2", status: "approved" }] }),
      ...fromCycles({ due: [{ id: "cy1", label: "Moon of November" }], pool: { size: 100 } }),
    ];
    expect(keys(items)).toEqual(["cash:co1", "owed:k1", "mint:mr1", "cycle:cy1"]);
    const words = JSON.stringify(items);
    for (const amount of ["50000", "1000", "\"units\""]) expect(words).not.toContain(amount);
  });

  it("the admin desks: co-signs, letters (by subject), the assistant's drafts, unread feedback, the intake's open proposals", () => {
    expect(keys(fromPlanting({ waiting: [{ id: "p1", title: "Payments key", requestedAt: Date.parse("2026-11-20T00:00:00Z") }] }))).toEqual(["cosign:p1"]);
    const letters = fromLetters({ letters: [{ id: "l1", kind: "welcome", subject: "Your application", body: "Dear Ana", applicationRef: "ap1", to: { email: "ana@example.test", name: "Ana" } }] });
    expect(keys(letters)).toEqual(["letter:l1"]);
    expect(JSON.stringify(letters)).not.toMatch(/Ana|example\.test/);
    expect(letters[0].touchesPerson).toBe(true);
    expect(keys(fromAssistantDrafts({ drafts: [{ id: "ad1", kind: "role", rationale: "A role the meetings keep naming", proposedAt: "2026-11-18" }] }))).toEqual(["assistant:ad1"]);
    expect(keys(fromFeedback({ items: [{ id: 3, title: "The map is slow", status: "new" }, { id: 4, title: "Read", status: "seen" }] }))).toEqual(["feedback:3"]);
    const desk = fromOpenProposalDesk({ proposals: [{ id: "op1", roles: ["Builder"], name: "Cy", email: "cy@example.test", stage: { key: "consent" } }] });
    expect(keys(desk)).toEqual(["open:op1"]);
    expect(JSON.stringify(desk)).not.toMatch(/Cy|example\.test/);
  });

  it("vouches: only when this reader may vouch, and never their own place; erasures: one line with the count", () => {
    expect(keys(fromVouches({ mayVouch: true, pins: [{ id: "pin1", title: "Old spring", mine: false }, { id: "pin2", mine: true }] }))).toEqual(["vouch:pin1"]);
    expect(fromVouches({ mayVouch: false, pins: [{ id: "pin1", mine: false }] })).toEqual([]);
    expect(fromErasure({ local: { count: 2, oldestSince: "2026-11-01" } }).map((i) => i.summary)).toEqual(["2 erasures wait to be retried"]);
    expect(fromErasure({ local: { count: 0 } })).toEqual([]);
  });
});

describe("every Open door leads somewhere", () => {
  it("each door a reader writes is a route the app draws, and a door a queue hands back is kept only inside the app", async () => {
    const { readFileSync } = await import("node:fs");
    const app = readFileSync("client/src/App.tsx", "utf8");
    const routes = [...app.matchAll(/<Route path="([^"]+)"/g)].map((m) => new RegExp(`^${m[1].replace(/:[A-Za-z]+/g, "[^/]+")}$`));
    const src = readFileSync("shared/reviewInbox.ts", "utf8");
    const doors = [...src.matchAll(/decideAt: (?:inApp\([^)]*\) \?\? )?[`"]([^`"]+)[`"]/g)].map((m) => m[1].replace(/\$\{[^}]*\}/g, "x"));
    expect(doors.length).toBeGreaterThan(20);
    for (const d of doors) expect(routes.some((r) => r.test(d.split(/[?#]/)[0])), d).toBe(true);
    const handed = fromWaitingOnMe({ applications: [
      { id: "a", href: "https://elsewhere.test/x" }, { id: "b", href: "//elsewhere.test" }, { id: "c", href: "/role-applications/c" },
    ] });
    expect(handed.map((i) => i.decideAt)).toEqual(["/role-applications/a", "/role-applications/b", "/role-applications/c"]);
  });
});

describe("find by code takes every shape a code is written in", () => {
  const base = { source: "connector" as const, kind: "page_content", summary: "x", filedAt: null, decideAt: "/admin/proposals", touchesPerson: false };
  const items = [
    { ...base, key: "connector:pc_long_change_id_1", code: "B-71.1", batch: { key: "batch:pcb_long_batch_id", code: "B-71", title: null } },
    { ...base, key: "connector:pc_long_change_id_2", code: "B-71.2", batch: { key: "batch:pcb_long_batch_id", code: "B-71", title: null } },
    { ...base, key: "connector:pc_other", code: "B-710.1", batch: { key: "batch:pcb_other", code: "B-710", title: null } },
    { ...base, source: "agent" as const, key: "agent:seating:ap_seating_123456", code: null, batch: null },
    { ...base, source: "vote" as const, key: "vote:ballot_abcdef99", code: null, batch: null },
    { ...base, source: "feedback" as const, key: "feedback:3", code: null, batch: null },
  ] as unknown as InboxItem[];
  const found = (q: string) => findInInbox(items, q).map((i) => i.key.split(":").pop());

  it("a batch code in any case or spacing brings every change in it, and only it", () => {
    for (const q of ["B-71", "b-71", "B71", "b 71", " B-071 "]) expect(found(q), q).toEqual(["pc_long_change_id_1", "pc_long_change_id_2"]);
  });
  it("a change code brings that one change", () => {
    for (const q of ["B-71.2", "b71.2", "B-71 . 2"]) expect(found(q), q).toEqual(["pc_long_change_id_2"]);
    expect(found("B-71.9")).toEqual([]);
  });
  it("a long id, whole or from its first six characters, finds any queue's item, including one whose key names its kind", () => {
    expect(found("ap_seating_123456")).toEqual(["ap_seating_123456"]);
    expect(found("ap_sea")).toEqual(["ap_seating_123456"]);
    expect(found("BALLOT_abc")).toEqual(["ballot_abcdef99"]);
    expect(found("pcb_long")).toEqual(["pc_long_change_id_1", "pc_long_change_id_2"]);
    expect(found("3")).toEqual(["3"]);
  });
  it("a short fragment of an id finds nothing, so a guess cannot sweep the list", () => {
    expect(found("ap_")).toEqual([]);
    expect(found("ballo")).toEqual([]);
    expect(searchedCode("b 71")).toBe("B-71");
    expect(searchedCode("ballot")).toBeNull();
  });
});

describe("the routes the inbox reads are the queues' own", () => {
  it("names the three queues whose path lives in a constant by that constant's value, so a moved route fails here", async () => {
    const { WAITING_URL } = await import("./waitingOnYou");
    const { MOON_ROUTES } = await import("./moonRecap");
    const { HANDOFFS_WAITING_URL } = await import("./roleTaskHandoff");
    const paths = INBOX_READS.map((r) => r.path);
    for (const p of [WAITING_URL, MOON_ROUTES.queue, HANDOFFS_WAITING_URL]) expect(paths).toContain(p);
  });
});

describe("org chart drafts (lane 4c: the lead could not find where to publish)", () => {
  it("lists every open draft from the admin's own read, by title, with a door to the draft's own page", async () => {
    const { fromOrgDrafts } = await import("./reviewInbox");
    const items = fromOrgDrafts([
      { id: "d1", status: "open", title: "Add a Seed Keeper role", changes: [{ id: "c1" }] },
      { id: "d2", status: "open", title: "", changes: [{ id: "c2" }, { id: "c3" }] },
      { id: "d3", status: "published", title: "Done" },
    ]);
    expect(items.map((i) => [i.key, i.source, i.summary, i.decideAt])).toEqual([
      ["structure:d1", "structure", "Add a Seed Keeper role", "/governance/decisions/drafts/d1"],
      ["structure:d2", "structure", "An org chart draft with 2 changes", "/governance/decisions/drafts/d2"],
    ]);
  });
});
