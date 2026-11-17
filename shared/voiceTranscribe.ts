/**
 * WRITING A TAKE DOWN ON THE SERVER (the lead, 17 Nov 2026: "It's okay for them
 * to reach an AI assistant, let's make it all work!" and "make sure they work
 * on all browsers"). The contract between the voice step on the public
 * application and server/routes/openProposalVoiceTranscribe.ts.
 *
 *   GET  /api/open-proposals/voice-transcribe          { on }
 *   POST /api/open-proposals/voice-transcribe          multipart: `voice` (one take), `seconds`, `lang`, `link`
 *                                                      -> { text }
 *
 * WHEN IT RUNS. Only when the applicant presses "Write down my words" on one
 * take, beside the line that says an AI service writes it down. Firefox and
 * some phones have no live speech engine, and a live engine can catch only part
 * of a take; this is the fallback for both. The words come back to the page,
 * into "What we heard, in your words", where the applicant reads and fixes them
 * before Send. Nothing is stored or logged on our side.
 *
 * OFF UNTIL AN ADMIN TYPES A KEY. The service is the village's own account with
 * a transcription provider (server/lib/voiceTranscription.ts), typed under
 * Admin, Integrations. With no key the GET says `on: false`, the button is not
 * drawn, and the step works exactly as before.
 *
 * CAPPED. One take is at most VOICE_NOTE_MAX_SECONDS long and VOICE_NOTE_MAX_BYTES
 * big, the same caps as Send. Each connection (or signed-in person) has an
 * hourly and a daily count, and the village a daily ceiling, every one failing
 * closed: each stands in front of a paid call.
 *
 * Pure, so the page and the server import it alike.
 */
import { VOICE_NOTE_MAX_SECONDS } from "./voiceNotes";

export const VOICE_TRANSCRIBE_PATH = "/api/open-proposals/voice-transcribe";

/** Takes one connection, or one signed-in person, may have written down in an hour: three takes, each tried twice. */
export const VOICE_TRANSCRIBE_PER_HOUR = 6;
/** The same, in a day. */
export const VOICE_TRANSCRIBE_PER_CONNECTION_DAY = 12;
/** Every take written down for the whole village in a day: at most 300 minutes of audio. */
export const VOICE_TRANSCRIBE_PER_DAY = 60;
/** Takes being written down at once, across the village. */
export const VOICE_TRANSCRIBE_AT_ONCE = 3;
/** The longest take that may be sent, with the page's own rounding allowed for. */
export const VOICE_TRANSCRIBE_MAX_SECONDS = VOICE_NOTE_MAX_SECONDS + 5;
/** The most words that come back for one take. */
export const VOICE_TRANSCRIBE_TEXT_MAX = 6000;

export const TRANSCRIBE_WORDS = {
  consentLine: "Your recording is transcribed by an AI service so the team can read it.",
  closed: "Applications are closed just now, so recordings can't be written down.",
  off: "Writing recordings down isn't switched on here. Type what you said instead.",
  tooMany: "That's a lot of recordings written down for one connection. Type what you said, or try again in an hour.",
  unavailable: "We couldn't write this recording down just now. Your recording is still kept. Try again in a moment, or type what you said.",
  busy: "A few recordings are being written down already. Try again in a moment.",
  tooLong: `Only takes up to ${VOICE_NOTE_MAX_SECONDS / 60} minutes can be written down.`,
  heardNothing: "The service heard no words in this recording. Type what you said, or record again.",
} as const;
