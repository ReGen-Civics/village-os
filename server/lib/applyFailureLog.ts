/**
 * EVERY FAILED APPLICATION POST, IN ONE LOG LINE (apply safety net, 19 Nov 2026).
 *
 * Applicants met intermittent errors sending or uploading an application, and
 * nothing on the server said which refusal they met or whether the connection
 * died before any answer was written. This watches the two posts an applicant
 * makes with a body (the application itself and a voice take sent to be written
 * down) and logs one line for each answer of 400 or above, and one for each
 * connection that closed before an answer went (the client gave up, or the
 * server's own request timeout cut the upload off).
 *
 * WHAT A LINE CARRIES, and nothing else: the endpoint, the status (or
 * "no-answer"), the size the post declared, the bytes this socket read while it
 * was open, how long it took, whether it was multipart, the field the refusal
 * named, and the refusal's KEY in the shared words (never its text, never the
 * body). No name, no address, no answer, no file name.
 */
import type { NextFunction, Request, Response } from "express";
import { OPEN_WORDS } from "../../shared/openProposals";
import { ATTACHMENT_WORDS } from "../../shared/proposalAttachments";
import { VOICE_WORDS } from "../../shared/voiceNotes";
import { TRANSCRIBE_WORDS, VOICE_TRANSCRIBE_PATH } from "../../shared/voiceTranscribe";

/** The posts watched: the application, and one voice take to be written down. */
export const WATCHED_APPLY_POSTS: readonly string[] = ["/api/open-proposals", VOICE_TRANSCRIBE_PATH];

export interface ApplyFailure {
  endpoint: string;
  status: number | "no-answer";
  declaredBytes: number | null;
  readBytes: number | null;
  ms: number;
  multipart: boolean;
  field: string | null;
  errorKey: string | null;
}

/** A refusal's words back to their key in the shared word lists, so the log names the refusal without its text. */
const KEYS: Map<string, string> = (() => {
  const m = new Map<string, string>();
  const add = (prefix: string, words: Record<string, unknown>) => {
    for (const [k, v] of Object.entries(words)) if (typeof v === "string" && !m.has(v)) m.set(v, `${prefix}.${k}`);
  };
  add("OPEN_WORDS", OPEN_WORDS as unknown as Record<string, unknown>);
  add("ATTACHMENT_WORDS", ATTACHMENT_WORDS as unknown as Record<string, unknown>);
  add("VOICE_WORDS", VOICE_WORDS as unknown as Record<string, unknown>);
  add("TRANSCRIBE_WORDS", TRANSCRIBE_WORDS as unknown as Record<string, unknown>);
  return m;
})();

/** The key of a refusal's words, or "other" for words built at the time (a minimum, a cap), which may carry figures. */
export function errorKeyOf(error: unknown): string | null {
  if (typeof error !== "string" || !error) return null;
  return KEYS.get(error) ?? "other";
}

/** The one line, with nothing personal in it. */
export function applyFailureLine(f: ApplyFailure): string {
  const parts = [
    `endpoint=${f.endpoint}`,
    `status=${f.status}`,
    `declared=${f.declaredBytes ?? "none"}`,
    `read=${f.readBytes ?? "unknown"}`,
    `ms=${f.ms}`,
    `multipart=${f.multipart ? "yes" : "no"}`,
    `field=${f.field ?? "none"}`,
    `error=${f.errorKey ?? "none"}`,
  ];
  return `[open-proposals] an application post failed: ${parts.join(" ")}`;
}

/**
 * The middleware: mounted before the routes, it touches only the watched posts,
 * reads the answer's `field` and `error` as res.json is handed them, and logs on
 * the way out. `log` is the server's console.warn unless a test hands its own.
 */
export function watchApplyFailures(log: (line: string) => void = (line) => console.warn(line), clock: () => number = Date.now) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.method !== "POST" || !WATCHED_APPLY_POSTS.includes(req.path)) return next();
    const started = clock();
    const declared = Number(req.headers["content-length"] ?? NaN);
    const socket = req.socket as { bytesRead?: number } | undefined;
    const readAtStart = typeof socket?.bytesRead === "number" ? socket.bytesRead : null;
    const multipart = String(req.headers["content-type"] ?? "").toLowerCase().startsWith("multipart/");
    let field: string | null = null;
    let errorKey: string | null = null;
    const json = res.json.bind(res);
    res.json = ((body: unknown) => {
      const b = body && typeof body === "object" ? (body as Record<string, unknown>) : null;
      if (b) {
        field = typeof b.field === "string" ? b.field.slice(0, 40) : null;
        errorKey = errorKeyOf(b.error);
      }
      return json(body);
    }) as Response["json"];
    let done = false;
    const line = (status: number | "no-answer") => {
      const now = typeof socket?.bytesRead === "number" ? socket.bytesRead : null;
      log(
        applyFailureLine({
          endpoint: req.path,
          status,
          declaredBytes: Number.isFinite(declared) ? declared : null,
          readBytes: now !== null && readAtStart !== null ? Math.max(0, now - readAtStart) : null,
          ms: Math.max(0, clock() - started),
          multipart,
          field,
          errorKey,
        }),
      );
    };
    res.on("finish", () => {
      done = true;
      if (res.statusCode >= 400) line(res.statusCode);
    });
    res.on("close", () => {
      if (!done && !res.writableFinished) line("no-answer");
    });
    next();
  };
}
