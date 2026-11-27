/**
 * EACH CONVERSATION'S PRIVATE NOTES (0444; the lead, 27 Nov 2026: "a link is sent to me and other interviewers
 * (never the applicant) for the notes we have about our sessions ... or upload the whole transcript"), over real HTTP
 * and the S5 scratch schema. Nothing is sent for real: the mail door is a fake.
 *
 * What is pinned, each with a control that fails for the reason claimed:
 *   - the conversation's role, the final-call role and the power to place people in roles read and write the notes;
 *     a member outside the application, and a member holding an unrelated role, are refused
 *   - the applicant's own status door never carries a note's words, a file's name or the notes' door
 *   - the other interviewers get a bell notice with a link to the notes; the author does not, and no note words ride on it
 *   - a file goes to the private folder (never the public uploads volume) and is read back only through its door,
 *     only by a reader; anybody else gets the same 404 as a stranger
 *   - only the author takes a note off, and its file leaves the disk
 *   - the notes go with the member's erasure and with the application's review
 */
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import express from "express";
import type mysql from "mysql2/promise";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { OutgoingEmail, PostResult } from "../../shared/comms/contracts";
import { provisionTestDb, testDbConfigured, type TestDb, testPool } from "../db/testDb";
import { escapeHtml } from "../lib/comms/mailer";
import { loadVariables } from "../lib/variables";
import { createOrgRole, seatHolder } from "../lib/orgChart";
import { usersRepo } from "../repos/users";
import { clearReviewOf, forgetMemberReview } from "../repos/applicationReview";
import { register } from "./openProposals";
import { signLink } from "../lib/comms/links";

const configured = testDbConfigured();
if (!configured) console.warn("[conversationNotes] TEST_DATABASE_URL not set - DB cases SKIPPED. A skip is not a pass.");

const ORIGIN = "https://village.example.test";
const NOW_SEASON = { id: "s-now", name: "Season of Seeds", startsOn: "2000-01-01", endsOn: "2037-01-01" };
const NEXT = { id: "s-next", name: "Season of Roots", startsOn: "2037-01-01", endsOn: "2037-03-20" };
const person = (id: string, name: string) => ({ id, name, email: `${id}@example.test` });
const FOUNDER = person("u-cn-founder", "Fern Oak");
const IA = person("u-cn-ia", "Iva Alder");
const IB = person("u-cn-ib", "Ivo Birch");
const FINAL = person("u-cn-final", "Flor Lima");
const OUTSIDER = person("u-cn-out", "Olly Out");
/** An applicant with a signed-in account who also holds the operations role: the conversation's own role. */
const APPLICANT_HOLDER = { id: "u-cn-applicant", name: "Ada Apply", email: "notes-holder@example.test" };
const SECRET = "Spoke warmly about the seed library; check the budget story with the community role.";

describe.skipIf(!configured)("conversation notes, on a real schema", () => {
  let db: TestDb;
  let pool: mysql.Pool;
  let server: http.Server;
  let base = "";
  let gate = "";
  let roleA = "";
  let roleFinal = "";
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "convnotes-"));
  const notesDir = path.join(dataDir, "private-conversation-notes");

  const state = {
    viewer: null as string | null,
    sent: [] as OutgoingEmail[],
    notices: [] as Array<{ userId: string; type: string; title: string; body?: string; dedupeKey: string; link?: string | null }>,
  };

  const q = (sql: string, args: unknown[] = []) => pool.query<any[]>(sql, args).then(([rows]) => rows); // module-review-ok: fixture SQL on the scratch schema this suite provisioned
  const variable = async (key: string, value: string) => {
    await q("INSERT INTO game_variables (config_key, value) VALUES (?, ?) ON DUPLICATE KEY UPDATE value = VALUES(value)", [key, value]);
    await loadVariables(pool);
  };

  beforeAll(async () => {
    db = await provisionTestDb();
    pool = testPool(db, { connectionLimit: 8 });
    const have = new Set((await q("SELECT COLUMN_NAME AS c FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'org_roles'")).map((r: any) => String(r.c)));
    for (const col of ["conversations", "selection_criteria", "conversation_mode"]) if (!have.has(col)) await q(`ALTER TABLE org_roles ADD COLUMN ${col} text NULL`);
    const users = usersRepo(pool);
    for (const p of [FOUNDER, IA, IB, FINAL, OUTSIDER, APPLICANT_HOLDER]) await users.add({ id: p.id, name: p.name, email: p.email, passwordHash: "x", emailVerifiedAt: "2026-01-01T00:00:00.000Z", paths: [] } as any);
    await q("INSERT INTO circles (id, name, aliases, is_example) VALUES ('c-cn', 'Core Circle', '[]', 0), ('c-cn-people', 'People Circle', '[]', 0)");
    gate = await createOrgRole(pool, { id: "cn-role-lead", name: "Lead Steward", seats: 1, circleId: "c-cn", aim: "Hold the money." });
    roleA = await createOrgRole(pool, { id: "cn-role-ops", name: "Operations Role", seats: 2, circleId: "c-cn", aim: "Hold operations." });
    const roleB = await createOrgRole(pool, { id: "cn-role-data", name: "Data Role", seats: 1, circleId: "c-cn-people", aim: "Hold data." });
    roleFinal = await createOrgRole(pool, { id: "cn-role-final", name: "Final Call Role", seats: 1, circleId: "c-cn-people", aim: "Make the final call." });
    const until = new Date("2036-12-01T00:00:00Z");
    for (const [r, u] of [[roleA, IA], [roleA, APPLICANT_HOLDER], [roleB, IB], [roleFinal, FINAL]] as const) await seatHolder(pool, r, { userId: u.id, seasonId: "s-now", termEndsAt: until });
    // One conversation, held by the operations role.
    await q("UPDATE org_roles SET conversations = ? WHERE id = ?", [JSON.stringify([{ roleId: roleA, minutes: 30, final: false }]), gate]);
    await variable("org.final_call_role", roleFinal);

    const app = express();
    app.use(express.json());
    register(app, {
      getPool: () => pool,
      overLimit: async () => false,
      clientIp: () => "203.0.113.9",
      proposalFileDir: path.join(dataDir, "private-proposal-files"),
      guardCapability: async (_req: any, res: any, cap: string, refusal?: { status: number; body: unknown }) => {
        const ok = !!state.viewer && (cap === "terms.read" ? true : state.viewer === FOUNDER.id);
        if (ok) return true;
        if (refusal) res.status(refusal.status).json(refusal.body);
        else res.status(state.viewer ? 403 : 401).json({ error: state.viewer ? "forbidden" : "auth_required" });
        return false;
      },
      authedUser: async () => (state.viewer ? await usersRepo(pool).byId(state.viewer) : null),
      commsPostOffice: { getPool: () => pool },
      deploymentOrigin: () => ORIGIN,
      projectName: () => "Test Village",
      escapeHtml,
      seasonState: () => ({ current: NOW_SEASON, seasons: [NOW_SEASON, NEXT], timezone: "UTC" }),
      postEmail: async (email: OutgoingEmail) => {
        state.sent.push(email);
        return { status: "sent", messageId: "m-1" } as PostResult;
      },
      governanceLifecycle: () => "public",
      notify: async (n: any) => {
        state.notices.push(n);
        return { fresh: true };
      },
      notifyAdmins: async () => {},
      members: usersRepo(pool),
      firstName: (name: string) => String(name ?? "").trim().split(/\s+/)[0] ?? "",
      liveHoldersOf: async () => [FOUNDER.id],
      rolesCarrying: () => [],
      loadRoleHolders: () => [],
      seatCalendar: () => ({ seasons: [NOW_SEASON, NEXT], currentSeasonId: "s-now", timezone: "UTC" }),
      lapse: () => ({ currentSeasonId: "s-now", cadence: "season_turn" }),
      stageOf: async () => "guest",
      recordStageEvent: async () => {},
      sessionsOn: () => false,
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
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  beforeEach(() => {
    state.viewer = null;
    state.sent.length = 0;
    state.notices.length = 0;
  });

  const call = async (method: string, p: string, body?: unknown, as: string | null = null) => {
    state.viewer = as;
    try {
      const res = await fetch(`${base}${p}`, { // module-review-ok: a test calling its own local server, never an outside host
        method,
        headers: body === undefined ? {} : { "content-type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const text = await res.text();
      let json: any = null;
      try {
        json = JSON.parse(text);
      } catch {
        json = null;
      }
      return { status: res.status, body: json, text, headers: res.headers };
    } finally {
      state.viewer = null;
    }
  };

  const sendFile = async (p: string, kind: string, name: string, content: string, as: string) => {
    state.viewer = as;
    try {
      const fd = new FormData();
      fd.append("kind", kind);
      fd.append("file", new Blob([content], { type: "text/plain" }), name);
      const res = await fetch(`${base}${p}`, { method: "POST", body: fd }); // module-review-ok: a test calling its own local server, never an outside host
      return { status: res.status, body: (await res.json().catch(() => null)) as any };
    } finally {
      state.viewer = null;
    }
  };

  const tokenOf = (mail: OutgoingEmail) => {
    const line = mail.text.split("\n").find((l) => /https:\/\/village\.example\.test\//.test(l)) as string;
    return new URL(/(https:\/\/\S+)/.exec(line)![1]).searchParams.get("token") as string;
  };

  const confirmed = async (email: string) => {
    const before = state.sent.length;
    const r = await call("POST", "/api/open-proposals", { name: "Rowan Field", email, locale: "en", roles: [{ roleId: gate, note: "I keep books." }], why: "I want to hold the money well.", aim: "A clear budget." });
    expect(r.status, r.text).toBe(200);
    const mail = state.sent[before];
    const id = mail.idempotencyKey.split(":")[1];
    expect((await call("POST", "/api/open-proposals/confirm", { token: tokenOf(mail) })).status).toBe(200);
    return id;
  };

  const app = (id: string) => `/api/governance/applications/${id}`;
  const interviewOf = async (id: string) => Number((await q("SELECT id FROM application_interviews WHERE application_ref = ? ORDER BY position LIMIT 1", [id]))[0].id);
  const notesOf = (id: string) => q("SELECT id, author_user_id, kind, body, file_name, original_name FROM application_conversation_notes WHERE application_ref = ? ORDER BY id", [id]);

  it("the conversation's role, the final call and the power to place roles read and write; anybody else is refused", async () => {
    const id = await confirmed("notes-who@example.test");
    const iv = await interviewOf(id);
    // CONTROL: a member outside the application, and one holding an unrelated role, may not write.
    // Anybody who is not a reader gets the same 404 as a stranger (QA round 1), never a 403 that says the conversation exists.
    expect((await call("POST", `${app(id)}/interviews/${iv}/notes`, { body: SECRET }, OUTSIDER.id)).status).toBe(404);
    expect((await call("POST", `${app(id)}/interviews/${iv}/notes`, { body: SECRET }, IB.id)).status).toBe(404);
    expect(await notesOf(id)).toEqual([]);
    const ok = await call("POST", `${app(id)}/interviews/${iv}/notes`, { body: SECRET }, IA.id);
    expect(ok.status, ok.text).toBe(200);
    expect((await call("POST", `${app(id)}/interviews/${iv}/notes`, { body: "Second view." }, FINAL.id)).status).toBe(200);
    expect((await call("POST", `${app(id)}/interviews/${iv}/notes`, { body: "Third view." }, FOUNDER.id)).status).toBe(200);
    for (const reader of [IA.id, FINAL.id, FOUNDER.id]) {
      const w = await call("GET", `${app(id)}/walkthrough`, undefined, reader);
      expect(w.status).toBe(200);
      const conv = w.body.walkthrough.conversations.find((c: any) => c.interviewId === iv);
      expect(conv.notes.map((n: any) => n.body)).toEqual([SECRET, "Second view.", "Third view."]);
    }
    // An empty note is refused; nothing is written.
    expect((await call("POST", `${app(id)}/interviews/${iv}/notes`, { body: "   " }, IA.id)).status).toBe(400);
    expect(await notesOf(id)).toHaveLength(3);
  });

  it("the applicant's own status door never carries a note, a file's name or the notes' door", async () => {
    const id = await confirmed("notes-applicant@example.test");
    const iv = await interviewOf(id);
    await call("POST", `${app(id)}/interviews/${iv}/notes`, { body: SECRET }, IA.id);
    expect((await sendFile(`${app(id)}/interviews/${iv}/notes`, "transcript", "call-transcript.txt", "Full words of the call.", IA.id)).status).toBe(200);
    const token = signLink("application_status", { ref: id }, 1);
    const status = await call("GET", `/api/application-status/${id}?token=${encodeURIComponent(token)}`);
    expect(status.status, status.text).toBe(200);
    // The route sweep: none of the notes' words, file names or doors reach the applicant.
    for (const leak of [SECRET, "call-transcript.txt", "conversation-notes", "Full words of the call."]) expect(status.text).not.toContain(leak);
    // A stranger, as the applicant is without a seat, gets nothing from the team's doors.
    expect((await call("GET", `${app(id)}/walkthrough`, undefined, OUTSIDER.id)).status).toBe(404);
  });

  it("tells the other interviewers with a link, never the author, and no note words ride on it", async () => {
    const id = await confirmed("notes-bell@example.test");
    const iv = await interviewOf(id);
    await call("POST", `${app(id)}/interviews/${iv}/notes`, { body: SECRET }, IA.id);
    const told = state.notices.filter((n) => n.type === "application_conversation_notes");
    // The other holder of the operations role hears too: they interview other applicants (the fixture's applicant).
    expect(told.map((n) => n.userId).sort()).toEqual([FINAL.id, FOUNDER.id, APPLICANT_HOLDER.id].sort());
    expect(told.every((n) => String(n.link).includes(id) && String(n.link).endsWith("#conversation-notes"))).toBe(true);
    expect(JSON.stringify(told)).not.toContain("seed library");
    // CONTROL: no email goes to the applicant for a note.
    expect(state.sent.filter((m) => m.to.email === "notes-bell@example.test" && m.idempotencyKey.includes("note"))).toEqual([]);
  });

  it("keeps a file in the private folder and opens it only to a reader", async () => {
    const id = await confirmed("notes-file@example.test");
    const iv = await interviewOf(id);
    // CONTROL: a file type that does not fit its kind is refused and nothing is stored.
    expect((await sendFile(`${app(id)}/interviews/${iv}/notes`, "recording", "notes.txt", "x", IA.id)).status).toBe(400);
    expect((await sendFile(`${app(id)}/interviews/${iv}/notes`, "transcript", "call.txt", "x", OUTSIDER.id)).status).toBe(404);
    const sent = await sendFile(`${app(id)}/interviews/${iv}/notes`, "transcript", "call.txt", "Every word we said.", IA.id);
    expect(sent.status, JSON.stringify(sent.body)).toBe(200);
    const [row] = await notesOf(id);
    expect(row.original_name).toBe("call.txt");
    expect(fs.existsSync(path.join(notesDir, row.file_name))).toBe(true);
    const w = await call("GET", `${app(id)}/walkthrough`, undefined, FINAL.id);
    const href = w.body.walkthrough.conversations[0].notes[0].fileHref as string;
    expect(href).toBe(`${app(id)}/conversation-notes/${row.id}/file`);
    const read = await call("GET", href, undefined, FINAL.id);
    expect(read.status).toBe(200);
    expect(read.text).toBe("Every word we said.");
    expect(read.headers.get("content-disposition")).toContain("attachment");
    expect(read.headers.get("cache-control")).toContain("no-store");
    // Anybody else: the same 404 as a stranger.
    expect((await call("GET", href, undefined, OUTSIDER.id)).status).toBe(404);
    expect((await call("GET", href, undefined, IB.id)).status).toBe(404);
    expect((await call("GET", href)).status).toBe(401);
  });

  it("only the author takes a note off, and its file leaves the disk", async () => {
    const id = await confirmed("notes-remove@example.test");
    const iv = await interviewOf(id);
    await sendFile(`${app(id)}/interviews/${iv}/notes`, "file", "plan.pdf.txt", "x", IA.id);
    const sent = await sendFile(`${app(id)}/interviews/${iv}/notes`, "transcript", "talk.txt", "words", IA.id);
    expect(sent.status).toBe(200);
    const row = (await notesOf(id)).find((r: any) => r.original_name === "talk.txt");
    const where = path.join(notesDir, row.file_name);
    // A reader who did not write it is told why; anybody else learns nothing.
    expect((await call("DELETE", `${app(id)}/conversation-notes/${row.id}`, undefined, FOUNDER.id)).status).toBe(403);
    expect((await call("DELETE", `${app(id)}/conversation-notes/${row.id}`, undefined, OUTSIDER.id)).status).toBe(404);
    expect((await call("DELETE", `${app(id)}/conversation-notes/${row.id}`, undefined, IB.id)).status).toBe(404);
    expect(fs.existsSync(where)).toBe(true);
    expect((await call("DELETE", `${app(id)}/conversation-notes/${row.id}`, undefined, IA.id)).status).toBe(200);
    expect(fs.existsSync(where)).toBe(false);
  });

  it("goes with the member's erasure and with the application's review", async () => {
    const id = await confirmed("notes-erase@example.test");
    const iv = await interviewOf(id);
    await call("POST", `${app(id)}/interviews/${iv}/notes`, { body: SECRET }, IA.id);
    await sendFile(`${app(id)}/interviews/${iv}/notes`, "transcript", "erase.txt", "words", IA.id);
    await call("POST", `${app(id)}/interviews/${iv}/notes`, { body: "Kept by the final call." }, FINAL.id);
    const file = (await notesOf(id)).find((r: any) => r.file_name)!.file_name;
    await forgetMemberReview(pool, IA.id, new Date());
    expect((await notesOf(id)).map((r: any) => r.author_user_id)).toEqual([FINAL.id]);
    expect(fs.existsSync(path.join(notesDir, file))).toBe(false);
    await clearReviewOf(pool, [id], new Date());
    expect(await notesOf(id)).toEqual([]);
  });

  it("A TEAM NUDGE NEVER REACHES THE APPLICANT (QA pass 3), even when they hold the role up next; its other holders hear it", async () => {
    const { nudgeTick } = await import("../lib/applicantNudges");
    const id = await confirmed(APPLICANT_HOLDER.email);
    const [first] = await q("SELECT id FROM application_interviews WHERE application_ref = ? ORDER BY position", [id]);
    await q("UPDATE application_interviews SET state = 'open', opened_at = ? WHERE id = ?", [new Date(Date.now() - 4 * 86_400_000), first.id]);
    try {
      state.notices.length = 0;
      const deps: any = { getPool: () => pool, notify: async (n: any) => { state.notices.push(n); return { fresh: true }; }, notifyAdmins: async () => {}, liveHoldersOf: async () => [FOUNDER.id, APPLICANT_HOLDER.id], now: () => new Date(), members: usersRepo(pool) };
      await nudgeTick(deps);
      const nudged = state.notices.filter((n) => n.dedupeKey.startsWith(`app:${id}:nudge:conversation`)).map((n) => n.userId);
      expect(nudged).toContain(IA.id);
      expect(nudged).not.toContain(APPLICANT_HOLDER.id);
      expect(state.notices.filter((n) => n.userId === APPLICANT_HOLDER.id)).toEqual([]);
    } finally {
      await q("UPDATE open_role_proposals SET status = 'withdrawn', decided_at = NOW(3) WHERE id = ?", [id]);
    }
  });

  it("VOICE REFLECTIONS (the lead, 27 Nov 2026): a later holder hears an earlier holder's recording; never the applicant, never earlier hearing later", async () => {
    await q("UPDATE org_roles SET conversations = ? WHERE id = ?", [JSON.stringify([{ roleId: roleA, minutes: 30, final: false }, { roleId: "cn-role-data", minutes: 30, final: false }]), gate]);
    try {
      const id = await confirmed(APPLICANT_HOLDER.email);
      const [first, second] = (await q("SELECT id FROM application_interviews WHERE application_ref = ? ORDER BY position", [id])).map((r: any) => Number(r.id));
      // The Ops holder records a reflection, and writes a text note that stays with Ops's own readers.
      expect((await sendFile(`${app(id)}/interviews/${first}/notes`, "recording", "ops-reflection.mp3", "AUDIO-FROM-OPS", IA.id)).status).toBe(200);
      expect((await call("POST", `${app(id)}/interviews/${first}/notes`, { body: "TEXT-ONLY-FOR-OPS-READERS" }, IA.id)).status).toBe(200);
      // The later holder (Data, the second conversation) hears it before their call.
      const w = await call("GET", `${app(id)}/walkthrough`, undefined, IB.id);
      expect(w.status, w.text).toBe(200);
      expect(w.body.walkthrough.reflections.map((r: any) => r.role)).toEqual(["Operations Role"]);
      const href = w.body.walkthrough.reflections[0].notes[0].fileHref as string;
      const heard = await call("GET", href, undefined, IB.id);
      expect([heard.status, heard.text]).toEqual([200, "AUDIO-FROM-OPS"]);
      expect(w.text).not.toContain("TEXT-ONLY-FOR-OPS-READERS");
      // The later holder records too; the earlier holder, without the power, does not hear it.
      const later = await sendFile(`${app(id)}/interviews/${second}/notes`, "recording", "data-reflection.mp3", "AUDIO-FROM-DATA", IB.id);
      expect(later.status).toBe(200);
      const [dataNote] = await q("SELECT id FROM application_conversation_notes WHERE application_ref = ? AND interview_id = ?", [id, second]);
      expect((await call("GET", `${app(id)}/conversation-notes/${dataNote.id}/file`, undefined, IA.id)).status).toBe(404);
      expect((await call("GET", `${app(id)}/walkthrough`, undefined, IA.id)).body.walkthrough.reflections ?? []).toEqual([]);
      // The power to place roles hears both.
      expect((await call("GET", `${app(id)}/conversation-notes/${dataNote.id}/file`, undefined, FOUNDER.id)).status).toBe(200);
      // The applicant, who even holds the first conversation's role, reaches none of it.
      expect((await call("GET", `${app(id)}/walkthrough`, undefined, APPLICANT_HOLDER.id)).status).toBe(404);
      expect((await call("GET", href, undefined, APPLICANT_HOLDER.id)).status).toBe(404);
      expect((await call("GET", `${app(id)}/conversation-notes/${dataNote.id}/file`, undefined, APPLICANT_HOLDER.id)).status).toBe(404);
      // Nor set a booked date from the team's side ("I've booked it"): the stranger's 404.
      expect((await call("POST", `${app(id)}/interviews/${first}/booked`, { at: new Date(Date.now() + 86_400_000).toISOString() }, APPLICANT_HOLDER.id)).status).toBe(404);
      const own = await call("GET", `${app(id)}/status`, undefined, APPLICANT_HOLDER.id);
      for (const leak of ["AUDIO-FROM", "reflection.mp3", "conversation-notes"]) expect(own.text).not.toContain(leak);
    } finally {
      await q("UPDATE org_roles SET conversations = ? WHERE id = ?", [JSON.stringify([{ roleId: roleA, minutes: 30, final: false }]), gate]);
      // The address applies again in the next case: this one is closed first.
      await q("UPDATE open_role_proposals SET status = 'withdrawn', email_key = NULL WHERE email = ?", [APPLICANT_HOLDER.email]);
    }
  });

  it("a signed-in applicant who holds the conversation's own role still reads and writes nothing, on any route", async () => {
    const id = await confirmed(APPLICANT_HOLDER.email);
    const iv = await interviewOf(id);
    await call("POST", `${app(id)}/interviews/${iv}/notes`, { body: SECRET }, IA.id);
    expect((await sendFile(`${app(id)}/interviews/${iv}/notes`, "transcript", "secret-call.txt", "Every word.", IA.id)).status).toBe(200);
    const file = (await notesOf(id)).find((r: any) => r.file_name)!;
    // CONTROL: the role alone would read them; being the applicant wins.
    const holderView = await call("GET", `${app(id)}/walkthrough`, undefined, IA.id);
    expect(holderView.status).toBe(200);
    expect((await call("GET", `${app(id)}/walkthrough`, undefined, APPLICANT_HOLDER.id)).status).toBe(404);
    expect((await call("POST", `${app(id)}/interviews/${iv}/notes`, { body: "mine" }, APPLICANT_HOLDER.id)).status).toBe(404);
    expect((await call("GET", `${app(id)}/conversation-notes/${file.id}/file`, undefined, APPLICANT_HOLDER.id)).status).toBe(404);
    expect((await call("DELETE", `${app(id)}/conversation-notes/${file.id}`, undefined, APPLICANT_HOLDER.id)).status).toBe(404);
    // Holding the role does not bring them the bell on their own application.
    expect(state.notices.filter((n) => n.type === "application_conversation_notes" && n.userId === APPLICANT_HOLDER.id)).toEqual([]);
    // The applicant's own signed-in status door carries none of it.
    const own = await call("GET", `${app(id)}/status`, undefined, APPLICANT_HOLDER.id);
    expect(own.status, own.text).toBe(200);
    for (const leak of [SECRET, "secret-call.txt", "conversation-notes", "Every word."]) expect(own.text).not.toContain(leak);
    expect(await notesOf(id)).toHaveLength(2);
    // QA round 2: their own booking names the role's other holder, never themselves.
    await q("UPDATE application_interviews SET state = 'open', opened_at = NOW(3) WHERE id = ?", [iv]);
    const booking = (await call("GET", `${app(id)}/status`, undefined, APPLICANT_HOLDER.id)).body.status.bookNow;
    expect(booking, "the open conversation offers its booking").toBeTruthy();
    expect(String(booking.label ?? "")).not.toContain(APPLICANT_HOLDER.name.split(" ")[0]);
    // By the role only since the lead's answer (27 Nov 2026): no holder is named at all.
    expect(String(booking.label ?? "")).not.toContain(IA.name.split(" ")[0]);
    expect(booking.label).toBe("Operations Role");
  });
});
