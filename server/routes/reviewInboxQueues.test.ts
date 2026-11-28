/**
 * THE QUEUES THAT SAT ON PAGES OF THEIR OWN, on the deciders' one list, over real HTTP (the running garden, 27 Nov
 * 2026): reports on forum threads and messages, reports on photographs of places, departures, invitation requests.
 *
 * Each is read as its OWN route answers the person, behind its own gate, exactly as the first queues are
 * (server/routes/reviewInbox.test.ts holds that rule for them). So this stands up a fake of the five routes that
 * answers each person as the real gates would, and checks that a person is shown what their own reads returned and
 * nothing a gate refused them, and that no row carries a name or what was said.
 * No database: the queues are the fake's.
 */
import http from "node:http";
import express from "express";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { register } from "./reviewInbox";

type Answer = { status: number; body: unknown };
const REFUSED: Answer = { status: 401, body: { error: "auth_required" } };

const FORUM = [{ id: "17", threadTitle: "Who left the gate open", severity: "soft", reason: "It names a neighbour", status: "open", reporter: "Rhea Reporter", at: "2026-11-20T10:00:00.000Z" }];
const MESSAGES = [{ id: 4, conversationName: "Ana and Ben", body: "The private words of a message", reporter: "Ana Member", reason: "Unkind", status: "open", at: "2026-11-21T08:00:00.000Z" }];
const PLACES = { status: "open", reports: [{ id: "pr1", photoId: "ph1", kind: "wrong-place", reason: "This is the old barn", status: "open", reporter: "Cy Member", at: "2026-11-19T09:00:00.000Z" }] };
const EXITS = { policy: {}, exits: [
  { id: "e1", userId: "u1", userName: "Dana Leaving", kind: "voluntary", status: "open", openedAt: "2026-11-18T00:00:00.000Z" },
  { id: "e3", userId: "u3", userName: "Fay Gone", kind: "voluntary", status: "resolved", openedAt: "2026-10-01T00:00:00.000Z" },
] };
const INVITES = { requests: [{ visitorId: "v1", name: "Hana Visitor", email: "hana@example.org", note: "I would love to join", requestedAt: "2026-11-23T12:00:00.000Z" }] };

/** What each queue answers each person, as the real gates would. */
const ANSWERS: Record<string, Record<string, Answer>> = {
  // An admin: every admin desk answers. The photographs are a village-held key the admin does not hold.
  admin: {
    "/api/admin/forum/reports": { status: 200, body: FORUM },
    "/api/admin/messages/reports": { status: 200, body: MESSAGES },
    "/api/places/reports": { status: 403, body: { error: "Reading this queue needs the capability to curate the village's photographs" } },
    "/api/admin/exits": { status: 200, body: EXITS },
    "/api/admin/visitors/invitations": { status: 200, body: INVITES },
  },
  // A curator who is not an admin: the photographs, and nothing from the admin desks.
  curator: {
    "/api/places/reports": { status: 200, body: PLACES },
  },
  // A greeter who moderates intake and is not an admin. The invitation read would answer them, and its rows are
  // decided on a tab of Admin they cannot open, so the list never shows them one. The forum's module is off here.
  greeter: {
    "/api/admin/visitors/invitations": { status: 200, body: INVITES },
    "/api/admin/forum/reports": { status: 404, body: { error: "module_off" } },
    "/api/admin/messages/reports": { status: 404, body: { error: "module_off" } },
    "/api/admin/exits": { status: 500, body: { error: "boom" } },
  },
};

describe("the queues that sat on pages of their own, read as each person behind each queue's own gate", () => {
  let queues: http.Server;
  let inbox: http.Server;
  let base = "";
  const asked: { who: string; path: string }[] = [];

  beforeAll(async () => {
    const fake = express();
    fake.use((req, res) => {
      const who = String(req.headers.authorization ?? "").replace("Bearer ", "");
      asked.push({ who, path: req.path });
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
      // The server's own admin gate. Only the admin can open Admin; the curator and the greeter cannot.
      isAdmin: async (req: any) => String(req.headers.authorization ?? "").replace("Bearer ", "") === "admin",
      clientIp: () => null,
      port: () => queuesPort,
      isMember: async () => true,
      blockedDrafts: async () => new Map(),
    } as any);
    inbox = http.createServer(app);
    await new Promise<void>((r) => inbox.listen(0, "127.0.0.1", r));
    base = `http://127.0.0.1:${(inbox.address() as { port: number }).port}`;
  });

  afterAll(async () => {
    await new Promise<void>((r) => inbox?.close(() => r()));
    await new Promise<void>((r) => queues?.close(() => r()));
  });

  const read = async (who: string) => {
    const res = await fetch(`${base}/api/admin/review/inbox`, { headers: { authorization: `Bearer ${who}` } }); // module-review-ok: a test calling its own local server
    return (await res.json()) as any;
  };
  const stateOf = (body: any, source: string) => body.sections.find((s: any) => s.source === source)?.state;

  it("an admin sees the reports, the departure and the invitation request, and nothing from the queue that refuses them", async () => {
    asked.length = 0;
    const body = await read("admin");
    expect(body.items.map((i: any) => i.key)).toEqual(["exit:e1", "report:forum:17", "report:message:4", "invite:v1"]);
    expect([stateOf(body, "report"), stateOf(body, "photo"), stateOf(body, "exit"), stateOf(body, "invite")]).toEqual(["ok", "refused", "ok", "ok"]);
    // Forum and message reports are one queue of two.
    expect(body.sections.find((s: any) => s.source === "report")).toMatchObject({ count: 2, more: false });
    // Each is one decision in the one count. The settled departure is not waiting.
    expect(body.counts).toEqual({ decisions: 4, applications: 0, blocked: 0, unknown: [], waiting: 4 });
    // Every one of the five routes was read as the admin, and as nobody else.
    const five = ["/api/admin/forum/reports", "/api/admin/messages/reports", "/api/places/reports", "/api/admin/exits", "/api/admin/visitors/invitations"];
    for (const path of five) expect(asked.filter((a) => a.path === path).map((a) => a.who), path).toEqual(["admin"]);
  });

  it("a curator who is not an admin sees the reported photograph and none of the admin desks", async () => {
    const body = await read("curator");
    expect(body.items.map((i: any) => i.key)).toEqual(["photo:pr1"]);
    expect([stateOf(body, "report"), stateOf(body, "photo"), stateOf(body, "exit"), stateOf(body, "invite")]).toEqual(["refused", "ok", "refused", "refused"]);
  });

  it("a module that is off is off, and a queue that failed is unknown, never empty", async () => {
    const body = await read("greeter");
    expect(body.items.map((i: any) => i.key)).toEqual([]);
    expect(stateOf(body, "report")).toBe("off");
    expect(body.sections.find((s: any) => s.source === "exit")).toMatchObject({ state: "failed", count: null });
    expect(body.counts).toMatchObject({ decisions: 0, unknown: ["exit"] });
  });

  // QA, 28 Nov 2026 (train 148, blocker B1): the invitation read is gated on `intake.moderate`, which is wider than
  // its only page, a tab of Admin. A moderator who is not an admin was listed three rows whose door showed them
  // nothing to press, and they were counted. On main that person sees neither the rows nor the count.
  it("a moderator of intake who is not an admin gets no invitation rows and no count, and an admin still does", async () => {
    asked.length = 0;
    const greeter = await read("greeter");
    expect(greeter.items.filter((i: any) => i.source === "invite")).toEqual([]);
    expect(stateOf(greeter, "invite")).toBe("refused");
    expect(greeter.sections.find((s: any) => s.source === "invite")).toMatchObject({ count: 0 });
    expect(greeter.counts.decisions).toBe(0);
    expect(greeter.counts.unknown).not.toContain("invite");
    // Nothing was read on their behalf from a queue whose page they cannot open.
    expect(asked.filter((a) => a.who === "greeter").map((a) => a.path)).not.toContain("/api/admin/visitors/invitations");
    // Finding by id reaches no invitation row either.
    const found = await fetch(`${base}/api/admin/review/find?q=v1`, { headers: { authorization: "Bearer greeter" } }); // module-review-ok: a test calling its own local server
    expect(JSON.stringify(await found.json())).not.toContain("invite:v1");

    const admin = await read("admin");
    expect(admin.items.map((i: any) => i.key)).toContain("invite:v1");
    expect(stateOf(admin, "invite")).toBe("ok");
    expect(admin.sections.find((s: any) => s.source === "invite")).toMatchObject({ count: 1 });
  });

  it("no row names a person or carries what was said, for anybody", async () => {
    for (const who of Object.keys(ANSWERS)) {
      const sent = JSON.stringify(await read(who));
      for (const secret of ["Rhea", "Ana", "Cy Member", "Dana", "Fay", "Hana", "example.org", "private words", "It names a neighbour", "Unkind", "old barn", "love to join"]) {
        expect(sent, `${who}: ${secret}`).not.toContain(secret);
      }
    }
  });
});
