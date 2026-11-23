/**
 * PUT /api/admin/players/:id/ops-email: an admin turns a member's operations
 * report email off, or back on, without that member signing in.
 *
 * Over real HTTP against the players routes, with an in-memory member store
 * and a real scratch schema for the audit row. What it holds: only an admin
 * may call it, only "daily" and "off" are accepted, the write lands in the
 * member's own `prefs.notify.opsEmail` (the key the member's own toggle and
 * `emailCadenceFor` read) without touching any other preference, the roster
 * reads it back, and the audit row names no one in its text.
 */
import http from "node:http";
import express from "express";
import type mysql from "mysql2/promise";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { provisionTestDb, testDbConfigured, testPool, type TestDb } from "../db/testDb";
import { emailCadenceFor, resolveNotifyPrefs } from "../lib/notify";
import { register } from "./players";

describe.skipIf(!testDbConfigured())("the admin's operations report email switch", () => {
  let db: TestDb;
  let pool: mysql.Pool;
  let server: http.Server;
  let base = "";
  let admin = true;
  const rows = new Map<string, any>();

  beforeAll(async () => {
    db = await provisionTestDb();
    pool = testPool(db, { connectionLimit: 4 });
    const members = {
      all: async () => Array.from(rows.values()),
      byId: async (id: string) => rows.get(id) ?? null,
      update: async (id: string, fn: (u: any) => void) => {
        const u = rows.get(id);
        if (!u) return null;
        fn(u);
        return u;
      },
    };
    const app = express();
    app.use(express.json());
    register(app, {
      isAdmin: async () => admin,
      authedUser: async () => (admin ? { id: "admin-1", role: "admin" } : null),
      members: members as any,
      claimsRepo: { consentedCounts: async () => new Map() } as any,
      computeStage: () => "newcomer",
      trainingCompletions: async () => new Map(),
      paidByVillage: async () => new Set<string>(),
      hasMembership: () => false,
      stageOf: () => null as any,
      recordStageEvent: async () => {},
      getPool: () => pool as any,
      lapseContext: () => ({}) as any,
      adminGroupsFor: () => [],
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

  beforeEach(() => {
    admin = true;
    rows.clear();
    rows.set("founder-2", { id: "founder-2", name: "A founder", email: "f@example.test", role: "founder", prefs: { notify: { gratitudeEmail: "off", seenAt: "2026-11-01T00:00:00.000Z" } } });
  });

  const put = (id: string, body: unknown) =>
    fetch(`${base}/api/admin/players/${id}/ops-email`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); // module-review-ok: this suite's own loopback server, not an outbound call

  it("turns the report email off for another member, and the cadence reads off", async () => {
    const res = await put("founder-2", { opsEmail: "off" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ userId: "founder-2", opsEmail: "off" });
    const prefs = rows.get("founder-2").prefs;
    expect(prefs.notify.opsEmail).toBe("off");
    expect(emailCadenceFor("failed_action", resolveNotifyPrefs(prefs))).toBe("off");
    // Every other preference stays exactly as the member left it.
    expect(prefs.notify.gratitudeEmail).toBe("off");
    expect(prefs.notify.seenAt).toBe("2026-11-01T00:00:00.000Z");
  });

  it("the roster reads the choice back, and daily turns it on again", async () => {
    await put("founder-2", { opsEmail: "off" });
    const roster = await (await fetch(`${base}/api/admin/players`)).json(); // module-review-ok: this suite's own loopback server, not an outbound call
    expect(roster.find((p: any) => p.id === "founder-2").opsEmail).toBe("off");
    const back = await put("founder-2", { opsEmail: "daily" });
    expect((await back.json()).opsEmail).toBe("daily");
    expect(emailCadenceFor("failed_action", resolveNotifyPrefs(rows.get("founder-2").prefs))).toBe("daily");
  });

  it("records an admin-only audit row that names no one in its text", async () => {
    await put("founder-2", { opsEmail: "off" });
    const [events] = await pool.query<any[]>("SELECT kind, text, actor_user_id, entity_type, entity_ref, audience FROM health_events WHERE entity_ref = 'founder-2' ORDER BY id DESC LIMIT 1"); // module-review-ok: reading back the audit row in the scratch schema this suite provisioned
    expect(events[0]).toMatchObject({ kind: "audit", actor_user_id: "admin-1", entity_type: "user", entity_ref: "founder-2", audience: "admin" });
    expect(events[0].text).toBe("turned a member's operations report email off");
    expect(events[0].text).not.toContain("A founder");
    expect(events[0].text).not.toContain("@");
  });

  it("refuses anything but daily or off, and writes nothing", async () => {
    for (const opsEmail of ["immediate", "", null, true]) {
      expect((await put("founder-2", { opsEmail })).status).toBe(400);
    }
    expect(rows.get("founder-2").prefs.notify.opsEmail).toBeUndefined();
  });

  it("answers 404 for an unknown member", async () => {
    expect((await put("nobody", { opsEmail: "off" })).status).toBe(404);
  });

  it("refuses a caller who is not an admin", async () => {
    admin = false;
    expect((await put("founder-2", { opsEmail: "off" })).status).toBe(401);
    expect(rows.get("founder-2").prefs.notify.opsEmail).toBeUndefined();
  });
});
