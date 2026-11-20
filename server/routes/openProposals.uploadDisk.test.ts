/**
 * UPLOADS STREAM TO DISK, AND GO AHEAD IN PARTS (the lead, 19 Nov 2026: "ensure we can receive full uploads"), over
 * real HTTP and the scratch schema, with a private folder of the suite's own.
 *
 * What is pinned:
 *
 *   - A large post with every file at its cap lands whole, byte for byte, and the server never holds it in memory:
 *     each part is a file in the private `.incoming` folder while it arrives, and memory grows by far less than
 *     the post.
 *   - Those files go after success, after a refusal, and after the sender walks away mid-upload.
 *   - The caps still refuse: a part over its size, a post over its total, and a full disk is "busy".
 *   - Parts sent ahead (POST /api/open-proposals/parts) are checked by their own bytes, named by id in the
 *     application, copied whole into its folder, and removed once it is kept; an unknown id is refused.
 *   - The capacity view answers behind the gate only.
 */
import { execFile, spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import express from "express";
import type mysql from "mysql2/promise";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { OutgoingEmail, PostResult } from "../../shared/comms/contracts";
import { ATTACHMENT_WORDS, PROPOSAL_FILE_MAX_BYTES, PROPOSAL_FILES_MAX } from "../../shared/proposalAttachments";
import { VOICE_WORDS } from "../../shared/voiceNotes";
import { CLIPS_DEFAULT, FILES_MAX, TAKES_MAX, uploadTotalMax } from "../../shared/applyLimits";
import { provisionTestDb, testDbConfigured, type TestDb, testPool } from "../db/testDb";
import { escapeHtml } from "../lib/comms/mailer";
import { createOrgRole } from "../lib/orgChart";
import { readOpenProposal } from "../repos/openProposals";
import { usersRepo } from "../repos/users";
import { register } from "./openProposals";

const configured = testDbConfigured();
if (!configured) console.warn("[openProposals.uploadDisk] TEST_DATABASE_URL not set - DB cases SKIPPED. A skip is not a pass.");

const ORIGIN = "https://village.example.test";
const NEXT = { id: "s-next", name: "Season of Roots", startsOn: "2099-01-01", endsOn: "2099-03-20", goals: [] };
const NOW_SEASON = { id: "s-now", name: "Season of Seeds", startsOn: "2000-01-01", endsOn: "2098-12-31" };
const MiB = 1024 * 1024;
/** The large post is sent by curl, from another process; a machine without it skips that case, said out loud. */
const HAS_CURL = spawnSync("curl", ["--version"], { stdio: "ignore" }).status === 0;
if (!HAS_CURL) console.warn("[openProposals.uploadDisk] no curl here: the large-post memory case is SKIPPED. A skip is not a pass.");

const PDF_HEAD = Buffer.from("%PDF-1.7\n1 0 obj\n<<>>\nendobj\n");
const WEBM = Buffer.concat([Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0x9f, 0x42, 0x86, 0x81, 0x01, 0x42, 0xf7, 0x81]), Buffer.alloc(64, 1)]);

/** A PDF of `bytes`: its magic, then random bytes. */
const pdfOf = (bytes: number) => {
  const b = crypto.randomBytes(bytes);
  PDF_HEAD.copy(b, 0);
  return b;
};
/** A .docx of `bytes` whose Word part is named far from the start, across a read chunk's edge. */
const docxOf = (bytes: number) => {
  const b = Buffer.alloc(bytes, 0x20);
  Buffer.from([0x50, 0x4b, 0x03, 0x04]).copy(b, 0);
  Buffer.from("word/document.xml").copy(b, 256 * 1024 - 5);
  return b;
};
const sha = (b: Buffer) => crypto.createHash("sha256").update(b).digest("hex");

describe.skipIf(!configured)("uploads streamed to disk, and parts sent ahead, on a real schema", () => {
  let db: TestDb;
  let pool: mysql.Pool;
  let server: http.Server;
  let base = "";
  let gate = "";
  let dir = "";
  const state = { sent: [] as OutgoingEmail[], answer: { status: "sent", messageId: "m-1" } as PostResult, admin: false, free: null as number | null };
  const q = (sql: string, args: unknown[] = []) => pool.query<any[]>(sql, args).then(([rows]) => rows); // module-review-ok: fixture SQL on the scratch schema this suite provisioned

  beforeAll(async () => {
    db = await provisionTestDb();
    pool = testPool(db, { connectionLimit: 4 });
    dir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "proposal-disk-"));
    await q("INSERT INTO circles (id, name, aliases, is_example) VALUES ('c-land', 'Land Circle', '[]', 0)");
    gate = await createOrgRole(pool, { id: "opd-role-gate", name: "Gate Keeper", seats: 2, circleId: "c-land", aim: "Open the gate at dawn." });
    const app = express();
    app.use(express.json());
    register(app, {
      getPool: () => pool,
      overLimit: async () => false,
      clientIp: () => "203.0.113.9",
      guardCapability: async (_req: any, res: any) => {
        if (state.admin) return true;
        res.status(401).json({ error: "auth_required" });
        return false;
      },
      authedUser: async () => null,
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
      // The real volume, unless a case fills it.
      freeBytes: async (d: string) => (state.free === null ? (await fs.promises.statfs(fs.existsSync(d) ? d : os.tmpdir()).then((s) => Number(s.bavail) * Number(s.bsize))) : state.free),
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
    state.free = null;
  });

  let n = 0;
  const proposal = (over: Record<string, unknown> = {}) => ({
    name: "Rowan Field",
    email: `rowan.disk${++n}@example.test`,
    roles: [{ roleId: gate, note: "I open gates for a living." }],
    why: "I live up the road and the gate is always shut.",
    aim: "The gate opens at dawn every day.",
    ...over,
  });
  const lastId = () => state.sent[state.sent.length - 1].idempotencyKey.split(":")[1];
  const incoming = () => path.join(dir, ".incoming");
  /** The files uploads are streaming into right now (not the parts kept for an application). */
  const streaming = () => {
    try {
      return fs.readdirSync(incoming()).filter((f) => f.startsWith("in-"));
    } catch {
      return [];
    }
  };
  const staged = () => {
    try {
      return fs.readdirSync(path.join(incoming(), "parts"));
    } catch {
      return [];
    }
  };
  const settle = async (check: () => boolean) => {
    for (let i = 0; i < 300 && !check(); i += 1) await new Promise((r) => setTimeout(r, 10));
  };

  const postForm = async (fd: FormData, url = "/api/open-proposals") => {
    const res = await fetch(`${base}${url}`, { method: "POST", body: fd }); // module-review-ok: a test calling its own local server
    return { status: res.status, body: (await res.json()) as any };
  };

  it.skipIf(!HAS_CURL)("a post with every file at its cap lands whole, streamed to disk, with memory growing far less than the post", async () => {
    // Six files of 30 MiB (the counts doubled, the sizes tripled, 19 Nov 2026), one a .docx whose Word part sits past the first read.
    const files = Array.from({ length: FILES_MAX }, (_, i) => (i === 0 ? { name: "cv.docx", bytes: docxOf(PROPOSAL_FILE_MAX_BYTES) } : { name: `work-${i}.pdf`, bytes: pdfOf(PROPOSAL_FILE_MAX_BYTES) }));
    const total = files.reduce((s, f) => s + f.bytes.length, 0);
    expect(total).toBe(180 * MiB);
    // Sent by another process (curl, reading the files from disk), so this process's memory is the server's alone.
    const src = await fs.promises.mkdtemp(path.join(os.tmpdir(), "disk-post-src-"));
    const args = ["-sS", "-o", "-", "-w", "\n%{http_code}", "-F", `proposal=<${path.join(src, "proposal.json")}`];
    await fs.promises.writeFile(path.join(src, "proposal.json"), JSON.stringify(proposal()));
    for (const [i, f] of files.entries()) {
      await fs.promises.writeFile(path.join(src, `${i}-${f.name}`), f.bytes);
      args.push("-F", `files=@${path.join(src, `${i}-${f.name}`)};filename=${f.name}`);
    }
    args.push(`${base}/api/open-proposals`);
    const before = process.memoryUsage();
    let peakArrays = before.arrayBuffers;
    let sawStreaming = 0;
    const sampler = setInterval(() => {
      peakArrays = Math.max(peakArrays, process.memoryUsage().arrayBuffers);
      sawStreaming = Math.max(sawStreaming, streaming().length);
    }, 5);
    const out = await new Promise<string>((resolve, reject) => {
      execFile("curl", args, { maxBuffer: 1024 * 1024 }, (err, stdout) => (err ? reject(err) : resolve(stdout)));
    });
    const [text, code] = [out.slice(0, out.lastIndexOf("\n")), out.slice(out.lastIndexOf("\n") + 1)];
    const r = { status: Number(code), body: JSON.parse(text || "{}") };
    await fs.promises.rm(src, { recursive: true, force: true });
    clearInterval(sampler);
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    // Each part was a file on disk while it arrived.
    expect(sawStreaming).toBeGreaterThan(0);
    // A memory engine would hold all 180 MiB at once; the disk engine holds a small buffer per part.
    expect(peakArrays - before.arrayBuffers).toBeLessThan(total / 3);
    const row = await readOpenProposal(pool, lastId());
    expect(row?.body.files?.map((f) => [f.kind, f.size, f.sha256])).toEqual(files.map((f, i) => [i === 0 ? "docx" : "pdf", f.bytes.length, sha(f.bytes)]));
    // And nothing of the upload is left behind.
    await settle(() => streaming().length === 0);
    expect(streaming()).toEqual([]);
  }, 120_000);

  it("removes what an upload wrote after a refusal, and after the sender walks away halfway", async () => {
    const fd = new FormData();
    fd.append("proposal", JSON.stringify(proposal()));
    fd.append("files", new Blob([new Uint8Array(pdfOf(2 * MiB))]), "cv.pdf");
    fd.append("files", new Blob([Buffer.from("<script>alert(1)</script>")]), "page.html");
    expect(await postForm(fd)).toEqual({ status: 400, body: { error: ATTACHMENT_WORDS.fileWrongType, field: "files" } });
    await settle(() => streaming().length === 0);
    expect(streaming()).toEqual([]);

    // Halfway: a post that claims 20 MB, sends 3, and goes.
    const url = new URL(`${base}/api/open-proposals`);
    const head = `--xx\r\nContent-Disposition: form-data; name="proposal"\r\n\r\n${JSON.stringify(proposal())}\r\n--xx\r\nContent-Disposition: form-data; name="files"; filename="cv.pdf"\r\nContent-Type: application/pdf\r\n\r\n`;
    const req = http.request({ host: url.hostname, port: url.port, path: url.pathname, method: "POST", headers: { "content-type": "multipart/form-data; boundary=xx", "content-length": String(head.length + 20_000_000) } });
    req.on("error", () => undefined);
    req.write(head);
    req.write(pdfOf(3 * MiB));
    await settle(() => streaming().length === 1);
    expect(streaming()).toHaveLength(1);
    req.destroy();
    await settle(() => streaming().length === 0);
    expect(streaming()).toEqual([]);
  });

  it("the caps still refuse: a file over its size, a post over its total, and a full volume is busy", async () => {
    const big = new FormData();
    big.append("proposal", JSON.stringify(proposal()));
    big.append("files", new Blob([new Uint8Array(pdfOf(PROPOSAL_FILE_MAX_BYTES + 1))]), "big.pdf");
    expect(await postForm(big)).toEqual({ status: 413, body: { error: ATTACHMENT_WORDS.fileTooBig, field: "files" } });
    await settle(() => streaming().length === 0);
    expect(streaming()).toEqual([]);
    // Over the whole post's total: refused on its length before a byte is read.
    const url = new URL(`${base}/api/open-proposals`);
    const over = await new Promise<number>((resolve, reject) => {
      const req = http.request({ host: url.hostname, port: url.port, path: url.pathname, method: "POST", headers: { "content-type": "multipart/form-data; boundary=xx", "content-length": String(uploadTotalMax(CLIPS_DEFAULT) + 1) } });
      req.on("response", (res) => {
        res.resume();
        resolve(res.statusCode ?? 0);
        req.destroy();
      });
      req.on("error", reject);
      req.write("--xx\r\n");
    });
    expect(over).toBe(413);
    // A volume without room for the post and the reserve: busy, before a byte is read.
    state.free = 10 * MiB;
    const small = new FormData();
    small.append("proposal", JSON.stringify(proposal()));
    small.append("files", new Blob([new Uint8Array(pdfOf(1000))]), "cv.pdf");
    expect(await postForm(small)).toEqual({ status: 503, body: { error: ATTACHMENT_WORDS.uploadBusy } });
    const part = new FormData();
    part.append("kind", "files");
    part.append("part", new Blob([new Uint8Array(pdfOf(1000))]), "cv.pdf");
    expect(await postForm(part, "/api/open-proposals/parts")).toEqual({ status: 503, body: { error: ATTACHMENT_WORDS.uploadBusy } });
    // CONTROL: with room again, the same post goes.
    state.free = null;
    expect((await postForm(small)).status).toBe(200);
  });

  const sendPart = async (kind: string, bytes: Buffer, name: string) => {
    const fd = new FormData();
    fd.append("kind", kind);
    fd.append("part", new Blob([new Uint8Array(bytes)]), name);
    return postForm(fd, "/api/open-proposals/parts");
  };
  const postJson = async (body: unknown) => {
    const res = await fetch(`${base}/api/open-proposals`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }); // module-review-ok: a test calling its own local server
    return { status: res.status, body: (await res.json()) as any };
  };

  it("parts sent ahead are checked by their bytes, named by id, kept whole in the application's folder, and then removed", async () => {
    const cv = pdfOf(5 * MiB);
    const a = await sendPart("files", cv, "My CV.pdf");
    expect(a.status, JSON.stringify(a.body)).toBe(200);
    expect(a.body.id).toMatch(/^up-[0-9a-f]{32}$/);
    expect(a.body.size).toBe(cv.length);
    const takes = Array.from({ length: TAKES_MAX }, (_, i) => Buffer.concat([WEBM, Buffer.alloc(1000 * (i + 1), i)]));
    const takeIds: string[] = [];
    for (const [i, t] of takes.entries()) {
      const r = await sendPart("voice", t, `voice-${i + 1}.webm`);
      expect(r.status, JSON.stringify(r.body)).toBe(200);
      takeIds.push(r.body.id);
    }
    const clip = await sendPart("clips", WEBM, "aim.webm");
    expect(clip.status).toBe(200);
    expect(staged()).toHaveLength((2 + TAKES_MAX) * 2);
    // Nothing is streaming once the parts are in.
    await settle(() => streaming().length === 0);
    expect(streaming()).toEqual([]);

    const r = await postJson(
      proposal({
        voice: { consent: true, seconds: takes.map(() => 30), transcript: "I keep the gate.", clips: [{ field: "aim", seconds: 5, words: "Dawn." }] },
        parts: { files: [a.body.id], voice: takeIds, clips: [clip.body.id] },
      }),
    );
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    const id = lastId();
    const row = await readOpenProposal(pool, id);
    expect(row?.body.files?.map((f) => [f.kind, f.name, f.size, f.sha256])).toEqual([["pdf", "My CV.pdf", cv.length, sha(cv)]]);
    expect(row?.body.voice?.notes.map((v) => [v.kind, v.size, v.sha256])).toEqual(takes.map((t) => ["webm", t.length, sha(t)]));
    expect(row?.body.voice?.clips?.map((c) => [c.field, c.size])).toEqual([["aim", WEBM.length]]);
    // Whole on disk in the proposal's folder, and the staged copies gone.
    const kept = row!.body.files![0];
    expect(sha(await fs.promises.readFile(path.join(dir, id, `${kept.id}.${kept.kind}`)))).toBe(sha(cv));
    expect(staged()).toEqual([]);
  });

  it("refuses a part that is not what it says, an unknown id, and a part named in the wrong list, keeping nothing", async () => {
    const before = staged().length;
    expect(await sendPart("files", Buffer.from("<script>alert(1)</script>"), "cv.pdf")).toEqual({ status: 400, body: { error: ATTACHMENT_WORDS.fileWrongType, field: "files" } });
    expect(await sendPart("voice", Buffer.from("<html></html>"), "voice-1.webm")).toEqual({ status: 400, body: { error: VOICE_WORDS.wrongType, field: "voice" } });
    expect(await sendPart("files", pdfOf(PROPOSAL_FILE_MAX_BYTES + 1), "big.pdf")).toEqual({ status: 413, body: { error: ATTACHMENT_WORDS.fileTooBig, field: "files" } });
    expect(await sendPart("other", pdfOf(100), "cv.pdf")).toEqual({ status: 400, body: { error: ATTACHMENT_WORDS.fileUnreadable, field: "files" } });
    expect(staged()).toHaveLength(before);
    await settle(() => streaming().length === 0);
    expect(streaming()).toEqual([]);

    const sent = state.sent.length;
    const unknown = await postJson(proposal({ parts: { files: [`up-${"0".repeat(32)}`] } }));
    expect(unknown).toEqual({ status: 400, body: { error: ATTACHMENT_WORDS.uploadGone, field: "files" } });
    const file = await sendPart("files", pdfOf(100), "cv.pdf");
    const wrongList = await postJson(proposal({ voice: { consent: true, seconds: [10], transcript: "" }, parts: { voice: [file.body.id] } }));
    expect(wrongList).toEqual({ status: 400, body: { error: ATTACHMENT_WORDS.uploadGone, field: "voice" } });
    // One past the count is refused with the count's own words, even when every part arrived ahead.
    const many: string[] = [];
    for (let i = 0; i <= PROPOSAL_FILES_MAX; i += 1) many.push((await sendPart("files", pdfOf(100), `f${i}.pdf`)).body.id);
    expect(await postJson(proposal({ parts: { files: many } }))).toEqual({ status: 400, body: { error: ATTACHMENT_WORDS.tooManyFiles, field: "files" } });
    expect(state.sent.length).toBe(sent);
    // CONTROL: the refused application left its parts, so the same ids, within the count, still go.
    expect((await postJson(proposal({ parts: { files: many.slice(0, PROPOSAL_FILES_MAX) } }))).status).toBe(200);
  });

  it("the capacity view answers the gate's holder alone, with memory, disk and the upload caps", async () => {
    const shut = await fetch(`${base}/api/admin/server-capacity`); // module-review-ok: a test calling its own local server
    expect(shut.status).toBe(401);
    state.admin = true;
    const res = await fetch(`${base}/api/admin/server-capacity`); // module-review-ok: a test calling its own local server
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    const body = (await res.json()) as any;
    expect(body.memory.hostTotalBytes).toBe(os.totalmem());
    expect(body.memory.rssBytes).toBeGreaterThan(0);
    expect(typeof body.disk.freeBytes).toBe("number");
    expect(body.uploads).toMatchObject({ filesMax: FILES_MAX, takesMax: TAKES_MAX, clipsVillage: CLIPS_DEFAULT, applicationMaxBytes: uploadTotalMax(CLIPS_DEFAULT), storage: "disk", hostBodyUploadMs: 300_000 });
  });
});
