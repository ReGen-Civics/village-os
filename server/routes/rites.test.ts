/**
 * RITES AND INVITATIONS over real HTTP and the S5 scratch schema
 * (server/routes/rites.ts). The members repo is an in-memory fake beside real
 * `users` rows; the bell and the mail are recorded, never sent.
 *
 * What is pinned:
 *   - A newcomer who came in on a sworn member's invitation is paired with
 *     them the first time their card is read.
 *   - The ceremony: lines in order from the candidate only, a witness confirms
 *     only after every line and the mark, the confirmation that reaches the
 *     count stamps the rite and its together rites once, fixes the mark and
 *     admits the member; the ring shows the mark.
 *   - Who witnesses: never the candidate; before anybody is sworn an admitted
 *     member; after, only the sworn.
 *   - A plain rite is stamped by one witness, never by the member.
 *   - The door code: made for a member who may vouch, read by a stranger as a
 *     first name, a request lands in the village's intake naming the member,
 *     and only that member answers it, with their own invitation.
 *   - The letter: the maker writes a line; a stranger with the link reads it.
 *   - Interest is taken only at a door marked interest only.
 */
import http from "node:http";
import express from "express";
import type mysql from "mysql2/promise";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { provisionTestDb, testDbConfigured, type TestDb, testPool } from "../db/testDb";
import { escapeHtml } from "../lib/comms/mailer";
import { makeInviteDoor } from "../lib/inviteDoor";
import { hashInviteToken, INVITE_DAYS, mintInviteToken } from "../lib/invites";
import { loadModuleSettings, setModuleConfig, setModuleLifecycle } from "../lib/modules";
import { claimInvite, createInviteOn } from "../repos/memberInvites";
import { loadTokenRegistry } from "../lib/ledger";
import { register, stampRiteFromModule } from "./rites";

const configured = testDbConfigured();
if (!configured) console.warn("[rites] TEST_DATABASE_URL not set - DB cases SKIPPED. A skip is not a pass.");

const CONFIG = {
  format: "village-rites/1",
  rites: [
    { id: "vow", todo: "Take the vow", done: "Took the vow", lines: ["I tend the land.", "I keep my word."], mark: true, admits: true, together: ["signed"] },
    { id: "signed", todo: "Sign the charter", done: "Signed the charter", ink: "alt" },
    { id: "met", todo: "Meet your buddy", done: "Met my buddy" },
    { id: "seven", todo: "Plant seven", done: "Planted seven", byModule: "hidden-map", pulse: false },
  ],
  welcome: { doors: [{ id: "rent", title: "Rent a week" }, { id: "buy", title: "Buy in", interestOnly: true }] },
  door: { title: "A member gave you this." },
  tokens: { record: "rec-tok" },
};

type Person = { id: string; name: string; email: string; tokenVersion: number; membershipGranted: boolean; isExample?: boolean; role?: string };
const people: Person[] = [
  { id: "u-ada", name: "Ada Stone", email: "ada@example.test", tokenVersion: 0, membershipGranted: true },
  { id: "u-bo", name: "Bo Reed", email: "bo@example.test", tokenVersion: 0, membershipGranted: true },
  { id: "u-cy", name: "Cy Moss", email: "cy@example.test", tokenVersion: 0, membershipGranted: false },
  { id: "u-di", name: "Di Fern", email: "di@example.test", tokenVersion: 0, membershipGranted: false },
  // A fresh village's founder: claimed, never admitted by any vouch or letter (QA P5-03).
  { id: "u-fay", name: "Fay Root", email: "fay@example.test", tokenVersion: 0, membershipGranted: false, role: "founder" },
];
const byId = (id: string) => people.find((p) => p.id === id) ?? null;

describe.skipIf(!configured)("rites and invitations, on a real schema", () => {
  let db: TestDb;
  let pool: mysql.Pool;
  let server: http.Server;
  let base = "";
  const state = { viewer: null as Person | null, vouchers: ["u-ada", "u-bo"], submissions: [] as any[], rung: [] as any[], sent: [] as any[] };

  const members = {
    byId: async (id: string) => (byId(id) ? { ...byId(id) } : null),
    byEmail: async (email: string) => people.find((p) => p.email === String(email).toLowerCase()) ?? null,
    all: async () => people.map((p) => ({ ...p })),
    update: async (id: string, mutate: (m: any) => void) => {
      const p = byId(id);
      if (p) mutate(p);
      return p;
    },
  };

  beforeAll(async () => {
    db = await provisionTestDb();
    pool = testPool(db, { connectionLimit: 4 });
    for (const p of people) {
      await pool.query("INSERT INTO users (id, name, email, password_hash, paths, membership_granted) VALUES (?, ?, ?, 'x', '[]', ?)", [p.id, p.name, p.email, p.membershipGranted ? 1 : 0]); // module-review-ok: fixture SQL against the S5 scratch schema
    }
    // A record token kept in hundredths, as a 2-decimal token is on the ledger (QA P5-17).
    await pool.query("INSERT IGNORE INTO tokens (slug, name, kind, decimals) VALUES ('rec-tok', 'Record Tokens', 'recognition', 2)"); // module-review-ok: fixture SQL against the S5 scratch schema
    await pool.query("INSERT INTO token_balances (account_id, token_type, balance) VALUES ('mem:u-ada', 'rec-tok', 777700)"); // module-review-ok: fixture SQL against the S5 scratch schema
    await loadTokenRegistry(pool);
    await loadModuleSettings(pool);
    await setModuleLifecycle("rites", "public", null, { sharedPasswordPosture: () => false });
    const set = await setModuleConfig("rites", CONFIG, null);
    expect(set.ok).toBe(true);
    const app = express();
    app.use(express.json());
    register(app, {
      authedUser: async () => (state.viewer ? { ...state.viewer } : null),
      isAdmin: async () => false,
      getPool: () => pool,
      members,
      mayAct: async () => ({ ok: !!state.viewer && state.vouchers.includes(state.viewer.id) }),
      overLimit: async () => false,
      clientIp: () => "127.0.0.1",
      notify: async (input: any) => {
        state.rung.push(input);
        return { fresh: true };
      },
      firstName: (name: string) => String(name).split(" ")[0],
      projectName: () => "Test Village",
      deploymentOrigin: () => "https://village.example.test",
      stageOf: async (u: any) => (u.membershipGranted ? "member" : "guest"),
      submissionsRepo: {
        all: () => state.submissions.map((s) => ({ ...s })),
        replaceAll: async (rows: any[]) => {
          state.submissions = rows.map((s) => ({ ...s }));
        },
        insert: async (row: any) => {
          state.submissions.push({ ...row });
          return row;
        },
      },
      commsPostOffice: { getPool: () => pool },
      escapeHtml,
      loadRoles: () => [],
      roleIdsFor: () => [],
      postEmail: async (email: any) => {
        state.sent.push(email);
        return { status: "sent", messageId: "m-1" };
      },
      invites: makeInviteDoor({ getPool: () => pool, members } as any),
    } as any);
    server = http.createServer(app);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const addr = server.address();
    if (!addr || typeof addr === "string") throw new Error("no port");
    base = `http://127.0.0.1:${addr.port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server?.close(() => resolve()));
    await pool?.end();
    await db?.drop();
  });

  beforeEach(() => {
    state.rung.length = 0;
  });

  const as = (id: string | null) => {
    state.viewer = id ? (byId(id) as Person) : null;
  };
  const call = async (method: string, path: string, json?: unknown) => {
    const res = await fetch(`${base}${path}`, { method, headers: { "content-type": "application/json" }, body: json === undefined ? undefined : JSON.stringify(json) }); // module-review-ok: a test calling its own local server
    return { status: res.status, body: (await res.json()) as any };
  };

  async function inviteFrom(makerId: string): Promise<{ id: string; token: string }> {
    const token = mintInviteToken();
    const id = `inv-${makerId}-${Math.random().toString(36).slice(2, 8)}`;
    const conn = await pool.getConnection();
    try {
      await createInviteOn(conn, { id, tokenHash: hashInviteToken(token), inviterUserId: makerId, days: INVITE_DAYS });
    } finally {
      conn.release();
    }
    return { id, token };
  }

  it("refuses a stranger everything but the public doors", async () => {
    as(null);
    expect((await call("GET", "/api/rites/me")).status).toBe(401);
    const pub = await call("GET", "/api/rites/public");
    expect(pub.status).toBe(200);
    expect(pub.body.welcome.doors.map((d: any) => d.id)).toEqual(["rent", "buy"]);
    expect(pub.body.counts.map((c: any) => c.label)).toEqual(["members", "circles", "quests done"]);
  });

  it("before anybody holds the admitting rite, an admitted member witnesses; the candidate never does", async () => {
    as("u-ada");
    const opened = await call("POST", "/api/rites/ceremonies", { riteId: "vow" });
    expect(opened.status, JSON.stringify(opened.body)).toBe(200);
    const id = opened.body.id;
    expect((await call("POST", `/api/rites/ceremonies/${id}/witness`, { via: "present" })).status).toBe(403);
    as("u-cy");
    expect((await call("POST", `/api/rites/ceremonies/${id}/witness`, { via: "present" })).body.error).toBe("Only an admitted member may witness.");
    as("u-bo");
    const joined = await call("POST", `/api/rites/ceremonies/${id}/witness`, { via: "call" });
    expect(joined.status).toBe(200);
    expect(joined.body.witnesses).toMatchObject([{ id: "u-bo", via: "call", confirmed: false }]);
    // A founder nobody admitted witnesses too, while nobody is sworn (QA P5-03).
    as("u-fay");
    expect((await call("POST", `/api/rites/ceremonies/${id}/witness`, { via: "present" })).status).toBe(200);

    // Lines in order, from the candidate only; the witness waits for the lines and the mark.
    expect((await call("POST", `/api/rites/ceremonies/${id}/spoken`, { line: 0 })).status).toBe(409);
    expect((await call("POST", `/api/rites/ceremonies/${id}/confirm`)).status).toBe(409);
    as("u-ada");
    expect((await call("POST", `/api/rites/ceremonies/${id}/spoken`, { line: 1 })).status).toBe(409);
    expect((await call("POST", `/api/rites/ceremonies/${id}/spoken`, { line: 0 })).body.step).toBe("speaking");
    expect((await call("POST", `/api/rites/ceremonies/${id}/spoken`, { line: 1 })).body.step).toBe("marking");
    as("u-bo");
    expect((await call("POST", `/api/rites/ceremonies/${id}/confirm`)).status).toBe(409);
    as("u-ada");
    expect((await call("POST", "/api/rites/mark", { strokes: [[[5, 5], [30, 50], [55, 5]]] })).body.path).toBe("M5 5L30 50L55 5");
    as("u-bo");
    const sworn = await call("POST", `/api/rites/ceremonies/${id}/confirm`);
    expect(sworn.body.step).toBe("sworn");

    as("u-ada");
    const card = await call("GET", "/api/rites/me");
    expect(card.body.stamps.map((s: any) => [s.id, s.state])).toEqual([["vow", "on"], ["signed", "on"], ["met", "next"], ["seven", "todo"]]);
    expect(card.body.sworn).toBe(true);
    // Whole tokens on the card: 777700 hundredths read 7,777 (QA P5-17).
    expect(card.body.tokens.record).toMatchObject({ name: "Record Tokens", n: 7777 });
    // The mark is fixed now.
    expect((await call("POST", "/api/rites/mark", { strokes: [[[1, 1], [2, 2]]] })).status).toBe(409);
    const ring = await call("GET", "/api/rites/ring");
    expect(ring.body).toMatchObject({ count: 1, marks: [{ path: "M5 5L30 50L55 5", mine: true }] });
    expect(state.rung.some((n) => n.userId === "u-ada" && n.title === "Took the vow")).toBe(true);
  });

  it("once anybody is sworn, only the sworn witness; the rite admits the newcomer", async () => {
    // Cy arrives on Ada's invitation and is paired with her on first read.
    const inv = await inviteFrom("u-ada");
    await claimInvite(pool, inv.id, "u-cy");
    as("u-cy");
    const card = await call("GET", "/api/rites/me");
    expect(card.body.buddy).toMatchObject({ id: "u-ada", name: "Ada" });
    expect(card.body.inviter).toBe("Ada");
    expect(card.body.sworn).toBe(false);

    const opened = await call("POST", "/api/rites/ceremonies", { riteId: "vow" });
    const id = opened.body.id;
    expect(state.rung.some((n) => n.userId === "u-ada" && n.type === "rite_witness_asked")).toBe(true);
    as("u-bo");
    expect((await call("POST", `/api/rites/ceremonies/${id}/witness`, { via: "present" })).body.error).toBe(
      "Only a member who has completed the village's admitting rite may witness.",
    );
    as("u-ada");
    expect((await call("POST", `/api/rites/ceremonies/${id}/witness`, { via: "present" })).status).toBe(200);
    as("u-cy");
    await call("POST", `/api/rites/ceremonies/${id}/spoken`, { line: 0 });
    await call("POST", `/api/rites/ceremonies/${id}/spoken`, { line: 1 });
    await call("POST", "/api/rites/mark", { strokes: [[[10, 10], [50, 50]]] });
    as("u-ada");
    expect((await call("POST", `/api/rites/ceremonies/${id}/confirm`)).body.step).toBe("sworn");
    expect(byId("u-cy")?.membershipGranted).toBe(true);
    const [ev] = await pool.query<any[]>("SELECT text FROM health_events WHERE kind = 'rite_stamped' ORDER BY `at` DESC, id DESC LIMIT 1"); // module-review-ok: reading the scratch schema back
    expect(ev[0].text).toBe("Cy took the vow");
  });

  it("stamps a plain rite by one witness, never by the member", async () => {
    as("u-cy");
    expect((await call("POST", "/api/rites/stamps", { userId: "u-cy", riteId: "met" })).status).toBe(403);
    as("u-ada");
    expect((await call("POST", "/api/rites/stamps", { userId: "u-cy", riteId: "met" })).body.stamped).toEqual(["met"]);
    expect((await call("POST", "/api/rites/stamps", { userId: "u-cy", riteId: "vow" })).status).toBe(400);
  });

  it("a rite another module stamps is never stamped by hand, and a quiet rite is never said in public", async () => {
    as("u-ada");
    expect((await call("POST", "/api/rites/stamps", { userId: "u-cy", riteId: "seven" })).status).toBe(403);
    expect((await call("POST", "/api/rites/ceremonies", { riteId: "seven" })).status).toBe(403);
    expect(await stampRiteFromModule("some-other-module", "u-cy", "seven")).toEqual([]);
    expect(await stampRiteFromModule("hidden-map", "u-cy", "seven")).toEqual(["seven"]);
    expect(await stampRiteFromModule("hidden-map", "u-cy", "seven")).toEqual([]);
    const [ev] = await pool.query<any[]>("SELECT COUNT(*) AS n FROM health_events WHERE kind = 'rite_stamped' AND text LIKE '%seven%'"); // module-review-ok: reading the scratch schema back
    expect(Number(ev[0].n)).toBe(0);
    as("u-cy");
    expect((await call("GET", "/api/rites/me")).body.stamps.find((s: any) => s.id === "seven").state).toBe("on");
  });

  it("fixes the mark the moment the witnesses are to confirm it", async () => {
    as("u-di");
    const id = (await call("POST", "/api/rites/ceremonies", { riteId: "vow" })).body.id;
    // Drawn early, before the lines: still the candidate's to change.
    expect((await call("POST", "/api/rites/mark", { strokes: [[[1, 1], [9, 9]]] })).status).toBe(200);
    expect((await call("POST", "/api/rites/mark", { strokes: [[[2, 2], [8, 8]]] })).status).toBe(200);
    await call("POST", `/api/rites/ceremonies/${id}/spoken`, { line: 0 });
    expect((await call("POST", `/api/rites/ceremonies/${id}/spoken`, { line: 1 })).body.step).toBe("witnessing");
    // The last line spoken over it: fixed, before any witness confirms.
    expect((await call("POST", "/api/rites/mark", { strokes: [[[3, 3], [7, 7]]] })).status).toBe(409);
    await call("POST", `/api/rites/ceremonies/${id}/set-aside`);
  });

  it("lets any sworn member pair a newcomer, and only the buddy writes the greeting", async () => {
    as("u-ada");
    expect((await call("POST", "/api/rites/buddies", { newcomerId: "u-di", buddyId: "u-bo" })).status).toBe(409);
    expect((await call("POST", "/api/rites/buddies", { newcomerId: "u-di", buddyId: "u-cy" })).status).toBe(200);
    expect((await call("PUT", "/api/rites/buddies/u-di/greeting", { greeting: "Hello" })).status).toBe(403);
    as("u-cy");
    expect((await call("PUT", "/api/rites/buddies/u-di/greeting", { greeting: "Find me by the galley." })).status).toBe(200);
    as("u-di");
    await call("POST", "/api/rites/aboard", { doorId: "rent", why: "Hands in the dirt." });
    expect((await call("POST", "/api/rites/aboard", { doorId: "nope" })).status).toBe(400);
    const card = await call("GET", "/api/rites/me");
    expect(card.body.buddy).toMatchObject({ name: "Cy", greeting: "Find me by the galley." });
    expect(card.body.aboard).toEqual({ doorId: "rent", why: "Hands in the dirt." });
  });

  it("a door code asks to join through its member, who alone answers with their own invitation", async () => {
    as("u-di");
    expect((await call("GET", "/api/rites/door")).body).toMatchObject({ mayInvite: false, code: null });
    as("u-ada");
    const mine = await call("GET", "/api/rites/door");
    expect(mine.body.code).toMatch(/^[a-hjkmnp-z2-9]{10}$/);
    expect((await call("GET", "/api/rites/door")).body.code).toBe(mine.body.code);
    as(null);
    expect((await call("GET", `/api/rites/door/${mine.body.code}`)).body.giver).toBe("Ada");
    expect((await call("GET", "/api/rites/door/zzzzzzzzzz")).status).toBe(404);
    const asked = await call("POST", `/api/rites/door/${mine.body.code}/request`, { name: "Eli Brook", email: "eli@example.test", why: "I saw your garden." });
    expect(asked.status).toBe(200);
    const sub = state.submissions.at(-1);
    expect(sub).toMatchObject({ type: "membership-request", data: { viaMember: "u-ada", name: "Eli Brook" } });
    expect(state.rung.some((n) => n.userId === "u-ada" && n.type === "rite_door_request")).toBe(true);

    as("u-bo");
    expect((await call("POST", `/api/rites/door-requests/${sub.id}/accept`)).status).toBe(403);
    as("u-ada");
    expect((await call("GET", "/api/rites/door-requests")).body.requests[0]).toMatchObject({ name: "Eli Brook", status: "new" });
    const yes = await call("POST", `/api/rites/door-requests/${sub.id}/accept`);
    expect(yes.status, JSON.stringify(yes.body)).toBe(200);
    expect(yes.body.emailed).toBe(true);
    expect(state.sent.at(-1).to.email).toBe("eli@example.test");

    // Replacing the code ends the old one.
    const fresh = await call("POST", "/api/rites/door/replace");
    expect(fresh.body.code).not.toBe(mine.body.code);
    as(null);
    expect((await call("GET", `/api/rites/door/${mine.body.code}`)).status).toBe(404);
  });

  it("an invitation carries its maker's line, and only its maker writes it", async () => {
    const inv = await inviteFrom("u-ada");
    as("u-bo");
    expect((await call("PUT", `/api/rites/letters/${inv.id}`, { line: "Come." })).status).toBe(404);
    as("u-ada");
    expect((await call("PUT", `/api/rites/letters/${inv.id}`, { line: "Saw you planting squash. Come sail." })).status).toBe(200);
    as(null);
    const letter = await call("GET", `/api/rites/letter?token=${inv.token}`);
    expect(letter.body).toMatchObject({ valid: true, inviter: "Ada", line: "Saw you planting squash. Come sail." });
    expect(letter.body.letter.title).toBe("Ada has saved you a place.");
    expect((await call("GET", "/api/rites/letter?token=" + "x".repeat(40))).body.valid).toBe(false);
  });

  it("takes names only at a door marked interest only", async () => {
    as(null);
    expect((await call("POST", "/api/rites/interest", { doorId: "rent", name: "Fay", email: "fay@example.test" })).status).toBe(404);
    expect((await call("POST", "/api/rites/interest", { doorId: "buy", name: "Fay", email: "fay@example.test" })).status).toBe(200);
    expect((await call("POST", "/api/rites/interest", { doorId: "buy", name: "Fay", email: "not an address" })).status).toBe(400);
  });
});
