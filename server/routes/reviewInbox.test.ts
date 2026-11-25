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
  },
  // A member who decides nothing.
  member: Object.fromEntries(
    ["/api/admin/proposals", "/api/review/queue", "/api/admin/quest-claims", "/api/approval-inbox", "/api/agent-proposals/waiting", "/api/saberra/differences"].map((p) => [p, REFUSED]),
  ),
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
      const a = ANSWERS[who]?.[req.path] ?? REFUSED;
      res.status(a.status).json(a.body);
    });
    queues = http.createServer(fake);
    await new Promise<void>((r) => queues.listen(0, "127.0.0.1", r));
    const queuesPort = (queues.address() as { port: number }).port;

    const app = express();
    register(app, {
      authedUser: async (req: any) => {
        const who = String(req.headers.authorization ?? "").replace("Bearer ", "");
        return ANSWERS[who] ? { id: who } : null;
      },
      overLimit: async () => false,
      clientIp: () => null,
      port: () => queuesPort,
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
    ]);
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
});
