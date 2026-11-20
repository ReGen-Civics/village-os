/**
 * THE COMING-SOON WAITLIST (0414, shared/roleWaitlist.ts): anybody may sign up for a coming-soon role, the
 * sign-up is kept privately and read by admins only, a role that is not coming soon is refused, the route
 * is rate limited, and the member's sign-ups leave with them (`forgetWaitlistOf`, the erasure step).
 */
import http from "node:http";
import express from "express";
import type mysql from "mysql2/promise";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { provisionTestDb, testDbConfigured, testPool, type TestDb } from "../db/testDb";
import { addChange, createDraft, publishDraft } from "../lib/orgDrafts";
import { forgetWaitlistOf } from "../repos/roleWaitlist";
import { registerRoleWaitlistRoutes } from "./roleWaitlist";

const configured = testDbConfigured();
let db: TestDb;
let pool: mysql.Pool;
let server: http.Server;
let base = "";
let limited = false;

const USERS: Record<string, { id: string; role: string }> = { "admin-1": { id: "admin-1", role: "admin" }, "member-1": { id: "member-1", role: "member" } };
const userOf = async (req: any) => USERS[String(req.headers["x-user"] ?? "")] ?? null;

async function call(method: string, route: string, user: string | null, body?: unknown) {
  const r = await fetch(base + route, { method, headers: { "Content-Type": "application/json", ...(user ? { "x-user": user } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) }); // module-review-ok: the test client dialling its own server on localhost
  return { status: r.status, json: (await r.json().catch(() => null)) as any };
}

async function seedRoles(): Promise<{ soon: string; open: string }> {
  const made = await createDraft(pool, { title: "Seed", createdBy: "admin-1", sourceKind: "human", openCap: null });
  if (!made.ok) throw new Error(made.error);
  await addChange(pool, made.id, { op: "create_circle", orgRoleId: "circle:wl-circle", payload: { name: "Waitlist Circle" } });
  await addChange(pool, made.id, { op: "create_seat", orgRoleId: "wl-soon", payload: { name: "Garden Steward", circleId: "wl-circle", aim: "Grow food" } });
  await addChange(pool, made.id, { op: "create_seat", orgRoleId: "wl-open", payload: { name: "Kitchen Steward", circleId: "wl-circle", aim: "Cook" } });
  const pub = await publishDraft(pool, made.id, "admin-1", null);
  if (!pub.ok) throw new Error(pub.error);
  await pool.query("UPDATE org_roles SET coming_soon = 1 WHERE id = ?", ["wl-soon"]); // module-review-ok: a test marking the role it signs up for as coming soon
  return { soon: "wl-soon", open: "wl-open" };
}

describe.skipIf(!configured)("the coming-soon waitlist", () => {
  let ids: { soon: string; open: string };
  beforeAll(async () => {
    db = await provisionTestDb();
    pool = testPool(db, { connectionLimit: 4 });
    const app = express();
    app.use(express.json());
    registerRoleWaitlistRoutes(app, { authedUser: userOf, isAdmin: async (req: any) => (await userOf(req))?.role === "admin", getPool: () => pool, overLimit: async () => limited });
    server = http.createServer(app);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const addr = server.address();
    if (!addr || typeof addr === "string") throw new Error("no port");
    base = `http://127.0.0.1:${addr.port}`;
    ids = await seedRoles();
  });
  afterAll(async () => {
    await new Promise<void>((resolve) => server?.close(() => resolve()));
    await pool?.end();
    await db?.drop();
  });

  it("keeps a visitor's sign-up for a coming-soon role, and only an admin reads it", async () => {
    const ok = await call("POST", "/api/roles/waitlist", null, { email: " Ana@Example.org ", whatsapp: "+506 8888 8888", roleIds: [ids.soon] });
    expect(ok.status).toBe(200);
    expect(ok.json).toEqual({ ok: true });
    expect((await call("GET", "/api/admin/roles/waitlist", "member-1")).status).toBe(401);
    expect((await call("GET", "/api/admin/roles/waitlist", null)).status).toBe(401);
    const read = await call("GET", "/api/admin/roles/waitlist", "admin-1");
    expect(read.status).toBe(200);
    expect(read.json.rows).toHaveLength(1);
    expect(read.json.rows[0]).toMatchObject({ email: "ana@example.org", whatsapp: "+506 8888 8888", roles: [{ id: ids.soon, name: "Garden Steward" }], member: false });
  });

  it("refuses a role that is not coming soon, a bad address and a bad number, and stores nothing (control: the good one above)", async () => {
    const before = (await call("GET", "/api/admin/roles/waitlist", "admin-1")).json.rows.length;
    expect((await call("POST", "/api/roles/waitlist", null, { email: "b@example.org", roleIds: [ids.open] })).json.field).toBe("roleIds");
    expect((await call("POST", "/api/roles/waitlist", null, { email: "not-an-address", roleIds: [ids.soon] })).json.field).toBe("email");
    expect((await call("POST", "/api/roles/waitlist", null, { email: "b@example.org", whatsapp: "call me", roleIds: [ids.soon] })).json.field).toBe("whatsapp");
    expect((await call("GET", "/api/admin/roles/waitlist", "admin-1")).json.rows.length).toBe(before);
  });

  it("is rate limited", async () => {
    limited = true;
    expect((await call("POST", "/api/roles/waitlist", null, { email: "c@example.org", roleIds: [ids.soon] })).status).toBe(429);
    limited = false;
  });

  it("a member's sign-ups leave with them, by account and by address; an admin removes one on request", async () => {
    expect((await call("POST", "/api/roles/waitlist", "member-1", { email: "member@example.org", roleIds: [ids.soon] })).status).toBe(200);
    expect((await call("POST", "/api/roles/waitlist", null, { email: "member@example.org", roleIds: [ids.soon] })).status).toBe(200);
    const rows = (await call("GET", "/api/admin/roles/waitlist", "admin-1")).json.rows as any[];
    expect(rows.filter((r) => r.email === "member@example.org")).toHaveLength(2);
    await forgetWaitlistOf(pool, { userId: "member-1", emailKeys: ["member@example.org"] });
    const after = (await call("GET", "/api/admin/roles/waitlist", "admin-1")).json.rows as any[];
    expect(after.some((r) => r.email === "member@example.org")).toBe(false);
    // Control: the visitor's row from the first case is still there.
    expect(after.some((r) => r.email === "ana@example.org")).toBe(true);
    const ana = after.find((r) => r.email === "ana@example.org");
    expect((await call("DELETE", `/api/admin/roles/waitlist/${ana.id}`, "member-1")).status).toBe(401);
    expect((await call("DELETE", `/api/admin/roles/waitlist/${ana.id}`, "admin-1")).status).toBe(200);
    expect((await call("GET", "/api/admin/roles/waitlist", "admin-1")).json.rows).toHaveLength(0);
  });
});
