/**
 * THE VOICE STEP'S TRANSCRIPTION SERVICE (the lead, 17 Nov 2026: "It's okay for
 * them to reach an AI assistant, let's make it all work!"). One take in, its
 * words out. The contract the page reads is shared/voiceTranscribe.ts; the door
 * is server/routes/openProposalVoiceTranscribe.ts.
 *
 * WHY A PROVIDER OF ITS OWN. The village's AI guide (assistant_api_key) speaks
 * text only and takes no audio, and nothing else here turned sound into words
 * on the server: call recordings arrive with their transcript already written.
 * So the voice step gets one provider, named by id below, with one key slot in
 * the secrets plane (server/lib/secrets.ts `voice_transcription_key`).
 *
 * THE KEY IS ADMIN-TYPED, SEALED, AND READ HERE ONLY. It is typed under Admin,
 * Integrations, sealed at rest like every other slot, has no host variable,
 * and leaves the server only in the Authorization header of the call to the
 * provider's fixed address, dialled through the pinned-IP guard like every
 * other outbound call (toolcheck.ts `guardedFetch`). It is never logged and
 * never returned.
 *
 * NO KEY, NO SERVICE. `transcriptionProvider()` answers null and the door says
 * `on: false`; the page draws no button and the step works as it always did.
 *
 * WHAT IS SENT. The bytes of the one take the applicant asked to be written
 * down, its format, and the language their page is in. No name, address,
 * application or any other answer. The reply's words go back to their page;
 * nothing is stored or logged here.
 */
import crypto from "node:crypto";
import { secretValue } from "./secrets";
import { guardedFetch } from "./toolcheck";
import type { VoiceNoteKind } from "../../shared/voiceNotes";
import { VOICE_NOTE_TYPES } from "../../shared/voiceNotes";
import { VOICE_TRANSCRIBE_TEXT_MAX } from "../../shared/voiceTranscribe";

export interface TranscriptionProviderDef {
  /** The provider's id, as the Integrations card and the door name it. */
  id: string;
  /** Who it is, as an admin knows them. */
  name: string;
  /** The secrets-store slot holding the village's own key. */
  slot: "voice_transcription_key";
  /** The one address the bytes go to. Fixed in code: an admin types a key, never an address. */
  url: string;
  /** The provider's speech-to-text model. */
  model: string;
}

/**
 * The providers this platform can send a take to. One today: OpenAI's audio
 * transcription endpoint, which reads WebM, Ogg and MP4 audio as browsers
 * record them, up to 25 MB, so every take the step allows (10 MB at most) goes
 * as recorded with no conversion first.
 */
export const TRANSCRIPTION_PROVIDERS: readonly TranscriptionProviderDef[] = [
  { id: "openai", name: "OpenAI", slot: "voice_transcription_key", url: "https://api.openai.com/v1/audio/transcriptions", model: "whisper-1" },
];

export const DEFAULT_TRANSCRIPTION_PROVIDER = TRANSCRIPTION_PROVIDERS[0];

/** The configured provider and its key, or null when no admin has typed one (or the store is not loaded yet). Never throws. */
export function transcriptionProvider(env: NodeJS.ProcessEnv = process.env): { def: TranscriptionProviderDef; key: string } | null {
  for (const def of TRANSCRIPTION_PROVIDERS) {
    let key = "";
    try {
      key = secretValue(def.slot, env).trim();
    } catch {
      key = "";
    }
    if (key) return { def, key };
  }
  return null;
}

export interface TranscribeInput {
  bytes: Buffer;
  kind: VoiceNoteKind;
  /** The page's language, "es-CR" or "en": only its first part is sent. */
  lang?: string;
}

export type TranscribeResult = { ok: true; text: string } | { ok: false; reason: "off" | "refused" | "failed" };

/** The language hint the provider takes: two or three letters, or nothing. */
export function languageHint(lang: unknown): string | null {
  const m = /^([a-z]{2,3})(?:$|[-_@.])/.exec(String(lang ?? "").trim().toLowerCase());
  return m ? m[1] : null;
}

/** How long one call may take before the take is reported unwritten. */
export const TRANSCRIBE_TIMEOUT_MS = 90_000;

/**
 * Send one take and read its words. Never throws: a provider that refuses,
 * fails or times out is `failed` (or `refused` for a 4xx, which retrying will
 * not fix), and the page tells the applicant their recording is still kept.
 */
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

/** How the call is made: the pinned dialer, unless a suite hands in its own. */
export type TranscribeFetch = (url: string, init: { method: string; headers: Record<string, string>; body: Uint8Array; signal?: AbortSignal }) => Promise<Response>;

/**
 * Send one take and read its words. Never throws: a provider that refuses,
 * fails or times out is `failed` (or `refused` for a 4xx, which retrying will
 * not fix), and the page tells the applicant their recording is still kept.
 */
export async function transcribeTake(
  input: TranscribeInput,
  deps: { fetchImpl?: TranscribeFetch; provider?: { def: TranscriptionProviderDef; key: string } | null } = {},
): Promise<TranscribeResult> {
  const provider = deps.provider === undefined ? transcriptionProvider() : deps.provider;
  if (!provider) return { ok: false, reason: "off" };
  const doFetch: TranscribeFetch = deps.fetchImpl ?? ((url, init) => guardedFetch(url, init as RequestInit));
  const hint = languageHint(input.lang);
  const { body, contentType } = multipartBody(
    { model: provider.def.model, response_format: "json", ...(hint ? { language: hint } : {}) },
    { name: `take.${input.kind}`, type: VOICE_NOTE_TYPES[input.kind], bytes: input.bytes },
  );
  try {
    const res = await doFetch(provider.def.url, {
      method: "POST",
      headers: { Authorization: `Bearer ${provider.key}`, "Content-Type": contentType, Accept: "application/json" },
      body,
      signal: AbortSignal.timeout(TRANSCRIBE_TIMEOUT_MS),
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
    return { ok: true, text: parsed.text.trim().slice(0, VOICE_TRANSCRIBE_TEXT_MAX) };
  } catch {
    return { ok: false, reason: "failed" };
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

/**
 * The Integrations card for the key (Admin, Integrations), which
 * `integrationCards()` in server/index.ts lists with the platform's own. Here
 * beside the provider it belongs to, so the copy that names the provider sits
 * next to the address the bytes go to.
 */
export const VOICE_TRANSCRIPTION_CARD: { key: "voice_transcription_key"; title: string; unlocks: string; getAt: string; placeholder: string } = {
  key: "voice_transcription_key",
  title: "Voice transcription, OpenAI",
  unlocks:
    "On the public application, \"Write down my words\" under each recording: the take goes to OpenAI's transcription service and the words come back to the applicant to read and fix before Send. It serves browsers that cannot write words down themselves, such as Firefox. Blank means the button is not shown and recording works as before. Capped at 60 takes a day for the whole village.",
  getAt: "platform.openai.com → API keys. A project key with a monthly spend limit is safest.",
  placeholder: "sk-…",
};
