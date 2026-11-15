/**
 * A VOICE NOTE AT THE INTAKE (Rye, 14 Nov 2026; shared/voiceNotes.ts), over
 * real HTTP and the scratch schema, with a private folder of the suite's own.
 *
 * What is pinned:
 *
 *   - Recordings and their words are kept only with the applicant's tick, in
 *     the proposal's private folder, checked by their own bytes.
 *   - Without the tick nothing of the voice is kept, and recordings or words
 *     sent without it are refused with the field named, keeping nothing.
 *   - The tidy job: a voice note goes with the name and address, and 90 days
 *     after the decision even from a proposal that keeps everything else.
 */
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import express from "express";
import type mysql from "mysql2/promise";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { OutgoingEmail, PostResult } from "../../shared/comms/contracts";
import { VOICE_WORDS } from "../../shared/voiceNotes";
import { provisionTestDb, testDbConfigured, type TestDb, testPool } from "../db/testDb";
import { escapeHtml } from "../lib/comms/mailer";
import { createOrgRole } from "../lib/orgChart";
import { readOpenProposal } from "../repos/openProposals";
import { usersRepo } from "../repos/users";
import { ATTACHMENT_WORDS } from "../../shared/proposalAttachments";
import { OPEN_UPLOAD_MAX_BYTES, OPEN_UPLOADS_AT_ONCE, register, tidyOpenProposals } from "./openProposals";

const configured = testDbConfigured();
if (!configured) console.warn("[openProposals.voice] TEST_DATABASE_URL not set - DB cases SKIPPED. A skip is not a pass.");

const ORIGIN = "https://village.example.test";
const NEXT = { id: "s-next", name: "Season of Roots", startsOn: "2099-01-01", endsOn: "2099-03-20", goals: [] };
const NOW_SEASON = { id: "s-now", name: "Season of Seeds", startsOn: "2000-01-01", endsOn: "2098-12-31" };

// The first bytes of each kind a browser records: WebM (EBML), MP4 ("ftyp" at 4), and a page that is not audio.
const WEBM = Buffer.concat([Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0x9f, 0x42, 0x86, 0x81, 0x01, 0x42, 0xf7, 0x81]), Buffer.alloc(64, 1)]);
const MP4 = Buffer.concat([Buffer.from([0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70, 0x4d, 0x34, 0x41, 0x20]), Buffer.alloc(64, 2)]);
const HTML = Buffer.from("<html><script>alert(1)</script></html>");

describe.skipIf(!configured)("a voice note at the intake, on a real schema", () => {
  let db: TestDb;
  let pool: mysql.Pool;
  let server: http.Server;
  let base = "";
  let gate = "";
  let dir = "";
  const state = { sent: [] as OutgoingEmail[], answer: { status: "sent", messageId: "m-1" } as PostResult, admin: false, role: "admin" };
  const q = (sql: string, args: unknown[] = []) => pool.query<any[]>(sql, args).then(([rows]) => rows); // module-review-ok: fixture SQL on the scratch schema this suite provisioned

  beforeAll(async () => {
    db = await provisionTestDb();
    pool = testPool(db, { connectionLimit: 4 });
    dir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "proposal-voice-"));
    await q("INSERT INTO circles (id, name, aliases, is_example) VALUES ('c-land', 'Land Circle', '[]', 0)");
    gate = await createOrgRole(pool, { id: "opv-role-gate", name: "Gate Keeper", seats: 2, circleId: "c-land", aim: "Open the gate at dawn." });
    const app = express();
    app.use(express.json());
    register(app, {
      getPool: () => pool,
      overLimit: async () => false,
      clientIp: () => "203.0.113.9",
      // Admin's applications panel: the desk holds intake.moderate when the case says so.
      guardCapability: async (_req: any, res: any) => {
        if (state.admin) return true;
        res.status(401).json({ error: "auth_required" });
        return false;
      },
      authedUser: async () => (state.admin ? { id: "u-desk", role: state.role } : null),
      commsPostOffice: { getPool: () => pool },
      deploymentOrigin: () => ORIGIN,
      projectName: () => "Test Village",
      escapeHtml,
      seasonState: () => ({ current: NOW_SEASON, seasons: [NOW_SEASON, NEXT], timezone: "UTC" }),
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
      proposalFileDir: dir,
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
    if (dir) await fs.promises.rm(dir, { recursive: true, force: true });
  });

  beforeEach(() => {
    state.sent.length = 0;
    state.answer = { status: "sent", messageId: "m-1" };
    state.admin = false;
    state.role = "admin";
  });

  let n = 0;
  const proposal = (over: Record<string, unknown> = {}) => ({
    name: "Rowan Field",
    email: `rowan${++n}@example.test`,
    roles: [{ roleId: gate, note: "I open gates for a living." }],
    why: "I live up the road and the gate is always shut.",
    aim: "The gate opens at dawn every day.",
    ...over,
  });

  const postJson = async (body: unknown) => {
    const res = await fetch(`${base}/api/open-proposals`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }); // module-review-ok: a test calling its own local server
    return { status: res.status, body: (await res.json()) as any };
  };

  const postClips = async (body: unknown, takes: Array<{ name: string; bytes: Buffer }>, clips: Array<{ name: string; bytes: Buffer }>) => {
    const fd = new FormData();
    fd.append("proposal", JSON.stringify(body));
    for (const f of takes) fd.append("voice", new Blob([f.bytes]), f.name);
    for (const f of clips) fd.append("clips", new Blob([f.bytes]), f.name);
    const res = await fetch(`${base}/api/open-proposals`, { method: "POST", body: fd }); // module-review-ok: a test calling its own local server
    return { status: res.status, body: (await res.json()) as any };
  };

  const postVoice = async (body: unknown, takes: Array<{ name: string; bytes: Buffer; type?: string }>) => {
    const fd = new FormData();
    fd.append("proposal", JSON.stringify(body));
    for (const f of takes) fd.append("voice", new Blob([f.bytes], { type: f.type ?? "application/octet-stream" }), f.name);
    const res = await fetch(`${base}/api/open-proposals`, { method: "POST", body: fd }); // module-review-ok: a test calling its own local server
    return { status: res.status, body: (await res.json()) as any };
  };

  const lastId = () => state.sent[state.sent.length - 1].idempotencyKey.split(":")[1];
  const folders = async () => (await fs.promises.readdir(dir)).sort();

  const ticked = (seconds: number[], transcript = "I keep gates.") => ({ voice: { consent: true, seconds, transcript } });

  it("keeps ticked recordings and their words in the proposal's private folder, read by their own bytes", async () => {
    const before = await folders();
    const r = await postVoice(proposal(ticked([42, 61], "I have kept the gate on my road for six years.")), [
      { name: "voice-1.webm", bytes: WEBM, type: "audio/webm" },
      { name: "voice-2.m4a", bytes: MP4, type: "audio/mp4" },
    ]);
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    const id = lastId();
    const voice = (await readOpenProposal(pool, id))?.body.voice;
    expect(voice?.consent).toBe(true);
    expect(voice?.transcript).toBe("I have kept the gate on my road for six years.");
    expect(voice?.notes.map((n) => [n.kind, n.seconds, n.size])).toEqual([
      ["webm", 42, WEBM.length],
      ["m4a", 61, MP4.length],
    ]);
    expect(await folders()).toEqual([...before, id].sort());
    expect((await fs.promises.readdir(path.join(dir, id))).sort()).toEqual(voice!.notes.map((n) => `${n.id}.${n.kind}`).sort());
  });

  it("keeps the words alone when the tick comes with no recording, and nothing of the voice without the tick", async () => {
    expect((await postJson(proposal(ticked([], "Words only.")))).status).toBe(200);
    expect((await readOpenProposal(pool, lastId()))?.body.voice).toEqual({ consent: true, notes: [], transcript: "Words only." });
    // CONTROL: no voice part at all is an application like any other.
    expect((await postJson(proposal())).status).toBe(200);
    expect((await readOpenProposal(pool, lastId()))?.body.voice).toBeUndefined();
  });

  it("refuses recordings or words sent without the tick, wrong bytes and too many, keeping nothing", async () => {
    const before = await folders();
    const sent = state.sent.length;
    const unticked = await postVoice(proposal(), [{ name: "voice-1.webm", bytes: WEBM }]);
    expect(unticked).toEqual({ status: 400, body: { error: VOICE_WORDS.needConsent, field: "voice" } });
    const wordsOnly = await postJson(proposal({ voice: { consent: false, seconds: [], transcript: "Not ticked." } }));
    expect(wordsOnly).toEqual({ status: 400, body: { error: VOICE_WORDS.needConsent, field: "voice" } });
    const html = await postVoice(proposal(ticked([10])), [{ name: "voice-1.webm", bytes: HTML, type: "audio/webm" }]);
    expect(html).toEqual({ status: 400, body: { error: VOICE_WORDS.wrongType, field: "voice" } });
    const tooLong = await postVoice(proposal(ticked([900])), [{ name: "voice-1.webm", bytes: WEBM }]);
    expect(tooLong).toEqual({ status: 400, body: { error: VOICE_WORDS.tooLong, field: "voice" } });
    const four = await postVoice(proposal(ticked([1, 2, 3, 4])), [1, 2, 3, 4].map((i) => ({ name: `voice-${i}.webm`, bytes: WEBM })));
    expect(four).toEqual({ status: 400, body: { error: VOICE_WORDS.tooMany, field: "voice" } });
    expect(state.sent.length).toBe(sent);
    expect(await folders()).toEqual(before);
  });

  it("the tidy job: a voice note goes with the name and address, and 90 days after any decision even where the rest is kept", async () => {
    await postVoice(proposal(ticked([30])), [{ name: "voice-1.webm", bytes: WEBM }]);
    const declined = lastId();
    await postVoice(proposal(ticked([30])), [{ name: "voice-1.webm", bytes: WEBM }]);
    // Adopted onto an account already here: no invitation, so the application keeps its name and address.
    const joined = lastId();
    await postVoice(proposal(ticked([30])), [{ name: "voice-1.webm", bytes: WEBM }]);
    const recent = lastId();
    const old = new Date(Date.now() - 91 * 24 * 60 * 60_000);
    await q("UPDATE open_role_proposals SET status = 'declined', confirmed_at = ?, decided_at = ? WHERE id = ?", [new Date(), old, declined]);
    await q("UPDATE open_role_proposals SET status = 'adopted', confirmed_at = ?, decided_at = ? WHERE id = ?", [new Date(), old, joined]);
    await q("UPDATE open_role_proposals SET status = 'adopted', confirmed_at = ?, decided_at = ? WHERE id = ?", [new Date(), new Date(Date.now() - 10 * 24 * 60 * 60_000), recent]);

    const said = await tidyOpenProposals(pool, new Date(), dir);
    expect(said).toMatch(/voice notes removed$/);
    expect(await folders()).not.toContain(declined);
    expect((await readOpenProposal(pool, declined))?.body.voice).toBeUndefined();
    // The one who joined keeps their application and their name; their voice goes, from the row and from the disk.
    const kept = await readOpenProposal(pool, joined);
    expect(kept).toMatchObject({ name: "Rowan Field" });
    expect(kept?.body.voice).toBeUndefined();
    expect((await fs.promises.readdir(path.join(dir, joined))).filter((f) => f.startsWith("pv-"))).toEqual([]);
    // CONTROL: a decision ten days old keeps its voice note.
    expect((await readOpenProposal(pool, recent))?.body.voice?.notes).toHaveLength(1);
    expect((await fs.promises.readdir(path.join(dir, recent))).filter((f) => f.startsWith("pv-"))).toHaveLength(1);
  });
  describe("clips beside answers (Rye, 14 Nov 2026)", () => {
    const withClips = (clips: Array<{ field: string; seconds: number; words: string }>) => ({ voice: { consent: true, seconds: [30], transcript: "", clips } });

    it("tells the form the village's limits, and keeps each clip with its answer and words, beside the main note", async () => {
      const form = await fetch(`${base}/api/open-proposals/form`).then((r) => r.json() as Promise<any>); // module-review-ok: a test calling its own local server
      expect(form.voice).toEqual({ max: 12, seconds: 60 });
      const r = await postClips(
        proposal(withClips([{ field: "why", seconds: 24, words: "I keep the gate." }, { field: "value-1-title", seconds: 9, words: "A seed swap." }])),
        [{ name: "voice-1.webm", bytes: WEBM }],
        [{ name: "why.m4a", bytes: MP4 }, { name: "value-1-title.webm", bytes: WEBM }],
      );
      expect(r.status, JSON.stringify(r.body)).toBe(200);
      const id = lastId();
      const voice = (await readOpenProposal(pool, id))?.body.voice;
      expect(voice?.notes).toHaveLength(1);
      expect(voice?.clips?.map((c) => [c.field, c.kind, c.seconds, c.words])).toEqual([
        ["why", "m4a", 24, "I keep the gate."],
        ["value-1-title", "webm", 9, "A seed swap."],
      ]);
      const onDisk = (await fs.promises.readdir(path.join(dir, id))).sort();
      expect(onDisk).toEqual([...voice!.notes, ...voice!.clips!].map((n) => `${n.id}.${n.kind}`).sort());
    });

    /** A multipart post by hand: `length` is the Content-Length it claims (null sends it chunked), `send` the bytes it writes before waiting. */
    const rawPost = (length: number | null, send: string) => {
      const url = new URL(`${base}/api/open-proposals`);
      const req = http.request({ host: url.hostname, port: url.port, path: url.pathname, method: "POST", headers: { "content-type": "multipart/form-data; boundary=xx", ...(length === null ? {} : { "content-length": String(length) }) } });
      const answer = new Promise<{ status: number; body: any }>((resolve, reject) => {
        req.on("response", (res) => {
          let text = "";
          res.on("data", (c) => (text += c));
          res.on("end", () => resolve({ status: res.statusCode ?? 0, body: text ? JSON.parse(text) : null }));
        });
        req.on("error", reject);
      });
      req.write(send);
      return { req, answer };
    };
    const PART = "--xx\r\nContent-Disposition: form-data; name=\"proposal\"\r\n\r\n{";

    it("refuses a post over the upload's total, or with no length, before reading it, and reads only a few at once (security sweep, 14 Nov 2026)", async () => {
      const before = await folders();
      const big = rawPost(OPEN_UPLOAD_MAX_BYTES + 1, PART);
      expect(await big.answer).toEqual({ status: 413, body: { error: ATTACHMENT_WORDS.uploadTooBig, field: "files" } });
      big.req.destroy();
      const chunked = rawPost(null, PART);
      expect(await chunked.answer).toEqual({ status: 411, body: { error: ATTACHMENT_WORDS.uploadTooBig, field: "files" } });
      chunked.req.destroy();
      // Posts still sending their bytes hold every place; the next is turned away at once.
      const slow = Array.from({ length: OPEN_UPLOADS_AT_ONCE }, () => rawPost(5000, PART));
      await new Promise((r) => setTimeout(r, 300));
      const next = rawPost(5000, PART);
      expect(await next.answer).toEqual({ status: 503, body: { error: ATTACHMENT_WORDS.uploadBusy } });
      next.req.destroy();
      for (const s of slow) {
        s.answer.catch(() => undefined);
        s.req.destroy();
      }
      await new Promise((r) => setTimeout(r, 300));
      // CONTROL: the places come back when those connections drop, and a real post goes through.
      const r = await postVoice(proposal({ voice: { consent: true, seconds: [10], transcript: "" } }), [{ name: "voice-1.webm", bytes: WEBM }]);
      expect(r.status, JSON.stringify(r.body)).toBe(200);
      expect((await folders()).length).toBe(before.length + 1);
    });

    it("refuses clips without the tick, past the village's count, or for an answer the form does not have, keeping nothing", async () => {
      const before = await folders();
      const unticked = await postClips(proposal(), [], [{ name: "why.webm", bytes: WEBM }]);
      expect(unticked).toEqual({ status: 400, body: { error: VOICE_WORDS.needConsent, field: "voice" } });
      const thirteen = Array.from({ length: 13 }, (_, i) => ({ field: i < 12 ? `value-${i + 1}-title` : "why", seconds: 5, words: "" }));
      const many = await postClips(proposal({ voice: { consent: true, seconds: [], transcript: "", clips: thirteen } }), [], thirteen.map((c) => ({ name: `${c.field}.webm`, bytes: WEBM })));
      expect(many).toEqual({ status: 400, body: { error: VOICE_WORDS.tooManyClips(12), field: "voice" } });
      const odd = await postClips(proposal({ voice: { consent: true, seconds: [], transcript: "", clips: [{ field: "email", seconds: 5, words: "" }] } }), [], [{ name: "email.webm", bytes: WEBM }]);
      expect(odd.status).toBe(400);
      const html = await postClips(proposal({ voice: { consent: true, seconds: [], transcript: "", clips: [{ field: "aim", seconds: 5, words: "" }] } }), [], [{ name: "aim.webm", bytes: HTML }]);
      expect(html).toEqual({ status: 400, body: { error: VOICE_WORDS.wrongType, field: "voice" } });
      expect(await folders()).toEqual(before);
    });

    it("Admin's applications panel plays the main note and each clip to the desk, and to nobody else", async () => {
      await postClips(proposal(withClips([{ field: "aim", seconds: 12, words: "Seed for all." }])), [{ name: "voice-1.webm", bytes: WEBM }], [{ name: "aim.webm", bytes: WEBM }]);
      const id = lastId();
      await q("UPDATE open_role_proposals SET status = 'confirmed', confirmed_at = ? WHERE id = ?", [new Date(), id]);
      state.admin = true;
      const desk = await fetch(`${base}/api/admin/open-proposals`).then((r) => r.json() as Promise<any>); // module-review-ok: a test calling its own local server
      const row = desk.proposals.find((p: any) => p.id === id);
      expect(row.voice.notes).toHaveLength(1);
      expect(row.voice.clips).toEqual([expect.objectContaining({ field: "aim", label: "Their aim in this role", seconds: 12, words: "Seed for all." })]);
      const play = await fetch(`${base}${row.voice.clips[0].href}`); // module-review-ok: a test calling its own local server
      expect(play.status).toBe(200);
      expect(Buffer.from(await play.arrayBuffer()).equals(WEBM)).toBe(true);
      expect(play.headers.get("content-type")).toBe("audio/webm");
      expect(play.headers.get("cache-control")).toBe("private, no-store");
      expect((await fetch(`${base}${row.voice.notes[0].href}`)).status).toBe(200); // module-review-ok: a test calling its own local server
      expect((await fetch(`${base}${row.voice.notes[0].href.replace(/pv-[0-9a-f]+$/, "pv-0000000000000000")}`)).status).toBe(404); // module-review-ok: a test calling its own local server
      // An agent through the connector, holding the same desk, hears nothing (security sweep, 14 Nov 2026).
      expect((await fetch(`${base}${row.voice.clips[0].href}`, { headers: { "x-village-connector": "1" } })).status).toBe(404); // module-review-ok: a test calling its own local server
      const agentDesk = await fetch(`${base}/api/admin/open-proposals`, { headers: { "x-village-connector": "1" } }).then((r) => r.json() as Promise<any>); // module-review-ok: a test calling its own local server
      expect(agentDesk.proposals.find((p: any) => p.id === id).voice).toBeNull();
      // The consent tick names the deciders and the admins: a member who only holds intake.moderate hears nothing here.
      state.role = "member";
      expect((await fetch(`${base}${row.voice.clips[0].href}`)).status).toBe(404); // module-review-ok: a test calling its own local server
      const moderator = await fetch(`${base}/api/admin/open-proposals`).then((r) => r.json() as Promise<any>); // module-review-ok: a test calling its own local server
      expect(moderator.proposals.find((p: any) => p.id === id).voice).toBeNull();
      state.admin = false;
      expect((await fetch(`${base}${row.voice.clips[0].href}`)).status).toBe(401); // module-review-ok: a test calling its own local server
    });

    it("the tidy job takes the clips with the main note, 90 days after the decision", async () => {
      await postClips(proposal(withClips([{ field: "why", seconds: 12, words: "" }])), [{ name: "voice-1.webm", bytes: WEBM }], [{ name: "why.webm", bytes: WEBM }]);
      const id = lastId();
      await q("UPDATE open_role_proposals SET status = 'adopted', confirmed_at = ?, decided_at = ? WHERE id = ?", [new Date(), new Date(Date.now() - 91 * 24 * 60 * 60_000), id]);
      await tidyOpenProposals(pool, new Date(), dir);
      expect((await readOpenProposal(pool, id))?.body.voice).toBeUndefined();
      expect((await fs.promises.readdir(path.join(dir, id))).filter((f) => f.startsWith("pv-"))).toEqual([]);
    });
  });
});
