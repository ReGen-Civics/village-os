/**
 * SAVE AND FINISH LATER (the lead, 24 Nov 2026; shared/applicationDrafts.ts), on a real schema, through the
 * application's own route module (server/routes/openProposals.ts registers the draft routes with its door, its
 * parts store and its mail door): the round trip with a file, the email on the existing path, token secrecy,
 * the 30-day cleanup and the rate limits.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import express from "express";
import type mysql from "mysql2/promise";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { OutgoingEmail, PostResult } from "../../shared/comms/contracts";
import { DRAFT_KEEP_DAYS, DRAFT_LIMITS, resumePath } from "../../shared/applicationDrafts";
import { provisionTestDb, testDbConfigured, type TestDb, testPool } from "../db/testDb";
import { escapeHtml } from "../lib/comms/mailer";
import { createOrgRole } from "../lib/orgChart";
import { usersRepo } from "../repos/users";
import * as drafts from "../repos/applicationDrafts";
import { register } from "./openProposals";
import { cleanupDrafts, draftFolder } from "./applicationDrafts";

const configured = testDbConfigured();
if (!configured) console.warn("[applicationDrafts] TEST_DATABASE_URL not set - DB cases SKIPPED. A skip is not a pass.");

const ORIGIN = "https://village.example.test";
const NOW_SEASON = { id: "s-now", name: "Season of Seeds", startsOn: "2000-01-01", endsOn: "2098-12-31" };
const NEXT = { id: "s-next", name: "Season of Roots", startsOn: "2099-01-01", endsOn: "2099-03-20", goals: [] };
const PDF = Buffer.from("%PDF-1.7\n1 0 obj\n<<>>\nendobj\n% a saved application's file\n");
const sha = (s: string) => crypto.createHash("sha256").update(s).digest("hex");

describe.skipIf(!configured)("save and finish later, on a real schema", () => {
  let db: TestDb;
  let pool: mysql.Pool;
  let server: http.Server;
  let base = "";
  let gate = "";
  let fileDir = "";
  const state = {
    limited: [] as string[],
    counting: false,
    sent: [] as OutgoingEmail[],
    answer: { status: "sent", messageId: "m-1" } as PostResult,
  };
  const hits = new Map<string, number>();
  const q = (sql: string, args: unknown[] = []) => pool.query<any[]>(sql, args).then(([rows]) => rows); // module-review-ok: fixture SQL on the scratch schema this suite provisioned

  beforeAll(async () => {
    db = await provisionTestDb();
    pool = testPool(db, { connectionLimit: 4 });
    fileDir = fs.mkdtempSync(path.join(os.tmpdir(), "drafts-test-"));
    await q("INSERT INTO circles (id, name, aliases, is_example) VALUES ('c-land', 'Land Circle', '[]', 0)");
    gate = await createOrgRole(pool, { id: "ad-role-gate", name: "Gate Keeper", seats: 2, circleId: "c-land", aim: "Open the gate at dawn." });
    const app = express();
    // The server's own JSON limit (server/index.ts), so the draft's own size check is the one that answers.
    app.use(express.json({ limit: "1mb" }));
    register(app, {
      proposalFileDir: fileDir,
      getPool: () => pool,
      overLimit: async (bucket: string, max: number) => {
        if (state.limited.some((b) => bucket.startsWith(b))) return true;
        if (!state.counting) return false;
        const n = (hits.get(bucket) ?? 0) + 1;
        hits.set(bucket, n);
        return n > max;
      },
      clientIp: (req: any) => String(req.headers["x-test-ip"] ?? "203.0.113.9"),
      guardCapability: async (_req: any, res: any) => {
        res.status(401).json({ error: "auth_required" });
        return false;
      },
      authedUser: async () => null,
      commsPostOffice: { getPool: () => pool },
      deploymentOrigin: () => ORIGIN,
      projectName: () => "Test Village",
      escapeHtml,
      seasonState: () => ({ current: NOW_SEASON, seasons: [NOW_SEASON, NEXT], timezone: "UTC" }),
      // The application's own mail door: the draft's email must come through it, as the confirmation does.
      postEmail: async (email: OutgoingEmail) => {
        state.sent.push(email);
        return state.answer;
      },
      governanceLifecycle: () => "public",
      notify: async () => ({ fresh: true }),
      notifyAdmins: async () => undefined,
      members: usersRepo(pool),
      liveHoldersOf: async () => [],
      rolesCarrying: () => [],
      loadRoleHolders: () => [],
      seatCalendar: () => ({ seasons: [NOW_SEASON, NEXT], currentSeasonId: "s-now", timezone: "UTC" }),
      lapse: () => ({ currentSeasonId: "s-now", cadence: "season_turn" }),
      stageOf: async () => "guest",
      recordStageEvent: async () => undefined,
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
    if (fileDir) fs.rmSync(fileDir, { recursive: true, force: true });
  });

  beforeEach(() => {
    state.limited = [];
    state.counting = false;
    hits.clear();
    state.sent.length = 0;
    state.answer = { status: "sent", messageId: "m-1" };
  });

  const call = async (p: string, body: unknown, ip?: string) => {
    const res = await fetch(`${base}${p}`, { // module-review-ok: a test calling its own local server, never an outside host
      method: "POST",
      headers: { "content-type": "application/json", ...(ip ? { "x-test-ip": ip } : {}) },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    let json: any = null;
    try {
      json = JSON.parse(text);
    } catch {
      json = null;
    }
    return { status: res.status, body: json, text, type: res.headers.get("content-type") ?? "" };
  };

  /** One file sent ahead as a part, the way the page sends it: its id. */
  const part = async (bytes: Buffer, name: string) => {
    const fd = new FormData();
    fd.append("kind", "files");
    fd.append("part", new Blob([bytes], { type: "application/pdf" }), name);
    const res = await fetch(`${base}/api/open-proposals/parts`, { method: "POST", body: fd }); // module-review-ok: a test calling its own local server, never an outside host
    expect(res.status, await res.clone().text()).toBe(200);
    return String(((await res.json()) as any).id);
  };

  const answers = { why: "I live up the road and the gate is always shut.", name: "Rowan Field", email: "rowan@example.test", step: 2, server: { references: [{ name: "Sol", how: "Neighbour", contact: "sol@example.test" }], consent: true, agreed: { nda: true }, early: false } };

  it("keeps every answer, the step and a file, emails the private link once through the application's mail door, and gives it all back", async () => {
    const id = await part(PDF, "my-work.pdf");
    const saved = await call("/api/application-drafts", { roleId: gate, step: 2, draft: answers, email: "rowan@example.test", name: "Rowan Field", locale: "en", files: { keep: [], parts: [id] } });
    expect(saved.status, saved.text).toBe(200);
    const token = saved.body.token as string;
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(saved.body).toMatchObject({ emailed: "sent", emailedTo: "rowan@example.test", files: [{ name: "my-work.pdf", size: PDF.length }] });

    // The email: one, essential, on the application's door, to the address typed, carrying the resume link.
    expect(state.sent).toHaveLength(1);
    const mail = state.sent[0];
    expect(mail).toMatchObject({ kind: "essential", origin: "open_proposal.draft", to: { email: "rowan@example.test" } });
    expect(mail.text).toContain(`${ORIGIN}${resumePath(token)}`);
    expect(mail.text).toContain(`${DRAFT_KEEP_DAYS} days`);

    // Opening it gives back every answer, the step, and the file's reference; the file's bytes are the bytes sent.
    const opened = await call("/api/application-drafts/open", { token });
    expect(opened.status).toBe(200);
    expect(opened.body).toMatchObject({ roleId: gate, step: 2, link: null, draft: answers });
    expect(opened.body.files).toHaveLength(1);
    const file = await call("/api/application-drafts/file", { token, fileId: opened.body.files[0].id });
    expect(file.status).toBe(200);
    expect(file.type).toBe("application/pdf");
    expect(file.text).toBe(PDF.toString("latin1"));

    // Saving again to the same address writes no second email; dropping the file removes it.
    const again = await call("/api/application-drafts", { token, roleId: gate, step: 3, draft: { ...answers, step: 3 }, email: "rowan@example.test", files: { keep: [], parts: [] } });
    expect(again.body).toMatchObject({ token, emailed: "already", files: [] });
    expect(state.sent).toHaveLength(1);
    expect((await call("/api/application-drafts/file", { token, fileId: opened.body.files[0].id })).status).toBe(404);
    expect((await call("/api/application-drafts/open", { token })).body.step).toBe(3);

    // An unsent draft is never an application: the team's list has nothing in it.
    expect(Number((await q("SELECT COUNT(*) AS n FROM open_role_proposals"))[0].n)).toBe(0);

    // Sent: the page discards it, and the link opens nothing after.
    expect((await call("/api/application-drafts/discard", { token })).status).toBe(200);
    expect((await call("/api/application-drafts/open", { token })).status).toBe(404);
  });

  it("keeps only the token's hash, never writes the token to a log, and opens nothing for a wrong one", async () => {
    const said: string[] = [];
    const spies = (["log", "info", "warn", "error"] as const).map((k) => vi.spyOn(console, k).mockImplementation((...a: unknown[]) => void said.push(a.map(String).join(" "))));
    try {
      const saved = await call("/api/application-drafts", { roleId: gate, step: 0, draft: { why: "x" }, files: { keep: [], parts: [] } });
      const token = saved.body.token as string;
      expect(saved.body.emailed).toBe("none");
      expect(await drafts.draftByTokenHash(pool, sha(token))).not.toBeNull();
      expect(await drafts.draftByTokenHash(pool, token)).toBeNull();
      expect(JSON.stringify(await q("SELECT * FROM application_drafts"))).not.toContain(token);
      // A failure on the way (a part that is not there) still logs no token.
      expect((await call("/api/application-drafts", { token, roleId: gate, step: 0, draft: {}, files: { keep: [], parts: ["up-" + "0".repeat(32)] } })).status).toBe(400);
      for (const wrong of [token.slice(0, -1) + (token.endsWith("A") ? "B" : "A"), "short", ""]) {
        expect((await call("/api/application-drafts/open", { token: wrong })).status).toBe(404);
        expect((await call("/api/application-drafts", { token: wrong, roleId: gate, step: 0, draft: {}, files: { keep: [], parts: [] } })).status).toBe(404);
      }
      expect(said.join("\n")).not.toContain(token);
    } finally {
      for (const s of spies) s.mockRestore();
    }
  });

  it("deletes a draft and its files 30 days after its last save, leaves a fresh one, and a second run deletes nothing", async () => {
    const id = await part(PDF, "old.pdf");
    const old = await call("/api/application-drafts", { roleId: gate, step: 1, draft: { why: "old" }, files: { keep: [], parts: [id] } });
    const fresh = await call("/api/application-drafts", { roleId: gate, step: 1, draft: { why: "fresh" }, files: { keep: [], parts: [] } });
    const row = await drafts.draftByTokenHash(pool, sha(old.body.token));
    expect(row).not.toBeNull();
    const folder = draftFolder(fileDir, row!.id)!;
    expect(fs.readdirSync(folder)).toHaveLength(1);
    await drafts.updateDraft(pool, row!.id, { roleId: row!.roleId, email: null, body: row!.body, files: row!.files, step: row!.step, at: new Date(Date.now() - (DRAFT_KEEP_DAYS + 1) * 24 * 60 * 60 * 1000) });
    // Past its days the link opens nothing even before the job runs.
    expect((await call("/api/application-drafts/open", { token: old.body.token })).status).toBe(404);
    expect(await cleanupDrafts(pool, fileDir, new Date())).toMatch(/^1 saved applications deleted/);
    expect(fs.existsSync(folder)).toBe(false);
    expect(await drafts.draftByTokenHash(pool, sha(old.body.token))).toBeNull();
    expect((await call("/api/application-drafts/open", { token: fresh.body.token })).status).toBe(200);
    expect(await cleanupDrafts(pool, fileDir, new Date())).toMatch(/^0 saved applications deleted/);
  });

  it("limits saves and resume lookups by connection, and resume emails by address", async () => {
    state.limited = ["application-draft:save"];
    expect((await call("/api/application-drafts", { roleId: gate, step: 0, draft: {}, files: { keep: [], parts: [] } })).status).toBe(429);
    state.limited = [];
    state.counting = true;
    const ip = "198.51.100.7";
    for (let i = 0; i < DRAFT_LIMITS.opensPerWindow; i++) expect((await call("/api/application-drafts/open", { token: "x".repeat(43) }, ip)).status).toBe(404);
    expect((await call("/api/application-drafts/open", { token: "x".repeat(43) }, ip)).status).toBe(429);
    // Another connection is not held by the first one's count.
    expect((await call("/api/application-drafts/open", { token: "x".repeat(43) }, "198.51.100.8")).status).toBe(404);
    state.counting = false;
    state.limited = ["application-draft:email"];
    const capped = await call("/api/application-drafts", { roleId: gate, step: 0, draft: {}, email: "busy@example.test", files: { keep: [], parts: [] } });
    expect(capped.body.emailed).toBe("limited");
    expect(state.sent).toHaveLength(0);
  });

  it("an address the mail door refuses (suppressed) is never written to, and the page is told to copy the link", async () => {
    state.answer = { status: "skipped", messageId: null, reason: "suppressed" };
    const r = await call("/api/application-drafts", { roleId: gate, step: 0, draft: {}, email: "stop@example.test", files: { keep: [], parts: [] } });
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ emailed: "failed", emailedTo: null });
    expect(typeof r.body.token).toBe("string");
  });

  it("refuses a role the form does not offer and an answer too big to keep", async () => {
    expect((await call("/api/application-drafts", { roleId: "no-such-role", step: 0, draft: {}, files: { keep: [], parts: [] } })).status).toBe(400);
    expect((await call("/api/application-drafts", { roleId: gate, step: 0, draft: { why: "x".repeat(DRAFT_LIMITS.bodyBytes + 1) }, files: { keep: [], parts: [] } })).status).toBe(413);
  });
});
