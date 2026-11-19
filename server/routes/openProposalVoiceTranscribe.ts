/**
 * "WRITE DOWN MY WORDS" ON THE PUBLIC APPLICATION, one door (the lead, 17 Nov
 * 2026; the contract is shared/voiceTranscribe.ts, the provider
 * server/lib/voiceTranscription.ts).
 *
 *   GET  /api/open-proposals/voice-transcribe    { on }
 *   POST /api/open-proposals/voice-transcribe    multipart `voice`, `seconds`, `lang`, `link`  -> { text }
 *
 * Registered from routes/openProposals.ts, which hands over its own door and
 * limiter, so server/index.ts gains no line for it.
 *
 * BY ITSELF (the lead, 17 Nov 2026: "actually make it automatic and the button
 * is to turn it off!"). The page sends each take and clip as soon as it is
 * recorded, while the applicant's switch is on; closing the request (the
 * switch turned off, or the page left) aborts the provider call.
 *
 * WHO CAN ASK. Anybody the application is open to, as with "Draft my answers"
 * (openProposalVoiceDraft.ts): an applicant has no account. So the same kind
 * of caps stand in front of it, each failing closed, because each stands in
 * front of a paid call: per connection an hour and a day, per signed-in person
 * an hour and a day instead, and a ceiling a day for the whole village.
 *
 * ONE TAKE, AT MOST FIFTEEN MINUTES (shared/applyLimits.ts). The bytes are read by their own first bytes
 * (WebM, Ogg or MP4 audio, as Send reads them), held to VOICE_NOTE_MAX_BYTES,
 * and the page's own length for the take to VOICE_TRANSCRIBE_MAX_SECONDS.
 * Only a few are read at once.
 *
 * NOTHING IS STORED OR LOGGED. The take is held in memory for the one call;
 * its words go back to the asker's page alone.
 */
import type { Express, NextFunction, Request, Response } from "express";
import multer from "multer";
import { VOICE_NOTE_MAX_BYTES, VOICE_WORDS, voiceNoteKind } from "../../shared/voiceNotes";
import {
  TRANSCRIBE_WORDS,
  VOICE_TRANSCRIBE_AT_ONCE,
  VOICE_TRANSCRIBE_CLIPS_PER_CONNECTION_DAY,
  VOICE_TRANSCRIBE_CLIPS_PER_DAY,
  VOICE_TRANSCRIBE_CLIPS_PER_HOUR,
  VOICE_TRANSCRIBE_MAX_SECONDS,
  VOICE_TRANSCRIBE_PATH,
  VOICE_TRANSCRIBE_PER_CONNECTION_DAY,
  VOICE_TRANSCRIBE_PER_DAY,
  VOICE_TRANSCRIBE_PER_HOUR,
} from "../../shared/voiceTranscribe";
import { uploadWindowMs } from "../../shared/applyLimits";
import { liftRequestTimeout } from "../lib/uploadWindow";
import { transcribeTake, type ReadyProvider, type TranscribeInput, type TranscribeResult } from "../lib/voiceTranscription";

const HOUR_MS = 60 * 60 * 1000;
/** The multipart wrapping around one take: its headers and the three small fields. */
const ENVELOPE_BYTES = 64 * 1024;

export interface VoiceTranscribeDeps {
  door: (rawLink: unknown) => Promise<{ open: boolean }>;
  /** The limiter's whole answer; `unavailable` refuses (fail closed). */
  limitState: (key: string, max: number, windowMs: number) => Promise<"under" | "over" | "unavailable">;
  authedUser?: (req: Request) => Promise<{ id: string | number } | null>;
  clientIp: (req: Request) => string;
  ipBucket: (ip: string) => string;
  /** The providers the admin's choice asks now, in order (server/lib/voiceTranscription.ts `providersNow`). */
  providers?: () => Promise<readonly ReadyProvider[]>;
  /** Whether any provider would be asked; tests hand in their own. */
  enabled?: () => boolean | Promise<boolean>;
  /** The provider call; tests hand in their own. */
  transcribe?: (input: TranscribeInput) => Promise<TranscribeResult>;
}

export function registerVoiceTranscribe(app: Express, deps: VoiceTranscribeDeps): void {
  const providers = deps.providers ?? (async () => []);
  const enabled = deps.enabled ?? (async () => (await providers()).length > 0);
  const transcribe = deps.transcribe ?? (async (input: TranscribeInput) => transcribeTake(input, { providers: await providers() }));
  const isOn = async () => {
    try {
      return await enabled();
    } catch {
      return false;
    }
  };
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: VOICE_NOTE_MAX_BYTES, files: 1, fields: 6, fieldSize: 4096, parts: 8 },
  }).single("voice");
  let reading = 0;

  app.get(VOICE_TRANSCRIBE_PATH, async (_req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.json({ on: await isOn() });
  });

  app.post(
    VOICE_TRANSCRIBE_PATH,
    async (req: Request, res: Response, next: NextFunction) => {
      res.setHeader("Cache-Control", "no-store");
      if (!(await isOn())) return void res.status(404).json({ error: TRANSCRIBE_WORDS.off, on: false });
      const length = Number(req.headers["content-length"]);
      if (!Number.isFinite(length) || length > VOICE_NOTE_MAX_BYTES + ENVELOPE_BYTES) {
        return void res.status(Number.isFinite(length) ? 413 : 411).json({ error: VOICE_WORDS.tooBig });
      }
      if (reading >= VOICE_TRANSCRIBE_AT_ONCE) return void res.status(503).json({ error: TRANSCRIBE_WORDS.busy });
      reading += 1;
      let released = false;
      const release = () => {
        if (!released) reading -= 1;
        released = true;
      };
      res.on("close", release);
      res.on("finish", release);
      // One take may take longer than Node's five minutes to arrive on a slow line: this request alone gets its own window.
      liftRequestTimeout(req, uploadWindowMs(length));
      upload(req, res, (err: any) => {
        if (err) return void res.status(err?.code === "LIMIT_FILE_SIZE" ? 413 : 400).json({ error: err?.code === "LIMIT_FILE_SIZE" ? VOICE_WORDS.tooBig : VOICE_WORDS.wrongType });
        next();
      });
    },
    async (req: Request, res: Response) => {
      try {
        const body = (req.body ?? {}) as Record<string, unknown>;
        if (!(await deps.door(body.link)).open) return res.status(403).json({ error: TRANSCRIBE_WORDS.closed });
        const file = (req as any).file as { buffer: Buffer } | undefined;
        const bytes = file?.buffer;
        const kind = bytes ? voiceNoteKind(new Uint8Array(bytes.subarray(0, 16))) : null;
        if (!bytes || !kind) return res.status(400).json({ error: VOICE_WORDS.wrongType });
        const seconds = Number(body.seconds);
        if (!Number.isFinite(seconds) || seconds <= 0 || seconds > VOICE_TRANSCRIBE_MAX_SECONDS) return res.status(400).json({ error: TRANSCRIBE_WORDS.tooLong });

        const bucket = deps.ipBucket(deps.clientIp(req));
        const me = deps.authedUser ? await deps.authedUser(req).catch(() => null) : null;
        const uid = me?.id !== undefined && me?.id !== null ? String(me.id) : null;
        const who = uid ? `user:${uid}` : `ip:${bucket}`;
        // A clip beside an answer has its own count, apart from the takes (shared/voiceTranscribe.ts).
        const clip = body.kind === "clip";
        const caps: Array<[string, number, number, 429 | 503]> = clip
          ? [
              [`open-proposal:voice-transcribe:clips-${who}`, VOICE_TRANSCRIBE_CLIPS_PER_HOUR, HOUR_MS, 429],
              [`open-proposal:voice-transcribe:clips-daily-${who}`, VOICE_TRANSCRIBE_CLIPS_PER_CONNECTION_DAY, 24 * HOUR_MS, 429],
            ]
          : [
              [`open-proposal:voice-transcribe:${who}`, VOICE_TRANSCRIBE_PER_HOUR, HOUR_MS, 429],
              [`open-proposal:voice-transcribe:daily-${who}`, VOICE_TRANSCRIBE_PER_CONNECTION_DAY, 24 * HOUR_MS, 429],
            ];
        // The village's day, also counted apart: 60 takes, 200 clips.
        caps.push(clip ? ["open-proposal:voice-transcribe:clips-day", VOICE_TRANSCRIBE_CLIPS_PER_DAY, 24 * HOUR_MS, 503] : ["open-proposal:voice-transcribe:day", VOICE_TRANSCRIBE_PER_DAY, 24 * HOUR_MS, 503]);
        for (const [key, max, windowMs, status] of caps) {
          const got = await deps.limitState(key, max, windowMs);
          if (got === "unavailable") return res.status(503).json({ error: TRANSCRIBE_WORDS.unavailable });
          if (got === "over") return res.status(status).json({ error: status === 429 ? TRANSCRIBE_WORDS.tooMany : TRANSCRIBE_WORDS.unavailable });
        }

        const lang = typeof body.lang === "string" ? body.lang : undefined;
        // The applicant turned writing down off, or left: the call stops (the lead, 17 Nov 2026: the switch cancels one already running).
        const stop = new AbortController();
        res.on("close", () => {
          if (!res.writableEnded) stop.abort();
        });
        const got = await transcribe({ bytes, kind, lang, signal: stop.signal });
        if (!got.ok && got.reason === "cancelled") return res.status(499).end();
        if (!got.ok) return res.status(got.reason === "off" ? 404 : 503).json({ error: got.reason === "off" ? TRANSCRIBE_WORDS.off : TRANSCRIBE_WORDS.unavailable });
        if (!got.text) return res.status(200).json({ text: "", note: TRANSCRIBE_WORDS.heardNothing });
        return res.json({ text: got.text });
      } catch {
        return res.status(503).json({ error: TRANSCRIBE_WORDS.unavailable });
      }
    },
  );
}
