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
import http from "node:http";
import express from "express";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { VOICE_NOTE_MAX_BYTES, VOICE_WORDS } from "../../shared/voiceNotes";
import { TRANSCRIBE_WORDS, VOICE_TRANSCRIBE_PATH, VOICE_TRANSCRIBE_PER_DAY, VOICE_TRANSCRIBE_PER_HOUR } from "../../shared/voiceTranscribe";
import { DEFAULT_TRANSCRIPTION_PROVIDER, languageHint, transcribeTake, transcriptionProvider, type TranscribeInput, type TranscribeResult } from "../lib/voiceTranscription";
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
    calls: [] as TranscribeInput[],
    answer: { ok: true, text: "I keep the gate at dawn." } as TranscribeResult,
    ip: "203.0.113.9",
  };

  beforeAll(async () => {
    const app = express();
    registerVoiceTranscribe(app, {
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
        state.calls.push(input);
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
  });
  beforeEach(() => {
    state.on = true;
    state.open = true;
    state.limiter = "counting";
    state.hits.clear();
    state.calls.length = 0;
    state.answer = { ok: true, text: "I keep the gate at dawn." };
    state.ip = "203.0.113.9";
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
    // Safari's MP4 goes as MP4.
    expect((await send(MP4, { seconds: "61" }, "audio/mp4")).status).toBe(200);
    expect(state.calls[1].kind).toBe("m4a");
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

  it("refuses a take over five minutes, bytes that are not audio, one too big, and a closed door, before any cap or call", async () => {
    expect(await send(TINY_WEBM_OPUS, { seconds: "306" })).toEqual({ status: 400, body: { error: TRANSCRIBE_WORDS.tooLong } });
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

  it("a provider that fails says the recording is kept, and an empty answer says nothing was heard", async () => {
    state.answer = { ok: false, reason: "failed" };
    expect(await send(TINY_WEBM_OPUS)).toEqual({ status: 503, body: { error: TRANSCRIBE_WORDS.unavailable } });
    state.answer = { ok: true, text: "" };
    expect(await send(TINY_WEBM_OPUS)).toEqual({ status: 200, body: { text: "", note: TRANSCRIBE_WORDS.heardNothing } });
  });
});

describe("the provider call", () => {
  const provider = { def: DEFAULT_TRANSCRIPTION_PROVIDER, key: "test-key-not-real" };

  it("with no key typed (or the store not loaded), there is no provider and nothing is sent", async () => {
    expect(transcriptionProvider({} as NodeJS.ProcessEnv)).toBeNull();
    let called = false;
    const got = await transcribeTake({ bytes: TINY_WEBM_OPUS, kind: "webm" }, { provider: null, fetchImpl: (async () => ((called = true), new Response("{}"))) as any });
    expect(got).toEqual({ ok: false, reason: "off" });
    expect(called).toBe(false);
  });

  it("posts the one take to the provider's fixed address with the key, its format and the language, and reads the words", async () => {
    const seen: Array<{ url: string; init: { headers: Record<string, string>; body: Uint8Array } }> = [];
    const fetchImpl = (async (url: string, init: { headers: Record<string, string>; body: Uint8Array }) => {
      seen.push({ url, init });
      return new Response(JSON.stringify({ text: "  Hola, cuido la puerta.  " }), { status: 200, headers: { "content-type": "application/json" } });
    }) as any;
    const got = await transcribeTake({ bytes: TINY_WEBM_OPUS, kind: "webm", lang: "es-CR" }, { provider, fetchImpl });
    expect(got).toEqual({ ok: true, text: "Hola, cuido la puerta." });
    expect(seen[0].url).toBe(DEFAULT_TRANSCRIPTION_PROVIDER.url);
    expect(seen[0].init.headers.Authorization).toBe("Bearer test-key-not-real");
    // The bytes the pinned dialer sends, read back as the provider reads them: a form.
    const form = await new Response(seen[0].init.body, { headers: { "content-type": seen[0].init.headers["Content-Type"] } }).formData();
    const file = form.get("file") as File;
    expect(file.type).toBe("audio/webm");
    expect(Buffer.from(await file.arrayBuffer()).equals(TINY_WEBM_OPUS)).toBe(true);
    expect(form.get("model")).toBe(DEFAULT_TRANSCRIPTION_PROVIDER.model);
    expect(form.get("language")).toBe("es");
    // Nothing else of an application is in the post.
    expect(Array.from(form.keys()).sort()).toEqual(["file", "language", "model", "response_format"]);
  });

  it("goes through the pinned-IP dialer by default, which refuses an address that is not public", async () => {
    // The default path is toolcheck's guardedFetch: a provider address resolving privately is never dialled.
    const local = { def: { ...DEFAULT_TRANSCRIPTION_PROVIDER, url: "https://127.0.0.1:9/v1/audio/transcriptions" }, key: "test-key-not-real" };
    expect(await transcribeTake({ bytes: TINY_WEBM_OPUS, kind: "webm" }, { provider: local })).toEqual({ ok: false, reason: "failed" });
  });

  it("a refusal, a failure and a reply with no words never throw", async () => {
    const answer = (status: number, body: string) => (async () => new Response(body, { status })) as any;
    expect(await transcribeTake({ bytes: MP4, kind: "m4a" }, { provider, fetchImpl: answer(401, "{}") })).toEqual({ ok: false, reason: "refused" });
    expect(await transcribeTake({ bytes: MP4, kind: "m4a" }, { provider, fetchImpl: answer(429, "{}") })).toEqual({ ok: false, reason: "failed" });
    expect(await transcribeTake({ bytes: MP4, kind: "m4a" }, { provider, fetchImpl: answer(500, "{}") })).toEqual({ ok: false, reason: "failed" });
    expect(await transcribeTake({ bytes: MP4, kind: "m4a" }, { provider, fetchImpl: answer(200, "not json") })).toEqual({ ok: false, reason: "failed" });
    const thrown = (async () => {
      throw new Error("offline");
    }) as any;
    expect(await transcribeTake({ bytes: MP4, kind: "m4a" }, { provider, fetchImpl: thrown })).toEqual({ ok: false, reason: "failed" });
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
