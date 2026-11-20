/**
 * AN APPLICATION SENT IN PARTS (the lead, 19 Nov 2026: "ensure we can receive full uploads").
 *
 * The host's edge closes any request whose body is still arriving after five minutes (shared/applyLimits.ts
 * HOST_BODY_UPLOAD_MS). A whole application with its files and recordings can be hundreds of megabytes, far past
 * what a slow line sends in five minutes, so the page sends each file, take and clip first, one request each
 * (POST /api/open-proposals/parts), and then the application itself, naming the parts by the ids the server gave
 * back. Each request has its own window for its own size (sendTimeoutMs). A refusal of any part stops the send and
 * is answered exactly as a refusal of the whole would be, on its field.
 *
 * Every Send sends its parts again: an id is never kept on the device, so a retry never names a part the server
 * has swept.
 */
import { sendTimeoutMs } from "@/components/fireflyPath/applySendFailure";
import { applicationRequest, voiceSent, type VoiceState } from "@/components/voice/VoiceInvite";
import { voiceKindOfType } from "@shared/voiceNotes";

export type PartKind = "files" | "voice" | "clips";

export interface PartToSend {
  kind: PartKind;
  blob: Blob;
  name: string;
}

/** The ids the server gave each part, by list, in the order sent. */
export interface StagedParts {
  files: string[];
  voice: string[];
  clips: string[];
}

export const PARTS_PATH = "/api/open-proposals/parts";
export const APPLICATION_PATH = "/api/open-proposals";

/**
 * What goes ahead of the application: every file, and the recordings and clips only with the tick. Takes and clips
 * keep the order the application's own voice description names them in, which is how the server pairs them.
 */
export function partsToSend(files: readonly File[], voice: VoiceState): PartToSend[] {
  const out: PartToSend[] = files.map((f) => ({ kind: "files", blob: f, name: f.name }));
  if (!voiceSent(voice)) return out;
  voice.takes.forEach((t, i) => out.push({ kind: "voice", blob: t.blob, name: `voice-${i + 1}.${voiceKindOfType(t.blob.type)}` }));
  Object.entries(voice.clips).forEach(([field, c]) => out.push({ kind: "clips", blob: c.blob, name: `${field}.${voiceKindOfType(c.blob.type)}` }));
  return out;
}

type Fetch = (url: string, init: RequestInit) => Promise<Response>;

/** One request with its own window, given up on as a timeout (an AbortError) past it or when `outer` is aborted. */
async function withWindow(fetchImpl: Fetch, url: string, init: RequestInit, ms: number, outer?: AbortSignal): Promise<Response> {
  const stop = new AbortController();
  const timer = setTimeout(() => stop.abort(), ms);
  const onOuter = () => stop.abort();
  outer?.addEventListener("abort", onOuter);
  try {
    if (outer?.aborted) stop.abort();
    return await fetchImpl(url, { ...init, signal: stop.signal });
  } finally {
    clearTimeout(timer);
    outer?.removeEventListener("abort", onOuter);
  }
}

/**
 * Send an application: its parts first, one request each, then the application naming them. Resolves with the
 * response the page reads (a part's refusal, or the application's own answer); rejects as the network or a
 * timeout does, exactly as one fetch would.
 */
export async function sendApplication(
  proposal: Record<string, unknown>,
  files: readonly File[],
  voice: VoiceState,
  opts: { link?: string; signal?: AbortSignal; fetchImpl?: Fetch; onPart?: (sent: number, of: number) => void } = {},
): Promise<Response> {
  const fetchImpl: Fetch = opts.fetchImpl ?? ((url, init) => fetch(url, init));
  const parts = partsToSend(files, voice);
  const staged: StagedParts = { files: [], voice: [], clips: [] };
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    opts.onPart?.(i, parts.length);
    const fd = new FormData();
    // The fields first: the server reads them before the file's bytes.
    fd.append("kind", p.kind);
    if (opts.link) fd.append("link", opts.link);
    fd.append("part", p.blob, p.name);
    const res = await withWindow(fetchImpl, PARTS_PATH, { method: "POST", body: fd }, sendTimeoutMs(true, p.blob.size), opts.signal);
    if (!res.ok) return res;
    const data = (await res.json().catch(() => ({}))) as { id?: unknown };
    if (typeof data.id !== "string") return new Response(JSON.stringify({}), { status: 502, headers: { "Content-Type": "application/json" } });
    staged[p.kind].push(data.id);
  }
  opts.onPart?.(parts.length, parts.length);
  const request = parts.length ? applicationRequest(proposal, files, voice, staged) : applicationRequest(proposal, files, voice);
  const bytes = request.body instanceof FormData ? new Blob([JSON.stringify(proposal)]).size : 0;
  return withWindow(fetchImpl, APPLICATION_PATH, request, sendTimeoutMs(request.body instanceof FormData, bytes), opts.signal);
}
