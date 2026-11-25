/**
 * ONE ACCOUNT, MORE THAN ONE ADDRESS (0430), on a real schema: attaching an
 * address only by the code mailed to it, the refusals, sign-in lookups by any
 * attached address, the delivery choice applied by the post office, making an
 * extra address the main one, removing one, a reset asked at an extra address,
 * the admin's read-only view and the erasure.
 */
import http from "node:http";
import express from "express";
import type mysql from "mysql2/promise";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { OutgoingEmail } from "../../shared/comms/contracts";
import { EMAIL_CODE_TRIES } from "../../shared/memberEmails";
import { provisionTestDb, testDbConfigured, type TestDb, testPool } from "../db/testDb";
import { post, type CommsMode, type PostOfficeDeps } from "../lib/comms/postOffice";
import type { Transport, TransportMessage } from "../lib/comms/transport";
import { ADDRESS_REFUSAL } from "../lib/memberEmails";
import { forgetMemberEmails, ownerOfAddress } from "../repos/memberEmails";
import { usersRepo } from "../repos/users";
import { register as registerRecovery } from "./authRecovery";
import { register } from "./memberEmails";

const configured = testDbConfigured();
if (!configured) console.warn("[memberEmails] TEST_DATABASE_URL not set - DB cases SKIPPED. A skip is not a pass.");

const SECRET = "s".repeat(64);
const LIVE: CommsMode = { lifecycle: "members", paused: false, rehearsalTo: [] };

describe.skipIf(!configured)("one account, more than one address, on a real schema", () => {
  let db: TestDb;
  let pool: mysql.Pool;
  let server: http.Server;
  let base = "";
  const letters: Array<{ to: string[]; subject: string; text?: string; html: string; origin?: string }> = [];
  const audits: string[] = [];
  const admins = new Set<string>();
  /** The newest code mailed to each address, read off the letter as it was sent. */
  const codes = new Map<string, string>();
  const capture = async (o: { to: string[]; subject: string; html: string; text?: string; origin?: string }) => {
    letters.push(o);
    const m = /Your code: (\d{6})/.exec(String(o.text ?? ""));
    if (m) codes.set(o.to[0], m[1]);
    return { sent: true };
  };
  const q = (sql: string, args: unknown[] = []) => pool.query<any[]>(sql, args).then(([rows]) => rows); // module-review-ok: fixture SQL on the scratch schema this suite provisioned
  let members: ReturnType<typeof usersRepo>;

  const call = (method: string, path: string, as: string | null, body?: unknown) =>
    new Promise<{ status: number; body: any }>((resolve, reject) => {
      const payload = body === undefined ? undefined : JSON.stringify(body);
      const req = http.request(
        `${base}${path}`,
        { method, headers: { "Content-Type": "application/json", ...(as ? { "x-test-user": as } : {}) } },
        (res) => {
          let text = "";
          res.on("data", (c) => (text += c));
          res.on("end", () => {
            let parsed: any = null;
            try {
              parsed = JSON.parse(text);
            } catch {
              parsed = null;
            }
            resolve({ status: res.statusCode ?? 0, body: parsed });
          });
        },
      );
      req.on("error", reject);
      if (payload) req.write(payload);
      req.end();
    });

  const codeFor = (address: string): string => {
    const c = codes.get(address);
    if (!c) throw new Error(`no code was mailed to ${address}`);
    return c;
  };

  const addMember = (id: string, email: string, proved = true) =>
    members.add({
      id,
      name: id,
      email,
      passwordHash: "$2b$10$abcdefghijklmnopqrstuv",
      handle: id,
      role: "member",
      tokenVersion: 0,
      paths: [],
      contributions: [],
      quests: [],
      recognitionBalance: 0,
      joinedAt: new Date().toISOString(),
      ...(proved ? { emailVerifiedAt: new Date().toISOString() } : {}),
    });

  beforeAll(async () => {
    db = await provisionTestDb();
    pool = testPool(db, { connectionLimit: 4 });
    members = usersRepo(pool);
    const app = express();
    app.use(express.json());
    register(app, {
      authSecret: SECRET,
      getPool: () => pool,
      members,
      authedUser: async (req: any) => {
        const id = req.headers["x-test-user"];
        return id ? members.byId(String(id)) : null;
      },
      isAdmin: async (req: any) => admins.has(String(req.headers["x-test-user"] ?? "")),
      overLimit: async () => false,
      clientIp: () => "203.0.113.9",
      sendEmail: capture,
      escapeHtml: (s) => s,
      projectName: () => "Riverbend",
      recordAudit: (t) => audits.push(t),
    });
    registerRecovery(app, {
      authSecret: SECRET,
      members,
      overLimit: async () => false,
      clientIp: () => "203.0.113.9",
      resetPerIpHourly: () => 100,
      sendEmail: capture,
      escapeHtml: (s) => s,
      origin: () => "https://village.example.test",
      projectName: () => "Riverbend",
      recordAudit: (t) => audits.push(t),
      attachedAddress: (email) => ownerOfAddress(pool, email),
    });
    server = await new Promise<http.Server>((resolve) => {
      const s = app.listen(0, "127.0.0.1", () => resolve(s));
    });
    base = `http://127.0.0.1:${(server.address() as any).port}`;
    await addMember("u-lead", "lead.personal@example.test");
    await addMember("u-other", "someone.else@example.test");
    await addMember("u-new", "fresh@example.test", false);
    admins.add("u-admin");
    await addMember("u-admin", "steward@example.test");
  });

  afterAll(async () => {
    await new Promise((r) => server?.close(() => r(null)));
    await pool?.end();
    await db?.drop();
  });

  beforeEach(() => {
    letters.length = 0;
  });

  it("an account whose main address was never proved cannot attach another, and learns nothing about other accounts", async () => {
    const r = await call("POST", "/api/me/email-addresses", "u-new", { email: "someone.else@example.test" });
    expect(r.status).toBe(400);
    expect(r.body.error).toBe(ADDRESS_REFUSAL.mainUnproved);
    expect(letters).toHaveLength(0);
  });

  it("refuses an address that already has its own account, and explains", async () => {
    const r = await call("POST", "/api/me/email-addresses", "u-lead", { email: "Someone.Else@example.test" });
    expect(r.status).toBe(409);
    expect(r.body.error).toBe(ADDRESS_REFUSAL.takenElsewhere);
    expect(letters).toHaveLength(0);
  });

  it("refuses a malformed address and the account's own main address", async () => {
    expect((await call("POST", "/api/me/email-addresses", "u-lead", { email: "not an address" })).body.error).toBe(ADDRESS_REFUSAL.invalid);
    expect((await call("POST", "/api/me/email-addresses", "u-lead", { email: "LEAD.personal@example.test" })).body.error).toBe(ADDRESS_REFUSAL.alreadyMain);
  });

  it("mails a code to the NEW address, and attaches nothing until the code comes back", async () => {
    const r = await call("POST", "/api/me/email-addresses", "u-lead", { email: " Ops@Village.example.test " });
    expect(r.status).toBe(200);
    expect(r.body.pending.email).toBe("ops@village.example.test");
    expect(letters).toHaveLength(1);
    expect(letters[0].to).toEqual(["ops@village.example.test"]);
    expect(letters[0].origin).toBe("auth.add_email");
    // Nothing attached yet: the address finds no account, and the owner's read shows it pending only.
    expect(await members.byEmail("ops@village.example.test")).toBeNull();
    const read = await call("GET", "/api/me/email-addresses", "u-lead");
    expect(read.body.extras).toEqual([]);
    expect(read.body.pending.email).toBe("ops@village.example.test");
    // The code is never in an answer.
    expect(JSON.stringify(r.body)).not.toContain(codeFor("ops@village.example.test"));
    expect(JSON.stringify(read.body)).not.toContain(codeFor("ops@village.example.test"));
  });

  it("a wrong code spends a try; the right one attaches the address", async () => {
    const code = codeFor("ops@village.example.test");
    const wrong = code === "000000" ? "111111" : "000000";
    const bad = await call("POST", "/api/me/email-addresses/confirm", "u-lead", { code: wrong });
    expect(bad.status).toBe(400);
    expect(bad.body.code).toBe("wrong");
    const good = await call("POST", "/api/me/email-addresses/confirm", "u-lead", { code });
    expect(good.status).toBe(200);
    expect(good.body.emails.extras.map((e: any) => e.email)).toEqual(["ops@village.example.test"]);
    expect(good.body.emails.pending).toBeNull();
    expect(audits).toContain("auth:email-attached");
    // A spent code does not work twice.
    expect((await call("POST", "/api/me/email-addresses/confirm", "u-lead", { code })).body.code).toBe("none");
  });

  it("every lookup by address reaches the same account: sign-in, sign-up's 'already exists', and the case does not matter", async () => {
    expect((await members.byEmail("OPS@village.example.test"))?.id).toBe("u-lead");
    expect((await members.byEmail("lead.personal@example.test"))?.id).toBe("u-lead");
    expect(await members.existsByEmail("ops@village.example.test")).toBe(true);
    expect(await members.existsByEmail("nobody@example.test")).toBe(false);
  });

  it("another account cannot attach an address that is already attached here", async () => {
    const r = await call("POST", "/api/me/email-addresses", "u-other", { email: "ops@village.example.test" });
    expect(r.status).toBe(409);
    expect(r.body.error).toBe(ADDRESS_REFUSAL.takenElsewhere);
  });

  it("five wrong codes spend the code, and a new one must be asked for", async () => {
    await call("POST", "/api/me/email-addresses", "u-other", { email: "other.work@example.test" });
    const right = codeFor("other.work@example.test");
    const wrong = right === "000000" ? "111111" : "000000";
    for (let i = 0; i < EMAIL_CODE_TRIES; i++) expect((await call("POST", "/api/me/email-addresses/confirm", "u-other", { code: wrong })).body.code).toBe("wrong");
    expect((await call("POST", "/api/me/email-addresses/confirm", "u-other", { code: right })).body.code).toBe("spent");
    expect(await members.byEmail("other.work@example.test")).toBeNull();
  });

  it("the post office sends a member's mail where they chose: main, the other address, or both; essential mail goes where it was addressed", async () => {
    const sent: TransportMessage[] = [];
    const transport: Transport = { name: "resend", send: async (m) => (sent.push(m), { ok: true, providerId: `p-${sent.length}` }) };
    const office: PostOfficeDeps = {
      getPool: () => pool,
      transport,
      sender: () => "Village <hello@village.example.test>",
      hasApiKey: () => true,
      origin: () => "https://village.example.test",
      mode: async () => LIVE,
      dial: () => 50,
    };
    let n = 0;
    const notice = (kind: OutgoingEmail["kind"] = "notices"): OutgoingEmail => ({
      idempotencyKey: `me-test:${++n}`,
      kind,
      origin: "notify.immediate",
      to: { email: "lead.personal@example.test", userId: "u-lead" },
      subject: "A decision",
      html: "<p>hi</p>",
      text: "",
      urgent: true,
    });
    const to = () => sent.map((m) => m.to).flat();

    await post(office, notice());
    expect(to()).toEqual(["lead.personal@example.test"]);

    sent.length = 0;
    expect((await call("PUT", "/api/me/email-addresses/delivery", "u-lead", { delivery: "other" })).body.emails.deliversTo).toEqual(["ops@village.example.test"]);
    await post(office, notice());
    expect(to()).toEqual(["ops@village.example.test"]);

    sent.length = 0;
    await call("PUT", "/api/me/email-addresses/delivery", "u-lead", { delivery: "both" });
    const both = await post(office, notice());
    expect(both.status).toBe("sent");
    expect(to().sort()).toEqual(["lead.personal@example.test", "ops@village.example.test"]);

    // Essential mail is never redirected: it goes to the address that asked.
    sent.length = 0;
    await post(office, notice("essential"));
    expect(to()).toEqual(["lead.personal@example.test"]);

    // An email addressed on purpose to a particular address is left alone.
    sent.length = 0;
    await post(office, { ...notice(), to: { email: "steward@example.test", userId: "u-lead" } });
    expect(to()).toEqual(["steward@example.test"]);

    await call("PUT", "/api/me/email-addresses/delivery", "u-lead", { delivery: "other" });
  });

  it("a reset asked at an extra address goes to that address, as it was proved", async () => {
    await call("POST", "/api/auth/forgot-password", null, { email: "OPS@village.example.test" });
    await new Promise((r) => setTimeout(r, 50));
    const reset = letters.filter((l) => l.origin === "auth.reset");
    expect(reset).toHaveLength(1);
    expect(reset[0].to).toEqual(["ops@village.example.test"]);
    letters.length = 0;
    await call("POST", "/api/auth/forgot-password", null, { email: "lead.personal@example.test" });
    await new Promise((r) => setTimeout(r, 50));
    expect(letters.filter((l) => l.origin === "auth.reset")[0].to).toEqual(["lead.personal@example.test"]);
  });

  it("an admin reads the addresses and the choice, never the pending code, and has no way to attach one", async () => {
    await call("POST", "/api/me/email-addresses", "u-lead", { email: "third@example.test" });
    const r = await call("GET", "/api/admin/members/u-lead/email-addresses", "u-admin");
    expect(r.status).toBe(200);
    expect(r.body.main).toBe("lead.personal@example.test");
    expect(r.body.extras.map((e: any) => e.email)).toEqual(["ops@village.example.test"]);
    expect(r.body.delivery).toBe("other");
    expect(r.body).not.toHaveProperty("pending");
    expect((await call("GET", "/api/admin/members/u-lead/email-addresses", "u-other")).status).toBe(401);
    expect((await call("POST", "/api/admin/members/u-lead/email-addresses", "u-admin", { email: "x@example.test" })).status).toBe(404);
  });

  it("making the other address the main one keeps both, keeps the proof, and keeps the mail going to it", async () => {
    const r = await call("POST", "/api/me/email-addresses/main", "u-lead", { email: "ops@village.example.test" });
    expect(r.status).toBe(200);
    expect(r.body.emails.main).toBe("ops@village.example.test");
    expect(r.body.emails.mainVerified).toBe(true);
    expect(r.body.emails.extras.map((e: any) => e.email)).toEqual(["lead.personal@example.test"]);
    // Mail went to "the other address", which is now the main one.
    expect(r.body.emails.delivery).toBe("main");
    expect(r.body.emails.deliversTo).toEqual(["ops@village.example.test"]);
    expect((await members.byEmail("lead.personal@example.test"))?.id).toBe("u-lead");
    expect((await members.byId("u-lead"))?.email).toBe("ops@village.example.test");
  });

  it("removing the address mail went to brings the mail home to the main address; the main address cannot be removed", async () => {
    await call("PUT", "/api/me/email-addresses/delivery", "u-lead", { delivery: "both" });
    const r = await call("DELETE", `/api/me/email-addresses/${encodeURIComponent("lead.personal@example.test")}`, "u-lead");
    expect(r.status).toBe(200);
    expect(r.body.emails.extras).toEqual([]);
    expect(r.body.emails.delivery).toBe("main");
    expect(await members.byEmail("lead.personal@example.test")).toBeNull();
    const main = await call("DELETE", `/api/me/email-addresses/${encodeURIComponent("ops@village.example.test")}`, "u-lead");
    expect(main.status).toBe(400);
  });

  it("the erasure takes every extra address and the choice with the person", async () => {
    await q("INSERT INTO member_emails (email, user_id, verified_at) VALUES ('gone@example.test', 'u-other', NOW(3))");
    await q("UPDATE users SET email_delivery = 'both' WHERE id = 'u-other'");
    await forgetMemberEmails(pool, "u-other");
    expect(await q("SELECT * FROM member_emails WHERE user_id = 'u-other'")).toEqual([]);
    expect((await q("SELECT email_delivery FROM users WHERE id = 'u-other'"))[0].email_delivery).toBeNull();
  });

});
