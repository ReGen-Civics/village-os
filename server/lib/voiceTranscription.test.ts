/**
 * WHICH SERVICE WRITES A RECORDING DOWN, AND WHAT HAPPENS WHEN ONE FAILS (the
 * lead, 17 Nov 2026: "Look for other options that are free"; server/lib/voiceTranscription.ts).
 *
 *   - Selection: `auto` asks Groq, then OpenAI, then the server's own Whisper,
 *     skipping any not ready; a named one is that one alone; `off` is nobody,
 *     whatever keys are typed.
 *   - Fallback: a failure or a refusal moves to the next; a cancel stops.
 *   - Each provider gets the form it reads, and nothing else.
 *   - The server's own Whisper, run for real where the program and model are
 *     here (the image ships them; a machine without them SKIPS, said aloud).
 *
 * External services are stand-ins throughout; no key is real.
 */
import fs from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

const keys = new Map<string, string>();
vi.mock("./secrets", () => ({ secretValue: (slot: string) => keys.get(slot) ?? "" }));

import {
  HTTP_PROVIDERS,
  cleanWords,
  localWhisperOf,
  localWhisperReady,
  providerOrder,
  resetLocalWhisperCheck,
  transcribeLocally,
  transcribeTake,
  transcribeWithHttp,
  type ReadyProvider,
  type TranscribeResult,
} from "./voiceTranscription";
import { resetFfmpegCheck } from "./voicePlayback";
import { TINY_WEBM_OPUS } from "./voiceRecordingFixtures";

const LOCAL = { bin: "/nowhere/whisper-cli", model: "/nowhere/model.bin", threads: 1 };
const ids = (ps: ReadyProvider[]) => ps.map((p) => p.id);

beforeEach(() => keys.clear());

describe("which provider a choice asks", () => {
  it("auto with nothing set up asks nobody; with the server's own Whisper alone, that", () => {
    expect(ids(providerOrder("auto", { localReady: false, local: LOCAL }))).toEqual([]);
    expect(ids(providerOrder("auto", { localReady: true, local: LOCAL }))).toEqual(["local"]);
  });

  it("auto puts the free Groq first, then OpenAI, then the server's own", () => {
    keys.set("voice_transcription_key", "sk-test-not-real");
    expect(ids(providerOrder("auto", { localReady: true, local: LOCAL }))).toEqual(["openai", "local"]);
    keys.set("voice_transcription_groq_key", "gsk-test-not-real");
    expect(ids(providerOrder("auto", { localReady: true, local: LOCAL }))).toEqual(["groq", "openai", "local"]);
    const groq = providerOrder("auto", { localReady: false, local: LOCAL })[0];
    expect(groq).toMatchObject({ id: "groq", key: "gsk-test-not-real", def: HTTP_PROVIDERS.groq });
  });

  it("a named provider is that one alone, and only when it is ready; off is nobody whatever is typed", () => {
    keys.set("voice_transcription_groq_key", "gsk-test-not-real");
    keys.set("voice_transcription_key", "sk-test-not-real");
    expect(ids(providerOrder("openai", { localReady: true, local: LOCAL }))).toEqual(["openai"]);
    expect(ids(providerOrder("local", { localReady: true, local: LOCAL }))).toEqual(["local"]);
    expect(ids(providerOrder("local", { localReady: false, local: LOCAL }))).toEqual([]);
    expect(ids(providerOrder("off", { localReady: true, local: LOCAL }))).toEqual([]);
    keys.clear();
    // CONTROL: Groq chosen with no Groq key asks nobody, never another service in its place.
    expect(ids(providerOrder("groq", { localReady: true, local: LOCAL }))).toEqual([]);
  });

  it("the server's own Whisper is not ready where its program or model is missing", async () => {
    resetLocalWhisperCheck();
    expect(await localWhisperReady({ WHISPER_CPP_PATH: "/nowhere/whisper-cli", WHISPER_MODEL_PATH: "/nowhere/m.bin" } as NodeJS.ProcessEnv)).toBe(false);
    resetLocalWhisperCheck();
    expect(localWhisperOf({} as NodeJS.ProcessEnv)).toMatchObject({ bin: "/usr/local/bin/whisper-cli", model: "/opt/whisper/ggml-base-q5_1.bin" });
    expect(localWhisperOf({ WHISPER_THREADS: "4" } as NodeJS.ProcessEnv).threads).toBe(4);
  });
});

describe("falling back", () => {
  const groq: ReadyProvider = { id: "groq", def: HTTP_PROVIDERS.groq, key: "gsk-test-not-real" };
  const openai: ReadyProvider = { id: "openai", def: HTTP_PROVIDERS.openai, key: "sk-test-not-real" };
  const local: ReadyProvider = { id: "local", local: LOCAL };
  const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });

  it("nobody to ask is off, and nothing is sent", async () => {
    let called = false;
    const got = await transcribeTake({ bytes: TINY_WEBM_OPUS, kind: "webm" }, { providers: [], fetchImpl: (async () => ((called = true), reply(200, {}))) as any });
    expect(got).toEqual({ ok: false, reason: "off" });
    expect(called).toBe(false);
  });

  it("Groq failing hands the take to OpenAI; a refused key hands it to the server's own Whisper", async () => {
    const asked: string[] = [];
    const fetchImpl = (async (url: string) => {
      asked.push(url);
      return url === HTTP_PROVIDERS.groq.url ? reply(503, {}) : reply(200, { text: "Hola, cuido la puerta." });
    }) as any;
    expect(await transcribeTake({ bytes: TINY_WEBM_OPUS, kind: "webm" }, { providers: [groq, openai, local], fetchImpl })).toEqual({ ok: true, text: "Hola, cuido la puerta.", by: "openai" });
    expect(asked).toEqual([HTTP_PROVIDERS.groq.url, HTTP_PROVIDERS.openai.url]);

    const runLocal = vi.fn(async (): Promise<TranscribeResult> => ({ ok: true, text: "Desde el servidor.", by: "local" }));
    const refused = (async () => reply(401, { error: "bad key" })) as any;
    expect(await transcribeTake({ bytes: TINY_WEBM_OPUS, kind: "webm" }, { providers: [groq, local], fetchImpl: refused, runLocal })).toEqual({ ok: true, text: "Desde el servidor.", by: "local" });
    expect(runLocal).toHaveBeenCalledTimes(1);
  });

  it("every one failing says failed; a cancel stops at once and asks nobody else", async () => {
    const down = (async () => reply(500, {})) as any;
    const runLocal = vi.fn(async (): Promise<TranscribeResult> => ({ ok: false, reason: "failed" }));
    expect(await transcribeTake({ bytes: TINY_WEBM_OPUS, kind: "webm" }, { providers: [groq, local], fetchImpl: down, runLocal })).toEqual({ ok: false, reason: "failed" });
    const stop = new AbortController();
    const hangs = ((_url: string, init: { signal?: AbortSignal }) =>
      new Promise<Response>((_resolve, reject) => {
        init.signal?.addEventListener("abort", () => reject(new Error("aborted")));
        setTimeout(() => stop.abort(), 5);
      })) as any;
    const after = vi.fn(async (): Promise<TranscribeResult> => ({ ok: true, text: "never", by: "local" }));
    expect(await transcribeTake({ bytes: TINY_WEBM_OPUS, kind: "webm", signal: stop.signal }, { providers: [groq, local], fetchImpl: hangs, runLocal: after })).toEqual({ ok: false, reason: "cancelled" });
    expect(after).not.toHaveBeenCalled();
  });
});

describe("the form each provider reads", () => {
  const formOf = async (init: { headers: Record<string, string>; body: Uint8Array }) => new Response(init.body, { headers: { "content-type": init.headers["Content-Type"] } }).formData();

  it("Groq: Whisper large-v3-turbo, the page's language, JSON back, and the one recording; nothing else", async () => {
    const seen: any[] = [];
    const got = await transcribeWithHttp({ bytes: TINY_WEBM_OPUS, kind: "webm", lang: "es-CR" }, { def: HTTP_PROVIDERS.groq, key: "gsk-test-not-real" }, (async (url: string, init: any) => {
      seen.push({ url, init });
      return new Response(JSON.stringify({ text: " Cuido la puerta. " }), { status: 200 });
    }) as any);
    expect(got).toEqual({ ok: true, text: "Cuido la puerta.", by: "groq" });
    expect(seen[0].url).toBe("https://api.groq.com/openai/v1/audio/transcriptions");
    expect(seen[0].init.headers.Authorization).toBe("Bearer gsk-test-not-real");
    const form = await formOf(seen[0].init);
    expect(Array.from(form.keys()).sort()).toEqual(["file", "language", "model", "response_format"]);
    expect(form.get("model")).toBe("whisper-large-v3-turbo");
    expect(form.get("language")).toBe("es");
    expect(Buffer.from(await (form.get("file") as File).arrayBuffer()).equals(TINY_WEBM_OPUS)).toBe(true);
  });

  it("OpenAI: gpt-transcribe (whisper-1 leaves the API on 26 Feb 2027), which detects the language itself", async () => {
    const seen: any[] = [];
    await transcribeWithHttp({ bytes: TINY_WEBM_OPUS, kind: "webm", lang: "es-CR" }, { def: HTTP_PROVIDERS.openai, key: "sk-test-not-real" }, (async (url: string, init: any) => {
      seen.push({ url, init });
      return new Response(JSON.stringify({ text: "x" }), { status: 200 });
    }) as any);
    expect(seen[0].url).toBe("https://api.openai.com/v1/audio/transcriptions");
    const form = await formOf(seen[0].init);
    expect(Array.from(form.keys()).sort()).toEqual(["file", "model"]);
    expect(form.get("model")).toBe("gpt-transcribe");
  });

  it("Whisper's markers for silence are not words anybody said", () => {
    expect(cleanWords("[BLANK_AUDIO]")).toBe("");
    expect(cleanWords(" [MUSIC]  Hola.\n\n(música)\n Adiós. ")).toBe("Hola.\nAdiós.");
    expect(cleanWords("I said [this] myself.")).toBe("I said [this] myself.");
  });
});

/*
 * THE SERVER'S OWN WHISPER, FOR REAL. The image ships whisper.cpp and the
 * base q5_1 model (Dockerfile, `whisper` stage); a machine without them, or
 * without ffmpeg, skips these and says so. A skip is not a pass.
 */
const local = localWhisperOf();
const HAS_LOCAL = fs.existsSync(local.bin) && fs.existsSync(local.model);
if (!HAS_LOCAL) console.warn(`[voiceTranscription] no whisper.cpp at ${local.bin} or no model at ${local.model}: the real local runs are SKIPPED. A skip is not a pass.`);

describe.skipIf(!HAS_LOCAL)("the server's own Whisper, run for real", () => {
  it("is ready here, and writes a browser's WebM recording down end to end (a tone: no words, and no silence markers)", async () => {
    resetLocalWhisperCheck();
    resetFfmpegCheck();
    expect(await localWhisperReady()).toBe(true);
    const got = await transcribeLocally({ bytes: TINY_WEBM_OPUS, kind: "webm", lang: "en" }, local);
    expect(got.ok, JSON.stringify(got)).toBe(true);
    if (got.ok) {
      expect(got.by).toBe("local");
      expect(got.text).not.toMatch(/BLANK_AUDIO/);
    }
  }, 120_000);

  it("a cancel stops the run and leaves nothing behind", async () => {
    const stop = new AbortController();
    setTimeout(() => stop.abort(), 50);
    expect(await transcribeLocally({ bytes: TINY_WEBM_OPUS, kind: "webm", signal: stop.signal }, local)).toEqual({ ok: false, reason: "cancelled" });
    // CONTROL: the next run still has its turn (the one-at-a-time queue was released).
    expect((await transcribeLocally({ bytes: TINY_WEBM_OPUS, kind: "webm" }, local)).ok).toBe(true);
  }, 120_000);

  // A real voice, when a sample is handed in (VOICE_SAMPLE_WEBM, VOICE_SAMPLE_WORD): how the lane measured a five-minute take.
  const sample = process.env.VOICE_SAMPLE_WEBM ?? "";
  it.skipIf(!sample)("writes a real recording down and finds a word it holds", async () => {
    const started = Date.now();
    const got = await transcribeLocally({ bytes: fs.readFileSync(sample), kind: "webm", lang: process.env.VOICE_SAMPLE_LANG ?? "es" }, local);
    console.info(`[voiceTranscription] real sample: ${((Date.now() - started) / 1000).toFixed(1)}s, ${got.ok ? got.text.length : 0} characters`);
    expect(got.ok).toBe(true);
    if (got.ok) expect(got.text.toLowerCase()).toContain((process.env.VOICE_SAMPLE_WORD ?? "").toLowerCase());
  }, 300_000);
});
