/**
 * THE ADMIN'S OWN HAND IS NOT THROTTLED (the lead's ruling, 2026-11-18; server/lib/adminUncapped.ts).
 *
 * Over real HTTP against a real database, with a COUNTING limiter in place of the
 * stub the main suite uses, so the 429 at save 31 is the real gate's answer:
 *   1. a person who is a village admin makes more than 30 saves in the window, none refused;
 *   2. a holder who is not an admin is still refused at save 31 (the control);
 *   3. the same admin coming through the connector is still refused at 31;
 *   4. an admin account held by an agent (`users.is_agent`) is still refused at 31.
 */
import http from "node:http";
import express from "express";
import type mysql from "mysql2/promise";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { provisionTestDb, testDbConfigured, testPool, type TestDb } from "../db/testDb";
import { capabilityDecision, type Capability, type CapabilityCtx } from "../../shared/capabilities";
import { addChange, createDraft, publishDraft } from "../lib/orgDrafts";
import { register } from "./orgDraftDecide";
import { adminUncapped, cameThroughAnAgent } from "../lib/adminUncapped";

const configured = testDbConfigured();

let db: TestDb;
let pool: mysql.Pool;
let server: http.Server;
let base = "";

const USERS: Record<string, { id: string; name: string; role: string }> = {
  "holder-1": { id: "holder-1", name: "Holder One", role: "member" },
  "admin-1": { id: "admin-1", name: "Admin One", role: "admin" },
  "admin-2": { id: "admin-2", name: "Admin Two", role: "admin" },
  "agent-admin": { id: "agent-admin", name: "Agent Admin", role: "admin" },
};
const holders = new Set<string>(["holder-1"]);
const SEASON = { current: { id: "s1" }, seasons: [{ id: "s1", startsOn: "2026-01-01", endsOn: "2030-01-01" }], timezone: "UTC" };

const userOf = async (req: any) => USERS[String(req.headers["x-user"] ?? "")] ?? null;
const ctxOf = async (user: any): Promise<CapabilityCtx> => ({
  stageIndex: 0,
  stageIndexOf: () => 0,
  roleCapabilities: holders.has(String(user.id)) ? ["org.decide"] : [],
  isAdmin: user.role === "admin",
  villageHeld: [],
});
async function guard(req: any, res: any, cap: Capability) {
  const user = await userOf(req);
  if (!user) {
    res.status(401).json({ error: "auth_required" });
    return false;
  }
  if (capabilityDecision(cap, await ctxOf(user)).allowed) return true;
  res.status(401).json({ error: "auth_required" });
  return false;
}

// The real shape of a fixed-window limiter: true once a key has been asked more than `max` times.
const counts = new Map<string, number>();
const overLimit = async (key: string, max: number) => {
  const n = (counts.get(key) ?? 0) + 1;
  counts.set(key, n);
  return n > max;
};

async function save(id: string, user: string, n: number, extra: Record<string, string> = {}) {
  const r = await fetch(`${base}/api/org/role-edit/${id}`, { // module-review-ok: the test client dialling its own server on localhost
    method: "POST",
    headers: { "Content-Type": "application/json", "x-user": user, ...extra },
    body: JSON.stringify({ words: { aim: `Keep the reading room alive, round ${n}` } }),
  });
  return r.status;
}

let seq = 0;
async function seedRole(): Promise<string> {
  seq += 1;
  const circle = `au-circle-${seq}`;
  const id = `au-role-${seq}`;
  const made = await createDraft(pool, { title: `Seed ${seq}`, createdBy: "admin-1", sourceKind: "human", openCap: null });
  if (!made.ok) throw new Error(made.error);
  for (const [op, orgRoleId, payload] of [
    ["create_circle", `circle:${circle}`, { name: `Uncapped Circle ${seq}` }],
    ["create_seat", id, { name: `Uncapped ${seq}`, circleId: circle, aim: "Old aim", domain: "Old domain" }],
  ] as const) {
    const r = await addChange(pool, made.id, { op: op as any, orgRoleId, payload });
    if (!r.ok) throw new Error(r.error);
  }
  const pub = await publishDraft(pool, made.id, "admin-1", null);
  if (!pub.ok) throw new Error(pub.error);
  return id;
}

/** Saves 1..35 in turn; the first refused save's number, or null when none was. */
async function firstRefused(id: string, user: string, extra: Record<string, string> = {}): Promise<number | null> {
  for (let n = 1; n <= 35; n += 1) {
    const status = await save(id, user, n, extra);
    if (status === 429) return n;
    expect(status, `save ${n} by ${user}`).toBe(200);
  }
  return null;
}

describe("who counts as an agent", () => {
  it("an agent token, or the connector's header, is an agent; a plain session is not", () => {
    expect(cameThroughAnAgent({ headers: {} })).toBe(false);
    expect(cameThroughAnAgent({ headers: { "x-village-connector": "1" } })).toBe(true);
    expect(cameThroughAnAgent({ headers: {}, agentToken: { id: "t", prefix: "vat_x" } })).toBe(true);
  });

  it("an agent-token request from an admin is never uncapped, and the admin check is not even asked", async () => {
    let asked = false;
    const isAdmin = async () => ((asked = true), true);
    expect(await adminUncapped({ headers: {}, agentToken: { id: "t" } }, "admin-1", isAdmin, null as any)).toBe(false);
    expect(asked).toBe(false);
  });
});

describe.skipIf(!configured)("the role editor's limiter and the admin's own hand", () => {
  beforeAll(async () => {
    db = await provisionTestDb();
    pool = testPool(db, { connectionLimit: 6 });
    for (const u of Object.values(USERS)) {
      await pool.query("INSERT INTO `users` (`id`, `name`, `email`, `password_hash`, `is_agent`) VALUES (?,?,?,'x',?)", [ // module-review-ok: fixture SQL against the S5 scratch schema, never a production table
        u.id,
        u.name,
        `${u.id}@example.test`,
        u.id === "agent-admin" ? 1 : null,
      ]);
    }
    const app = express();
    app.use(express.json());
    register(app, {
      authedUser: userOf,
      isAdmin: async (req: any) => (await userOf(req))?.role === "admin",
      guardCapability: guard,
      capabilityCtx: ctxOf,
      getPool: () => pool,
      notify: async () => ({}) as any,
      seasonState: () => SEASON,
      circlesRepo: { load: async () => {}, all: () => [] },
      liveHoldersOf: async () => Array.from(holders),
      overLimit,
      ballotSetup: async () => ({}) as any,
      notifyRoll: async () => 0,
      governanceOn: () => true,
      closers: {},
    } as any);
    server = http.createServer(app);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const addr = server.address();
    if (!addr || typeof addr === "string") throw new Error("the test server did not report a port");
    base = `http://127.0.0.1:${addr.port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server?.close(() => resolve()));
    await pool?.end();
    await db?.drop();
  });

  it("a person who is a village admin makes more than 30 saves in the window without a 429", async () => {
    expect(await firstRefused(await seedRole(), "admin-1")).toBeNull();
  });

  it("a holder who is not an admin is still refused at save 31", async () => {
    expect(await firstRefused(await seedRole(), "holder-1")).toBe(31);
  });

  it("an admin coming through the connector is still refused at save 31", async () => {
    expect(await firstRefused(await seedRole(), "admin-2", { "x-village-connector": "1" })).toBe(31);
  });

  it("an admin account held by an agent is still refused at save 31", async () => {
    expect(await firstRefused(await seedRole(), "agent-admin")).toBe(31);
  });
});
