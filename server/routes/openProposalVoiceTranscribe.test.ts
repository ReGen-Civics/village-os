/**
 * "WRITE DOWN MY WORDS" (the lead, 17 Nov 2026; shared/voiceTranscribe.ts), over
 * real HTTP with a stand-in provider, and the provider call itself against a
 * stand-in fetch.
 *
 *   - Off with no key: the GET says so, the POST refuses, nothing is sent.
 *   - On: one take goes to the provider with its format and language, and its
 *     words come back; nothing else of an application goes.
 *   - Capped: per connection an hour, the village a day, and a limiter that
 *     cannot be read refuses; a take over five minutes or not audio is refused
 *     before any of that.
 */
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import express from "express";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { VOICE_NOTE_MAX_BYTES, VOICE_NOTE_MAX_SECONDS, VOICE_WORDS } from "../../shared/voiceNotes";
import { PROVIDER_UPLOAD_MAX_BYTES, RECORDING_BYTES_PER_SECOND } from "../../shared/applyLimits";
import { TRANSCRIBE_WORDS, VOICE_TRANSCRIBE_MAX_SECONDS, VOICE_TRANSCRIBE_CLIPS_PER_DAY, VOICE_TRANSCRIBE_CLIPS_PER_HOUR, VOICE_TRANSCRIBE_PATH, VOICE_TRANSCRIBE_PER_DAY, VOICE_TRANSCRIBE_PER_HOUR } from "../../shared/voiceTranscribe";
import { HTTP_PROVIDERS, languageHint, transcribeTake, type TranscribeInput, type TranscribeResult } from "../lib/voiceTranscription";
import { registerVoiceTranscribe } from "./openProposalVoiceTranscribe";
import { TINY_WEBM_OPUS } from "../lib/voiceRecordingFixtures";

const MP4 = Buffer.concat([Buffer.from([0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70, 0x4d, 0x34, 0x41, 0x20]), Buffer.alloc(64, 2)]);
const HTML = Buffer.from("<html><script>alert(1)</script></html>");

describe("the door, over real HTTP", () => {
  let server: http.Server;
  let base = "";
  const state = {
    on: true,
    open: true,
    limiter: "counting" as "counting" | "unavailable",
    hits: new Map<string, number>(),
    /** Each call as the provider saw it: the take's bytes read from where the upload streamed them, and that path. */
    calls: [] as Array<TranscribeInput & { bytes: Buffer; onDisk: string | null }>,
    answer: { ok: true, text: "I keep the gate at dawn.", by: "groq" } as TranscribeResult,
    /** Hold the provider call until the asker goes away, and note whether it was told to stop. */
    hold: false,
    stopped: [] as boolean[],
    ip: "203.0.113.9",
  };

  let incoming = "";
  /** The take files the upload streamed, wherever they are now: none should outlive its request. */
  const leftOver = () => {
    try {
      return fs.readdirSync(path.join(incoming, "takes"));
    } catch {
      return [];
    }
  };
  beforeAll(async () => {
    incoming = fs.mkdtempSync(path.join(os.tmpdir(), "transcribe-incoming-"));
    const app = express();
    registerVoiceTranscribe(app, {
      incoming,
      door: async () => ({ open: state.open }),
      limitState: async (key, max) => {
        if (state.limiter === "unavailable") return "unavailable";
        const n = (state.hits.get(key) ?? 0) + 1;
        state.hits.set(key, n);
        return n > max ? "over" : "under";
      },
      clientIp: () => state.ip,
      ipBucket: (ip) => ip,
      enabled: () => state.on,
      transcribe: async (input) => {
        // Streamed to disk, never held: the route hands over a path, and the bytes are read from it here.
        state.calls.push({ ...input, bytes: input.path ? fs.readFileSync(input.path) : (input.bytes as Buffer), onDisk: input.path ?? null } as TranscribeInput & { bytes: Buffer; onDisk: string | null });
        if (state.hold) {
          await new Promise<void>((resolve) => input.signal?.addEventListener("abort", () => resolve()));
          state.stopped.push(!!input.signal?.aborted);
          return { ok: false, reason: "cancelled" };
        }
        return state.answer;
      },
    });
    server = http.createServer(app);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const addr = server.address();
    if (!addr || typeof addr === "string") throw new Error("no port");
    base = `http://127.0.0.1:${addr.port}`;
  });
  afterAll(async () => {
    await new Promise<void>((resolve) => server?.close(() => resolve()));
    fs.rmSync(incoming, { recursive: true, force: true });
  });
  beforeEach(() => {
    state.on = true;
    state.open = true;
    state.limiter = "counting";
    state.hits.clear();
    state.calls.length = 0;
    state.answer = { ok: true, text: "I keep the gate at dawn.", by: "groq" };
    state.ip = "203.0.113.9";
    state.hold = false;
    state.stopped.length = 0;
  });

  const send = async (bytes: Buffer, fields: Record<string, string> = { seconds: "300", lang: "es-CR" }, type = "audio/webm;codecs=opus") => {
    const fd = new FormData();
    for (const [k, v] of Object.entries(fields)) fd.append(k, v);
    fd.append("voice", new Blob([new Uint8Array(bytes)], { type }), "take.webm");
    const res = await fetch(`${base}${VOICE_TRANSCRIBE_PATH}`, { method: "POST", body: fd }); // module-review-ok: a test calling its own local server
    return { status: res.status, body: (await res.json()) as any };
  };
  const on = async () => (await fetch(`${base}${VOICE_TRANSCRIBE_PATH}`).then((r) => r.json() as Promise<any>)).on; // module-review-ok: a test calling its own local server

  it("on: one five-minute take goes to the provider with its format and language, and its words come back", async () => {
    expect(await on()).toBe(true);
    const r = await send(TINY_WEBM_OPUS);
    expect(r).toEqual({ status: 200, body: { text: "I keep the gate at dawn." } });
    expect(state.calls).toHaveLength(1);
    expect(state.calls[0].kind).toBe("webm");
    expect(state.calls[0].lang).toBe("es-CR");
    expect(state.calls[0].bytes.equals(TINY_WEBM_OPUS)).toBe(true);
    // The take was a file on disk (19 Nov 2026), and it is gone once the words came back.
    expect(state.calls[0].onDisk).toMatch(/in-[0-9a-f]{32}\.part$/);
    await new Promise((r) => setTimeout(r, 50));
    expect(fs.existsSync(state.calls[0].onDisk!)).toBe(false);
    expect(leftOver()).toEqual([]);
    // Safari's MP4 goes as MP4.
    expect((await send(MP4, { seconds: "61" }, "audio/mp4")).status).toBe(200);
    expect(state.calls[1].kind).toBe("m4a");
  });

  it("a full take at the largest size and length one take may be (the ops request of 19 Nov 2026) goes whole to the provider and its words come back", async () => {
    // 7 minutes at the largest phone rate, as shared/applyLimits.ts sizes it, under the providers' 25 MB.
    expect(VOICE_NOTE_MAX_SECONDS).toBe(7 * 60);
    expect(VOICE_NOTE_MAX_BYTES).toBeGreaterThanOrEqual(VOICE_NOTE_MAX_SECONDS * RECORDING_BYTES_PER_SECOND);
    expect(VOICE_NOTE_MAX_BYTES).toBeLessThan(PROVIDER_UPLOAD_MAX_BYTES);
    const full = Buffer.alloc(VOICE_NOTE_MAX_BYTES, 7);
    TINY_WEBM_OPUS.copy(full, 0, 0, Math.min(TINY_WEBM_OPUS.length, 64));
    const words = "word ".repeat(3000).trim();
    state.answer = { ok: true, text: words, by: "groq" };
    const r = await send(full, { seconds: String(VOICE_NOTE_MAX_SECONDS), lang: "en" });
    expect(r).toEqual({ status: 200, body: { text: words } });
    expect(state.calls).toHaveLength(1);
    expect(state.calls[0].bytes.length).toBe(VOICE_NOTE_MAX_BYTES);
    // One byte more is refused, before the provider is asked.
    expect((await send(Buffer.concat([full, Buffer.alloc(1)]), { seconds: String(VOICE_NOTE_MAX_SECONDS) })).status).toBe(413);
    expect(state.calls).toHaveLength(1);
  });

  it("off with no key: the GET says so, the POST refuses, and nothing is sent", async () => {
    state.on = false;
    expect(await on()).toBe(false);
    expect(await send(TINY_WEBM_OPUS)).toEqual({ status: 404, body: { error: TRANSCRIBE_WORDS.off, on: false } });
    expect(state.calls).toEqual([]);
  });

  it("caps each connection at its hour, and refuses with nothing sent once over", async () => {
    for (let i = 0; i < VOICE_TRANSCRIBE_PER_HOUR; i += 1) expect((await send(TINY_WEBM_OPUS)).status).toBe(200);
    expect(await send(TINY_WEBM_OPUS)).toEqual({ status: 429, body: { error: TRANSCRIBE_WORDS.tooMany } });
    expect(state.calls).toHaveLength(VOICE_TRANSCRIBE_PER_HOUR);
    // CONTROL: another connection still has its own hour.
    state.ip = "198.51.100.4";
    expect((await send(TINY_WEBM_OPUS)).status).toBe(200);
  });

  it("clips have their own count: they never use up the takes' hour, and stop at their own", async () => {
    const clipSend = () => send(TINY_WEBM_OPUS, { seconds: "40", lang: "es-CR", kind: "clip" });
    // Twenty clips in an hour, far past the six takes, all written down.
    for (let i = 0; i < VOICE_TRANSCRIBE_CLIPS_PER_HOUR; i += 1) expect((await clipSend()).status, `clip ${i + 1}`).toBe(200);
    // The takes' hour is untouched by them.
    for (let i = 0; i < VOICE_TRANSCRIBE_PER_HOUR; i += 1) expect((await send(TINY_WEBM_OPUS)).status, `take ${i + 1}`).toBe(200);
    // Each count stops at its own end, with the same plain words, and nothing more is sent.
    const sentSoFar = state.calls.length;
    expect(await clipSend()).toEqual({ status: 429, body: { error: TRANSCRIBE_WORDS.tooMany } });
    expect(await send(TINY_WEBM_OPUS)).toEqual({ status: 429, body: { error: TRANSCRIBE_WORDS.tooMany } });
    expect(state.calls).toHaveLength(sentSoFar);
    expect(sentSoFar).toBe(VOICE_TRANSCRIBE_CLIPS_PER_HOUR + VOICE_TRANSCRIBE_PER_HOUR);
  });

  it("the village's day counts clips apart too: a day full of takes still writes clips down, and clips stop at their own 200", async () => {
    const clipSend = () => send(TINY_WEBM_OPUS, { seconds: "40", lang: "es-CR", kind: "clip" });
    state.hits.set("open-proposal:voice-transcribe:day", VOICE_TRANSCRIBE_PER_DAY);
    // The takes' day is full: a take is refused, a clip is written down.
    expect(await send(TINY_WEBM_OPUS)).toEqual({ status: 503, body: { error: TRANSCRIBE_WORDS.unavailable } });
    expect((await clipSend()).status).toBe(200);
    // The clips' own day full: a clip is refused with nothing sent, and a take is counted on its own day again.
    state.hits.set("open-proposal:voice-transcribe:clips-day", VOICE_TRANSCRIBE_CLIPS_PER_DAY);
    const sent = state.calls.length;
    expect(await clipSend()).toEqual({ status: 503, body: { error: TRANSCRIBE_WORDS.unavailable } });
    expect(state.calls).toHaveLength(sent);
    state.hits.set("open-proposal:voice-transcribe:day", 0);
    expect((await send(TINY_WEBM_OPUS)).status).toBe(200);
  });

  it("caps the whole village at its day, across connections", async () => {
    state.hits.set("open-proposal:voice-transcribe:day", VOICE_TRANSCRIBE_PER_DAY);
    expect(await send(TINY_WEBM_OPUS)).toEqual({ status: 503, body: { error: TRANSCRIBE_WORDS.unavailable } });
    expect(state.calls).toEqual([]);
  });

  it("a limiter that cannot be read refuses (fail closed)", async () => {
    state.limiter = "unavailable";
    expect(await send(TINY_WEBM_OPUS)).toEqual({ status: 503, body: { error: TRANSCRIBE_WORDS.unavailable } });
    expect(state.calls).toEqual([]);
  });

  it("refuses a take over seven minutes, bytes that are not audio, one too big, and a closed door, before any cap or call", async () => {
    expect(await send(TINY_WEBM_OPUS, { seconds: String(VOICE_TRANSCRIBE_MAX_SECONDS + 1) })).toEqual({ status: 400, body: { error: TRANSCRIBE_WORDS.tooLong } });
    expect(await send(TINY_WEBM_OPUS, { seconds: "nope" })).toEqual({ status: 400, body: { error: TRANSCRIBE_WORDS.tooLong } });
    expect(await send(HTML)).toEqual({ status: 400, body: { error: VOICE_WORDS.wrongType } });
    const big = Buffer.concat([TINY_WEBM_OPUS, Buffer.alloc(VOICE_NOTE_MAX_BYTES, 1)]);
    expect((await send(big)).status).toBe(413);
    state.open = false;
    expect(await send(TINY_WEBM_OPUS)).toEqual({ status: 403, body: { error: TRANSCRIBE_WORDS.closed } });
    expect(state.calls).toEqual([]);
    expect([...state.hits.values()].reduce((a, b) => a + b, 0)).toBe(0);
    // CONTROL: exactly five minutes is a take.
    state.open = true;
    expect((await send(TINY_WEBM_OPUS, { seconds: "300" })).status).toBe(200);
  });

  it("an applicant who turns writing down off (the page aborts its request) stops the provider call", async () => {
    state.hold = true;
    const stop = new AbortController();
    const fd = new FormData();
    fd.append("seconds", "300");
    fd.append("voice", new Blob([new Uint8Array(TINY_WEBM_OPUS)], { type: "audio/webm" }), "take.webm");
    const going = fetch(`${base}${VOICE_TRANSCRIBE_PATH}`, { method: "POST", body: fd, signal: stop.signal }).catch((e) => e); // module-review-ok: a test calling its own local server
    for (let i = 0; i < 100 && state.calls.length === 0; i += 1) await new Promise((r) => setTimeout(r, 10));
    expect(state.calls).toHaveLength(1);
    stop.abort();
    await going;
    for (let i = 0; i < 100 && state.stopped.length === 0; i += 1) await new Promise((r) => setTimeout(r, 10));
    expect(state.stopped).toEqual([true]);
    // The take's file goes with the asker.
    for (let i = 0; i < 100 && leftOver().length; i += 1) await new Promise((r) => setTimeout(r, 10));
    expect(leftOver()).toEqual([]);
  });

  it("an asker who walks away halfway through sending a take leaves no file behind (19 Nov 2026)", async () => {
    const url = new URL(`${base}${VOICE_TRANSCRIBE_PATH}`);
    const head = `--xx\r\nContent-Disposition: form-data; name="seconds"\r\n\r\n300\r\n--xx\r\nContent-Disposition: form-data; name="voice"; filename="take.webm"\r\nContent-Type: audio/webm\r\n\r\n`;
    const req = http.request({ host: url.hostname, port: url.port, path: url.pathname, method: "POST", headers: { "content-type": "multipart/form-data; boundary=xx", "content-length": String(head.length + 5_000_000) } });
    req.on("error", () => undefined);
    req.write(head);
    req.write(Buffer.concat([TINY_WEBM_OPUS, Buffer.alloc(1_000_000, 1)]));
    // Half a take is on disk while it arrives.
    for (let i = 0; i < 200 && leftOver().length === 0; i += 1) await new Promise((r) => setTimeout(r, 10));
    expect(leftOver()).toHaveLength(1);
    req.destroy();
    for (let i = 0; i < 200 && leftOver().length; i += 1) await new Promise((r) => setTimeout(r, 10));
    expect(leftOver()).toEqual([]);
    expect(state.calls).toHaveLength(0);
  });

  it("a provider that fails says the recording is kept, and an empty answer says nothing was heard", async () => {
    state.answer = { ok: false, reason: "failed" };
    expect(await send(TINY_WEBM_OPUS)).toEqual({ status: 503, body: { error: TRANSCRIBE_WORDS.unavailable } });
    state.answer = { ok: true, text: "", by: "local" };
    expect(await send(TINY_WEBM_OPUS)).toEqual({ status: 200, body: { text: "", note: TRANSCRIBE_WORDS.heardNothing } });
  });
});

describe("the provider call", () => {
  const provider = { id: "groq" as const, def: HTTP_PROVIDERS.groq, key: "test-key-not-real" };

  it("goes through the pinned-IP dialer by default, which refuses an address that is not public", async () => {
    // The default path is toolcheck's guardedFetch: a provider address resolving privately is never dialled.
    const local = { id: "groq" as const, def: { ...HTTP_PROVIDERS.groq, url: "https://127.0.0.1:9/v1/audio/transcriptions" }, key: "test-key-not-real" };
    expect(await transcribeTake({ bytes: TINY_WEBM_OPUS, kind: "webm" }, { providers: [local] })).toEqual({ ok: false, reason: "failed" });
  });

  it("a refusal, a failure and a reply with no words never throw", async () => {
    const answer = (status: number, body: string) => (async () => new Response(body, { status })) as any;
    expect(await transcribeTake({ bytes: MP4, kind: "m4a" }, { providers: [provider], fetchImpl: answer(401, "{}") })).toEqual({ ok: false, reason: "refused" });
    expect(await transcribeTake({ bytes: MP4, kind: "m4a" }, { providers: [provider], fetchImpl: answer(429, "{}") })).toEqual({ ok: false, reason: "failed" });
    expect(await transcribeTake({ bytes: MP4, kind: "m4a" }, { providers: [provider], fetchImpl: answer(500, "{}") })).toEqual({ ok: false, reason: "failed" });
    expect(await transcribeTake({ bytes: MP4, kind: "m4a" }, { providers: [provider], fetchImpl: answer(200, "not json") })).toEqual({ ok: false, reason: "failed" });
    const thrown = (async () => {
      throw new Error("offline");
    }) as any;
    expect(await transcribeTake({ bytes: MP4, kind: "m4a" }, { providers: [provider], fetchImpl: thrown })).toEqual({ ok: false, reason: "failed" });
  });

  it("sends a language hint only when the page's language reads as one", () => {
    expect(languageHint("es-CR")).toBe("es");
    expect(languageHint("en")).toBe("en");
    expect(languageHint("en-XA")).toBe("en");
    // What a Linux browser reports for its language.
    expect(languageHint("en-US@posix")).toBe("en");
    expect(languageHint("../../")).toBeNull();
    expect(languageHint(undefined)).toBeNull();
  });
});
