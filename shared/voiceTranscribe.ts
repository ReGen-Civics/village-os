/**
 * WRITING A TAKE DOWN ON THE SERVER (the lead, 17 Nov 2026: "It's okay for them
 * to reach an AI assistant, let's make it all work!" and "make sure they work
 * on all browsers"). The contract between the voice step on the public
 * application and server/routes/openProposalVoiceTranscribe.ts.
 *
 *   GET  /api/open-proposals/voice-transcribe          { on }
 *   POST /api/open-proposals/voice-transcribe          multipart: `voice` (one take or clip), `seconds`, `lang`, `link`, `kind` (take | clip)
 *                                                      -> { text }
 *
 * WHEN IT RUNS (the lead, 17 Nov 2026: "actually make it automatic and the
 * button is to turn it off!"). By itself, as soon as a take or a clip is
 * recorded, while "Write down my words automatically" stays on. That switch is
 * shown before recording, beside the line that says an AI service writes it
 * down, is on unless the applicant turns it off, and is remembered for their
 * visit. Turning it off stops every send and cancels one already running; each
 * take then offers "Write down my words" to press. The words come back to the
 * page, into "What we heard, in your words", where the applicant reads and
 * fixes them before Send; nothing they typed is overwritten. Nothing is stored
 * or logged on our side.
 *
 * WORKS WITH NO KEY. With no key typed, the server's own Whisper writes it down
 * where the image ships one (server/lib/voiceTranscription.ts, provider
 * `local`); a key for Groq (free tier) or OpenAI makes it faster. An admin
 * picks under Admin, Integrations, or chooses `off`, and then the GET says
 * `on: false`, nothing is drawn, and the step works exactly as before.
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
/**
 * CLIPS HAVE THEIR OWN COUNT (the lead, 17 Nov 2026: it should "just work for
 * applicants mid-process"). A clip beside an answer is short, and with
 * writing down automatic an applicant records many, so clips are counted apart
 * from takes: a connection's clips never use up its takes' hour or day.
 */
export const VOICE_TRANSCRIBE_CLIPS_PER_HOUR = 20;
export const VOICE_TRANSCRIBE_CLIPS_PER_CONNECTION_DAY = 40;
/** Every clip written down for the whole village in a day, apart from the takes' 60: well inside Groq's free 2,000 requests a day, and nothing at all on the server's own Whisper. */
export const VOICE_TRANSCRIBE_CLIPS_PER_DAY = 200;

/** Every take written down for the whole village in a day: at most 300 minutes of audio. */
export const VOICE_TRANSCRIBE_PER_DAY = 60;
/** Takes being written down at once, across the village. */
export const VOICE_TRANSCRIBE_AT_ONCE = 3;
/** The longest take that may be sent, with the page's own rounding allowed for. */
export const VOICE_TRANSCRIBE_MAX_SECONDS = VOICE_NOTE_MAX_SECONDS + 5;
/** The most words that come back for one take. */
export const VOICE_TRANSCRIBE_TEXT_MAX = 6000;

export const TRANSCRIBE_WORDS = {
  consentLine: "Your recording is transcribed by an AI service so the team can read it. You can turn this off.",
  closed: "Applications are closed just now, so recordings can't be written down.",
  off: "Writing recordings down isn't switched on here. Type what you said instead.",
  tooMany: "That's a lot of recordings written down for one connection. Type what you said, or try again in an hour.",
  unavailable: "We couldn't write this recording down just now. Your recording is still kept. Try again in a moment, or type what you said.",
  busy: "A few recordings are being written down already. Try again in a moment.",
  tooLong: `Only takes up to ${VOICE_NOTE_MAX_SECONDS / 60} minutes can be written down.`,
  heardNothing: "The service heard no words in this recording. Type what you said, or record again.",
} as const;

/*
 * WHICH SERVICE WRITES IT DOWN (the lead, 17 Nov 2026: "Look for other options
 * that are free ... find a better route (preferably free)"). An admin picks
 * under Admin, Integrations; keys stay in the secrets plane, sealed and
 * write-only (server/lib/voiceTranscription.ts names each provider's address).
 *
 *   auto    the first that is ready: Groq (a free tier, key needed), then
 *           OpenAI (paid, key needed), then this server's own Whisper (no key,
 *           no cost per use, slower). If one fails, the next is tried.
 *   groq | openai | local   only that one.
 *   off     none: nothing is sent anywhere, and the page draws no AI line.
 */
export const TRANSCRIPTION_PROVIDER_IDS = ["groq", "openai", "local"] as const;
export type TranscriptionProviderId = (typeof TRANSCRIPTION_PROVIDER_IDS)[number];
export const TRANSCRIPTION_CHOICES = ["auto", ...TRANSCRIPTION_PROVIDER_IDS, "off"] as const;
export type TranscriptionChoice = (typeof TRANSCRIPTION_CHOICES)[number];
export const DEFAULT_TRANSCRIPTION_CHOICE: TranscriptionChoice = "auto";

/** A choice as read from a setting or a request, falling back to the default. Never throws. */
export function transcriptionChoiceOf(raw: unknown): TranscriptionChoice {
  return (TRANSCRIPTION_CHOICES as readonly string[]).includes(String(raw)) ? (raw as TranscriptionChoice) : DEFAULT_TRANSCRIPTION_CHOICE;
}

/** Admin, Integrations: the picker's door. GET -> TranscriptionSettings; PUT { choice }. */
export const VOICE_TRANSCRIPTION_SETTINGS_PATH = "/api/admin/voice-transcription";

export interface TranscriptionProviderStatus {
  id: TranscriptionProviderId;
  /** Ready to take a recording now: a key is typed, or the model is installed here. */
  ready: boolean;
}

export interface TranscriptionSettings {
  choice: TranscriptionChoice;
  /** The providers that would be asked, in order, for the choice as it stands. Empty means writing down is off. */
  order: TranscriptionProviderId[];
  providers: TranscriptionProviderStatus[];
}

/*
 * WRITING DOWN A STORED RECORDING (the lead, 17 Nov 2026: "Transcribe them!
 * They've personally consented with me."). On Admin's applications panel and
 * the deciders' page, "Write down the words" beside each kept recording and
 * clip, and "Transcribe all waiting" on the panel. The words are saved with the
 * application, marked as an AI transcript, and go with the recording when it
 * goes (shared/voiceNotes.ts `written`).
 *
 *   POST /api/admin/open-proposals/:id/voice/:noteId/transcribe             -> { written }
 *   POST /api/governance/open-proposals/:id/voice/:noteId/transcribe        -> { written }
 *   POST /api/admin/open-proposals/voice/transcribe-waiting                 -> { started, waiting }
 */
export const voiceTranscribeAdminHref = (proposalId: string, noteId: string): string =>
  `/api/admin/open-proposals/${encodeURIComponent(proposalId)}/voice/${encodeURIComponent(noteId)}/transcribe`;
export const voiceTranscribeDeciderHref = (proposalId: string, noteId: string): string =>
  `/api/governance/open-proposals/${encodeURIComponent(proposalId)}/voice/${encodeURIComponent(noteId)}/transcribe`;
export const VOICE_TRANSCRIBE_WAITING_PATH = "/api/admin/open-proposals/voice/transcribe-waiting";

/** Stored recordings one person may have written down in an hour. */
export const VOICE_TRANSCRIBE_STORED_PER_HOUR = 40;
/** Stored recordings written down for the whole village in a day, apart from the applicants' own 60. */
export const VOICE_TRANSCRIBE_STORED_PER_DAY = 150;
/** The most recordings one "Transcribe all waiting" run takes on. */
export const VOICE_TRANSCRIBE_WAITING_MAX = 40;

export const STORED_TRANSCRIBE_WORDS = {
  tooMany: "That's a lot of recordings written down in an hour. Try again later.",
  dayFull: "The village has written down as many recordings as it may today. Try again tomorrow.",
  running: "Recordings are already being written down. They appear here as each one finishes.",
  unavailable: "We couldn't write this recording down just now. The recording is still kept. Try again in a moment.",
  off: "Writing recordings down isn't switched on. An admin can switch it on under Integrations.",
  heardNothing: "The service heard no words in this recording.",
} as const;
