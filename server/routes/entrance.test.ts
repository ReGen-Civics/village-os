/**
 * THE PORTAL ENTRANCE'S ROUTES, OVER REAL HTTP AND A REAL SCHEMA (migration 0425).
 *
 * What is pinned, for the design confirmed on 24 Nov 2026:
 *
 *   - entering keeps the entry with its keep-in-touch answer UNANSWERED, sets the cookie, and
 *     answers the page first asked for (`/roles` stays `/roles`; another site falls back to none);
 *   - the keep-in-touch step takes yes or no for this device's own entry only, keeps the words,
 *     and only a yes reaches the email list (a no never calls it; a later no stands);
 *   - the pages an entered visitor opens are kept, with the role a role page shows, and a member's
 *     never are;
 *   - Admin reads the answer, the first path asked for, the pages opened and whether an account is
 *     a member yet; forgetting a person takes their pages with them.
 *
 * Every name and address is fake.
 */
import http from "node:http";
import express from "express";
import type { Pool } from "mysql2/promise";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { provisionTestDb, testDbConfigured, testPool, type TestDb } from "../db/testDb";
import { register } from "./entrance";

const configured = testDbConfigured();
const SECRET = "test-secret-for-the-entrance-routes-only"; // module-review-ok: a test fixture key for the HMAC, never a real credential

describe.skipIf(!configured)("the portal entrance, over HTTP", () => {
  let db: TestDb;
  let pool: Pool;
  let server: http.Server;
  let base = "";
  let member = false;
  let canModerate = true;
  const brevoCalls: unknown[] = [];

  beforeAll(async () => {
    db = await provisionTestDb();
    pool = testPool(db, { connectionLimit: 4 });
    const app = express();
    app.use(express.json());
    register(app, {
      getPool: () => pool,
      authedUser: async () => (member ? { id: "u-member" } : null),
      boolVar: (k) => k === "entrance.required",
      stringVar: () => "",
      turnstileSecret: () => "",
      secret: SECRET,
      clientIp: () => "203.0.113.7",
      overLimit: async () => false,
      guardCapability: async (_req, res) => {
        if (canModerate) return true;
        res.status(403).json({ error: "forbidden" });
        return false;
      },
      brevo: {
        apiKey: () => "test-brevo-key", // module-review-ok: a fake key, never sent anywhere
        listId: () => 7,
        post: async (url, body) => {
          brevoCalls.push({ url, body });
          return {};
        },
      },
      isAgent: async () => false,
      passToken: () => "",
      now: () => Date.now(),
    });
    app.get("/api/roles-like", (_req, res) => res.json({ ok: true }));
    server = http.createServer(app);
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()));
    base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  });

  afterAll(async () => {
    await new Promise<void>((r) => server?.close(() => r()));
    await pool?.end();
    await db?.drop();
  });

  const call = (path: string, init?: RequestInit) => fetch(base + path, init); // module-review-ok: the test's own loopback server, not an outbound call
  const post = (path: string, body: unknown, cookie = "") => call(path, { method: "POST", headers: { "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}) }, body: JSON.stringify(body) });
  /** The test reads its own scratch schema to see what was written. */
  const read = async (sql: string, args: unknown[] = []) => (await pool.query<any[]>(sql, args))[0]; // module-review-ok: a test reading back its own scratch schema

  async function enter(name: string, email: string, next: string): Promise<{ cookie: string; next: string | null }> {
    const res = await post("/api/entrance", { name, email, next, website: "", shownAt: Date.now() - 10_000, consentWords: "the privacy words" });
    expect(res.status).toBe(201);
    const cookie = String(res.headers.get("set-cookie") ?? "").split(";")[0];
    expect(cookie).toMatch(/^vos_portal=/);
    const body = (await res.json()) as { next: string | null };
    return { cookie, next: body.next };
  }

  const rowFor = async (email: string) => {
    const rows = await read("SELECT * FROM portal_entries WHERE email = ?", [email]);
    return rows[0];
  };

  it("keeps the entry unanswered and sends the visitor on to the page first asked for", async () => {
    const { next } = await enter("Rowan Test", "rowan@example.org", "/roles");
    expect(next).toBe("/roles");
    const row = await rowFor("rowan@example.org");
    expect(row.updates).toBeNull();
    expect(row.next_path).toBe("/roles");
    const off = await enter("Sky Test", "sky@example.org", "https://elsewhere.example/x");
    expect(off.next).toBeNull();
  });

  it("takes yes or no for this device's own entry, and only a yes reaches the email list", async () => {
    const { cookie } = await enter("Wren Test", "wren@example.org", "/roles/x");
    expect((await post("/api/entrance/updates", { answer: "yes" })).status).toBe(401);
    expect((await post("/api/entrance/updates", { answer: "maybe" }, cookie)).status).toBe(400);

    brevoCalls.length = 0;
    const no = await post("/api/entrance/updates", { answer: "no", words: "Do you want us to keep you updated?" }, cookie);
    expect(no.status).toBe(200);
    expect((await rowFor("wren@example.org")).updates).toBe("no");
    expect((await rowFor("wren@example.org")).updates_words).toBe("Do you want us to keep you updated?");
    await new Promise((r) => setTimeout(r, 50));
    expect(brevoCalls).toEqual([]);

    const yes = await post("/api/entrance/updates", { answer: "yes", words: "Do you want us to keep you updated?" }, cookie);
    expect(yes.status).toBe(200);
    expect((await rowFor("wren@example.org")).updates).toBe("yes");
    await new Promise((r) => setTimeout(r, 100));
    expect(brevoCalls.length).toBeGreaterThan(0);
    expect(JSON.stringify(brevoCalls[0])).toContain("wren@example.org");
  });

  it("keeps the pages an entered visitor opens, and never a member's", async () => {
    const { cookie } = await enter("Moss Test", "moss@example.org", "/");
    const id = decodeURIComponent(cookie.split("=")[1]).split(".")[0];
    expect((await post("/api/entrance/view", { path: "/roles/garden-steward?seat=a" }, cookie)).status).toBe(204);
    expect((await post("/api/entrance/view", { path: "//elsewhere.example" }, cookie)).status).toBe(400);
    member = true;
    expect((await post("/api/entrance/view", { path: "/roles/kept-out" }, cookie)).status).toBe(204);
    member = false;
    const rows = await read("SELECT path, role_slug FROM portal_views WHERE entry_id = ?", [id]);
    expect(rows.map((r) => [r.path, r.role_slug])).toEqual([["/roles/garden-steward", "garden-steward"]]);
  });

  it("shows Admin the answer, the first page asked for and the pages opened, and forgets them together", async () => {
    // Not signed in: the entrance itself turns the read away before the capability gate is asked.
    expect((await call(`/api/admin/entrance/entries`)).status).toBe(401);
    member = true;
    canModerate = false;
    expect((await call(`/api/admin/entrance/entries`)).status).toBe(403);
    canModerate = true;
    const list = (await (await call(`/api/admin/entrance/entries`)).json()) as { entries: any[] };
    const moss = list.entries.find((e) => e.email === "moss@example.org");
    expect(moss.updates).toBeNull();
    expect(moss.nextPath).toBe("/");
    expect(moss.views.map((v: any) => v.roleSlug)).toEqual(["garden-steward"]);
    expect(moss.journey.account).toBeNull();
    const wren = list.entries.find((e) => e.email === "wren@example.org");
    expect(wren.updates).toBe("yes");

    const yesOnly = (await (await call(`/api/admin/entrance/entries?updates=1`)).json()) as { entries: any[] };
    expect(yesOnly.entries.map((e) => e.email)).toEqual(["wren@example.org"]);

    const csv = await (await call(`/api/admin/entrance/entries.csv`)).text();
    expect(csv.split("\r\n")[0]).toContain("keep_in_touch");
    expect(csv).toContain("garden-steward");

    const gone = await call(`/api/admin/entrance/entries?email=MOSS@example.org`, { method: "DELETE" });
    expect(((await gone.json()) as { removed: number }).removed).toBe(1);
    const views = await read("SELECT COUNT(*) AS n FROM portal_views");
    expect(Number(views[0].n)).toBe(0);
    member = false;
  });
});
