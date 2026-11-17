/**
 * WRITING DOWN A KEPT RECORDING (the lead, 17 Nov 2026: "Transcribe them!
 * They've personally consented with me."). The contract is
 * shared/voiceTranscribe.ts; the provider server/lib/voiceTranscription.ts.
 *
 * One recording or clip an applicant sent with their tick, read from the
 * proposal's private folder (checked against its fingerprint), written down by
 * the village's transcription service, and kept with the application as an AI
 * transcript (shared/voiceNotes.ts `written`), so the people reviewing it can
 * read it. The doors that call this are Admin's applications panel
 * (routes/openProposals.ts, one recording and "Transcribe all waiting") and
 * the deciders' page (routes/openProposalDecide.ts, one recording): each
 * checks who may hear the recording first, exactly as its Listen door does.
 *
 * CAPPED, each failing closed: a person's hour and the village's day, apart
 * from the applicants' own counts. One "Transcribe all waiting" run at a time,
 * of at most VOICE_TRANSCRIBE_WAITING_MAX recordings, one after another.
 *
 * LOGGED WITHOUT THE CONTENT. Each run writes one line: which door, which
 * application and recording (ids only), which service, how it ended and how
 * long it took. Never a word of the transcript, never a name.
 */
import type { Pool } from "mysql2/promise";
import { limitState as dbLimitState } from "../repos/rateHits";
import { setVoiceWritten, type StoredOpenProposal } from "../repos/openProposals";
import { readVoiceNote } from "../lib/proposalFiles";
import { transcribeTake, type ReadyProvider, type TranscribeInput, type TranscribeResult } from "../lib/voiceTranscription";
import type { VoiceNote, WrittenWords } from "../../shared/voiceNotes";
import {
  STORED_TRANSCRIBE_WORDS,
  VOICE_TRANSCRIBE_STORED_PER_DAY,
  VOICE_TRANSCRIBE_STORED_PER_HOUR,
  VOICE_TRANSCRIBE_WAITING_MAX,
} from "../../shared/voiceTranscribe";

const HOUR_MS = 60 * 60 * 1000;

export interface StoredTranscribeDeps {
  getPool: () => Pool;
  proposalFileDir?: string;
  /** The limiter's whole answer; `unavailable` refuses (fail closed). Absent: the rate-hits table. */
  limitState?: (key: string, max: number, windowMs: number) => Promise<"under" | "over" | "unavailable">;
  /** The providers the admin's choice asks now. */
  providers?: () => Promise<readonly ReadyProvider[]>;
  /** The provider call; a suite hands in its own. */
  transcribe?: (input: TranscribeInput) => Promise<TranscribeResult>;
  /** Where the run's one line goes. Absent: the server log. */
  log?: (line: string) => void;
  now?: () => Date;
}

export type StoredOutcome = { status: number; body: Record<string, unknown> };

/** Every recording and clip of a proposal that has no AI transcript yet. */
export function waitingRecordings(p: StoredOpenProposal): VoiceNote[] {
  const v = p.body.voice;
  if (!v) return [];
  return [...v.notes, ...(v.clips ?? [])].filter((n) => !v.written?.[n.id]);
}

async function capsAllow(deps: StoredTranscribeDeps, who: string): Promise<StoredOutcome | null> {
  const limit = deps.limitState ?? ((key, max, windowMs) => dbLimitState(deps.getPool(), key, max, windowMs));
  const caps: Array<[string, number, number, string]> = [
    [`voice-written:${who}`, VOICE_TRANSCRIBE_STORED_PER_HOUR, HOUR_MS, STORED_TRANSCRIBE_WORDS.tooMany],
    ["voice-written:day", VOICE_TRANSCRIBE_STORED_PER_DAY, 24 * HOUR_MS, STORED_TRANSCRIBE_WORDS.dayFull],
  ];
  for (const [key, max, windowMs, words] of caps) {
    const got = await limit(key, max, windowMs).catch(() => "unavailable" as const);
    if (got === "unavailable") return { status: 503, body: { error: STORED_TRANSCRIBE_WORDS.unavailable } };
    if (got === "over") return { status: 429, body: { error: words } };
  }
  return null;
}

/**
 * Write one kept recording down and keep the words with its application. The
 * caller has already checked that this person may hear it.
 */
export async function writeDownStored(deps: StoredTranscribeDeps, p: StoredOpenProposal, note: VoiceNote, who: string, door: "admin" | "decider"): Promise<StoredOutcome> {
  const log = deps.log ?? ((line: string) => console.info(line));
  const providers = deps.providers ?? (async () => []);
  const transcribe = deps.transcribe ?? (async (input: TranscribeInput) => transcribeTake(input, { providers: await providers() }));
  if (!deps.proposalFileDir) return { status: 404, body: { error: "not_found" } };
  if (!deps.transcribe && !(await providers()).length) return { status: 409, body: { error: STORED_TRANSCRIBE_WORDS.off, on: false } };
  const refused = await capsAllow(deps, who);
  if (refused) {
    log(`[voice-written] ${door} proposal=${p.id} recording=${note.id} result=capped`);
    return refused;
  }
  const bytes = await readVoiceNote(deps.proposalFileDir, p.id, note);
  if (!bytes) return { status: 404, body: { error: "not_found" } };
  const started = Date.now();
  const got = await transcribe({ bytes, kind: note.kind });
  const ms = Date.now() - started;
  log(`[voice-written] ${door} proposal=${p.id} recording=${note.id} seconds=${Math.round(note.seconds)} by=${got.ok ? got.by : "none"} result=${got.ok ? (got.text ? "written" : "no-words") : got.reason} ms=${ms}`);
  if (!got.ok) return got.reason === "off" ? { status: 409, body: { error: STORED_TRANSCRIBE_WORDS.off, on: false } } : { status: 503, body: { error: STORED_TRANSCRIBE_WORDS.unavailable } };
  if (!got.text) return { status: 200, body: { written: null, note: STORED_TRANSCRIBE_WORDS.heardNothing } };
  const written: WrittenWords = { text: got.text, at: (deps.now ?? (() => new Date()))().toISOString(), by: got.by };
  if (!(await setVoiceWritten(deps.getPool(), p.id, note.id, written))) return { status: 404, body: { error: "not_found" } };
  return { status: 200, body: { written } };
}

/* ── "Transcribe all waiting" ───────────────────────────────────────────── */

let waitingRun: Promise<void> | null = null;

/** Whether a "Transcribe all waiting" run is going now. */
export function waitingRunGoing(): boolean {
  return waitingRun !== null;
}

/**
 * Start one run over the recordings that have no words yet, one after
 * another, at most VOICE_TRANSCRIBE_WAITING_MAX of them, stopping at the first
 * cap. Answers at once with how many it took on; the panel shows each
 * transcript as it lands. A second press while one runs is told so.
 */
export function startWaitingRun(deps: StoredTranscribeDeps, proposals: readonly StoredOpenProposal[], who: string): StoredOutcome {
  if (waitingRun) return { status: 409, body: { error: STORED_TRANSCRIBE_WORDS.running, running: true } };
  const queue = proposals.flatMap((p) => waitingRecordings(p).map((note) => ({ p, note })));
  const taken = queue.slice(0, VOICE_TRANSCRIBE_WAITING_MAX);
  if (!taken.length) return { status: 200, body: { started: 0, waiting: 0 } };
  waitingRun = (async () => {
    for (const { p, note } of taken) {
      const out = await writeDownStored(deps, p, note, who, "admin").catch(() => ({ status: 503, body: {} }) as StoredOutcome);
      // A cap or a service that is off stops the run: the rest would be refused the same way.
      if (out.status === 429 || out.status === 409) break;
    }
  })().finally(() => {
    waitingRun = null;
  });
  return { status: 202, body: { started: taken.length, waiting: queue.length } };
}

/** For a suite: wait for the run going now to finish. */
export async function waitingRunSettled(): Promise<void> {
  await waitingRun;
}
