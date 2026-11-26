/**
 * THE VISIBILITY RULE OF THE DECIDERS' READ, over real HTTP (docs/REVIEW_INBOX_PLAN.md, lane 3).
 *
 * The inbox must never show a person more than the queues' own pages show them. It holds that by reading each queue's
 * own route AS the person, so this suite stands up a fake of the six queue routes that answers differently for each
 * person, points the inbox's loopback at it, and checks, for every person:
 *   - every item the inbox lists is one that person's own reads returned, and none is missing
 *   - a queue that refuses them is absent, a module that is off is off, a queue that fails says failed
 *   - the loopback carried exactly their own authorization, never another's
 *   - a code that does not exist and a code they may not see answer the same
 * No database: the queues are the fake's.
 */
import http from "node:http";
import express from "express";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { register } from "./reviewInbox";

type Answer = { status: number; body: unknown };

const CONNECTOR_B71 = {
  batches: [{ id: "pcb_1", code: "B-71", title: "Phase A" }],
  changes: [{ id: "pc_1", code: "B-71.1", batchId: "pcb_1", batchCode: "B-71", kind: "page_content", summary: "Reword the headline.", at: "2026-11-20T10:00:00.000Z" }],
  decided: [],
};
const REFUSED: Answer = { status: 401, body: { error: "auth_required" } };

/** What each queue answers each person, as the real gates would. */
const ANSWERS: Record<string, Record<string, Answer>> = {
  // A steward who keeps the intake queue and witnesses finished work, and opens nothing else.
  steward: {
    "/api/admin/proposals": { status: 403, body: { error: "not_a_reader" } },
    "/api/review/queue": { status: 200, body: { batches: [{ batchId: "eb_1", items: [{ id: "ep_1", kind: "role.proposed", payload: { name: "Water Steward" }, receivedAt: "2026-11-19T00:00:00.000Z" }] }], quests: [] } },
    "/api/admin/quest-claims": { status: 200, body: [{ id: "c1", status: "submitted", questTitle: "Mend the fence", submittedAt: "2026-11-21T00:00:00.000Z" }] },
    "/api/approval-inbox": REFUSED,
    "/api/agent-proposals/waiting": REFUSED,
    "/api/saberra/differences": { status: 404, body: { error: "module_off" } },
  },
  // A storyteller who reads the connector's batches and the approvals, where an agent's seating also waits.
  teller: {
    "/api/admin/proposals": { status: 200, body: CONNECTOR_B71 },
    "/api/review/queue": REFUSED,
    "/api/admin/quest-claims": { status: 403, body: { error: "for stewards" } },
    "/api/approval-inbox": { status: 200, body: { waiting: [{ id: "ap_9", kind: "seating", title: "Seat a member in Water", at: "2026-11-20T00:00:00.000Z" }] } },
    "/api/agent-proposals/waiting": { status: 200, body: { roleChanges: [], seatings: [{ id: "ap_9", title: "Seat a member in Water", createdAt: "2026-11-20T00:00:00.000Z" }] } },
    "/api/saberra/differences": { status: 500, body: { error: "Could not read the differences." } },
    // A draft a proposal made is on both reads: listed once, with the structure review's door waiting-on-me gives it.
    "/api/governance/waiting-on-me": { status: 200, body: { drafts: [{ id: "dr_1", title: "Add a Seed Keeper role", circles: 0, seats: 1, href: "/review/structure/b_1" }] } },
    "/api/admin/org/drafts": { status: 200, body: [{ id: "dr_1", status: "open", title: "Add a Seed Keeper role", changes: [{ id: "c1" }] }, { id: "dr_2", status: "open", title: "Rest the old council", changes: [{ id: "c2" }] }] },
  },
  // A member who decides nothing.
  member: Object.fromEntries(
    ["/api/admin/proposals", "/api/review/queue", "/api/admin/quest-claims", "/api/approval-inbox", "/api/agent-proposals/waiting", "/api/saberra/differences"].map((p) => [p, REFUSED]),
  ),
};

/** What the community face reads, as each person (lane 6). */
const COMMUNITY: Record<string, Record<string, Answer>> = {
  // A member who takes part in the village.
  neighbour: {
    "/api/governance/ballots": { status: 200, body: [
      { id: "b1", subjectType: "power_return", title: "Give the dial power back", status: "running", myWeight: 1, myVote: null, tally: { yes: 4 }, closesAt: "2026-11-30T12:00:00.000Z" },
      { id: "b2", subjectType: "role_application", title: "Seat Ana Applicant", status: "running", myWeight: 1, myVote: null },
    ] },
    "/api/change-requests": { status: 200, body: { open: [{ id: "c1", title: "Shorter quiet hours", state: "voting", author: "Cy Author" }], mine: [{ id: "c2", title: "My own request", state: "in_review", author: "Me" }] } },
    "/api/powers/hands": { status: 200, body: { hands: [{ id: "h1", powerLabel: "Turn the dials", userId: "ben", userName: "Ben Raiser", note: "Ben's note", status: "open", youMayPut: true }] } },
    "/api/governance/waiting-on-me": { status: 500, body: { error: "boom" } },
    "/api/game/progression": { status: 200, body: { stage: "member", capabilityCatalogue: [
      { key: "ballot.vote", label: "Cast a vote", held: true, opens: { via: "stage", stage: "member" }, holderNames: ["Ana Applicant"] },
      { key: "mechanics.propose", held: true, opens: { via: "stage", stage: "member" } },
      { key: "proposal.open", held: false, opens: { via: "stage", stage: "co-creator" } },
      { key: "cash.pay", held: true, opens: { via: "appointment" } },
    ], history: [{ reason: "Ben's note" }] } },
  },
  // Signed in, but a visitor: the community face is for members.
  visitor: {},
};

describe("the deciders' read shows each person exactly what their own queues show them", () => {
  let queues: http.Server;
  let inbox: http.Server;
  let base = "";
  const seenAuth: string[] = [];

  beforeAll(async () => {
    const fake = express();
    fake.use((req, res) => {
      const who = String(req.headers.authorization ?? "").replace("Bearer ", "");
      seenAuth.push(who);
      const a = ANSWERS[who]?.[req.path] ?? COMMUNITY[who]?.[req.path] ?? REFUSED;
      res.status(a.status).json(a.body);
    });
    queues = http.createServer(fake);
    await new Promise<void>((r) => queues.listen(0, "127.0.0.1", r));
    const queuesPort = (queues.address() as { port: number }).port;

    const app = express();
    register(app, {
      authedUser: async (req: any) => {
        const who = String(req.headers.authorization ?? "").replace("Bearer ", "");
        return ANSWERS[who] || COMMUNITY[who] ? { id: who } : null;
      },
      overLimit: async () => false,
      clientIp: () => null,
      port: () => queuesPort,
      isMember: async (u: { id: string }) => u.id !== "visitor",
    } as any);
    inbox = http.createServer(app);
    await new Promise<void>((r) => inbox.listen(0, "127.0.0.1", r));
    base = `http://127.0.0.1:${(inbox.address() as { port: number }).port}`;
  });

  afterAll(async () => {
    await new Promise<void>((r) => inbox?.close(() => r()));
    await new Promise<void>((r) => queues?.close(() => r()));
  });

  const get = async (path: string, who: string | null) => {
    const res = await fetch(`${base}${path}`, { headers: who ? { authorization: `Bearer ${who}` } : {} }); // module-review-ok: a test calling its own local server
    return { status: res.status, body: (await res.json()) as any };
  };

  it("a steward sees the intake and the finished work, nothing from the queues that refuse them, and Sera as off", async () => {
    seenAuth.length = 0;
    const r = await get("/api/admin/review/inbox", "steward");
    expect(r.status).toBe(200);
    expect(r.body.items.map((i: any) => i.key)).toEqual(["intake:ep_1", "claim:c1"]);
    expect(Object.fromEntries(r.body.sections.map((s: any) => [s.source, s.state]))).toMatchObject({
      connector: "refused", intake: "ok", quest: "ok", claim: "ok", approval: "refused", agent: "refused", sera: "off",
      // A queue the fake does not answer for this person refuses, as the real gate would.
      vote: "refused", recap: "refused", application: "refused",
    });
    // Every queue was read as the steward, and as nobody else.
    expect(new Set(seenAuth)).toEqual(new Set(["steward"]));
  });

  it("a storyteller sees B-71 and the agent's seating once, and Sera as failed, never as empty", async () => {
    const r = await get("/api/admin/review/inbox", "teller");
    expect(r.body.items.map((i: any) => [i.key, i.code])).toEqual([
      ["agent:seating:ap_9", null],
      ["connector:pc_1", "B-71.1"],
      ["structure:dr_1", null],
      ["structure:dr_2", null],
    ]);
    // A draft made in the admin panel is listed too, and the one both reads carry keeps the structure review's door.
    expect(r.body.items.filter((i: any) => i.source === "structure").map((i: any) => i.decideAt)).toEqual(["/review/structure/b_1", "/admin?tab=org-chart"]);
    const states = Object.fromEntries(r.body.sections.map((s: any) => [s.source, s.state]));
    expect(states.sera).toBe("failed");
    expect(states.approval).toBe("ok");
  });

  it("a member who decides nothing gets an empty list with every section refused, and a stranger is refused", async () => {
    const r = await get("/api/admin/review/inbox", "member");
    expect(r.body.items).toEqual([]);
    expect(r.body.sections.every((s: any) => s.state === "refused")).toBe(true);
    expect((await get("/api/admin/review/inbox", null)).status).toBe(401);
  });

  it("never lists an item a person's own reads did not return to them", async () => {
    for (const who of Object.keys(ANSWERS)) {
      const r = await get("/api/admin/review/inbox", who);
      const theirs = JSON.stringify(ANSWERS[who]);
      for (const item of r.body.items) expect(theirs, `${who}: ${item.key}`).toContain(item.key.split(":").pop());
    }
  });

  it("finds B-71 for the one who may see it, and answers a code they may not see exactly as one that does not exist", async () => {
    const found = await get("/api/admin/review/find?q=B-71", "teller");
    expect(found.status).toBe(200);
    expect(found.body.items.map((i: any) => i.code)).toEqual(["B-71.1"]);
    const hidden = await get("/api/admin/review/find?q=B-71", "steward");
    const missing = await get("/api/admin/review/find?q=B-999", "steward");
    expect(hidden.status).toBe(404);
    expect(missing.status).toBe(404);
    expect(Object.keys(hidden.body).sort()).toEqual(Object.keys(missing.body).sort());
    expect(hidden.body.error).toBe(missing.body.error);
  });

  it("THE COMMUNITY FACE (lane 6): members only, read as the member, and nothing outside the allowlist reaches them", async () => {
    expect((await get("/api/review/community", null)).status).toBe(401);
    seenAuth.length = 0;
    expect((await get("/api/review/community", "visitor")).status).toBe(403);
    expect(seenAuth, "a visitor is refused before any queue is read").toEqual([]);

    const r = await get("/api/review/community", "neighbour");
    expect(r.status).toBe(200);
    expect(Object.keys(r.body).sort()).toEqual(["open", "reads", "waiting", "yours"]);
    expect(r.body.open.map((i: any) => [i.kind, i.id])).toEqual([["vote", "b1"], ["change", "c1"], ["hand", "h1"]]);
    expect(r.body.yours.map((i: any) => [i.kind, i.id])).toEqual([["change", "c2"]]);
    // A read that failed says so, and is never shown as nothing waiting.
    expect(r.body.reads.find((x: any) => x.name === "waiting").state).toBe("failed");
    for (const i of [...r.body.open, ...r.body.yours, ...r.body.waiting]) expect(Object.keys(i).sort()).toEqual(["closesAt", "href", "id", "kind", "state", "title"]);
    const text = JSON.stringify(r.body);
    for (const leak of ["Ana Applicant", "Ben Raiser", "Ben's note", "Cy Author", "tally", "myWeight", "boom"]) expect(text, leak).not.toContain(leak);
  });

  it("THE GOVERNANCE PAGE'S NOW (step 2): members only, read as the member, and only the allowlisted voice and items", async () => {
    expect((await get("/api/governance/now", null)).status).toBe(401);
    seenAuth.length = 0;
    expect((await get("/api/governance/now", "visitor")).status).toBe(403);
    expect(seenAuth, "a visitor is refused before any read is made").toEqual([]);

    const r = await get("/api/governance/now", "neighbour");
    expect(r.status).toBe(200);
    expect(Object.keys(r.body).sort()).toEqual(["closingSoon", "reads", "voice", "waiting", "yours"]);
    expect(r.body.waiting.map((i: any) => [i.kind, i.id])).toEqual([["vote", "b1"], ["change", "c1"], ["hand", "h1"]]);
    expect(r.body.voice).toEqual({
      mode: "equal",
      weighedBy: null,
      rights: [
        { right: "ballot.vote", held: true, opensAt: null },
        { right: "mechanics.propose", held: true, opensAt: null },
        { right: "proposal.open", held: false, opensAt: "co-creator" },
      ],
    });
    for (const i of [...r.body.waiting, ...r.body.yours, ...r.body.closingSoon]) expect(Object.keys(i).sort()).toEqual(["closesAt", "href", "id", "kind", "state", "title"]);
    const text = JSON.stringify(r.body);
    for (const leak of ["Ana Applicant", "Ben Raiser", "Ben's note", "Cy Author", "tally", "myWeight", "boom", "cash.pay", "history", "Cast a vote"]) expect(text, leak).not.toContain(leak);
  });
});
