/**
 * THE INVESTOR GATE, OVER REAL HTTP AND A REAL SCHEMA (migration 0440; the routes are
 * server/routes/investorAccess.ts, the contract shared/investorInterest.ts).
 *
 * The lead's ask (27 Nov 2026), in order:
 *   - a reader without access is refused by `allowed` (the summary, the packet and the page's words
 *     are refused through it in server/index.ts);
 *   - the form's name and email come from the entrance entry, locked, and are kept over what was typed;
 *   - the interest answer is stored as an `investor-interest` submission, unknown choices dropped,
 *     and the team's alert fires once; the POST is rate limited and a bot's hidden field keeps nothing;
 *   - accepting the answer lets its person in, and only them; declining takes it back; an answer from
 *     an address the entrance never proved lets nobody in.
 *
 * Every name and address is fake.
 */
import http from "node:http";
import express, { type Request } from "express";
import type { Pool } from "mysql2/promise";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { provisionTestDb, testDbConfigured, testPool, type TestDb } from "../db/testDb";
import { signEntry } from "../lib/entrance";
import { INVESTOR_INTEREST_FORM } from "../../shared/investorInterest";
import { ENTRY_COOKIE as GATE_COOKIE } from "../../shared/entrance";
import { register, INVESTOR_SECTION, type InvestorAccess } from "./investorAccess";

const configured = testDbConfigured();
const SECRET = "test-secret-for-the-investor-routes-only"; // module-review-ok: a test fixture key for the HMAC, never a real credential

describe.skipIf(!configured)("the investor gate, over HTTP", () => {
  let db: TestDb;
  let pool: Pool;
  let server: http.Server;
  let base = "";
  let gate: InvestorAccess;
  let limited = false;
  let signedIn: any = null;
  let admin = false;
  let gateOn = true;
  const rows: any[] = [];
  const alerts: any[] = [];

  beforeAll(async () => {
    db = await provisionTestDb();
    pool = testPool(db, { connectionLimit: 4 });
    const entry = async (id: string, name: string, email: string, verified: boolean, extra: { whatsapp?: string; link?: string } = {}) =>
      pool.query( // module-review-ok: fixture SQL on the scratch schema this suite provisioned
        "INSERT INTO portal_entries (id, name, email, email_key, whatsapp, link, consent_words, human, code_required, verified_at) VALUES (?, ?, ?, ?, ?, ?, 'words', 'fallback', 1, ?)",
        [id, name, email, email.toLowerCase(), extra.whatsapp ?? null, extra.link ?? null, verified ? new Date() : null],
      );
    await entry("pe-a0a0a0a0a0a0a0a0a0a0", "Ana Prueba", "Ana@Example.test", true, { whatsapp: "+506 8888 0000", link: "https://ana.example" });
    await entry("pe-b1b1b1b1b1b1b1b1b1b1", "Typed Person", "typed@example.test", false);
    const app = express();
    app.use(express.json());
    gate = register(app, {
      getPool: () => pool,
      gateOn: () => gateOn,
      secret: SECRET,
      authedUser: async () => signedIn,
      isAdmin: async () => admin,
      clientIp: () => "203.0.113.7",
      overLimit: async () => limited,
      submissions: {
        insert: async (e: any) => {
          rows.push(e);
        },
        all: () => rows,
      },
      alert: (e: any) => alerts.push(e),
    });
    // The routes server/index.ts guards with `allowed`, stood in for here by one that answers the same way.
    app.get("/guarded", async (req: Request, res) => res.status((await gate.allowed(req)) ? 200 : 403).end());
    server = http.createServer(app);
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()));
    base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  });

  afterAll(async () => {
    await new Promise<void>((r) => server?.close(() => r()));
    await pool?.end();
    await db?.drop();
  });

  beforeEach(() => {
    limited = false;
    signedIn = null;
    admin = false;
    gateOn = true;
  });

  it("lets everybody in while the village keeps its gate off, the default", async () => {
    gateOn = false;
    expect(await guarded()).toBe(200);
    expect((await (await call("/api/investor/access")).json()).access).toBe(true);
  });

  const cookie = (entryId: string) => `${GATE_COOKIE}=${encodeURIComponent(signEntry(SECRET, entryId))}`;
  const call = (path: string, init: RequestInit = {}) => fetch(base + path, init); // module-review-ok: the test's own loopback server, not an outbound call
  const post = (body: unknown, c = "") => call("/api/investor/interest", { method: "POST", headers: { "Content-Type": "application/json", ...(c ? { Cookie: c } : {}) }, body: JSON.stringify(body) });
  const guarded = async (c = "") => (await call("/guarded", c ? { headers: { Cookie: c } } : {})).status;

  it("keeps the gate closed to a stranger, a visitor and a member alike, and open to an administrator", async () => {
    expect(await guarded()).toBe(403);
    expect(await guarded(cookie("pe-a0a0a0a0a0a0a0a0a0a0"))).toBe(403);
    signedIn = { id: "u-member", name: "Mem Ber", email: "member@example.test" };
    expect(await guarded()).toBe(403);
    signedIn = null;
    admin = true;
    expect(await guarded()).toBe(200);
    expect(INVESTOR_SECTION).toBe("page-investor");
  });

  it("fills the form from the entrance entry and locks it when the address was proven", async () => {
    const proven = await (await call("/api/investor/access", { headers: { Cookie: cookie("pe-a0a0a0a0a0a0a0a0a0a0") } })).json();
    expect(proven).toEqual({ access: false, prefill: { name: "Ana Prueba", email: "Ana@Example.test", whatsapp: "+506 8888 0000", link: "https://ana.example", locked: true }, request: null });
    const typed = await (await call("/api/investor/access", { headers: { Cookie: cookie("pe-b1b1b1b1b1b1b1b1b1b1") } })).json();
    expect(typed.prefill).toEqual({ name: "Typed Person", email: "typed@example.test", whatsapp: "", link: "", locked: false });
    signedIn = { id: "u-member", name: "Mem Ber", email: "member@example.test" };
    expect((await (await call("/api/investor/access")).json()).prefill).toMatchObject({ name: "Mem Ber", email: "member@example.test", locked: true });
  });

  it("stores the answer as an investor interest submission, keeps the proven name over a typed one, and drops unknown choices", async () => {
    const r = await post({ name: "Someone Else", email: "other@example.test", accreditation: "accredited", checkSize: "100k-250k", structure: "pirate-gold", interests: ["land", "moon"], thesis: "  Long-term land stewardship. ", consent: "The words I read." }, cookie("pe-a0a0a0a0a0a0a0a0a0a0"));
    expect(r.status).toBe(200);
    const row = rows.at(-1);
    expect(row.type).toBe(INVESTOR_INTEREST_FORM);
    expect(row.status).toBe("new");
    expect(row.data).toMatchObject({ name: "Ana Prueba", email: "Ana@Example.test", accreditation: "accredited", checkSize: "100k-250k", interests: ["land"], thesis: "Long-term land stewardship.", identity: "visitor", provenEmail: "ana@example.test", consentWords: "The words I read." });
    expect(row.data.structure).toBeUndefined();
    expect(alerts.at(-1)?.id).toBe(row.id);
    const after = await (await call("/api/investor/access", { headers: { Cookie: cookie("pe-a0a0a0a0a0a0a0a0a0a0") } })).json();
    expect(after.request).toMatchObject({ status: "new" });
  });

  it("asks for a name and an address only when nothing is held, refuses a bad one, keeps nothing from a bot, and slows a flood", async () => {
    const before = rows.length;
    expect((await post({ name: "", email: "x@example.test" })).status).toBe(400);
    expect((await post({ name: "Ok", email: "not-an-address" })).status).toBe(400);
    expect((await post({ name: "Bot", email: "bot@example.test", website: "spam.example" })).status).toBe(200);
    expect(rows.length).toBe(before);
    limited = true;
    expect((await post({ name: "Ok", email: "ok@example.test" })).status).toBe(429);
    expect(rows.length).toBe(before);
  });

  it("lets the accepted visitor in, only them, and takes it back on decline", async () => {
    const row = rows.find((r) => r.data?.identity === "visitor");
    expect(await gate.decided(row, "reviewing", "u-steward")).toEqual({ letIn: null, holder: "visitor" });
    expect(await guarded(cookie("pe-a0a0a0a0a0a0a0a0a0a0"))).toBe(403);
    expect(await gate.decided(row, "accepted", "u-steward")).toEqual({ letIn: true, holder: "visitor" });
    expect(await guarded(cookie("pe-a0a0a0a0a0a0a0a0a0a0"))).toBe(200);
    expect((await (await call("/api/investor/access", { headers: { Cookie: cookie("pe-a0a0a0a0a0a0a0a0a0a0") } })).json()).access).toBe(true);
    // Somebody else, and the unproven entry, stay outside.
    expect(await guarded(cookie("pe-b1b1b1b1b1b1b1b1b1b1"))).toBe(403);
    const [kept] = await pool.query<any[]>("SELECT user_id, email_key, submission_id, granted_by FROM investor_access"); // module-review-ok: a test reading back its own scratch schema
    expect(kept).toEqual([{ user_id: null, email_key: "ana@example.test", submission_id: row.id, granted_by: "u-steward" }]);
    // Accepted twice keeps one row.
    await gate.decided(row, "accepted", "u-steward");
    expect((await pool.query<any[]>("SELECT COUNT(*) AS n FROM investor_access"))[0][0].n).toBe(1); // module-review-ok: a test reading back its own scratch schema
    expect(await gate.decided(row, "declined", "u-steward")).toEqual({ letIn: false, holder: "visitor" });
    expect(await guarded(cookie("pe-a0a0a0a0a0a0a0a0a0a0"))).toBe(403);
  });

  it("lets a member in by their account", async () => {
    signedIn = { id: "u-investor", name: "In Vestor", email: "investor@example.test" };
    await post({ checkSize: "over-5m" });
    const row = rows.at(-1);
    expect(row.userId).toBe("u-investor");
    expect(row.data.identity).toBe("account");
    expect(await guarded()).toBe(403);
    await gate.decided(row, "accepted", "u-steward");
    expect(await guarded()).toBe(200);
    signedIn = { id: "u-other", name: "Other", email: "other@example.test" };
    expect(await guarded()).toBe(403);
  });

  it("lets nobody in from an address the entrance never proved, and says so", async () => {
    await post({ name: "Typed Person", email: "typed@example.test" }, cookie("pe-b1b1b1b1b1b1b1b1b1b1"));
    const row = rows.at(-1);
    expect(row.data.identity).toBe("unverified");
    expect(row.data.provenEmail).toBeUndefined();
    expect(await gate.decided(row, "accepted", "u-steward")).toEqual({ letIn: null, holder: null });
    expect(await guarded(cookie("pe-b1b1b1b1b1b1b1b1b1b1"))).toBe(403);
  });

  it("leaves every other kind of submission alone", async () => {
    expect(await gate.decided({ id: "s1", type: "investor", userId: "u-investor", data: {} }, "accepted", "u-steward")).toBeNull();
  });
});
