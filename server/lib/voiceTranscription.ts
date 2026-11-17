/**
 * THE VOICE STEP'S TRANSCRIPTION SERVICE (the lead, 17 Nov 2026: "It's okay for
 * them to reach an AI assistant, let's make it all work!", then "Look for other
 * options that are free and that we can add now!"). One recording in, its words
 * out. The contract the pages read is shared/voiceTranscribe.ts; the doors are
 * server/routes/openProposalVoiceTranscribe.ts (the applicant's take) and
 * server/routes/openProposalVoiceWritten.ts (a kept recording, at an admin's or
 * a decider's press).
 *
 * THREE PROVIDERS, ONE CHOICE. An admin picks under Admin, Integrations
 * (`TranscriptionChoice`, kept in the app_config document below):
 *
 *   - `groq`: Groq's speech-to-text, Whisper large-v3-turbo, OpenAI-compatible.
 *     A free tier (measured 17 Nov 2026 in Groq's rate-limit table: 20 requests
 *     a minute, 2,000 a day, 7,200 audio seconds an hour, 28,800 a day), and
 *     $0.04 an hour of audio past it. Reads WebM, Ogg and MP4 as browsers record
 *     them, up to 25 MB, so a take goes as recorded. Spanish and English.
 *   - `openai`: OpenAI's audio transcription, `gpt-transcribe` ($0.0045 a
 *     minute on 17 Nov 2026). `whisper-1`, which #1433 used, is deprecated and
 *     leaves the API on 26 Feb 2027 (OpenAI's deprecations page), so the
 *     replacement it names is used. It detects the language itself.
 *   - `local`: Whisper running in this server's own container (whisper.cpp,
 *     the multilingual `base` model, quantised; Dockerfile, the `whisper`
 *     stage). No key, no account, no cost per use, and the recording never
 *     leaves the server. Slower: about a minute of two cores for a five-minute
 *     take, measured 17 Nov 2026, so one runs at a time.
 *
 * `auto` (the default) asks them in that order, skipping any that is not
 * ready, and when one fails the next is tried. So with no key at all the image
 * still writes recordings down, and a Groq key makes it fast and still free.
 *
 * THE KEYS ARE ADMIN-TYPED, SEALED, AND READ HERE ONLY. Each is typed under
 * Admin, Integrations, sealed at rest like every other slot, has no host
 * variable, and leaves the server only in the Authorization header of the call
 * to its provider's fixed address, dialled through the pinned-IP guard like
 * every other outbound call (toolcheck.ts `guardedFetch`). Never logged, never
 * returned.
 *
 * WHAT IS SENT. The bytes of the one recording, its format, and (to Groq) the
 * language the page is in. No name, address, application or other answer.
 */
import { spawn } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { Pool } from "mysql2/promise";
import { secretValue } from "./secrets";
import { guardedFetch } from "./toolcheck";
import { ffmpegAvailable, ffmpegBinary } from "./voicePlayback";
import { dbDocument } from "../repos/store-db";
import type { VoiceNoteKind } from "../../shared/voiceNotes";
import { VOICE_NOTE_TYPES } from "../../shared/voiceNotes";
import {
  TRANSCRIPTION_PROVIDER_IDS,
  VOICE_TRANSCRIBE_TEXT_MAX,
  transcriptionChoiceOf,
  type TranscriptionChoice,
  type TranscriptionProviderId,
  type TranscriptionSettings,
} from "../../shared/voiceTranscribe";

/* ── The providers ──────────────────────────────────────────────────────── */

type HttpProviderId = Exclude<TranscriptionProviderId, "local">;

export interface HttpProviderDef {
  id: HttpProviderId;
  /** Who it is, as an admin knows them. */
  name: string;
  /** The secrets-store slot holding the village's own key. */
  slot: "voice_transcription_groq_key" | "voice_transcription_key";
  /** The one address the bytes go to. Fixed in code: an admin types a key, never an address. */
  url: string;
  model: string;
  /** Whether the provider takes a `language` field (Groq's Whisper does; OpenAI's gpt-transcribe detects it). */
  sendsLanguage: boolean;
}

export const HTTP_PROVIDERS: Readonly<Record<HttpProviderId, HttpProviderDef>> = {
  groq: { id: "groq", name: "Groq", slot: "voice_transcription_groq_key", url: "https://api.groq.com/openai/v1/audio/transcriptions", model: "whisper-large-v3-turbo", sendsLanguage: true },
  openai: { id: "openai", name: "OpenAI", slot: "voice_transcription_key", url: "https://api.openai.com/v1/audio/transcriptions", model: "gpt-transcribe", sendsLanguage: false },
};

/** Where this server's own Whisper lives. The image ships both (Dockerfile, `whisper` stage); a host may point elsewhere. */
export interface LocalWhisper {
  bin: string;
  model: string;
  threads: number;
}

export function localWhisperOf(env: NodeJS.ProcessEnv = process.env): LocalWhisper {
  const threads = Math.floor(Number(env.WHISPER_THREADS));
  return {
    bin: (env.WHISPER_CPP_PATH ?? "").trim() || "/usr/local/bin/whisper-cli",
    model: (env.WHISPER_MODEL_PATH ?? "").trim() || "/opt/whisper/ggml-base-q5_1.bin",
    threads: Number.isFinite(threads) && threads > 0 ? Math.min(threads, 8) : Math.max(1, Math.min(2, os.availableParallelism?.() ?? 1)),
  };
}

let localChecked: Promise<boolean> | null = null;
/** Whether this server can write a recording down itself: the program, the model and ffmpeg are all here. Asked once per process. */
export function localWhisperReady(env: NodeJS.ProcessEnv = process.env): Promise<boolean> {
  if (!localChecked) {
    const w = localWhisperOf(env);
    localChecked = (async () => {
      try {
        await fs.promises.access(w.bin, fs.constants.X_OK);
        const st = await fs.promises.stat(w.model);
        if (st.size < 1024 * 1024) return false;
      } catch {
        return false;
      }
      return ffmpegAvailable();
    })();
  }
  return localChecked;
}
/** For a suite: ask again. */
export function resetLocalWhisperCheck(): void {
  localChecked = null;
}

/** One provider ready to take a recording. */
export type ReadyProvider = { id: HttpProviderId; def: HttpProviderDef; key: string } | { id: "local"; local: LocalWhisper };

function keyOf(def: HttpProviderDef, env: NodeJS.ProcessEnv): string {
  try {
    return secretValue(def.slot, env).trim();
  } catch {
    return "";
  }
}

/**
 * The providers a choice asks, in order, among those ready now. `auto` is every
 * ready one, Groq first; a named provider is that one alone, when it is ready;
 * `off` is none. Pure apart from reading the keys.
 */
export function providerOrder(choice: TranscriptionChoice, opts: { env?: NodeJS.ProcessEnv; localReady: boolean; local?: LocalWhisper }): ReadyProvider[] {
  const env = opts.env ?? process.env;
  const wanted: TranscriptionProviderId[] = choice === "off" ? [] : choice === "auto" ? [...TRANSCRIPTION_PROVIDER_IDS] : [choice];
  const out: ReadyProvider[] = [];
  for (const id of wanted) {
    if (id === "local") {
      if (opts.localReady) out.push({ id: "local", local: opts.local ?? localWhisperOf(env) });
      continue;
    }
    const def = HTTP_PROVIDERS[id];
    const key = keyOf(def, env);
    if (key) out.push({ id, def, key });
  }
  return out;
}

/* ── The admin's choice ─────────────────────────────────────────────────── */

export const TRANSCRIPTION_SETTINGS_KEY = "voice-transcription";

/** The choice an admin made under Integrations, read fresh; `auto` when none was made or the store cannot be read. */
export async function readTranscriptionChoice(pool: Pool): Promise<TranscriptionChoice> {
  try {
    const doc = dbDocument(pool, TRANSCRIPTION_SETTINGS_KEY, {} as Record<string, unknown>);
    await doc.load();
    return transcriptionChoiceOf(doc.get().choice);
  } catch {
    return "auto";
  }
}

export async function writeTranscriptionChoice(pool: Pool, choice: TranscriptionChoice): Promise<void> {
  await dbDocument(pool, TRANSCRIPTION_SETTINGS_KEY, {} as Record<string, unknown>).put({ choice });
}

/** The providers to ask now: the admin's choice, among those ready. */
export async function providersNow(pool: Pool, env: NodeJS.ProcessEnv = process.env): Promise<ReadyProvider[]> {
  const choice = await readTranscriptionChoice(pool);
  return providerOrder(choice, { env, localReady: choice === "auto" || choice === "local" ? await localWhisperReady(env) : false });
}

/** What the Integrations picker shows: the choice, what it resolves to, and which providers are ready. */
export async function transcriptionSettings(pool: Pool, env: NodeJS.ProcessEnv = process.env): Promise<TranscriptionSettings> {
  const choice = await readTranscriptionChoice(pool);
  const localReady = await localWhisperReady(env);
  const ready = providerOrder("auto", { env, localReady }).map((p) => p.id);
  return {
    choice,
    order: providerOrder(choice, { env, localReady }).map((p) => p.id),
    providers: TRANSCRIPTION_PROVIDER_IDS.map((id) => ({ id, ready: ready.includes(id) })),
  };
}

/* ── One recording, written down ────────────────────────────────────────── */

export interface TranscribeInput {
  bytes: Buffer;
  kind: VoiceNoteKind;
  /** The page's language, "es-CR" or "en": only its first part is used. */
  lang?: string;
  /** Aborted when the asker goes away or turns writing down off: the call stops. */
  signal?: AbortSignal;
}

export type TranscribeResult = { ok: true; text: string; by: TranscriptionProviderId } | { ok: false; reason: "off" | "refused" | "failed" | "cancelled" };

/** The language hint a provider takes: two or three letters, or nothing. */
export function languageHint(lang: unknown): string | null {
  const m = /^([a-z]{2,3})(?:$|[-_@.])/.exec(String(lang ?? "").trim().toLowerCase());
  return m ? m[1] : null;
}

/** How long one call to a provider may take before the recording is reported unwritten. */
export const TRANSCRIBE_TIMEOUT_MS = 90_000;
/** How long this server's own Whisper may take on one recording: a five-minute take on one slow core. */
export const LOCAL_TIMEOUT_MS = 240_000;

/** One multipart body, as bytes: the provider reads a form, and the pinned dialer sends bytes as they are. */
export function multipartBody(fields: Record<string, string>, file: { name: string; type: string; bytes: Buffer }): { body: Buffer; contentType: string } {
  const boundary = `----voice${crypto.randomBytes(12).toString("hex")}`;
  const parts: Buffer[] = [];
  for (const [k, v] of Object.entries(fields)) {
    parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${k}"\r\n\r\n${v}\r\n`, "utf8"));
  }
  parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${file.name}"\r\nContent-Type: ${file.type}\r\n\r\n`, "utf8"));
  parts.push(file.bytes);
  parts.push(Buffer.from(`\r\n--${boundary}--\r\n`, "utf8"));
  return { body: Buffer.concat(parts), contentType: `multipart/form-data; boundary=${boundary}` };
}

/** How a call is made: the pinned dialer, unless a suite hands in its own. */
export type TranscribeFetch = (url: string, init: { method: string; headers: Record<string, string>; body: Uint8Array; signal?: AbortSignal }) => Promise<Response>;
/** How this server's own Whisper is run; a suite may hand in its own. */
export type LocalRun = (input: TranscribeInput, local: LocalWhisper) => Promise<TranscribeResult>;

const cancelled = (signal?: AbortSignal) => !!signal?.aborted;

/** Whisper's own markers for no speech, "[BLANK_AUDIO]" or "(music)", which are not words anybody said. */
export function cleanWords(text: string): string {
  return text
    .replace(/\[[A-Z _]{3,40}\]/g, " ")
    .replace(/^\s*[([](?:music|silence|applause|blank_audio|música|silencio)[)\]]\s*$/gim, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .trim()
    .slice(0, VOICE_TRANSCRIBE_TEXT_MAX);
}

/** One recording to one HTTP provider. Never throws. */
export async function transcribeWithHttp(input: TranscribeInput, provider: { def: HttpProviderDef; key: string }, fetchImpl?: TranscribeFetch): Promise<TranscribeResult> {
  const doFetch: TranscribeFetch = fetchImpl ?? ((url, init) => guardedFetch(url, init as RequestInit));
  const hint = provider.def.sendsLanguage ? languageHint(input.lang) : null;
  const fields: Record<string, string> = { model: provider.def.model, ...(provider.def.id === "groq" ? { response_format: "json" } : {}), ...(hint ? { language: hint } : {}) };
  const { body, contentType } = multipartBody(fields, { name: `take.${input.kind}`, type: VOICE_NOTE_TYPES[input.kind], bytes: input.bytes });
  const timeout = AbortSignal.timeout(TRANSCRIBE_TIMEOUT_MS);
  const signal = input.signal ? AbortSignal.any([timeout, input.signal]) : timeout;
  try {
    const res = await doFetch(provider.def.url, {
      method: "POST",
      headers: { Authorization: `Bearer ${provider.key}`, "Content-Type": contentType, Accept: "application/json" },
      body,
      signal,
    });
    if (!res.ok) {
      await res.body?.cancel().catch(() => undefined);
      return { ok: false, reason: res.status >= 400 && res.status < 500 && res.status !== 429 ? "refused" : "failed" };
    }
    const text = await readCapped(res, 256 * 1024);
    const parsed = (() => {
      try {
        return JSON.parse(text ?? "") as { text?: unknown };
      } catch {
        return null;
      }
    })();
    if (!parsed || typeof parsed.text !== "string") return { ok: false, reason: "failed" };
    return { ok: true, text: cleanWords(parsed.text), by: provider.def.id };
  } catch {
    return { ok: false, reason: cancelled(input.signal) ? "cancelled" : "failed" };
  }
}

/** A reply read to at most `max` bytes; null past it. */
async function readCapped(res: Response, max: number): Promise<string | null> {
  if (!res.body) return "";
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > max) {
      await reader.cancel().catch(() => undefined);
      return null;
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString("utf8");
}

/* ── This server's own Whisper ──────────────────────────────────────────── */

/** Recordings waiting for the server's own Whisper beyond the one it is on; more than this is refused as busy. */
export const LOCAL_WAITING_MAX = 6;
let localRunning = false;
const localQueue: Array<() => void> = [];

/** One run at a time: the model takes the cores it is given for the whole run. False when too many already wait. */
async function localTurn(signal?: AbortSignal): Promise<boolean> {
  if (!localRunning) {
    localRunning = true;
    return true;
  }
  if (localQueue.length >= LOCAL_WAITING_MAX) return false;
  return new Promise<boolean>((resolve) => {
    const go = () => {
      signal?.removeEventListener("abort", leave);
      resolve(true);
    };
    const leave = () => {
      const i = localQueue.indexOf(go);
      if (i >= 0) localQueue.splice(i, 1);
      resolve(false);
    };
    localQueue.push(go);
    signal?.addEventListener("abort", leave, { once: true });
  });
}
function localDone(): void {
  const next = localQueue.shift();
  if (next) next();
  else localRunning = false;
}

/** Run one program to its end, or kill it at the time limit or the abort. Resolves its exit code, or null. */
function run(bin: string, args: string[], timeoutMs: number, signal?: AbortSignal): Promise<number | null> {
  return new Promise((resolve) => {
    let done = false;
    let p: ReturnType<typeof spawn>;
    const finish = (code: number | null) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      signal?.removeEventListener("abort", kill);
      resolve(code);
    };
    const kill = () => {
      p?.kill("SIGKILL");
      finish(null);
    };
    try {
      p = spawn(bin, args, { stdio: "ignore" });
    } catch {
      return resolve(null);
    }
    const timer = setTimeout(kill, timeoutMs);
    signal?.addEventListener("abort", kill, { once: true });
    p.on("error", () => finish(null));
    p.on("exit", (code) => finish(code));
  });
}

/**
 * One recording through this server's own Whisper: ffmpeg makes the 16 kHz
 * mono WAV the model reads, whisper.cpp writes the words to a text file, both
 * in a private scratch folder removed whatever happens. Never throws.
 */
export async function transcribeLocally(input: TranscribeInput, local: LocalWhisper): Promise<TranscribeResult> {
  if (cancelled(input.signal)) return { ok: false, reason: "cancelled" };
  if (!(await localTurn(input.signal))) return { ok: false, reason: cancelled(input.signal) ? "cancelled" : "failed" };
  const scratch = await fs.promises.mkdtemp(path.join(os.tmpdir(), "voice-words-")).catch(() => null);
  try {
    if (!scratch) return { ok: false, reason: "failed" };
    const source = path.join(scratch, `in.${input.kind}`);
    const wav = path.join(scratch, "in.wav");
    const out = path.join(scratch, "out");
    await fs.promises.writeFile(source, input.bytes);
    const started = Date.now();
    const decoded = await run(
      ffmpegBinary(),
      ["-nostdin", "-hide_banner", "-loglevel", "error", "-y", "-i", source, "-vn", "-map_metadata", "-1", "-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le", "-f", "wav", wav],
      60_000,
      input.signal,
    );
    if (decoded !== 0) return { ok: false, reason: cancelled(input.signal) ? "cancelled" : "failed" };
    const lang = languageHint(input.lang) ?? "auto";
    const left = Math.max(10_000, LOCAL_TIMEOUT_MS - (Date.now() - started));
    const wrote = await run(local.bin, ["-m", local.model, "-f", wav, "-l", lang, "-t", String(local.threads), "-nt", "-np", "-otxt", "-of", out], left, input.signal);
    if (wrote !== 0) return { ok: false, reason: cancelled(input.signal) ? "cancelled" : "failed" };
    const text = await fs.promises.readFile(`${out}.txt`, "utf8").catch(() => null);
    if (text === null) return { ok: false, reason: "failed" };
    return { ok: true, text: cleanWords(text), by: "local" };
  } catch {
    return { ok: false, reason: cancelled(input.signal) ? "cancelled" : "failed" };
  } finally {
    if (scratch) await fs.promises.rm(scratch, { recursive: true, force: true }).catch(() => undefined);
    localDone();
  }
}

/**
 * Write one recording down: ask each provider in order until one answers.
 * Never throws. A refusal (a 4xx: a bad key) and a failure both move on to
 * the next, so a lapsed key falls back to the server's own Whisper under
 * `auto`; a cancel stops at once.
 */
export async function transcribeTake(
  input: TranscribeInput,
  deps: { providers?: readonly ReadyProvider[]; pool?: Pool; fetchImpl?: TranscribeFetch; runLocal?: LocalRun } = {},
): Promise<TranscribeResult> {
  const providers = deps.providers ?? (deps.pool ? await providersNow(deps.pool) : []);
  if (!providers.length) return { ok: false, reason: "off" };
  let last: TranscribeResult = { ok: false, reason: "failed" };
  for (const p of providers) {
    if (cancelled(input.signal)) return { ok: false, reason: "cancelled" };
    last = p.id === "local" ? await (deps.runLocal ?? transcribeLocally)(input, p.local) : await transcribeWithHttp(input, p, deps.fetchImpl);
    if (last.ok || last.reason === "cancelled") return last;
  }
  return last;
}

/* ── The Integrations cards ─────────────────────────────────────────────── */

type Card = { key: "voice_transcription_groq_key" | "voice_transcription_key"; title: string; unlocks: string; getAt: string; placeholder: string };

/**
 * The key cards (Admin, Integrations), which `integrationCards()` in
 * server/index.ts lists with the platform's own. Here beside the providers
 * they belong to, so the copy that names a provider sits next to its address.
 * The choice between them is the picker above the cards
 * (client/src/components/admin/VoiceTranscriptionPicker.tsx).
 */
export const VOICE_TRANSCRIPTION_CARDS: readonly Card[] = [
  {
    key: "voice_transcription_groq_key",
    title: "Voice transcription, Groq (free tier)",
    unlocks:
      "Writes applicants' voice recordings down fast with Whisper large-v3-turbo, in Spanish and English. Groq's free tier covers far more than the village's cap of 60 takes a day; past it, about $0.04 an hour of audio. Blank: the server's own Whisper writes them down instead, more slowly, or OpenAI if its key is set.",
    getAt: "console.groq.com → API Keys (free account). In Data Controls you can turn off Groq's retention of requests.",
    placeholder: "gsk_…",
  },
  {
    key: "voice_transcription_key",
    title: "Voice transcription, OpenAI",
    unlocks:
      "Writes applicants' voice recordings down with OpenAI's gpt-transcribe, about $0.0045 a minute of audio. Used when it is the choice above, or under Automatic when no Groq key is set. Blank: not used.",
    getAt: "platform.openai.com → API keys. A project key with a monthly spend limit is safest.",
    placeholder: "sk-…",
  },
];
