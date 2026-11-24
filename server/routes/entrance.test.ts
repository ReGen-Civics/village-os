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
import { insertPortalView, sweepPortalViews } from "../repos/portalEntries";
import { portalGoogleVisitor, register } from "./entrance";

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
  let mailOn = false;
  let clock = 0;
  const letters: { to: string; subject: string; html: string }[] = [];
  const accounts = new Map<string, any>([["member@example.org", { id: "u-ana", email: "member@example.org", tokenVersion: 2, passwordHash: "hash", emailVerifiedAt: "2026-01-01T00:00:00.000Z" }]]);
  const codeIn = (html: string) => (/(\d{3}) (\d{3})/.exec(html) ?? []).slice(1).join("");

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
      numberVar: (k) => (k === "entrance.views_keep_days" ? 30 : 0),
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
      mail: {
        ready: () => mailOn,
        sendEmail: async (o) => {
          letters.push({ to: o.to[0], subject: o.subject, html: o.html });
          return { sent: true };
        },
        escapeHtml: (x) => x,
        projectName: () => "Test Village",
      },
      accounts: {
        byEmail: async (e) => accounts.get(String(e).toLowerCase()) ?? null,
        update: async (id, mutate) => {
          const a = Array.from(accounts.values()).find((x) => x.id === id);
          if (!a) return null;
          mutate(a);
          return a;
        },
        encodeToken: (id, email, v) => `token:${id}:${email}:${v}`,
        publicUser: (u) => ({ id: u.id }),
        endReachAround: async (_id, change) => change(),
        recordAudit: () => undefined,
      },
      mailLookup: {
        resolveMx: async (d) => {
          if (d === "nomail.example") throw Object.assign(new Error("no"), { code: "ENOTFOUND" });
          return [{ exchange: "mx" }];
        },
        resolve4: async () => {
          throw Object.assign(new Error("no"), { code: "ENOTFOUND" });
        },
      },
      now: () => Date.now() + clock,
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

  it("sweeps page views past the keeping period and keeps the recent ones", async () => {
    const { cookie } = await enter("Fern Test", "fern@example.org", "/");
    const id = decodeURIComponent(cookie.split("=")[1]).split(".")[0];
    const day = 24 * 60 * 60 * 1000;
    await insertPortalView(pool, { id: "pv-old-one", entryId: id, path: "/roles/old", roleSlug: "old", at: new Date(Date.now() - 40 * day) });
    await insertPortalView(pool, { id: "pv-new-one", entryId: id, path: "/roles/new", roleSlug: "new", at: new Date(Date.now() - 2 * day) });
    expect(await sweepPortalViews(pool, new Date(Date.now() - 30 * day), 1)).toBe(1);
    const left = await read("SELECT id FROM portal_views WHERE entry_id = ?", [id]);
    expect(left.map((r) => r.id)).toEqual(["pv-new-one"]);
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
    const views = await read("SELECT COUNT(*) AS n FROM portal_views WHERE path = '/roles/garden-steward'");
    expect(Number(views[0].n)).toBe(0);
    member = false;
  });

  // ── A short look, then the code (0428) ──────────────────────────────────

  const status = async (cookie: string) => (await (await call("/api/entrance", { headers: { Cookie: cookie } })).json()) as { look: any; entered: boolean };

  it("refuses a throwaway inbox and a domain that takes no mail, with a sentence", async () => {
    const bin = await post("/api/entrance", { name: "Bin", email: "x@mailinator.com", website: "", shownAt: Date.now() - 10_000 });
    expect(bin.status).toBe(400);
    expect(((await bin.json()) as { message: string }).message).toMatch(/throwaway/);
    const none = await post("/api/entrance", { name: "None", email: "x@nomail.example", website: "", shownAt: Date.now() - 10_000 });
    expect(none.status).toBe(400);
  });

  it("sends a code and lets the visitor in at once, then a wrong code is told how many tries are left", async () => {
    mailOn = true;
    letters.length = 0;
    const res = await post("/api/entrance", { name: "Code Test", email: "code@example.org", next: "/roles", website: "", shownAt: Date.now() - 10_000 });
    expect(res.status).toBe(201);
    expect(((await res.json()) as { code: { sentTo: string } }).code).toEqual({ sentTo: "code@example.org" });
    const cookie = String(res.headers.get("set-cookie")).split(";")[0];
    expect(letters).toHaveLength(1);
    expect(letters[0].html).toMatch(/keep exploring/);
    expect((await status(cookie)).look).toMatchObject({ needsCode: true, pages: 0, lookPages: 3, lookMs: 3 * 60 * 1000, sentTo: "code@example.org" });
    // Inside the look, the reads are open.
    expect((await call("/api/roles-like", { headers: { Cookie: cookie } })).status).toBe(200);

    const real = codeIn(letters[0].html);
    const wrong = real === "000000" ? "111111" : "000000";
    const bad = await post("/api/entrance/code", { code: wrong }, cookie);
    expect(bad.status).toBe(400);
    expect(((await bad.json()) as { message: string }).message).toMatch(/4 more tries/);

    // Said yes before the code: no list yet.
    brevoCalls.length = 0;
    await post("/api/entrance/updates", { answer: "yes", words: "q" }, cookie);
    await new Promise((r) => setTimeout(r, 50));
    expect(brevoCalls).toEqual([]);

    const good = await post("/api/entrance/code", { code: `${real.slice(0, 3)} ${real.slice(3)}` }, cookie);
    expect(good.status).toBe(200);
    expect(((await good.json()) as { token?: string }).token).toBeUndefined();
    expect((await rowFor("code@example.org")).verified_at).not.toBeNull();
    expect((await status(cookie)).look).toBeNull();
    // The code, once taken, never works again.
    expect((await post("/api/entrance/code", { code: real }, cookie)).status).toBe(410);
    // And the yes now reaches the list.
    await new Promise((r) => setTimeout(r, 100));
    expect(brevoCalls.length).toBeGreaterThan(0);
  });

  it("closes the look after its time on the server too, and asks for the code by name", async () => {
    mailOn = true;
    const res = await post("/api/entrance", { name: "Slow Test", email: "slow@example.org", website: "", shownAt: Date.now() - 10_000 });
    const cookie = String(res.headers.get("set-cookie")).split(";")[0];
    clock = 5 * 60 * 1000;
    // Past the entry checker's short memory of the answer.
    await new Promise((r) => setTimeout(r, 5200));
    const shut = await call("/api/roles-like", { headers: { Cookie: cookie } });
    expect(shut.status).toBe(401);
    expect(((await shut.json()) as { error: string }).error).toBe("code_required");
    // The way back is still open: the status, and a new code.
    expect((await status(cookie)).look).toMatchObject({ needsCode: true });
    expect((await post("/api/entrance/code/resend", {}, cookie)).status).toBe(200);
    clock = 0;
  }, 15_000);

  it("spends a code after five wrong tries, and asks a moment before sending another", async () => {
    mailOn = true;
    letters.length = 0;
    const res = await post("/api/entrance", { name: "Try Test", email: "try@example.org", website: "", shownAt: Date.now() - 10_000 });
    const cookie = String(res.headers.get("set-cookie")).split(";")[0];
    const real = codeIn(letters[0].html);
    const wrong = real === "000000" ? "111111" : "000000";
    for (let i = 0; i < 4; i++) expect((await post("/api/entrance/code", { code: wrong }, cookie)).status).toBe(400);
    expect((await post("/api/entrance/code", { code: wrong }, cookie)).status).toBe(410);
    expect((await post("/api/entrance/code", { code: real }, cookie)).status).toBe(410);
    expect((await post("/api/entrance/code/resend", {}, cookie)).status).toBe(429);
  });

  it("signs in an address that already has an account, and makes no second one", async () => {
    mailOn = true;
    letters.length = 0;
    const res = await post("/api/entrance", { name: "Ana", email: "member@example.org", website: "", shownAt: Date.now() - 10_000 });
    const cookie = String(res.headers.get("set-cookie")).split(";")[0];
    expect(letters[0].html).toMatch(/sign in/);
    const ok = await post("/api/entrance/code", { code: codeIn(letters[0].html) }, cookie);
    expect(((await ok.json()) as { token: string }).token).toBe("token:u-ana:member@example.org:2");
    expect((await rowFor("member@example.org")).user_id).toBe("u-ana");
    expect(accounts.size).toBe(1);
  });

  it("asks no code while the village cannot send email, as before", async () => {
    mailOn = false;
    letters.length = 0;
    const res = await post("/api/entrance", { name: "Quiet Test", email: "quiet@example.org", website: "", shownAt: Date.now() - 10_000 });
    expect(((await res.json()) as { code: unknown }).code).toBeNull();
    expect(letters).toEqual([]);
    const cookie = String(res.headers.get("set-cookie")).split(";")[0];
    expect((await status(cookie)).look).toBeNull();
  });

  it("records a Google visitor as verified, with no account, and lands them on the keep-in-touch question", async () => {
    const visit = portalGoogleVisitor({ getPool: () => pool, secret: SECRET });
    const out = await visit({ name: "Gee Test", email: "gee@example.org", next: "/roles?x=1#top", secure: false });
    expect(out.next).toBe("/roles?x=1&keep-in-touch=1#top");
    expect(out.cookie).toMatch(/^vos_portal=/);
    const row = await rowFor("gee@example.org");
    expect(row.human).toBe("google");
    expect(row.verified_at).not.toBeNull();
    expect(Number(row.code_required)).toBe(0);
  });
});
