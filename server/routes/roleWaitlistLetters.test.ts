/**
 * A LETTER TO THE PEOPLE WAITING FOR ONE ROLE (shared/roleWaitlistLetters.ts), over real HTTP and the S5
 * scratch schema. The provider is a recorder: NOTHING IS SENT FOR REAL, and the proof that nothing goes
 * without a person is in the cases below, each with a control that fails for the reason claimed:
 *
 *   - no press (`confirm: true`), a wrong count, no capability, a paused or rehearsing village: the recorder holds nothing
 *   - the route file has no job, timer or schedule, and exactly one route that sends
 *   - the press writes to each distinct address waiting for that role and no other; a suppressed one is skipped
 *   - every letter ends with the one-click link off the waitlist, which describes on GET and acts only on POST
 *   - the log names who, which role, the subject and the counts, and no address
 */
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import express from "express";
import type mysql from "mysql2/promise";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { provisionTestDb, testDbConfigured, testPool, type TestDb } from "../db/testDb";
import { addChange, createDraft, publishDraft } from "../lib/orgDrafts";
import { addSuppression } from "../lib/comms/suppressions";
import { resolveActionLink, clearActions } from "../lib/comms/actions";
import { recentEvents } from "../lib/events";
import { addWaitlistSignUp, listWaitlist } from "../repos/roleWaitlist";
import type { CommsMode, PostOfficeDeps } from "../lib/comms/postOffice";
import type { TransportMessage } from "../lib/comms/transport";
import { register } from "./roleWaitlistLetters";

const configured = testDbConfigured();
const ORIGIN = "https://village.example.test";
const LIVE: CommsMode = { lifecycle: "members", paused: false, rehearsalTo: [] };

let db: TestDb;
let pool: mysql.Pool;
let server: http.Server;
let base = "";
const provider: TransportMessage[] = [];
const state = { viewer: null as string | null, allowed: true, mode: LIVE as CommsMode, sender: "Village <hello@village.example.test>" };

const office = (): PostOfficeDeps => ({
  getPool: () => pool,
  transport: { name: "resend", send: async (m) => (provider.push(m), { ok: true, providerId: `prov_${provider.length}` }) },
  sender: () => state.sender,
  hasApiKey: () => true,
  origin: () => ORIGIN,
  mode: async () => state.mode,
  dial: () => 1000,
});

async function call(method: string, route: string, body?: unknown, as: string | null = "admin-1") {
  state.viewer = as;
  const r = await fetch(base + route, { method, headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) }); // module-review-ok: the test client dialling its own server on localhost
  return { status: r.status, json: (await r.json().catch(() => null)) as any };
}

async function seedRoles() {
  const made = await createDraft(pool, { title: "Seed", createdBy: "admin-1", sourceKind: "human", openCap: null });
  if (!made.ok) throw new Error(made.error);
  await addChange(pool, made.id, { op: "create_circle", orgRoleId: "circle:wll-circle", payload: { name: "Letters Circle" } });
  await addChange(pool, made.id, { op: "create_seat", orgRoleId: "wll-garden", payload: { name: "Garden Steward", circleId: "wll-circle", aim: "Grow food" } });
  await addChange(pool, made.id, { op: "create_seat", orgRoleId: "wll-kitchen", payload: { name: "Kitchen Steward", circleId: "wll-circle", aim: "Cook" } });
  const pub = await publishDraft(pool, made.id, "admin-1", null);
  if (!pub.ok) throw new Error(pub.error);
}

const sign = (email: string, roles: string[], at: Date) => addWaitlistSignUp(pool, { emailKey: email, whatsapp: null, roleIds: roles }, null, at);
const ask = (over: Record<string, unknown> = {}) => ({ roleId: "wll-garden", subject: "The Garden Steward role is opening", body: "Hello,\n\nThe role opens next moon: https://village.example.test/roles#role-wll-garden", expectedCount: 3, lang: "en", confirm: true, ...over });
const SEND = "/api/admin/roles/waitlist-letters/send";

describe.skipIf(!configured)("letters to the coming-soon waitlist", () => {
  beforeAll(async () => {
    db = await provisionTestDb();
    pool = testPool(db, { connectionLimit: 6 });
    await seedRoles();
    const app = express();
    app.use(express.json());
    register(app, {
      authedUser: async () => (state.viewer ? { id: state.viewer, name: "Fern Oak", email: `${state.viewer}@example.test` } : null),
      guardCapability: async (_req: any, res: any, cap: string, refusal?: { status: number; body: unknown }) => {
        expect(cap).toBe("comms.manage");
        if (state.viewer && state.allowed) return true;
        res.status(refusal?.status ?? 403).json(refusal?.body ?? { error: "forbidden" });
        return false;
      },
      mayStillSee: async () => !!state.viewer && state.allowed,
      getPool: () => pool,
      commsPostOffice: office(),
      members: { byId: async (id: string) => ({ id, name: "Fern Oak" }) },
      projectName: () => "Test Village",
    } as any);
    server = http.createServer(app);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const addr = server.address();
    if (!addr || typeof addr === "string") throw new Error("no port");
    base = `http://127.0.0.1:${addr.port}`;
    // Three people wait for the garden role (one signed up twice); one waits only for the kitchen.
    await sign("ana@example.org", ["wll-garden"], new Date("2026-11-01T10:00:00Z"));
    await sign("ana@example.org", ["wll-garden", "wll-kitchen"], new Date("2026-11-03T10:00:00Z"));
    await sign("ben@example.org", ["wll-garden"], new Date("2026-11-02T10:00:00Z"));
    await sign("cleo@example.org", ["wll-garden"], new Date("2026-11-02T11:00:00Z"));
    await sign("dan@example.org", ["wll-kitchen"], new Date("2026-11-02T12:00:00Z"));
  });
  afterAll(async () => {
    await new Promise<void>((resolve) => server?.close(() => resolve()));
    await pool?.end();
    await db?.drop();
  });
  beforeEach(() => {
    provider.length = 0;
    state.allowed = true;
    state.mode = LIVE;
    state.sender = "Village <hello@village.example.test>";
  });

  it("sends nothing without the person's own press, with a wrong count, or without the capability (control: the good press below)", async () => {
    for (const confirm of [undefined, false, "yes"]) expect((await call("POST", SEND, ask({ confirm }))).status).toBe(400);
    const stale = await call("POST", SEND, ask({ expectedCount: 2 }));
    expect([stale.status, stale.json.error, stale.json.count]).toEqual([409, "count_changed", 3]);
    state.allowed = false;
    expect((await call("POST", SEND, ask())).status).toBe(403);
    expect((await call("POST", SEND, ask(), null)).status).toBe(403);
    expect(provider).toEqual([]);
    expect((await call("GET", "/api/admin/roles/waitlist-letters")).status).toBe(403);
  });

  it("sends nothing while the village's email is paused, rehearsing or without a sender", async () => {
    state.mode = { ...LIVE, paused: true };
    expect((await call("POST", SEND, ask())).json.error).toBe("cannot_send");
    state.mode = { ...LIVE, lifecycle: "preview", rehearsalTo: ["admin@example.test"] };
    expect((await call("POST", SEND, ask())).json.error).toBe("cannot_send");
    state.mode = LIVE;
    state.sender = "";
    expect((await call("POST", SEND, ask())).json.error).toBe("cannot_send");
    expect(provider).toEqual([]);
    // The screen is told why, so the button is not offered as if it would work.
    expect((await call("GET", "/api/admin/roles/waitlist-letters")).json.blocked).toMatch(/no email sender/);
  });

  it("the route file has no job, timer or schedule, and one route that sends (nothing is automatic)", () => {
    const src = fs.readFileSync(path.resolve(__dirname, "roleWaitlistLetters.ts"), "utf8");
    const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    for (const banned of ["registerJob", "setInterval", "setTimeout", "cron", "scheduler", "sendAfter", "agentMcp", "seraAgent"]) expect(code, banned).not.toContain(banned);
    expect(code.match(/(?<![.\w])post\(/g)).toHaveLength(1);
    expect(code.match(/app\.post\(/g)).toHaveLength(1);
    // CONTROL: the same scan sees a planted timer.
    expect("setInterval(() => post(x), 1)").toContain("setInterval");
  });

  it("on the press, writes once to each person waiting for that role, skips a suppressed address, and logs no address", async () => {
    await addSuppression(pool, { email: "cleo@example.org", reason: "manual" });
    const r = await call("POST", SEND, ask());
    expect(r.status, JSON.stringify(r.json)).toBe(200);
    expect(r.json).toEqual({ ok: true, sent: 2, skipped: 1, failed: 0 });
    // Ana (once, though she signed up twice) and Ben. Not Cleo (suppressed), not Dan (waits for another role).
    expect(provider.map((m) => String(m.to)).sort()).toEqual(["ana@example.org", "ben@example.org"]);
    for (const m of provider) {
      expect(m.subject).toBe("The Garden Steward role is opening");
      expect(m.text).toContain("https://village.example.test/roles#role-wll-garden");
      // The line the sender cannot remove: a link off the waitlist.
      expect(m.text).toMatch(/You get this because you asked Test Village to tell you when this role opens/);
      expect(m.text).toMatch(/https:\/\/village\.example\.test\/email\/a\?t=/);
    }
    // The log: who, which role, what subject, how many, and no address anywhere.
    const events = (await recentEvents(pool, "admin", 50)).filter((e) => e.kind === "waitlist_letter");
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ actorUserId: "admin-1", entityRef: "wll-garden", text: 'Letter to the waitlist for Garden Steward: "The Garden Steward role is opening" (2 sent, 1 skipped)' });
    expect(JSON.stringify(events)).not.toContain("@example.org");
    const log = await call("GET", "/api/admin/roles/waitlist-letters");
    expect(log.json.blocked).toBeNull();
    expect(log.json.sent[0]).toMatchObject({ by: "Fern Oak", roleId: "wll-garden" });
    expect(JSON.stringify(log.json)).not.toContain("@example.org");
  });

  it("the link in a letter describes on a GET and takes the address off only on the press", async () => {
    clearActions();
    register(express(), { authedUser: async () => null, guardCapability: async () => false, mayStillSee: async () => false, getPool: () => pool, commsPostOffice: office(), members: {}, projectName: () => "Test Village" } as any);
    expect((await call("POST", SEND, ask())).status).toBe(200);
    const mail = provider.find((m) => String(m.to) === "ben@example.org")!;
    const token = decodeURIComponent(String(/\/email\/a\?t=([^\s&]+)/.exec(mail.text ?? "")?.[1]));
    const found = resolveActionLink(token);
    expect(found?.purpose).toBe("waitlist_remove");
    const before = (await listWaitlist(pool)).filter((x) => x.emailKey === "ben@example.org").length;
    // Describing never acts: a mail scanner opening the link removes nobody.
    const described = await found!.handler.describe(found!.payload, { village: "Test Village" });
    expect(described?.choices.map((c) => c.value)).toEqual(["remove", "keep"]);
    expect((await listWaitlist(pool)).filter((x) => x.emailKey === "ben@example.org")).toHaveLength(before);
    // "Keep" changes nothing; "remove" takes the address off every role.
    await found!.handler.act(found!.payload, { choice: "keep" }, { village: "Test Village" });
    expect((await listWaitlist(pool)).filter((x) => x.emailKey === "ben@example.org")).toHaveLength(before);
    const done = await found!.handler.act(found!.payload, { choice: "remove" }, { village: "Test Village" });
    expect(done.ok).toBe(true);
    expect((await listWaitlist(pool)).filter((x) => x.emailKey === "ben@example.org")).toHaveLength(0);
    // Ana and Dan are still there: the removal is one address.
    expect((await listWaitlist(pool)).some((x) => x.emailKey === "ana@example.org")).toBe(true);
    expect((await listWaitlist(pool)).some((x) => x.emailKey === "dan@example.org")).toBe(true);
    // A second press says it is already done.
    const again = await found!.handler.describe(found!.payload, { village: "Test Village" });
    expect(again?.choices).toEqual([]);
  });

  it("refuses a role nobody waits for and a list over the cap, and writes nothing", async () => {
    expect((await call("POST", SEND, ask({ roleId: "no-such-role", expectedCount: 0 }))).status).toBe(404);
    provider.length = 0;
    await pool.query("DELETE FROM role_waitlist"); // module-review-ok: a test emptying the waitlist it seeded
    const nobody = await call("POST", SEND, ask({ expectedCount: 0 }));
    expect([nobody.status, nobody.json.error]).toEqual([409, "nobody"]);
    expect(provider).toEqual([]);
  });
});
