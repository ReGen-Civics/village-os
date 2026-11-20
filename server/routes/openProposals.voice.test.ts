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
import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import express from "express";
import type mysql from "mysql2/promise";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { OutgoingEmail, PostResult } from "../../shared/comms/contracts";
import { spawnSync } from "node:child_process";
import { VOICE_NOTE_MAX_BYTES, VOICE_NOTE_MAX_SECONDS, VOICE_WORDS, voiceNoteKind } from "../../shared/voiceNotes";
import { TINY_WEBM_OPUS } from "../lib/voiceRecordingFixtures";
import { provisionTestDb, testDbConfigured, type TestDb, testPool } from "../db/testDb";
import { escapeHtml } from "../lib/comms/mailer";
import { createOrgRole } from "../lib/orgChart";
import { readOpenProposal } from "../repos/openProposals";
import { usersRepo } from "../repos/users";
import { ATTACHMENT_WORDS } from "../../shared/proposalAttachments";
import { OPEN_UPLOAD_MAX_BYTES, OPEN_UPLOADS_AT_ONCE, register, tidyOpenProposals } from "./openProposals";
import { waitingRunSettled } from "./openProposalVoiceWritten";
import type { TranscribeInput, TranscribeResult } from "../lib/voiceTranscription";
import { STORED_TRANSCRIBE_WORDS, VOICE_TRANSCRIBE_STORED_PER_HOUR, VOICE_TRANSCRIBE_WAITING_PATH } from "../../shared/voiceTranscribe";

const configured = testDbConfigured();
/** The image ships ffmpeg (Dockerfile); a machine without one skips the copy cases, said out loud. */
const HAS_FFMPEG = spawnSync("ffmpeg", ["-hide_banner", "-version"], { stdio: "ignore" }).status === 0;
if (!HAS_FFMPEG) console.warn("[openProposals.voice] no ffmpeg here: the MP4 copy cases are SKIPPED. A skip is not a pass.");
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
  /** "Write down the words" on a kept recording: a stand-in service, a counting limiter, and the log lines. */
  const stored = {
    on: true,
    calls: [] as TranscribeInput[],
    answer: (input: TranscribeInput): TranscribeResult => ({ ok: true, text: `Words of a ${input.kind} recording, ${input.bytes?.length ?? 0} bytes.`, by: "groq" }),
    hold: null as Promise<void> | null,
    limiter: "counting" as "counting" | "unavailable",
    hits: new Map<string, number>(),
    logs: [] as string[],
  };
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
      storedTranscribe: {
        providers: async () => (stored.on ? [{ id: "local", local: { bin: "x", model: "x", threads: 1 } }] : []),
        transcribe: async (input: TranscribeInput) => {
          stored.calls.push(input);
          if (stored.hold) await stored.hold;
          return stored.on ? stored.answer(input) : { ok: false, reason: "off" };
        },
        limitState: async (key: string, max: number) => {
          if (stored.limiter === "unavailable") return "unavailable";
          const n = (stored.hits.get(key) ?? 0) + 1;
          stored.hits.set(key, n);
          return n > max ? "over" : "under";
        },
        log: (line: string) => stored.logs.push(line),
      },
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
    stored.on = true;
    stored.calls.length = 0;
    stored.hold = null;
    stored.limiter = "counting";
    stored.hits.clear();
    stored.logs.length = 0;
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
  // The proposals' folders: the folder uploads stream through (.incoming, server/lib/uploadDisk.ts) is not one.
  const folders = async () => (await fs.promises.readdir(dir)).filter((n) => !n.startsWith(".")).sort();

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
    const tooLong = await postVoice(proposal(ticked([VOICE_NOTE_MAX_SECONDS + 6])), [{ name: "voice-1.webm", bytes: WEBM }]);
    expect(tooLong).toEqual({ status: 400, body: { error: VOICE_WORDS.tooLong, field: "voice" } });
    // One past the six takes one application carries (doubled by the lead, 19 Nov 2026).
    const seven = [1, 2, 3, 4, 5, 6, 7];
    const four = await postVoice(proposal(ticked(seven)), seven.map((i) => ({ name: `voice-${i}.webm`, bytes: WEBM })));
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
  /*
   * FIVE MINUTES, KEPT WHOLE (an applicant, 17 Nov 2026: "I just recorded like 5 minutes").
   * A recording at the page's limit, at the size each browser makes it, goes in and
   * comes back through Admin's door byte for byte. Chrome's WebM measured 4.86 MB
   * for 300 s at its own default rate (Playwright, a fake microphone, 17 Nov 2026);
   * Safari's MP4 and Firefox's Ogg are given the same weight and more, and the page
   * now asks for 64 kbit/s, about half of that.
   */
  it("keeps a five-minute recording in each format a browser makes, and plays every byte of it back", async () => {
    const ogg = Buffer.concat([Buffer.from([0x4f, 0x67, 0x67, 0x53, 0, 2, 0, 0, 0, 0, 0, 0]), Buffer.alloc(64, 3)]);
    const fiveMinutes = (head: Buffer, mb: number) => {
      const body = crypto.randomBytes(Math.round(mb * 1024 * 1024));
      head.copy(body, 0, 0, head.length);
      return body;
    };
    const cases: Array<{ name: string; type: string; bytes: Buffer; kind: string }> = [
      { name: "voice-1.webm", type: "audio/webm;codecs=opus", bytes: fiveMinutes(WEBM, 4.9), kind: "webm" },
      { name: "voice-2.m4a", type: "audio/mp4", bytes: fiveMinutes(MP4, 7.5), kind: "m4a" },
      { name: "voice-3.ogg", type: "audio/ogg;codecs=opus", bytes: fiveMinutes(ogg, 4.9), kind: "ogg" },
    ];
    // All three at once: the post stays inside the upload's total, so a person who talks for three full takes is kept.
    const total = cases.reduce((s, c) => s + c.bytes.length, 0);
    expect(total).toBeLessThan(OPEN_UPLOAD_MAX_BYTES);
    const r = await postVoice(proposal(ticked([300, 300, 300], "Five minutes about the land.")), cases);
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    const id = lastId();
    const voice = (await readOpenProposal(pool, id))?.body.voice;
    expect(voice?.notes.map((n) => [n.kind, n.seconds, n.size])).toEqual(cases.map((c) => [c.kind, 300, c.bytes.length]));
    await q("UPDATE open_role_proposals SET status = 'confirmed', confirmed_at = ? WHERE id = ?", [new Date(), id]);
    state.admin = true;
    const desk = await fetch(`${base}/api/admin/open-proposals`).then((res) => res.json() as Promise<any>); // module-review-ok: a test calling its own local server
    const row = desk.proposals.find((p: any) => p.id === id);
    expect(row.voice.notes.map((n: any) => n.seconds)).toEqual([300, 300, 300]);
    for (const [i, c] of cases.entries()) {
      const play = await fetch(`${base}${row.voice.notes[i].href}`); // module-review-ok: a test calling its own local server
      expect(play.status).toBe(200);
      expect(play.headers.get("content-type")).toBe({ webm: "audio/webm", m4a: "audio/mp4", ogg: "audio/ogg" }[c.kind]);
      expect(Buffer.from(await play.arrayBuffer()).equals(c.bytes), c.name).toBe(true);
    }
  });

  it("keeps a full take, seven minutes at the largest size one take may be, byte for byte (the ops request of 19 Nov 2026)", async () => {
    const full = crypto.randomBytes(VOICE_NOTE_MAX_BYTES);
    WEBM.copy(full, 0, 0, WEBM.length);
    const r = await postVoice(proposal(ticked([VOICE_NOTE_MAX_SECONDS], "Seven minutes about the land.")), [{ name: "voice-1.webm", bytes: full, type: "audio/webm" }]);
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    const voice = (await readOpenProposal(pool, lastId()))?.body.voice;
    expect(voice?.notes.map((n) => [n.seconds, n.size])).toEqual([[VOICE_NOTE_MAX_SECONDS, VOICE_NOTE_MAX_BYTES]]);
  });

  it("refuses a recording over the note's own size with the voice named, keeping nothing", async () => {
    const before = await folders();
    const big = Buffer.concat([WEBM, Buffer.alloc(VOICE_NOTE_MAX_BYTES, 1)]);
    const r = await postVoice(proposal(ticked([300])), [{ name: "voice-1.webm", bytes: big, type: "audio/webm" }]);
    expect(r.status).toBe(413);
    expect(r.body).toEqual({ error: VOICE_WORDS.tooBig, field: "voice" });
    expect(await folders()).toEqual(before);
  });

  /*
   * A TAB LEFT OPEN ON THE OLD PAGE (the lead, 17 Nov 2026: "make sure that it's
   * all going to work if they leave it open and try to submit"). An applicant's
   * tab may still run release 1.3.19's page, with a take in memory, and press
   * Send after the server is newer. `applicationRequest119` below is that
   * page's own builder, copied verbatim from v1.3.19
   * (client/src/components/voice/VoiceInvite.tsx, with `voiceKindOfType` and
   * the transcript cap from its shared/voiceNotes.ts), so this posts exactly
   * the field names, file names, types and sizes it sends: `proposal` as JSON,
   * recordings as `voice` named `voice-<n>.<kind>`, typed with the recorder's
   * own mimeType, at the browser's own bitrate (1.3.19 asked for none: Chrome
   * measured 4.86 MB for five minutes).
   */
  describe("an application from the 1.3.19 page, still open in a tab", () => {
    const VOICE_TRANSCRIPT_MAX_119 = 12000;
    function voiceKindOfType119(type: string): "webm" | "ogg" | "m4a" {
      const t = type.toLowerCase();
      if (t.includes("mp4") || t.includes("aac") || t.includes("m4a")) return "m4a";
      if (t.includes("ogg")) return "ogg";
      return "webm";
    }
    type Take119 = { blob: Blob; seconds: number; url: string };
    type State119 = { takes: Take119[]; transcript: string; consent: boolean; skipped: boolean; clips: Record<string, Take119 & { words: string }> };
    function voiceSent119(v: State119): boolean {
      return v.consent && (v.takes.length > 0 || v.transcript.trim() !== "" || Object.keys(v.clips).length > 0);
    }
    function applicationRequest119(proposal: Record<string, unknown>, files: readonly File[], voice: State119): RequestInit {
      const sent = voiceSent119(voice);
      const clips = sent ? Object.entries(voice.clips) : [];
      const body = sent
        ? {
            ...proposal,
            voice: {
              consent: true,
              seconds: voice.takes.map((t) => t.seconds),
              transcript: voice.transcript.trim().slice(0, VOICE_TRANSCRIPT_MAX_119),
              ...(clips.length ? { clips: clips.map(([field, c]) => ({ field, seconds: c.seconds, words: c.words })) } : {}),
            },
          }
        : proposal;
      const takes = sent ? voice.takes : [];
      if (!files.length && !takes.length && !clips.length) return { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) };
      const fd = new FormData();
      fd.append("proposal", JSON.stringify(body));
      for (const f of files) fd.append("files", f, f.name);
      takes.forEach((t, i) => fd.append("voice", t.blob, `voice-${i + 1}.${voiceKindOfType119(t.blob.type)}`));
      clips.forEach(([field, c]) => fd.append("clips", c.blob, `${field}.${voiceKindOfType119(c.blob.type)}`));
      return { method: "POST", body: fd };
    }
    const fiveMinutes = (head: Buffer, mb: number) => {
      const body = crypto.randomBytes(Math.round(mb * 1024 * 1024));
      head.copy(body, 0, 0, head.length);
      return body;
    };
    const take = (bytes: Buffer, type: string, seconds: number): Take119 => ({ blob: new Blob([new Uint8Array(bytes)], { type }), seconds, url: "blob:old-tab" });

    it("keeps a five-minute WebM from Chrome and a five-minute MP4 from Safari, sent by the old page, and plays every byte back", async () => {
      const cases = [
        { bytes: fiveMinutes(WEBM, 4.86), type: "audio/webm;codecs=opus", kind: "webm" },
        // Older Safari: MP4 at its own default rate, given more weight than Chrome's.
        { bytes: fiveMinutes(MP4, 4.9), type: "audio/mp4", kind: "m4a" },
      ];
      const voice: State119 = { takes: cases.map((c) => take(c.bytes, c.type, 300)), transcript: "", consent: true, skipped: false, clips: {} };
      const res = await fetch(`${base}/api/open-proposals`, applicationRequest119(proposal(), [], voice)); // module-review-ok: a test calling its own local server
      expect(res.status, await res.clone().text()).toBe(200);
      const id = lastId();
      const kept = (await readOpenProposal(pool, id))?.body.voice;
      expect(kept?.notes.map((n) => [n.kind, n.seconds, n.size])).toEqual(cases.map((c) => [c.kind, 300, c.bytes.length]));
      // An empty "What we heard" from a browser with no speech engine is an application like any other.
      expect(kept?.transcript).toBe("");
      await q("UPDATE open_role_proposals SET status = 'confirmed', confirmed_at = ? WHERE id = ?", [new Date(), id]);
      state.admin = true;
      const desk = await fetch(`${base}/api/admin/open-proposals`).then((r) => r.json() as Promise<any>); // module-review-ok: a test calling its own local server
      const row = desk.proposals.find((p: any) => p.id === id);
      for (const [i, c] of cases.entries()) {
        const play = await fetch(`${base}${row.voice.notes[i].href}`); // module-review-ok: a test calling its own local server
        expect(play.status).toBe(200);
        expect(Buffer.from(await play.arrayBuffer()).equals(c.bytes)).toBe(true);
      }
      // Safari's MP4 is its own playable copy, made with no ffmpeg at all.
      const mp4 = await fetch(`${base}${row.voice.notes[1].href}?as=mp4`); // module-review-ok: a test calling its own local server
      expect(mp4.headers.get("content-type")).toBe("audio/mp4");
      expect(Buffer.from(await mp4.arrayBuffer()).equals(cases[1].bytes)).toBe(true);
    });

    it("keeps the old page's three takes with their words, and a clip beside an answer, as it sent them", async () => {
      const voice: State119 = {
        takes: [take(WEBM, "audio/webm;codecs=opus", 300), take(WEBM, "audio/webm", 12), take(Buffer.concat([Buffer.from([0x4f, 0x67, 0x67, 0x53, 0, 2, 0, 0, 0, 0, 0, 0]), Buffer.alloc(64, 3)]), "audio/ogg;codecs=opus", 40)],
        transcript: "  I keep the gate.  ",
        consent: true,
        skipped: false,
        clips: { why: { ...take(MP4, "audio/mp4", 20), words: "Because the gate is shut." } },
      };
      const res = await fetch(`${base}/api/open-proposals`, applicationRequest119(proposal(), [], voice)); // module-review-ok: a test calling its own local server
      expect(res.status, await res.clone().text()).toBe(200);
      const kept = (await readOpenProposal(pool, lastId()))?.body.voice;
      expect(kept?.notes.map((n) => [n.kind, n.seconds])).toEqual([["webm", 300], ["webm", 12], ["ogg", 40]]);
      expect(kept?.transcript).toBe("I keep the gate.");
      expect(kept?.clips?.map((c) => [c.field, c.kind, c.words])).toEqual([["why", "m4a", "Because the gate is shut."]]);
    });

    it.skipIf(!HAS_FFMPEG)("a real WebM from the old page plays on Safari through Admin's door, as an MP4/AAC copy", async () => {
      const voice: State119 = { takes: [take(TINY_WEBM_OPUS, "audio/webm;codecs=opus", 2)], transcript: "", consent: true, skipped: false, clips: {} };
      const res = await fetch(`${base}/api/open-proposals`, applicationRequest119(proposal(), [], voice)); // module-review-ok: a test calling its own local server
      expect(res.status, await res.clone().text()).toBe(200);
      const id = lastId();
      await q("UPDATE open_role_proposals SET status = 'confirmed', confirmed_at = ? WHERE id = ?", [new Date(), id]);
      state.admin = true;
      const row = (await fetch(`${base}/api/admin/open-proposals`).then((r) => r.json() as Promise<any>)).proposals.find((p: any) => p.id === id); // module-review-ok: a test calling its own local server
      const copy = await fetch(`${base}${row.voice.notes[0].href}?as=mp4`); // module-review-ok: a test calling its own local server
      expect(copy.status).toBe(200);
      expect(copy.headers.get("content-type")).toBe("audio/mp4");
      expect(voiceNoteKind(new Uint8Array(await copy.arrayBuffer()))).toBe("m4a");
      // An agent, holding the same desk, gets no copy either.
      expect((await fetch(`${base}${row.voice.notes[0].href}?as=mp4`, { headers: { "x-village-connector": "1" } })).status).toBe(404); // module-review-ok: a test calling its own local server
    });
  });

  it("with no transcription key typed, the real door says it is off and refuses a take", async () => {
    expect((await fetch(`${base}/api/open-proposals/voice-transcribe`).then((r) => r.json() as Promise<any>)).on).toBe(false); // module-review-ok: a test calling its own local server
    const fd = new FormData();
    fd.append("seconds", "10");
    fd.append("voice", new Blob([new Uint8Array(TINY_WEBM_OPUS)], { type: "audio/webm" }), "take.webm");
    const res = await fetch(`${base}/api/open-proposals/voice-transcribe`, { method: "POST", body: fd }); // module-review-ok: a test calling its own local server
    expect(res.status).toBe(404);
  });

  describe("clips beside answers (Rye, 14 Nov 2026)", () => {
    const withClips = (clips: Array<{ field: string; seconds: number; words: string }>) => ({ voice: { consent: true, seconds: [30], transcript: "", clips } });

    it("tells the form the village's limits, and keeps each clip with its answer and words, beside the main note", async () => {
      const form = await fetch(`${base}/api/open-proposals/form`).then((r) => r.json() as Promise<any>); // module-review-ok: a test calling its own local server
      expect(form.voice).toEqual({ max: 24, seconds: 60 });
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
      // One past the village's default of 24 (doubled by the lead, 19 Nov 2026).
      const oneTooMany = Array.from({ length: 25 }, (_, i) => ({ field: i < 24 ? `value-${i + 1}-title` : "why", seconds: 5, words: "" }));
      const many = await postClips(proposal({ voice: { consent: true, seconds: [], transcript: "", clips: oneTooMany } }), [], oneTooMany.map((c) => ({ name: `${c.field}.webm`, bytes: WEBM })));
      expect(many).toEqual({ status: 400, body: { error: VOICE_WORDS.tooManyClips(24), field: "voice" } });
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

  /*
   * WRITING DOWN A KEPT RECORDING, on Admin's applications panel (the lead, 17
   * Nov 2026: "Transcribe them! They've personally consented with me.").
   */
  describe("write down the words, on Admin's panel", () => {
    /** A confirmed application with one recording and one clip. */
    const confirmedWithVoice = async (name = "Rowan Field") => {
      const r = await postClips(
        proposal({ name, voice: { consent: true, seconds: [42], transcript: "", clips: [{ field: "why", seconds: 18, words: "" }] } }),
        [{ name: "voice-1.webm", bytes: WEBM }],
        [{ name: "why.webm", bytes: WEBM }],
      );
      expect(r.status, JSON.stringify(r.body)).toBe(200);
      const id = lastId();
      await q("UPDATE open_role_proposals SET status = 'confirmed', confirmed_at = ? WHERE id = ?", [new Date(), id]);
      const voice = (await readOpenProposal(pool, id))!.body.voice!;
      return { id, note: voice.notes[0], clip: voice.clips![0] };
    };
    const desk = async () => fetch(`${base}/api/admin/open-proposals`).then((res) => res.json() as Promise<any>); // module-review-ok: a test calling its own local server
    const writeDown = async (id: string, noteId: string) => {
      const res = await fetch(`${base}/api/admin/open-proposals/${id}/voice/${noteId}/transcribe`, { method: "POST" }); // module-review-ok: a test calling its own local server
      return { status: res.status, body: (await res.json().catch(() => ({}))) as any };
    };

    it("writes one recording and one clip down, keeps the words with the application as an AI transcript, and logs no word of them", async () => {
      const { id, note, clip } = await confirmedWithVoice("Ash Wilder");
      state.admin = true;
      const before = (await desk()).proposals.find((p: any) => p.id === id);
      expect((await desk()).transcribeOn).toBe(true);
      expect(before.voice.written).toEqual({});
      const one = await writeDown(id, note.id);
      expect(one.status, JSON.stringify(one.body)).toBe(200);
      expect(one.body.written).toEqual({ text: `Words of a webm recording, ${WEBM.length} bytes.`, by: "groq", at: expect.any(String) });
      expect((await writeDown(id, clip.id)).status).toBe(200);
      // Kept with the application, by recording, and on the desk.
      const kept = (await readOpenProposal(pool, id))!.body.voice!.written!;
      expect(Object.keys(kept).sort()).toEqual([note.id, clip.id].sort());
      const after = (await desk()).proposals.find((p: any) => p.id === id);
      expect(after.voice.written[note.id].text).toBe(one.body.written.text);
      // The recording sent was the kept file, checked by its fingerprint.
      expect(stored.calls.map((c) => c.bytes!.equals(WEBM))).toEqual([true, true]);
      // One line a run: ids, the service and the outcome; never the words, never the name.
      expect(stored.logs).toHaveLength(2);
      expect(stored.logs[0]).toContain(`proposal=${id} recording=${note.id}`);
      expect(stored.logs[0]).toContain("by=groq result=written");
      expect(stored.logs.join("\n")).not.toContain("Words of");
      expect(stored.logs.join("\n")).not.toContain("Ash");
    });

    it("only the village's admins, a person, on a confirmed application: everybody else is answered as if there were nothing", async () => {
      const { id, note } = await confirmedWithVoice();
      expect((await writeDown(id, note.id)).status).toBe(401);
      state.admin = true;
      state.role = "member";
      expect((await writeDown(id, note.id)).status).toBe(404);
      state.role = "admin";
      expect((await writeDown(id, "pv-0000000000000000")).status).toBe(404);
      await q("UPDATE open_role_proposals SET status = 'declined' WHERE id = ?", [id]);
      expect((await writeDown(id, note.id)).status).toBe(404);
      expect(stored.calls).toEqual([]);
      // CONTROL: the same admin on a confirmed application is heard.
      await q("UPDATE open_role_proposals SET status = 'confirmed' WHERE id = ?", [id]);
      expect((await writeDown(id, note.id)).status).toBe(200);
    });

    it("caps a person's hour and the village's day, fails closed when the limiter cannot be read, and says so when it is switched off", async () => {
      const { id, note } = await confirmedWithVoice();
      state.admin = true;
      stored.hits.set("voice-written:u-desk", VOICE_TRANSCRIBE_STORED_PER_HOUR);
      expect(await writeDown(id, note.id)).toEqual({ status: 429, body: { error: STORED_TRANSCRIBE_WORDS.tooMany } });
      stored.hits.clear();
      stored.hits.set("voice-written:day", 10_000);
      expect(await writeDown(id, note.id)).toEqual({ status: 429, body: { error: STORED_TRANSCRIBE_WORDS.dayFull } });
      stored.limiter = "unavailable";
      expect(await writeDown(id, note.id)).toEqual({ status: 503, body: { error: STORED_TRANSCRIBE_WORDS.unavailable } });
      expect(stored.calls).toEqual([]);
      expect(stored.logs.every((l) => l.endsWith("result=capped"))).toBe(true);
      stored.limiter = "counting";
      stored.hits.clear();
      stored.on = false;
      expect((await desk()).transcribeOn).toBe(false);
      expect((await writeDown(id, note.id)).body.error).toBe(STORED_TRANSCRIBE_WORDS.off);
      expect((await readOpenProposal(pool, id))!.body.voice!.written).toBeUndefined();
    });

    it("Transcribe all waiting: every recording with no words yet, one after another, never one already written, and one run at a time", async () => {
      const a = await confirmedWithVoice();
      const b = await confirmedWithVoice();
      state.admin = true;
      // One already written: the run leaves it alone.
      expect((await writeDown(a.id, a.note.id)).status).toBe(200);
      stored.calls.length = 0;
      let release!: () => void;
      stored.hold = new Promise<void>((r) => (release = r));
      const waitingBefore = (await desk()).proposals.reduce((n: number, p: any) => n + [...(p.voice?.notes ?? []), ...(p.voice?.clips ?? [])].filter((r: any) => !p.voice.written[r.id]).length, 0);
      const start = await fetch(`${base}${VOICE_TRANSCRIBE_WAITING_PATH}`, { method: "POST" }); // module-review-ok: a test calling its own local server
      expect(start.status).toBe(202);
      expect(await start.json()).toEqual({ started: Math.min(waitingBefore, 40), waiting: waitingBefore });
      // A second press while it runs is told so, and starts nothing.
      const again = await fetch(`${base}${VOICE_TRANSCRIBE_WAITING_PATH}`, { method: "POST" }); // module-review-ok: a test calling its own local server
      expect(again.status).toBe(409);
      expect(((await again.json()) as any).error).toBe(STORED_TRANSCRIBE_WORDS.running);
      release();
      await waitingRunSettled();
      expect(stored.calls).toHaveLength(Math.min(waitingBefore, 40));
      for (const x of [a, b]) {
        const written = (await readOpenProposal(pool, x.id))!.body.voice!.written!;
        expect(Object.keys(written).sort()).toEqual([x.note.id, x.clip.id].sort());
      }
      // CONTROL: nothing waits now, and a press starts nothing.
      const none = await fetch(`${base}${VOICE_TRANSCRIBE_WAITING_PATH}`, { method: "POST" }); // module-review-ok: a test calling its own local server
      expect(await none.json()).toEqual({ started: 0, waiting: 0 });
      state.admin = false;
      expect((await fetch(`${base}${VOICE_TRANSCRIBE_WAITING_PATH}`, { method: "POST" })).status).toBe(401); // module-review-ok: a test calling its own local server
    });

    it("the AI transcript goes with the recording when the voice part goes", async () => {
      const { id, note } = await confirmedWithVoice();
      state.admin = true;
      expect((await writeDown(id, note.id)).status).toBe(200);
      await q("UPDATE open_role_proposals SET status = 'declined', decided_at = ? WHERE id = ?", [new Date(Date.now() - 91 * 24 * 60 * 60_000), id]);
      await tidyOpenProposals(pool, new Date(), dir);
      const raw = (await q("SELECT body_json FROM open_role_proposals WHERE id = ?", [id]))[0]?.body_json;
      expect(JSON.stringify(raw ?? "")).not.toContain("Words of");
    });
  });
});
