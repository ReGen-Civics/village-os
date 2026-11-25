/**
 * A VISITOR'S PROFILE, OVER REAL HTTP AND A REAL SCHEMA (migration 0434; the routes are
 * server/routes/visitorProfile.ts, registered by the entrance).
 *
 * The whole journey the lead asked for (25 Nov 2026), in order:
 *   - a visitor enters, confirms the code, and has a profile with nothing made but their entry;
 *   - they leave, and sign back in on another device with their email and a fresh code;
 *     an address we do not know gets the same answer and no letter;
 *   - they change their details, and their keep-in-touch answer;
 *   - an application sent from the address shows; withdraw stamps it decided (so the tidy job takes
 *     the name off 90 days later); edit withdraws and answers a draft to reopen the form with;
 *   - they ask for an invitation; Admin lists it; promote makes a member account, verified, admitted
 *     by a super vouch on the promoter's name, and emails a link to set a password; decline leaves
 *     words on the profile and a date to ask again;
 *   - delete withdraws what still waits and removes everything else;
 *   - a visitor who came by Google signs back in with Google onto the profile they have.
 *
 * Every name and address is fake.
 */
import http from "node:http";
import express from "express";
import type { Pool } from "mysql2/promise";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { provisionTestDb, testDbConfigured, testPool, type TestDb } from "../db/testDb";
import { portalGoogleVisitor, portalVisitorKnown, register } from "./entrance";
import { draftFromApplication } from "./visitorProfile";

const configured = testDbConfigured();
const SECRET = "test-secret-for-the-visitor-routes-only"; // module-review-ok: a test fixture key for the HMAC, never a real credential

describe.skipIf(!configured)("a visitor's profile, over HTTP", () => {
  let db: TestDb;
  let pool: Pool;
  let server: http.Server;
  let base = "";
  let steward = false;
  let mayAdmit = true;
  const letters: { to: string; subject: string; html: string }[] = [];
  const accounts = new Map<string, any>();
  const codeIn = (html: string) => (/(\d{3}) (\d{3})/.exec(html) ?? []).slice(1).join("");

  beforeAll(async () => {
    db = await provisionTestDb();
    pool = testPool(db, { connectionLimit: 4 });
    // The steward who promotes: a real row, since a vouch names its voucher.
    await pool.query("INSERT INTO users (id, name, email, password_hash) VALUES ('u-steward', 'Steward Test', 'steward@example.test', 'x')"); // module-review-ok: fixture SQL on the scratch schema this suite provisioned
    const app = express();
    app.use(express.json());
    register(app, {
      getPool: () => pool,
      authedUser: async () => (steward ? { id: "u-steward", tokenVersion: 0 } : null),
      boolVar: (k) => k === "entrance.required",
      stringVar: () => "",
      numberVar: () => 0,
      turnstileSecret: () => "",
      secret: SECRET,
      clientIp: () => "203.0.113.9",
      overLimit: async () => false,
      guardCapability: async (_req, res, cap) => {
        if (cap === "member.superVouch" && !mayAdmit) {
          res.status(403).json({ error: "forbidden" });
          return false;
        }
        if (!steward) {
          res.status(401).json({ error: "auth_required" });
          return false;
        }
        return true;
      },
      brevo: { apiKey: () => "", listId: () => 0 },
      isAgent: async () => false,
      passToken: () => "",
      mail: {
        ready: () => true,
        sendEmail: async (o) => {
          letters.push({ to: o.to[0], subject: o.subject, html: o.html });
          return { sent: true };
        },
        escapeHtml: (x) => x,
        projectName: () => "Test Village",
        origin: () => "https://village.example",
      },
      roleNames: async () => new Map([["r-gate", "Gate Keeper"]]),
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
        add: async (m) => {
          accounts.set(String(m.email).toLowerCase(), { ...m, tokenVersion: 0 });
          await pool.query("INSERT INTO users (id, name, email, password_hash) VALUES (?, ?, ?, '')", [m.id, m.name, m.email]); // module-review-ok: the test's stand-in for the members store, on its scratch schema
          return m;
        },
        makeHandle: async (name) => name.toLowerCase().replace(/\s+/g, "-"),
      },
      mailLookup: { resolveMx: async () => [{ exchange: "mx" }], resolve4: async () => [] },
    });
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
  const read = async (sql: string, args: unknown[] = []) => (await pool.query<any[]>(sql, args))[0]; // module-review-ok: a test reading back its own scratch schema
  const cookiesOf = (res: Response): string[] => (res.headers.getSetCookie?.() ?? []).map((c) => c.split(";")[0]);
  const send = (path: string, method: string, body: unknown, cookie = "") =>
    call(path, { method, headers: { "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}) }, body: JSON.stringify(body) });
  const me = async (cookie: string) => (await call("/api/visitor/me", { headers: { Cookie: cookie } })).json() as Promise<{ profile?: any; error?: string }>;

  /** Enter and confirm the code: a verified visitor's entry cookie. */
  async function enterAndVerify(name: string, email: string): Promise<string> {
    letters.length = 0;
    const res = await send("/api/entrance", "POST", { name, email, website: "", shownAt: Date.now() - 10_000, consentWords: "words" });
    expect(res.status).toBe(201);
    const cookie = cookiesOf(res).find((c) => c.startsWith("vos_portal="))!;
    const ok = await send("/api/entrance/code", "POST", { code: codeIn(letters[0].html) }, cookie);
    expect(ok.status).toBe(200);
    return cookie;
  }

  let cookie = "";

  it("gives a verified visitor a profile, and an unverified one none", async () => {
    letters.length = 0;
    const early = await send("/api/entrance", "POST", { name: "Early Test", email: "early@example.org", website: "", shownAt: Date.now() - 10_000 });
    const earlyCookie = cookiesOf(early).find((c) => c.startsWith("vos_portal="))!;
    expect((await call("/api/visitor/me", { headers: { Cookie: earlyCookie } })).status).toBe(401);

    cookie = await enterAndVerify("Rowan Visitor", "rowan@example.org");
    const { profile } = await me(cookie);
    expect(profile).toMatchObject({ name: "Rowan Visitor", email: "rowan@example.org", applications: [], invite: null, viaGoogle: false });
    expect(accounts.size).toBe(0);
  });

  it("signs a visitor back in on another device with their email and a fresh code, and tells a stranger nothing", async () => {
    letters.length = 0;
    const stranger = await send("/api/visitor/sign-in", "POST", { email: "nobody@example.org" });
    const known = await send("/api/visitor/sign-in", "POST", { email: "ROWAN@example.org" });
    expect(await stranger.json()).toEqual(await known.clone().json());
    expect(letters.map((l) => l.to)).toEqual(["rowan@example.org"]);
    const pending = cookiesOf(known).find((c) => c.startsWith("vos_visitor_signin="))!;
    expect(pending).toBeTruthy();
    expect((await send("/api/visitor/sign-in/code", "POST", { code: "000000" === codeIn(letters[0].html) ? "111111" : "000000" }, pending)).status).toBe(400);
    const ok = await send("/api/visitor/sign-in/code", "POST", { code: codeIn(letters[0].html) }, pending);
    expect(ok.status).toBe(200);
    const fresh = cookiesOf(ok).find((c) => c.startsWith("vos_portal=") && c.length > "vos_portal=".length)!;
    expect((await me(fresh)).profile.email).toBe("rowan@example.org");
    cookie = fresh;
  });

  it("lets the visitor change what they gave us, and their keep-in-touch answer", async () => {
    const res = await send("/api/visitor/me", "PATCH", { name: "Rowan Oak", whatsapp: "+506 8888 7777", interest: "home", updates: "no" }, cookie);
    expect(res.status).toBe(200);
    const { profile } = (await res.json()) as { profile: any };
    expect(profile).toMatchObject({ name: "Rowan Oak", whatsapp: "+506 8888 7777", interest: "home", updates: "no" });
    expect((await send("/api/visitor/me", "PATCH", { whatsapp: "call me" }, cookie)).status).toBe(400);
  });

  it("shows the applications sent from the address, withdraws one, and edits another by withdrawing it into a draft", async () => {
    const body = { roles: [{ roleId: "r-gate", note: "", commitmentPct: 60 }], why: "I keep gates.", aim: "Open at dawn.", about: { based: "Dominical", languages: "es, en", story: "A story." }, knowUs: ["visit"] };
    for (const id of ["opp-one", "opp-two"]) {
      await pool.query("INSERT INTO open_role_proposals (id, name, email, email_key, status, body_json, confirm_hash, created_at) VALUES (?, 'Rowan Oak', 'rowan@example.org', 'rowan@example.org', 'confirmed', ?, 'h', NOW())", [id, JSON.stringify(body)]); // module-review-ok: fixture SQL on the scratch schema this suite provisioned
    }
    const { profile } = await me(cookie);
    expect(profile.applications.map((a: any) => [a.roles, a.status, a.open])).toEqual([
      [["Gate Keeper"], "confirmed", true],
      [["Gate Keeper"], "confirmed", true],
    ]);

    expect((await send("/api/visitor/me/applications/opp-one/withdraw", "POST", {}, cookie)).status).toBe(200);
    const [one] = await read("SELECT status, decided_at FROM open_role_proposals WHERE id = 'opp-one'");
    expect(one.status).toBe("withdrawn");
    expect(one.decided_at).not.toBeNull();
    expect((await send("/api/visitor/me/applications/opp-one/withdraw", "POST", {}, cookie)).status).toBe(409);

    const edit = await send("/api/visitor/me/applications/opp-two/edit", "POST", {}, cookie);
    expect(edit.status).toBe(200);
    const { resume } = (await edit.json()) as { resume: string };
    expect(resume).toMatch(/^\/propose-a-role#resume=[A-Za-z0-9_-]{43}$/);
    const [two] = await read("SELECT status FROM open_role_proposals WHERE id = 'opp-two'");
    expect(two.status).toBe("withdrawn");
    const [draft] = await read("SELECT role_id, email, body FROM application_drafts ORDER BY created_at DESC LIMIT 1");
    expect(draft.role_id).toBe("r-gate");
    const kept = typeof draft.body === "string" ? JSON.parse(draft.body) : draft.body;
    expect(kept).toMatchObject({ why: "I keep gates.", aim: "Open at dawn.", about: { based: "Dominical" }, email: "rowan@example.org" });

    // Somebody else's application is never theirs to touch.
    await pool.query("INSERT INTO open_role_proposals (id, name, email, email_key, status, body_json, confirm_hash, created_at) VALUES ('opp-other', 'Other', 'other@example.org', 'other@example.org', 'confirmed', '{}', 'h', NOW())"); // module-review-ok: fixture SQL on the scratch schema this suite provisioned
    expect((await send("/api/visitor/me/applications/opp-other/withdraw", "POST", {}, cookie)).status).toBe(409);
  });

  it("takes a request for an invitation once, and Admin promotes it into a verified member with a letter", async () => {
    const asked = await send("/api/visitor/me/invitation", "POST", { note: "I would love to help." }, cookie);
    expect(asked.status).toBe(200);
    expect(((await asked.json()) as any).profile.invite).toMatchObject({ status: "requested", note: "I would love to help." });
    expect((await send("/api/visitor/me/invitation", "POST", {}, cookie)).status).toBe(409);

    // Not signed in: Admin's list is refused.
    expect((await call("/api/admin/visitors/invitations")).status).toBe(401);
    steward = true;
    const list = (await (await call("/api/admin/visitors/invitations")).json()) as { requests: any[] };
    const req = list.requests.find((r) => r.email === "rowan@example.org");
    expect(req).toMatchObject({ name: "Rowan Oak", note: "I would love to help.", hasAccount: false });

    mayAdmit = false;
    expect((await send("/api/admin/visitors/invitations/promote", "POST", { ids: [req.visitorId] })).status).toBe(403);
    mayAdmit = true;
    letters.length = 0;
    const promoted = await send("/api/admin/visitors/invitations/promote", "POST", { ids: [req.visitorId] });
    expect(((await promoted.json()) as any).results).toEqual([{ id: req.visitorId, ok: true, emailed: true }]);
    const member = accounts.get("rowan@example.org");
    expect(member).toMatchObject({ name: "Rowan Oak", membershipGranted: true, passwordHash: "" });
    expect(member.emailVerifiedAt).toBeTruthy();
    const [vouch] = await read("SELECT voucher_user_id, kind FROM member_vouches WHERE vouched_user_id = ?", [member.id]);
    expect(vouch).toMatchObject({ voucher_user_id: "u-steward", kind: "super" });
    expect(letters.map((l) => l.to)).toEqual(["rowan@example.org"]);
    expect(letters[0].html).toContain("https://village.example/set-password?token=");
    expect(letters[0].html).toContain("https://village.example/profile");
    // Answered once: a second promote of the same request does nothing.
    expect(((await (await send("/api/admin/visitors/invitations/promote", "POST", { ids: [req.visitorId] })).json()) as any).results[0].ok).toBe(false);
    expect((await me(cookie)).profile.invite.status).toBe("promoted");
    steward = false;
  });

  it("declines with words the visitor reads, and lets them ask again only after 30 days", async () => {
    const other = await enterAndVerify("Sky Visitor", "sky@example.org");
    await send("/api/visitor/me/invitation", "POST", {}, other);
    steward = true;
    const list = (await (await call("/api/admin/visitors/invitations")).json()) as { requests: any[] };
    const req = list.requests.find((r) => r.email === "sky@example.org");
    await send("/api/admin/visitors/invitations/decline", "POST", { ids: [req.visitorId], words: "Not yet: come to a gathering first." });
    steward = false;
    const { profile } = await me(other);
    expect(profile.invite).toMatchObject({ status: "declined", declineWords: "Not yet: come to a gathering first." });
    expect(Date.parse(profile.invite.askAgainFrom) - Date.now()).toBeGreaterThan(29 * 24 * 60 * 60 * 1000);
    expect((await send("/api/visitor/me/invitation", "POST", {}, other)).status).toBe(409);
  });

  it("deletes everything on the visitor's word, withdrawing what still waits", async () => {
    const gone = await enterAndVerify("Moss Visitor", "moss@example.org");
    await pool.query("INSERT INTO open_role_proposals (id, name, email, email_key, status, body_json, confirm_hash, created_at) VALUES ('opp-moss', 'Moss', 'moss@example.org', 'moss@example.org', 'confirmed', '{}', 'h', NOW())"); // module-review-ok: fixture SQL on the scratch schema this suite provisioned
    await send("/api/visitor/me/invitation", "POST", {}, gone);
    expect((await send("/api/visitor/me", "DELETE", { confirm: "delete" }, gone)).status).toBe(400);
    const res = await send("/api/visitor/me", "DELETE", { confirm: "DELETE" }, gone);
    expect(await res.json()).toMatchObject({ ok: true, withdrawn: 1 });
    expect(await read("SELECT id FROM portal_entries WHERE email_key = 'moss@example.org'")).toEqual([]);
    expect(await read("SELECT id FROM portal_visitors WHERE email_key = 'moss@example.org'")).toEqual([]);
    const [app] = await read("SELECT status, decided_at FROM open_role_proposals WHERE id = 'opp-moss'");
    expect(app.status).toBe("withdrawn");
    expect(app.decided_at).not.toBeNull();
    expect((await call("/api/visitor/me", { headers: { Cookie: gone } })).status).toBe(401);
  });

  it("signs a Google visitor back in with Google onto the profile they have, with no new entry", async () => {
    const visit = portalGoogleVisitor({ getPool: () => pool, secret: SECRET });
    const known = portalVisitorKnown({ getPool: () => pool });
    expect(await known("gee@example.org")).toBe(false);
    const first = await visit({ name: "Gee Test", email: "gee@example.org", next: "/roles", secure: false });
    expect(first.next).toBe("/roles?keep-in-touch=1");
    expect(await known("GEE@example.org")).toBe(true);
    const again = await visit({ name: "Gee Test", email: "gee@example.org", next: "/profile", secure: false });
    expect(again.next).toBe("/visitor");
    expect(await read("SELECT id FROM portal_entries WHERE email_key = 'gee@example.org'")).toHaveLength(1);
    const c = again.cookie.split(";")[0];
    expect((await me(c)).profile).toMatchObject({ email: "gee@example.org", viaGoogle: true });
  });
});

describe("an application's answers as the form's draft", () => {
  it("carries the applicant's own words, the roles and their terms, and nothing third-party", () => {
    const d = draftFromApplication(
      {
        roles: [{ roleId: "r-a", commitmentPct: 40 }, { roleId: "r-b", commitmentPct: 20 }],
        why: "Why.",
        aim: "Aim.",
        about: { based: "Here", languages: "es", story: "Story" },
        links: [{ label: "Site", url: "https://example.org" }],
        references: [{ name: "Somebody Else" }],
        backgroundCheck: { needed: true },
      },
      { name: "Ana", email: "ana@example.org" },
      new Date("2026-11-25T00:00:00Z"),
    );
    expect(d).toMatchObject({ why: "Why.", aim: "Aim.", name: "Ana", email: "ana@example.org", about: { based: "Here" }, terms: { commitmentPct: 40 }, extras: [{ roleId: "r-b", terms: { commitmentPct: 20 } }] });
    expect(JSON.stringify(d)).not.toContain("Somebody Else");
    expect(JSON.stringify(d)).not.toContain("backgroundCheck");
  });
});
