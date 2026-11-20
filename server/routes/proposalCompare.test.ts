/**
 * The Compare door (the lead, 20 Nov 2026): who may read it, what it lists, and what it leaves out. No database: the
 * reads are handed in, so every case is about the door and the listing, and a gate that says no reads nothing.
 */
import http from "node:http";
import express from "express";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { hasCapability, type Capability } from "../../shared/capabilities";
import type { ComparePayload } from "../../shared/proposalCompare";
import type { CompareSources } from "../lib/proposalCompare";
import { COMPARE_PATH, registerProposalCompare } from "./proposalCompare";

const ROLES = [
  { id: "r-garden", name: "Garden steward", circleId: "c-land", accountabilities: ["Keep the seed bank catalogued", "Run the weekly garden circle"], seats: 1, commitmentTarget: 100 },
  { id: "r-water", name: "Water keeper", circleId: "c-land", accountabilities: ["Read the springs each week"], seats: 2, commitmentTarget: null },
  { id: "r-cook", name: "Cook", circleId: "c-kitchen", accountabilities: [], seats: 1 },
];
const CIRCLES = [
  { id: "c-land", name: "Land" },
  { id: "c-kitchen", name: "Kitchen" },
];

const open = (id: string, extra: Record<string, unknown>) => ({
  id,
  name: `Person ${id}`,
  email: `${id}@example.test`,
  status: "confirmed",
  createdAt: new Date("2026-11-10T10:00:00Z"),
  confirmedAt: new Date("2026-11-10T11:00:00Z"),
  body: { roles: [{ roleId: "r-garden", note: "" }], why: "why", aim: "an aim", ...extra },
});

const SOURCES: CompareSources = {
  openProposals: async () =>
    [
      open("op-a", {
        roles: [{ roleId: "r-garden", note: "" }, { roleId: "r-water", note: "", commitmentPct: 30 }],
        card: {
          roles: [{ roleId: "r-garden", moves: [{ text: "Keep the seed bank catalogued", target: "Every seed labelled" }], firstMoon: [{ quest: "Build a compost system", doneWhen: "It is turning" }] }],
          serves: [],
          hours: "",
          commitmentPct: 50,
          agreed: { loveLetter: false, nda: true },
          earliestStart: "2026-12-01",
          terms: { choice: "talk", note: "About the rhythm", answers: { rhythm: { choice: "talk", note: "" } } },
        },
        payAsk: { kind: "amount", monthly: 2000, per: "month" },
        email: "never@example.test",
      }),
      { ...open("op-b", { kind: "conversation" }), confirmedAt: new Date("2026-11-12T09:00:00Z") },
      { ...open("op-c", { roles: [{ roleId: "r-garden", note: "", early: true }] }), confirmedAt: new Date("2026-11-11T09:00:00Z") },
      { ...open("op-old", {}), status: "adopted" },
      { ...open("op-0123456789abcdef0123", {}), name: "Lina Brook", email: "lina@example.test", status: "adopted", held: [{ roleId: "r-garden", holds: ["Map every spring"], with: ["op:op-a:r-garden"], by: "u-ivo", at: "2026-11-19T10:00:00.000Z" }] },
    ] as any,
  applications: async () =>
    [
      { id: "sa-1", candidateUserId: "u-ivo", seatIds: ["r-cook"], status: "awaiting-holder", answers: { terms: { choice: "accept", note: "", commitmentPct: 40 }, goals: [{ title: "Cook for the circle", doneWhen: "", moves: "", serves: "", date: "", roleId: "" }], windows: [] }, deliverables: null, createdAt: new Date("2026-11-09T00:00:00Z"), startsAt: null, termEndsAt: new Date("2027-01-01T00:00:00Z") },
      { id: "sa-2", candidateUserId: "u-ana", seatIds: ["r-cook"], status: "adopted", answers: null, deliverables: null, createdAt: new Date("2026-11-08T00:00:00Z"), startsAt: null, termEndsAt: new Date("2027-01-01T00:00:00Z") },
    ] as any,
  questProposals: async () =>
    [
      { id: "qp-1", status: "proposed", proposedBy: null, proposedByKind: "human", receivedAt: "2026-11-13T00:00:00Z", prose: { title: "Mulch the beds", circle: "Land", deliverable: "Every bed mulched", steps: ["Gather leaves"] } },
      { id: "qp-2", status: "rejected", proposedBy: null, proposedByKind: "agent", receivedAt: "2026-11-13T00:00:00Z", prose: { title: "Old idea" } },
    ] as any,
  roles: async () => ROLES as any,
  circles: async () => CIRCLES,
  taken: async () => new Map([["r-garden", 1]]),
  nameOf: async (id) => ({ "u-ivo": "Ivo Lantern", "u-ana": "Ana Quill" })[id] ?? null,
};

function harness() {
  const state = { caps: [] as Capability[], isAdmin: false, readsPay: false, reads: 0, viewer: "u-hal" as string | null, gate: "both" as "both" | "guard-only" };
  const stamped: Array<{ kind: "op" | "sa"; id: string; held: any[] }> = [];
  const audits: string[] = [];
  const ctx = () => ({ isAdmin: state.isAdmin, stage: "member", ladder: ["member"], roleCapabilities: state.caps }) as any;
  let server: http.Server | null = null;
  let base = "";
  const counted = Object.fromEntries(
    Object.entries(SOURCES).map(([k, fn]) => [k, async (...a: any[]) => {
      state.reads++;
      return (fn as any)(...a);
    }]),
  ) as unknown as CompareSources;
  const start = async () => {
    const app = express();
    app.use(express.json());
    registerProposalCompare(app, {
      guardCapability: async (_req: any, res: any, cap: Capability) => {
        const ok = hasCapability(cap, ctx());
        if (!ok) res.status(401).json({ error: "auth_required" });
        return ok;
      },
      ...(state.gate === "both" ? { mayStillSee: async (_req: any, cap: Capability) => hasCapability(cap, ctx()) } : {}),
      authedUser: async () => (state.viewer ? { id: state.viewer, email: `${state.viewer}@example.test` } : null),
      compareStore: {
        openProposal: async (id: string) => ((await SOURCES.openProposals()) as any[]).find((p) => p.id === id) ?? null,
        application: async (id: string) => ((await SOURCES.applications()) as any[]).find((a) => a.id === id) ?? null,
        stampOpen: async (id: string, held: any[]) => (stamped.push({ kind: "op", id, held }), true),
        stampApplication: async (id: string, held: any[]) => (stamped.push({ kind: "sa", id, held }), true),
        audit: async (text: string) => {
          audits.push(text);
        },
      },
      now: () => new Date("2026-11-20T12:00:00Z"),
      getPool: () => {
        throw new Error("the database was read");
      },
      members: {} as any,
      mayReadPay: async () => state.readsPay,
      compareSources: counted,
    } as any);
    server = http.createServer(app);
    await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", resolve));
    const addr = server.address();
    if (!addr || typeof addr === "string") throw new Error("no port");
    base = `http://127.0.0.1:${addr.port}`;
  };
  const stop = () => new Promise<void>((resolve) => server?.close(() => resolve()));
  const call = async (path = "", method = "GET", body?: unknown) => {
    const res = await fetch(`${base}${COMPARE_PATH}${path}`, { method, headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) }); // module-review-ok: this suite's own loopback server, not an outbound call
    return { status: res.status, body: (await res.json().catch(() => ({}))) as ComparePayload & { error?: string } & Record<string, any> };
  };
  return { state, start, stop, call, stamped, audits };
}

describe("who may compare", () => {
  const h = harness();
  beforeAll(h.start);
  afterAll(h.stop);
  beforeEach(() => Object.assign(h.state, { caps: [], isAdmin: false, readsPay: false, reads: 0, viewer: "u-hal" }));

  it("refuses a member without the desk's key, and reads nothing", async () => {
    const r = await h.call();
    expect(r.status).toBe(401);
    expect(h.state.reads).toBe(0);
  });

  it("CONTROL: a holder of intake.moderate reads the list", async () => {
    h.state.caps = ["intake.moderate"];
    const r = await h.call();
    expect(r.status).toBe(200);
    expect(r.body.items.length).toBeGreaterThan(0);
  });

  it("a key for something else does not open it", async () => {
    h.state.caps = ["quest.consent" as Capability, "terms.read"];
    expect((await h.call()).status).toBe(401);
  });

  it("an admin reads it", async () => {
    h.state.isAdmin = true;
    expect((await h.call()).status).toBe(200);
  });
});

describe("what it lists", () => {
  const h = harness();
  beforeAll(async () => {
    await h.start();
  });
  afterAll(h.stop);
  beforeEach(() => Object.assign(h.state, { caps: ["intake.moderate"], isAdmin: false, readsPay: false, reads: 0, viewer: "u-hal" }));

  it("lists every proposal waiting, one entry per role, in the order each arrived", async () => {
    const { body } = await h.call();
    expect(body.items.map((i) => i.key)).toEqual(["sa:sa-1:r-cook", "op:op-a:r-garden", "op:op-a:r-water", "op:op-c:r-garden", "op:op-b:r-garden", "qp:qp-1"]);
  });

  it("marks early applications, conversations, member applications and quest ideas", async () => {
    const { body } = await h.call();
    const way = Object.fromEntries(body.items.map((i) => [i.key, i.way]));
    expect(way).toMatchObject({ "op:op-a:r-garden": "full", "op:op-c:r-garden": "early", "op:op-b:r-garden": "conversation", "sa:sa-1:r-cook": "member", "qp:qp-1": "quest" });
  });

  it("files each under the data's own category: the role's circle, the quest's circle", async () => {
    const { body } = await h.call();
    expect(body.categories).toEqual([
      { key: "circle:c-kitchen", label: "Kitchen", count: 1 },
      { key: "circle:c-land", label: "Land", count: 4 },
      { key: "quest:land", label: "Land", count: 1 },
    ]);
  });

  it("carries the commitment, the deliverables, the terms, the dates and the link for each role", async () => {
    const { body } = await h.call();
    const a = body.items.find((i) => i.key === "op:op-a:r-garden")!;
    expect(a.commitmentPct).toBe(50);
    expect(a.deliverables).toEqual([
      { text: "Keep the seed bank catalogued", doneWhen: "Every seed labelled", from: "outcome" },
      { text: "Build a compost system", doneWhen: "It is turning", from: "value" },
    ]);
    expect(a.terms).toMatchObject({ choice: "talk", note: "About the rhythm", talkAbout: ["Rhythm"], ask: null });
    expect(a.dates).toMatchObject({ earliestStart: "2026-12-01", received: "2026-11-10" });
    expect(a.href).toBe("/open-proposals/op-a");
    expect(body.items.find((i) => i.key === "op:op-a:r-water")!.commitmentPct).toBe(30);
    const member = body.items.find((i) => i.key === "sa:sa-1:r-cook")!;
    expect(member).toMatchObject({ who: "Ivo Lantern", commitmentPct: 40, href: "/role-applications/sa-1" });
    expect(body.roles.find((r) => r.id === "r-garden")).toMatchObject({ outcomes: ["Keep the seed bank catalogued", "Run the weekly garden circle"], commitmentTarget: 100, places: 1, taken: 1 });
    expect(body.roles.find((r) => r.id === "r-water")!.commitmentTarget).toBe(100);
  });

  it("never sends an email address, and sends a price ask only to a reader who may read pay", async () => {
    const without = await h.call();
    expect(JSON.stringify(without.body)).not.toMatch(/@example\.test/);
    expect(without.body.readsPay).toBe(false);
    h.state.readsPay = true;
    const withPay = await h.call();
    expect(withPay.body.items.find((i) => i.key === "op:op-a:r-garden")!.terms!.ask).toEqual({ kind: "amount", amount: 2000, per: "month" });
  });
});

describe("each key sees its own part (the lead, 20 Nov 2026)", () => {
  const h = harness();
  beforeAll(h.start);
  afterAll(h.stop);
  beforeEach(() => Object.assign(h.state, { caps: [], isAdmin: false, readsPay: true, reads: 0, viewer: "u-hal" }));

  it("quest.approve alone sees the quest part only: quest proposals and the quest category, no role, no pay, no saved split", async () => {
    h.state.caps = ["quest.approve"];
    const r = await h.call();
    expect(r.status).toBe(200);
    expect(r.body.scope).toBe("quests");
    expect(r.body.items.map((i) => i.key)).toEqual(["qp:qp-1"]);
    expect(r.body.items.every((i) => i.kind === "quest")).toBe(true);
    expect(r.body.categories.map((c) => c.key)).toEqual(["quest:land"]);
    expect(r.body.roles).toEqual([]);
    expect(r.body.readsPay).toBe(false);
    expect(r.body.saved).toBeUndefined();
    expect(r.body.maySave).toBeUndefined();
    expect(JSON.stringify(r.body)).not.toMatch(/op-a|sa-1|Person|2000/);
  });

  it("intake.moderate sees everything, the saved splits included", async () => {
    h.state.caps = ["intake.moderate"];
    const r = await h.call();
    expect(r.body.scope).toBe("all");
    expect(r.body.items.some((i) => i.kind === "role")).toBe(true);
    expect(r.body.maySave).toBe(true);
    expect(Array.isArray(r.body.saved)).toBe(true);
  });

  it("a key for something else sees nothing, and nothing is read", async () => {
    h.state.caps = ["terms.read"];
    expect((await h.call()).status).toBe(401);
    expect(h.state.reads).toBe(0);
  });

  it("quest.approve cannot save a split or read one person's saved split", async () => {
    h.state.caps = ["quest.approve"];
    expect((await h.call("/split", "POST", { roleId: "r-garden", rows: [{ key: "op:op-a:r-garden", holds: ["x"] }] })).status).toBe(401);
    expect((await h.call("/held/op-aaaaaaaaaaaaaaaaaaaa")).status).toBe(401);
    expect(h.stamped).toEqual([]);
  });
});

describe("saving a split (the lead, 20 Nov 2026)", () => {
  const h = harness();
  beforeAll(h.start);
  afterAll(h.stop);
  beforeEach(() => {
    Object.assign(h.state, { caps: ["intake.moderate"], isAdmin: false, readsPay: false, reads: 0, viewer: "u-hal" });
    h.stamped.length = 0;
    h.audits.length = 0;
  });

  it("keeps on each person's proposal what they hold, who else is in the split, who saved it and when, and audits it", async () => {
    const r = await h.call("/split", "POST", { roleId: "r-garden", rows: [{ key: "op:op-a:r-garden", holds: ["Keep the seed bank catalogued"] }, { key: "op:op-c:r-garden", holds: ["Build a compost system", " "] }] });
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect(h.stamped).toEqual([
      { kind: "op", id: "op-a", held: [{ roleId: "r-garden", holds: ["Keep the seed bank catalogued"], with: ["op:op-c:r-garden"], by: "u-hal", at: "2026-11-20T12:00:00.000Z" }] },
      { kind: "op", id: "op-c", held: [{ roleId: "r-garden", holds: ["Build a compost system"], with: ["op:op-a:r-garden"], by: "u-hal", at: "2026-11-20T12:00:00.000Z" }] },
    ]);
    expect(h.audits).toEqual(["proposal-split:saved:r-garden: a split of 2 for the role was saved"]);
  });

  it("refuses a split naming a proposal that is not in Compare, one for another role, or a closed one, and writes nothing", async () => {
    for (const body of [
      { roleId: "r-garden", rows: [{ key: "op:op-nope:r-garden", holds: ["x"] }] },
      { roleId: "r-garden", rows: [{ key: "op:op-a:r-water", holds: ["x"] }] },
      { roleId: "r-garden", rows: [] },
    ]) {
      expect((await h.call("/split", "POST", body)).status, JSON.stringify(body)).toBe(400);
    }
    // CONTROL: sa-2 is adopted, so it may be split; the refusal above was the empty and unknown rows.
    expect((await h.call("/split", "POST", { roleId: "r-cook", rows: [{ key: "sa:sa-2:r-cook", holds: ["x"] }] })).status).toBe(200);
    expect(h.stamped.map((x) => x.id)).toEqual(["sa-2"]);
  });

  it("shows one person's saved split to a decider, and never to the person it is about", async () => {
    const r = await h.call("/held/op-0123456789abcdef0123");
    expect(r.status).toBe(200);
    expect(r.body.held).toEqual([{ roleId: "r-garden", roleName: "Garden steward", holds: ["Map every spring"], with: ["Person op-a"], by: "Ivo Lantern", at: "2026-11-19T10:00:00.000Z" }]);
    // The person it is about, even holding the key, reads nothing here.
    h.state.viewer = "lina";
    expect((await h.call("/held/op-0123456789abcdef0123")).body.held).toEqual([]);
    expect((await h.call("/held/op-aaaaaaaaaaaaaaaaaaaa")).status).toBe(404);
    expect((await h.call("/held/not-a-ref")).status).toBe(404);
  });

  it("Compare lists the saved splits by role, with each person, their status and what they hold", async () => {
    const r = await h.call();
    expect(r.body.saved).toEqual([
      { roleId: "r-garden", roleName: "Garden steward", by: "Ivo Lantern", at: "2026-11-19T10:00:00.000Z", rows: [{ key: "op:op-0123456789abcdef0123:r-garden", who: "Lina Brook", status: "adopted", holds: ["Map every spring"], href: "/open-proposals/op-0123456789abcdef0123" }] },
    ]);
  });
});
